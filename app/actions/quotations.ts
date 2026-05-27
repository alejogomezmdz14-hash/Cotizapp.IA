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
  getWhatsAppSharePhoneState,
  normalizeQuotationStatus,
  parseQuotationFormData,
  persistDraftQuotation,
  publishQuotationSharePdfForUser,
  sanitizeDraftQuotationItems,
} from "@/lib/quotations";
import { buildSharedQuotationPdfPath } from "@/lib/storage/paths";
import { removeFile, STORAGE_BUCKETS } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";
import type { QuotationAttachment } from "@/types";

const EDITABLE_QUOTATION_STATUSES = new Set([
  "draft",
  "pending",
  "accepted",
  "rejected",
]);

function revalidateQuotationViews() {
  revalidatePath("/cotizaciones");
  revalidatePath("/dashboard");
  revalidatePath("/cotizaciones/nueva");
  revalidatePath("/perfil-empresa");
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
      throw new Error("No se pudieron validar los ítems del catálogo de la cotización.");
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
          throw new Error("No se pudo crear el cliente de la cotización.");
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
          throw new Error("No se pudo guardar la cotización borrador.");
        }

        return data;
      },
      createQuotationItems: async (quotationId, items) => {
        const { error } = await supabase
          .from("quotation_items")
          .insert(buildQuotationItemInsertRows(quotationId, items));

        if (error) {
          throw new Error("No se pudieron guardar los ítems de la cotización.");
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
          throw new Error("No se pudo revertir la cotización borrador.");
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
            "No se pudo eliminar el cliente temporal creado para la cotización.",
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
                throw new Error("No se pudo validar la cotización del adjunto.");
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

export async function getQuotationWhatsappRecipientAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: quotationData, error: quotationError } = await supabase
    .from("quotations")
    .select("id, client_id")
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quotationError || !quotationData) {
    throw new Error("No se pudo cargar el cliente de la cotización.");
  }

  if (!quotationData.client_id) {
    return {
      clientPhone: null,
    };
  }

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("phone")
    .eq("id", quotationData.client_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (clientError) {
    throw new Error("No se pudo cargar el teléfono del cliente.");
  }

  return {
    clientPhone: clientData?.phone ?? null,
  };
}

export async function saveQuotationClientPhoneAction(
  quotationId: string,
  phone: string,
) {
  const user = await requireUser();
  const normalizedPhoneInput = phone.trim();
  const phoneState = getWhatsAppSharePhoneState(normalizedPhoneInput);

  if (!normalizedPhoneInput || !phoneState.normalizedPhone) {
    throw new Error("Ingresa un teléfono válido antes de compartir por WhatsApp.");
  }

  const supabase = await createClient();
  const { data: quotationData, error: quotationError } = await supabase
    .from("quotations")
    .select("client_id")
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quotationError || !quotationData) {
    throw new Error("No se pudo cargar la cotización para actualizar el teléfono.");
  }

  if (!quotationData.client_id) {
    throw new Error("La cotización no tiene un cliente asociado para guardar el teléfono.");
  }

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .update({
      phone: normalizedPhoneInput,
    })
    .eq("id", quotationData.client_id)
    .eq("user_id", user.id)
    .select("phone")
    .maybeSingle();

  if (clientError || !clientData) {
    throw new Error("No se pudo guardar el teléfono del cliente.");
  }

  return {
    clientPhone: clientData.phone ?? normalizedPhoneInput,
  };
}

export async function updateQuotationStatusAction(
  quotationId: string,
  nextStatus: string,
) {
  const user = await requireUser();
  const normalizedStatus = normalizeQuotationStatus(nextStatus);

  if (!normalizedStatus || !EDITABLE_QUOTATION_STATUSES.has(normalizedStatus)) {
    throw new Error("Selecciona un estado válido para la cotización.");
  }

  const supabase = await createClient();
  const { data: quotationData, error: quotationError } = await supabase
    .from("quotations")
    .select("id, sent_at")
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quotationError || !quotationData) {
    throw new Error("No se pudo cargar la cotización para actualizar el estado.");
  }

  const sentAt =
    normalizedStatus === "draft"
      ? null
      : quotationData.sent_at ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("quotations")
    .update({
      status: normalizedStatus,
      sent_at: sentAt,
    })
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .select("id, status, sent_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se pudo actualizar el estado de la cotización.");
  }

  revalidateQuotationViews();

  return {
    status: normalizeQuotationStatus(data.status),
    sentAt: data.sent_at ?? null,
  };
}

export async function duplicateQuotationAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: quotationData, error: quotationError } = await supabase
    .from("quotations")
    .select(
      "id, client_id, client_name, notes, subtotal, tax_rate, total, valid_until",
    )
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quotationError || !quotationData) {
    throw new Error("No se pudo cargar la cotización a duplicar.");
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("quotation_items")
    .select("catalog_item_id, name, description, quantity, unit, unit_price")
    .eq("quotation_id", quotationId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (itemsError) {
    throw new Error("No se pudieron cargar los ítems para duplicar la cotización.");
  }

  const duplicatedItems = (itemRows ?? []).map((item) => ({
    catalogItemId: item.catalog_item_id,
    name: item.name,
    description: item.description,
    quantity: Number(item.quantity ?? 0),
    unit: item.unit,
    unitPrice: Number(item.unit_price ?? 0),
  }));

  if (duplicatedItems.length === 0) {
    throw new Error("La cotización no tiene ítems para duplicar.");
  }

  const totals = calculateQuotationTotals(
    duplicatedItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    Number(quotationData.tax_rate ?? 0),
  );
  const { data: duplicatedQuotation, error: duplicateError } = await supabase
    .from("quotations")
    .insert({
      user_id: user.id,
      client_id: quotationData.client_id,
      client_name: quotationData.client_name,
      number: buildQuotationNumber(),
      status: DRAFT_QUOTATION_STATUS,
      notes: quotationData.notes,
      subtotal: totals.subtotal,
      tax_rate: Number(quotationData.tax_rate ?? 0),
      total: totals.total,
      valid_until: quotationData.valid_until,
      pdf_path: null,
      pdf_generated_at: null,
      share_token: null,
      sent_at: null,
    })
    .select("id, number")
    .single();

  if (duplicateError || !duplicatedQuotation) {
    throw new Error("No se pudo duplicar la cotización.");
  }

  const { error: duplicatedItemsError } = await supabase
    .from("quotation_items")
    .insert(buildQuotationItemInsertRows(duplicatedQuotation.id, duplicatedItems));

  if (duplicatedItemsError) {
    await supabase
      .from("quotations")
      .delete()
      .eq("id", duplicatedQuotation.id)
      .eq("user_id", user.id);
    throw new Error("No se pudieron duplicar los ítems de la cotización.");
  }

  revalidateQuotationViews();

  return {
    quotationId: duplicatedQuotation.id,
    number: duplicatedQuotation.number,
  };
}

export async function deleteQuotationAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const [quotationResult, attachmentsResult] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, pdf_path, share_token")
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("quotation_attachments")
      .select("file_path")
      .eq("quotation_id", quotationId)
      .eq("user_id", user.id),
  ]);

  if (quotationResult.error || !quotationResult.data) {
    throw new Error("No se pudo cargar la cotización a eliminar.");
  }

  if (attachmentsResult.error) {
    throw new Error("No se pudieron cargar los adjuntos de la cotización.");
  }

  const { data, error } = await supabase
    .from("quotations")
    .delete()
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .select("id");

  if (error || (data?.length ?? 0) !== 1) {
    throw new Error("No se pudo eliminar la cotización.");
  }

  const cleanupTasks = (attachmentsResult.data ?? []).map((attachment) =>
    removeFile(STORAGE_BUCKETS.quotationAttachments, attachment.file_path).catch(
      () => undefined,
    ),
  );

  if (quotationResult.data.pdf_path) {
    cleanupTasks.push(
      removeFile(STORAGE_BUCKETS.quotationPdfs, quotationResult.data.pdf_path).catch(
        () => undefined,
      ),
    );
  }

  if (quotationResult.data.share_token) {
    cleanupTasks.push(
      removeFile(
        STORAGE_BUCKETS.quotationSharePdfs,
        buildSharedQuotationPdfPath(user.id, quotationResult.data.share_token),
      ).catch(() => undefined),
    );
  }

  await Promise.allSettled(cleanupTasks);
  revalidateQuotationViews();
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
          throw new Error("No se pudo cargar la cotización para compartir.");
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
            throw new Error("No se pudo cargar el teléfono del cliente.");
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
          throw new Error("No se pudo guardar el estado de envío de la cotización.");
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
