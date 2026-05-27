"use server";

import { revalidatePath } from "next/cache";

import { buildPublicAppPath } from "@/lib/app-url";
import { formatCurrencyAmount, formatDateOnly } from "@/lib/formatting";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import { getProfile, requireUser } from "@/lib/profile";
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";
import { buildQuotationWhatsAppShareMessage } from "@/lib/whatsapp";
import { reserveNextQuotationNumber } from "@/app/actions/quotation-number";
import {
  assertDraftQuotationMutationAllowed,
  assertSingleQuotationRollbackMutation,
  buildQuotationItemInsertRows,
  confirmQuotationWhatsappShare,
  DRAFT_QUOTATION_STATUS,
  deleteQuotationAttachmentWithCleanup,
  isDraftQuotationStatus,
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

function revalidateQuotationViews(quotationId?: string) {
  revalidatePath("/cotizaciones");
  revalidatePath("/dashboard");
  revalidatePath("/cotizaciones/nueva");
  revalidatePath("/perfil-empresa");
  revalidatePath("/facturas");

  if (quotationId) {
    revalidatePath(`/cotizaciones/${quotationId}`);
  }
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
      quotationNumber: await reserveNextQuotationNumber(),
      subtotal: totals.subtotal,
      total: totals.total,
    },
  );

  revalidateQuotationViews();

  return result;
}

export async function updateDraftQuotationAction(formData: FormData) {
  const user = await requireUser();
  const quotationId = formData.get("quotation_id");

  if (typeof quotationId !== "string" || !quotationId.trim()) {
    throw new Error("No se pudo identificar la cotización a editar.");
  }

  const values = parseQuotationFormData(formData);
  const supabase = await createClient();
  const { data: existingQuotation, error: existingError } = await supabase
    .from("quotations")
    .select("id, status")
    .eq("id", quotationId.trim())
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError || !existingQuotation) {
    throw new Error("La cotización no existe o no te pertenece.");
  }

  if (!isDraftQuotationStatus(existingQuotation.status)) {
    throw new Error("Solo podés editar cotizaciones en borrador.");
  }

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

  let clientId = sanitizedValues.clientId;
  let clientName = sanitizedValues.inlineClient?.name ?? null;

  if (sanitizedValues.inlineClient) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        user_id: user.id,
        ...sanitizedValues.inlineClient,
      })
      .select("id, name")
      .single();

    if (error || !data) {
      throw new Error("No se pudo crear el cliente de la cotización.");
    }

    clientId = data.id;
    clientName = data.name;
  } else if (clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      throw new Error("El cliente seleccionado no existe o no te pertenece.");
    }

    clientName = data.name;
  }

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      client_id: clientId,
      client_name: clientName,
      notes: sanitizedValues.notes,
      subtotal: totals.subtotal,
      tax_rate: sanitizedValues.taxRate,
      total: totals.total,
      valid_until: sanitizedValues.validUntil,
    })
    .eq("id", quotationId.trim())
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error("No se pudo actualizar la cotización borrador.");
  }

  const { error: deleteItemsError } = await supabase
    .from("quotation_items")
    .delete()
    .eq("quotation_id", quotationId.trim());

  if (deleteItemsError) {
    throw new Error("No se pudieron reemplazar los ítems de la cotización.");
  }

  const { error: insertItemsError } = await supabase
    .from("quotation_items")
    .insert(buildQuotationItemInsertRows(quotationId.trim(), sanitizedValues.items));

  if (insertItemsError) {
    throw new Error("No se pudieron guardar los ítems actualizados.");
  }

  const { data: updatedQuotation, error: reloadError } = await supabase
    .from("quotations")
    .select("id, number")
    .eq("id", quotationId.trim())
    .eq("user_id", user.id)
    .single();

  if (reloadError || !updatedQuotation) {
    throw new Error("La cotización se actualizó pero no se pudo recargar.");
  }

  revalidateQuotationViews(quotationId.trim());

  return {
    quotationId: updatedQuotation.id,
    number: updatedQuotation.number,
  };
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

  const nowIso = new Date().toISOString();
  const sentAt =
    normalizedStatus === "draft"
      ? null
      : quotationData.sent_at ?? nowIso;
  const { data, error } = await supabase
    .from("quotations")
    .update({
      status: normalizedStatus,
      sent_at: sentAt,
      accepted_at: normalizedStatus === "accepted" ? nowIso : null,
      rejected_at: normalizedStatus === "rejected" ? nowIso : null,
    })
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .select("id, status, sent_at, accepted_at, rejected_at")
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
      number: await reserveNextQuotationNumber(),
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

export async function toggleQuotationPaidAction(
  quotationId: string,
  paid: boolean,
) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .update({
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .select("id, paid_at")
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se pudo actualizar el estado de pago.");
  }

  revalidateQuotationViews(quotationId);

  return {
    paidAt: data.paid_at ?? null,
  };
}

export async function saveQuotationSignaturePathAction(
  quotationId: string,
  signaturePath: string | null,
) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .update({
      signature_url: signaturePath,
    })
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .select("id, signature_url")
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se pudo guardar la firma.");
  }

  revalidateQuotationViews(quotationId);

  const { generateQuotationPdfForUser } = await import("@/lib/quotations");
  await generateQuotationPdfForUser(user.id, quotationId).catch(() => undefined);

  return {
    signatureUrl: data.signature_url ?? null,
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
  let shareMessageContext: {
    clientName: string | null;
    total: number;
    validUntil: string | null;
  } | null = null;

  const result = await confirmQuotationWhatsappShare(
    {
      getQuotation: async (targetQuotationId) => {
        const { data, error } = await supabase
          .from("quotations")
          .select(
            "id, number, status, pdf_path, share_token, sent_at, client_id, client_name, total, valid_until",
          )
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
        let linkedClientName: string | null = null;

        if (data.client_id) {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("phone, name")
            .eq("id", data.client_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (clientError) {
            throw new Error("No se pudo cargar el teléfono del cliente.");
          }

          clientPhone = clientData?.phone ?? null;
          linkedClientName = clientData?.name ?? null;
        }

        const clientName =
          typeof data.client_name === "string" && data.client_name.trim()
            ? data.client_name.trim()
            : linkedClientName?.trim() || null;
        const total =
          typeof data.total === "number"
            ? data.total
            : Number(data.total ?? 0) || 0;

        shareMessageContext = {
          clientName,
          total,
          validUntil:
            typeof data.valid_until === "string" ? data.valid_until : null,
        };

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

  const profile = await getProfile(user.id);
  const shareUrl = buildPublicAppPath(result.sharePath);
  const messageContext = shareMessageContext ?? {
    clientName: null,
    total: 0,
    validUntil: null,
  };
  const whatsappText = buildQuotationWhatsAppShareMessage({
    clientName: messageContext.clientName,
    businessName: profile?.business_name?.trim() || "Cotizapp",
    quotationNumber: result.quotationNumber,
    totalLabel: formatCurrencyAmount(
      messageContext.total,
      profile?.currency ?? "ARS",
    ),
    validUntilLabel: formatDateOnly(
      sanitizeQuotationValidityDate(messageContext.validUntil),
    ),
    shareUrl,
  });

  return {
    ...result,
    shareUrl,
    whatsappText,
  };
}
