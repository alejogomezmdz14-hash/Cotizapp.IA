"use server";

import { revalidatePath } from "next/cache";

import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import { requireUser } from "@/lib/profile";
import {
  assertDraftQuotationMutationAllowed,
  assertSingleQuotationRollbackMutation,
  buildQuotationItemInsertRows,
  buildQuotationNumber,
  confirmQuotationWhatsappShare,
  DRAFT_QUOTATION_STATUS,
  deleteQuotationAttachmentWithCleanup,
  generateQuotationPdfForUser,
  normalizeQuotationStatus,
  parseQuotationFormData,
  persistDraftQuotation,
  publishQuotationSharePdfForUser,
  sanitizeDraftQuotationItems,
} from "@/lib/quotations";
import { removeFile, STORAGE_BUCKETS } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";
import type { QuotationAttachment } from "@/types";

function revalidateQuotationViews() {
  revalidatePath("/cotizaciones");
  revalidatePath("/dashboard");
  revalidatePath("/cotizaciones/nueva");
}

export async function createDraftQuotationAction(formData: FormData) {
  const user = await requireUser();
  const values = parseQuotationFormData(formData);
  const supabase = await createClient();
  const requestedCatalogItemIds = Array.from(
    new Set(
      values.items.flatMap((item) =>
        item.catalogItemId ? [item.catalogItemId] : [],
      ),
    ),
  );
  const ownedCatalogItemIds = new Set<string>();

  if (requestedCatalogItemIds.length > 0) {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("user_id", user.id)
      .in("id", requestedCatalogItemIds);

    if (error) {
      throw new Error("No se pudieron validar los items del catalogo de la cotizacion.");
    }

    for (const row of (data ?? []) as Array<{ id: string }>) {
      ownedCatalogItemIds.add(row.id);
    }
  }

  const sanitizedValues = {
    ...values,
    items: sanitizeDraftQuotationItems(values.items, ownedCatalogItemIds),
  };
  const totals = calculateQuotationTotals(sanitizedValues.items, sanitizedValues.taxRate);
  const result = await persistDraftQuotation(
    {
      createInlineClient: async (inlineClient) => {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            user_id: user.id,
            ...inlineClient,
          })
          .select("id, name")
          .single();

        if (error || !data) {
          throw new Error("No se pudo crear el cliente de la cotizacion.");
        }

        return data;
      },
      getExistingClient: async (clientId) => {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", clientId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo validar el cliente seleccionado.");
        }

        return data;
      },
      createQuotation: async ({
        clientId,
        clientName,
        quotationNumber,
        notes,
        subtotal,
        taxRate,
        total,
        validUntil,
      }) => {
        const { data, error } = await supabase
          .from("quotations")
          .insert({
            user_id: user.id,
            client_id: clientId,
            client_name: clientName,
            number: quotationNumber,
            status: DRAFT_QUOTATION_STATUS,
            notes,
            subtotal,
            tax_rate: taxRate,
            total,
            valid_until: validUntil,
          })
          .select("id, number")
          .single();

        if (error || !data) {
          throw new Error("No se pudo guardar la cotizacion borrador.");
        }

        return data;
      },
      createQuotationItems: async (quotationId, items) => {
        const { error } = await supabase
          .from("quotation_items")
          .insert(buildQuotationItemInsertRows(quotationId, items));

        if (error) {
          throw new Error("No se pudieron guardar los items de la cotizacion.");
        }
      },
      deleteQuotation: async (quotationId) => {
        const { data, error } = await supabase
          .from("quotations")
          .delete()
          .eq("id", quotationId)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          throw new Error("No se pudo revertir la cotizacion borrador.");
        }

        assertSingleQuotationRollbackMutation(data, "quotation");
      },
      deleteClient: async (clientId) => {
        const { data, error } = await supabase
          .from("clients")
          .delete()
          .eq("id", clientId)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          throw new Error(
            "No se pudo eliminar el cliente temporal creado para la cotizacion.",
          );
        }

        assertSingleQuotationRollbackMutation(data, "client");
      },
    },
    {
      values: sanitizedValues,
      quotationNumber: buildQuotationNumber(),
      subtotal: totals.subtotal,
      total: totals.total,
    },
  );

  revalidateQuotationViews();

  return result;
}

export async function deleteQuotationAttachmentAction(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await deleteQuotationAttachmentWithCleanup(
    {
      getAttachment: async (attachmentId) => {
        const { data, error } = await supabase
          .from("quotation_attachments")
          .select("*")
          .eq("id", attachmentId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo cargar el adjunto.");
        }

        return (data as QuotationAttachment | null) ?? null;
      },
      assertCanMutateQuotation: async (quotationId) => {
        await assertDraftQuotationMutationAllowed(
          {
            getDraftQuotation: async (draftQuotationId) => {
              const { data, error } = await supabase
                .from("quotations")
                .select("id")
                .eq("id", draftQuotationId)
                .eq("user_id", user.id)
                .eq("status", DRAFT_QUOTATION_STATUS)
                .maybeSingle();

              if (error) {
                throw new Error("No se pudo validar la cotizacion del adjunto.");
              }

              return data;
            },
          },
          quotationId,
        );
      },
      deleteAttachmentRecord: async (attachmentId) => {
        const { data, error } = await supabase
          .from("quotation_attachments")
          .delete()
          .eq("id", attachmentId)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          throw new Error("No se pudo eliminar el adjunto.");
        }

        if ((data?.length ?? 0) !== 1) {
          throw new Error("El adjunto no existe, no te pertenece o ya fue eliminado.");
        }
      },
      removeAttachmentFile: async (path) => {
        await removeFile(STORAGE_BUCKETS.quotationAttachments, path);
      },
    },
    id,
  );

  revalidateQuotationViews();
}

export async function generateQuotationPdfAction(quotationId: string) {
  const user = await requireUser();
  const result = await generateQuotationPdfForUser(user.id, quotationId);

  if (result.shareToken) {
    await publishQuotationSharePdfForUser(
      user.id,
      quotationId,
      result.shareToken,
    );
  }

  revalidateQuotationViews();

  return {
    fileName: result.fileName,
    path: result.path,
    generatedAt: result.generatedAt,
  };
}

export async function confirmQuotationWhatsappShareAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const result = await confirmQuotationWhatsappShare(
    {
      getQuotation: async (targetQuotationId) => {
        const { data, error } = await supabase
          .from("quotations")
          .select("id, number, status, pdf_path, share_token, sent_at, client_id")
          .eq("id", targetQuotationId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo cargar la cotizacion para compartir.");
        }

        if (!data) {
          return null;
        }

        let clientPhone: string | null = null;

        if (data.client_id) {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("phone")
            .eq("id", data.client_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (clientError) {
            throw new Error("No se pudo cargar el telefono del cliente.");
          }

          clientPhone = clientData?.phone ?? null;
        }

        return {
          id: data.id,
          number: data.number,
          status: normalizeQuotationStatus(data.status),
          pdfPath: data.pdf_path,
          shareToken: data.share_token,
          sentAt: data.sent_at,
          clientPhone,
        };
      },
      persistShareState: async (values) => {
        const { data, error } = await supabase
          .from("quotations")
          .update({
            share_token: values.shareToken,
            status: values.status,
            sent_at: values.sentAt,
          })
          .eq("id", quotationId)
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();

        if (error || !data) {
          throw new Error("No se pudo guardar el estado de envio de la cotizacion.");
        }
      },
    },
    {
      quotationId,
    },
  );

  await publishQuotationSharePdfForUser(
    user.id,
    quotationId,
    result.shareToken,
  );

  revalidateQuotationViews();

  return result;
}
