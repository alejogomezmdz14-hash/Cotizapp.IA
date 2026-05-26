"use server";

import { revalidatePath } from "next/cache";

import {
  calculateQuotationLineTotal,
  calculateQuotationTotals,
} from "@/lib/quotation-calculations";
import { requireUser } from "@/lib/profile";
import {
  assertDraftQuotationMutationAllowed,
  assertSingleQuotationRollbackMutation,
  buildQuotationNumber,
  deleteQuotationAttachmentWithCleanup,
  parseQuotationFormData,
  persistDraftQuotation,
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
  const totals = calculateQuotationTotals(values.items, values.taxRate);
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
            status: "draft",
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
        const { error } = await supabase.from("quotation_items").insert(
          items.map((item) => ({
            quotation_id: quotationId,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unitPrice,
            total: calculateQuotationLineTotal(item.quantity, item.unitPrice),
          })),
        );

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
      values,
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
                .eq("status", "draft")
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
