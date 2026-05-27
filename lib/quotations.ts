import { renderToBuffer } from "@react-pdf/renderer";

import {
  buildQuotationPdfTemplateData,
  createQuotationPdfDocument,
  type QuotationPdfTemplateData,
} from "@/components/cotizacion/quotation-pdf-template";
import { normalizeCatalogUnit } from "@/lib/catalog";
import { normalizeEntityName } from "@/lib/entity-normalization";
import { buildProfileLogoDataUrl, resolveProfileBranding } from "@/lib/profile";
import { calculateQuotationLineTotal } from "@/lib/quotation-calculations";
import { getDefaultQuotationValidityDate } from "@/lib/quotation-expiry";
import {
  sanitizeQuotationValidityDate,
  validateQuotationValidityDate,
  normalizeDateOnlyString,
} from "@/lib/quotation-validity";
import {
  buildSharedQuotationPdfPath,
  buildQuotationPdfFileName,
  buildQuotationPdfPath,
} from "@/lib/storage/paths";
import {
  canHydrateQuotationEditorStatus,
  DRAFT_QUOTATION_STATUS,
  normalizeQuotationStatus,
} from "@/lib/quotation-status";
import {
  downloadFile,
  removeFile,
  STORAGE_BUCKETS,
  uploadFile,
} from "@/lib/storage/server";
import {
  fetchUserQuotationById,
  fetchUserQuotations,
} from "@/lib/quotation-select";
import { createClient } from "@/lib/supabase/server";
import {
  normalizePhoneForWhatsApp,
} from "@/lib/whatsapp";
import type {
  Client,
  HydratedQuotation,
  HydratedQuotationAttachment,
  Profile,
  Quotation,
  QuotationAttachment,
  QuotationItem,
  QuotationStatus,
} from "@/types";

type QuotationRow = Omit<Quotation, "status" | "subtotal" | "tax_rate" | "total"> & {
  status: string | null;
  subtotal: number | string | null;
  tax_rate: number | string | null;
  total: number | string | null;
};

type QuotationItemRow = Omit<QuotationItem, "position" | "quantity" | "unit_price" | "total"> & {
  position: number | string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  total: number | string | null;
};

type QuotationMutationRow = {
  id: string;
};

type QuotationRollbackEntity = "quotation" | "client";

type QuotationItemInsertRow = {
  quotation_id: string;
  position: number;
  catalog_item_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
};

export type DraftQuotationClientInput = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type DraftQuotationItemInput = {
  catalogItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type ParsedQuotationFormData = {
  clientId: string | null;
  inlineClient: DraftQuotationClientInput | null;
  notes: string | null;
  taxRate: number;
  validUntil: string | null;
  items: DraftQuotationItemInput[];
};

type DraftQuotationClientRecord = {
  id: string;
  name: string;
};

type DraftQuotationRecord = {
  id: string;
  number: string;
};

type PersistDraftQuotationDependencies = {
  createInlineClient: (
    input: DraftQuotationClientInput,
  ) => Promise<DraftQuotationClientRecord>;
  getExistingClient: (
    clientId: string,
  ) => Promise<DraftQuotationClientRecord | null>;
  createQuotation: (input: {
    clientId: string | null;
    clientName: string | null;
    quotationNumber: string;
    notes: string | null;
    subtotal: number;
    taxRate: number;
    total: number;
    validUntil: string | null;
  }) => Promise<DraftQuotationRecord>;
  createQuotationItems: (
    quotationId: string,
    items: DraftQuotationItemInput[],
  ) => Promise<void>;
  deleteQuotation: (quotationId: string) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
};

type PersistDraftQuotationInput = {
  values: ParsedQuotationFormData;
  quotationNumber: string;
  subtotal: number;
  total: number;
};

type DeleteQuotationAttachmentDependencies = {
  getAttachment: (id: string) => Promise<QuotationAttachment | null>;
  assertCanMutateQuotation: (quotationId: string) => Promise<void>;
  removeAttachmentFile: (path: string) => Promise<void>;
  deleteAttachmentRecord: (id: string) => Promise<void>;
};

type HydrateQuotationAttachmentsDependencies = {
  listAttachments: () => Promise<QuotationAttachment[]>;
  createSignedUrl: (path: string) => Promise<string | null>;
};

type LoadDraftQuotationHydrationContextDependencies = {
  getDraftQuotation: () => Promise<
    Pick<
      Quotation,
      "id" | "number" | "status" | "pdf_generated_at" | "share_token" | "sent_at"
    > | null
  >;
  getAttachments: () => Promise<HydratedQuotationAttachment[]>;
};

type HydrateCompleteQuotationDependencies = {
  getQuotation: () => Promise<QuotationRow | null>;
  getProfile: () => Promise<Profile | null>;
  getClient: (clientId: string) => Promise<Client | null>;
  getItems: () => Promise<QuotationItemRow[]>;
  createSignedLogoUrl: (path: string) => Promise<string | null>;
};

type GenerateAndStoreQuotationPdfDependencies = {
  getHydratedQuotation: () => Promise<HydratedQuotation | null>;
  resolveLogoDataUrl: (quotation: HydratedQuotation) => Promise<string | null>;
  resolveSignatureDataUrl?: (
    quotation: HydratedQuotation,
  ) => Promise<string | null>;
  renderPdf: (templateData: QuotationPdfTemplateData) => Promise<Uint8Array>;
  uploadPdf: (input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }) => Promise<void>;
  updateOutput: (values: {
    pdfPath: string;
    pdfGeneratedAt: string;
  }) => Promise<void>;
  removeUploadedPdf: (path: string) => Promise<void>;
};

type GetStoredQuotationPdfDependencies = {
  getHydratedQuotation: () => Promise<HydratedQuotation | null>;
  downloadPdf: (path: string) => Promise<Uint8Array>;
};

type ConfirmQuotationWhatsappShareDependencies = {
  getQuotation: (quotationId: string) => Promise<{
    id: string;
    number: string;
    status: QuotationStatus | null;
    pdfPath: string | null;
    shareToken: string | null;
    sentAt: string | null;
    clientPhone: string | null;
  } | null>;
  persistShareState: (values: {
    shareToken: string;
    status: QuotationStatus;
    sentAt: string;
  }) => Promise<void>;
  createShareToken?: () => string;
};

type GetSharedQuotationPdfDependencies = {
  getSharedQuotation: (shareToken: string) => Promise<{
    number: string;
    pdfPath: string | null;
    pdfGeneratedAt: string | null;
  } | null>;
  downloadPdf: (path: string) => Promise<Uint8Array>;
};

type PublishQuotationSharePdfDependencies = {
  getStoredPdf: () => Promise<{
    fileName: string;
    bytes: Uint8Array;
  }>;
  uploadSharedPdf: (input: {
    path: string;
    body: Uint8Array;
    contentType: string;
    upsert: boolean;
  }) => Promise<void>;
};

type DraftQuotationMutationDependencies = {
  getDraftQuotation: (
    quotationId: string,
  ) => Promise<Pick<Quotation, "id"> | null>;
};

type RollbackUploadedQuotationAttachmentsDependencies = {
  deleteAttachmentRecord: (attachmentId: string) => Promise<void>;
  removeAttachmentFile: (filePath: string) => Promise<void>;
};

export {
  canHydrateQuotationEditorStatus,
  DRAFT_QUOTATION_STATUS,
  isDraftQuotationStatus,
  normalizeQuotationStatus,
} from "@/lib/quotation-status";
export { buildWhatsAppShareHref, getWhatsAppSharePhoneState } from "@/lib/whatsapp";

function normalizeAmount(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function getStringValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalStringValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeDecimalInput(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }

  if (typeof value !== "string") {
    return "";
  }

  const compactValue = value.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return "";
  }

  if (!/^\d+(?:[.,]\d+)?$/.test(compactValue)) {
    return null;
  }

  return compactValue.replace(",", ".");
}

function parsePositiveDecimal(value: unknown) {
  const normalizedValue = normalizeDecimalInput(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function parseNonNegativeDecimal(value: unknown) {
  const normalizedValue = normalizeDecimalInput(value);

  if (normalizedValue === "") {
    return 0;
  }

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function parseInlineClientPayload(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error("Completa los datos del cliente antes de guardar la cotización.");
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const name = getOptionalStringValue(parsedValue.name);

    if (!name) {
      throw new Error("Completa los datos del cliente antes de guardar la cotización.");
    }

    return {
      name: normalizeEntityName(name),
      email: getOptionalStringValue(parsedValue.email),
      phone: getOptionalStringValue(parsedValue.phone),
      address: getOptionalStringValue(parsedValue.address),
    };
  } catch {
    throw new Error("Completa los datos del cliente antes de guardar la cotización.");
  }
}

function parseItemsPayload(rawValue: FormDataEntryValue | null) {
  const validationMessages = new Set([
    "Agrega al menos un ítem a la cotización antes de guardarla.",
    "Cada ítem necesita un concepto, una cantidad válida y un precio válido.",
  ]);

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error("Agrega al menos un ítem a la cotización antes de guardarla.");
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Array<Record<string, unknown>>;

    if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
      throw new Error("Agrega al menos un ítem a la cotización antes de guardarla.");
    }

    return parsedValue.map((item) => {
      const name = getOptionalStringValue(item.name);
      const quantity = parsePositiveDecimal(item.quantity);
      const unitPrice = parsePositiveDecimal(item.unitPrice);

      if (!name || quantity === null || unitPrice === null) {
        throw new Error(
          "Cada ítem necesita un concepto, una cantidad válida y un precio válido.",
        );
      }

      return {
        catalogItemId: getOptionalStringValue(item.catalogItemId),
        name: normalizeEntityName(name),
        description: getOptionalStringValue(item.description),
        quantity,
        unit: normalizeCatalogUnit(getOptionalStringValue(item.unit)),
        unitPrice,
      };
    });
  } catch (error) {
    if (error instanceof Error && validationMessages.has(error.message)) {
      throw error;
    }

    throw new Error("No se pudieron leer los ítems de la cotización.");
  }
}

function parseTaxRate(formData: FormData) {
  const parsedValue = parseNonNegativeDecimal(getStringValue(formData, "tax_rate"));

  if (parsedValue === null) {
    throw new Error("Ingresa una tasa de impuesto válida.");
  }

  return parsedValue;
}

function parseValidUntil(
  formData: FormData,
  options?: {
    now?: Date;
  },
) {
  const value = getStringValue(formData, "valid_until");

  if (!value) {
    return getDefaultQuotationValidityDate(options?.now);
  }

  const validityState = validateQuotationValidityDate(
    value,
    options,
  );

  if (!validityState.valid) {
    if (validityState.reason === "past") {
      throw new Error("La fecha de validez no puede estar en el pasado.");
    }

    if (validityState.reason === "too_far") {
      throw new Error("La fecha de validez no puede superar 5 años desde hoy.");
    }

    throw new Error("Ingresa una fecha de validez válida.");
  }

  return normalizeDateOnlyString(value);
}

export function buildQuotationNumber(
  date = new Date(),
  suffix = globalThis.crypto.randomUUID().slice(0, 6),
) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");
  const normalizedSuffix =
    suffix.replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 6) || "000000";

  return `COT-${year}${month}${day}-${hours}${minutes}${seconds}-${normalizedSuffix}`;
}

export function buildQuotationSharePath(shareToken: string) {
  return `/api/quotations/share/${encodeURIComponent(shareToken.trim())}`;
}

function normalizeQuotationRow(quotation: QuotationRow): Quotation {
  return {
    ...quotation,
    status: normalizeQuotationStatus(quotation.status),
    subtotal: normalizeAmount(quotation.subtotal),
    tax_rate: normalizeAmount(quotation.tax_rate),
    total: normalizeAmount(quotation.total),
    valid_until: sanitizeQuotationValidityDate(quotation.valid_until),
  };
}

function normalizeQuotationItemRow(
  item: QuotationItemRow,
): HydratedQuotation["items"][number] {
  return {
    id: item.id,
    quotationId: item.quotation_id,
    position: normalizeAmount(item.position),
    catalogItemId: item.catalog_item_id,
    name: item.name,
    description: item.description,
    quantity: normalizeAmount(item.quantity),
    unit: normalizeCatalogUnit(item.unit),
    unitPrice: normalizeAmount(item.unit_price),
    total: normalizeAmount(item.total),
  };
}

export function buildQuotationItemInsertRows(
  quotationId: string,
  items: DraftQuotationItemInput[],
): QuotationItemInsertRow[] {
  return items.map((item, index) => ({
    quotation_id: quotationId,
    position: index,
    catalog_item_id: item.catalogItemId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    total: calculateQuotationLineTotal(item.quantity, item.unitPrice),
  }));
}

export function sanitizeDraftQuotationItems(
  items: DraftQuotationItemInput[],
  ownedCatalogItemIds: ReadonlySet<string>,
): DraftQuotationItemInput[] {
  return items.map((item) => ({
    ...item,
    catalogItemId:
      item.catalogItemId && ownedCatalogItemIds.has(item.catalogItemId)
        ? item.catalogItemId
        : null,
  }));
}

export function parseQuotationFormData(
  formData: FormData,
  options?: {
    now?: Date;
  },
): ParsedQuotationFormData {
  const clientMode = getStringValue(formData, "client_mode") === "inline"
    ? "inline"
    : "existing";
  const items = parseItemsPayload(formData.get("items_payload"));
  const notes = getOptionalStringValue(formData.get("notes"));
  const taxRate = parseTaxRate(formData);
  const validUntil = parseValidUntil(formData, options);

  if (clientMode === "inline") {
    return {
      clientId: null,
      inlineClient: parseInlineClientPayload(formData.get("client_payload")),
      notes,
      taxRate,
      validUntil,
      items,
    };
  }

  const clientId = getStringValue(formData, "client_id");

  if (!clientId) {
    throw new Error(
      "Selecciona un cliente existente o crea uno nuevo dentro de la cotización.",
    );
  }

  return {
    clientId,
    inlineClient: null,
    notes,
    taxRate,
    validUntil,
    items,
  };
}

export function assertSingleQuotationAttachmentMutation(
  rows: QuotationMutationRow[] | null,
) {
  if ((rows?.length ?? 0) === 1) {
    return;
  }

  throw new Error("El adjunto no existe, no te pertenece o ya fue eliminado.");
}

export function assertSingleQuotationRollbackMutation(
  rows: QuotationMutationRow[] | null,
  entity: QuotationRollbackEntity,
) {
  if ((rows?.length ?? 0) === 1) {
    return;
  }

  if (entity === "quotation") {
    throw new Error("No se pudo revertir la cotización borrador.");
  }

  throw new Error(
    "No se pudo eliminar el cliente temporal creado para la cotización.",
  );
}

export async function assertDraftQuotationMutationAllowed(
  dependencies: DraftQuotationMutationDependencies,
  quotationId: string,
) {
  const quotation = await dependencies.getDraftQuotation(quotationId);

  if (quotation) {
    return quotation;
  }

  throw new Error("La cotización no existe, no te pertenece o ya no se puede modificar.");
}

export async function persistDraftQuotation(
  dependencies: PersistDraftQuotationDependencies,
  input: PersistDraftQuotationInput,
) {
  let createdInlineClientId: string | null = null;
  let createdQuotationId: string | null = null;

  try {
    let clientId = input.values.clientId;
    let clientName = input.values.inlineClient?.name ?? null;

    if (input.values.inlineClient) {
      const inlineClient = await dependencies.createInlineClient(
        input.values.inlineClient,
      );

      createdInlineClientId = inlineClient.id;
      clientId = inlineClient.id;
      clientName = inlineClient.name;
    } else if (clientId) {
      const existingClient = await dependencies.getExistingClient(clientId);

      if (!existingClient) {
        throw new Error("El cliente seleccionado no existe o no te pertenece.");
      }

      clientName = existingClient.name;
    }

    const quotation = await dependencies.createQuotation({
      clientId,
      clientName,
      quotationNumber: input.quotationNumber,
      notes: input.values.notes,
      subtotal: input.subtotal,
      taxRate: input.values.taxRate,
      total: input.total,
      validUntil: input.values.validUntil,
    });

    createdQuotationId = quotation.id;

    await dependencies.createQuotationItems(quotation.id, input.values.items);

    return {
      quotationId: quotation.id,
      number: quotation.number,
    };
  } catch (error) {
    const cleanupErrors: string[] = [];

    if (createdQuotationId) {
      try {
        await dependencies.deleteQuotation(createdQuotationId);
      } catch {
        cleanupErrors.push("cotizacion");
      }
    }

    if (createdInlineClientId) {
      try {
        await dependencies.deleteClient(createdInlineClientId);
      } catch {
        cleanupErrors.push("cliente");
      }
    }

    const baseMessage = getErrorMessage(
      error,
      "No se pudo guardar la cotización borrador.",
    );

    if (cleanupErrors.length === 0) {
      throw new Error(baseMessage);
    }

    throw new Error(
      `${baseMessage} Tambien fallo la limpieza automatica de ${cleanupErrors.join(
        " y ",
      )}.`,
    );
  }
}

export async function deleteQuotationAttachmentWithCleanup(
  dependencies: DeleteQuotationAttachmentDependencies,
  id: string,
) {
  const attachment = await dependencies.getAttachment(id);

  if (!attachment) {
    throw new Error("El adjunto no existe, no te pertenece o ya fue eliminado.");
  }

  await dependencies.assertCanMutateQuotation(attachment.quotation_id);

  try {
    await dependencies.removeAttachmentFile(attachment.file_path);
  } catch {
    throw new Error("No se pudo eliminar el adjunto.");
  }

  await dependencies.deleteAttachmentRecord(id);
}

export async function rollbackUploadedQuotationAttachments(
  dependencies: RollbackUploadedQuotationAttachmentsDependencies,
  input: {
    createdAttachments: Array<{
      id: string;
      filePath: string;
    }>;
    uploadedFilePaths: string[];
  },
) {
  const cleanupErrors: string[] = [];

  for (const attachment of input.createdAttachments) {
    try {
      await dependencies.deleteAttachmentRecord(attachment.id);
    } catch {
      cleanupErrors.push(`registro ${attachment.id}`);
    }
  }

  const uniqueFilePaths = Array.from(
    new Set([
      ...input.uploadedFilePaths,
      ...input.createdAttachments.map((attachment) => attachment.filePath),
    ]),
  );

  for (const filePath of uniqueFilePaths) {
    try {
      await dependencies.removeAttachmentFile(filePath);
    } catch {
      cleanupErrors.push(`archivo ${filePath}`);
    }
  }

  return cleanupErrors;
}

export function formatCleanupFailureMessage(
  baseMessage: string,
  cleanupErrors: string[],
) {
  if (cleanupErrors.length === 0) {
    return baseMessage;
  }

  return `${baseMessage} Tambien fallo la limpieza automatica de ${cleanupErrors.join(
    " y ",
  )}.`;
}

export async function hydrateQuotationAttachments(
  dependencies: HydrateQuotationAttachmentsDependencies,
): Promise<HydratedQuotationAttachment[]> {
  const attachments = await dependencies.listAttachments();

  return Promise.all(
    attachments.map(async (attachment) => ({
      id: attachment.id,
      quotationId: attachment.quotation_id,
      filePath: attachment.file_path,
      fileName: attachment.file_name,
      fileType: attachment.file_type,
      createdAt: attachment.created_at,
      url: await dependencies.createSignedUrl(attachment.file_path),
    })),
  );
}

export { getDraftQuotationEditorHref } from "@/lib/quotation-editor-links";

export async function confirmQuotationWhatsappShare(
  dependencies: ConfirmQuotationWhatsappShareDependencies,
  input: {
    quotationId: string;
    now?: Date;
  },
) {
  const quotation = await dependencies.getQuotation(input.quotationId);

  if (!quotation) {
    throw new Error("La cotización no existe o no te pertenece.");
  }

  if (!quotation.pdfPath) {
    throw new Error("Genera el PDF antes de compartir la cotización.");
  }

  const shareToken =
    quotation.shareToken ??
    dependencies.createShareToken?.() ??
    globalThis.crypto.randomUUID();
  const shareStatus =
    quotation.status && quotation.status !== DRAFT_QUOTATION_STATUS
      ? quotation.status
      : "pending";
  const sentAt = quotation.sentAt ?? (input.now ?? new Date()).toISOString();
  const needsPersistence =
    shareToken !== quotation.shareToken ||
    shareStatus !== quotation.status ||
    sentAt !== quotation.sentAt;

  if (needsPersistence) {
    await dependencies.persistShareState({
      shareToken,
      status: shareStatus,
      sentAt,
    });
  }

  return {
    quotationId: quotation.id,
    quotationNumber: quotation.number,
    shareToken,
    sharePath: buildQuotationSharePath(shareToken),
    shareStatus,
    sentAt,
    clientPhone: normalizePhoneForWhatsApp(quotation.clientPhone),
  };
}

export async function getQuotationDraft(
  userId: string,
  quotationId: string,
): Promise<
  Pick<
    Quotation,
    "id" | "number" | "status" | "pdf_generated_at" | "share_token" | "sent_at"
  > | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number, status, pdf_generated_at, share_token, sent_at")
    .eq("id", quotationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo cargar la cotización.");
  }

  if (!data || !canHydrateQuotationEditorStatus(data.status)) {
    return null;
  }

  return {
    ...data,
    status: normalizeQuotationStatus(data.status),
  };
}

export async function loadDraftQuotationHydrationContext(
  dependencies: LoadDraftQuotationHydrationContextDependencies,
): Promise<{
  draftQuotation: Pick<
    Quotation,
    "id" | "number" | "status" | "pdf_generated_at" | "share_token" | "sent_at"
  > | null;
  attachments: HydratedQuotationAttachment[];
}> {
  const draftQuotation = await dependencies.getDraftQuotation();

  if (!draftQuotation) {
    return {
      draftQuotation: null,
      attachments: [],
    };
  }

  return {
    draftQuotation,
    attachments: await dependencies.getAttachments(),
  };
}

export async function hydrateCompleteQuotation(
  dependencies: HydrateCompleteQuotationDependencies,
): Promise<HydratedQuotation | null> {
  const quotationRecord = await dependencies.getQuotation();

  if (!quotationRecord) {
    return null;
  }

  const [profile, client, items] = await Promise.all([
    dependencies.getProfile(),
    quotationRecord.client_id
      ? dependencies.getClient(quotationRecord.client_id)
      : Promise.resolve(null),
    dependencies.getItems(),
  ]);

  const branding = resolveProfileBranding(profile);
  let logoUrl: string | null = null;

  if (branding.logoPath) {
    try {
      logoUrl = await dependencies.createSignedLogoUrl(branding.logoPath);
    } catch {
      logoUrl = null;
    }
  }

  const quotation = normalizeQuotationRow(quotationRecord);
  const sortedItems = [...items].sort((left, right) => {
    const positionDelta = normalizeAmount(left.position) - normalizeAmount(right.position);

    if (positionDelta !== 0) {
      return positionDelta;
    }

    return left.id.localeCompare(right.id);
  });

  return {
    quotation,
    branding: {
      ...branding,
      logoUrl,
    },
    customer: {
      id: client?.id ?? quotation.client_id,
      name: getOptionalStringValue(client?.name) ?? quotation.client_name,
      email: getOptionalStringValue(client?.email),
      phone: getOptionalStringValue(client?.phone),
      address: getOptionalStringValue(client?.address),
    },
    items: sortedItems.map((item) => normalizeQuotationItemRow(item)),
    output: {
      pdfPath: quotation.pdf_path,
      pdfGeneratedAt: quotation.pdf_generated_at,
      shareToken: quotation.share_token,
      sentAt: quotation.sent_at,
    },
  };
}

export async function generateAndStoreQuotationPdf(
  dependencies: GenerateAndStoreQuotationPdfDependencies,
  input: {
    userId: string;
    quotationId: string;
    now?: Date;
  },
) {
  const quotation = await dependencies.getHydratedQuotation();

  if (!quotation) {
    throw new Error("La cotización no existe o no te pertenece.");
  }

  const generatedAt = (input.now ?? new Date()).toISOString();
  const fileName = buildQuotationPdfFileName(quotation.quotation.number);
  const path = buildQuotationPdfPath(
    input.userId,
    input.quotationId,
    quotation.quotation.number,
  );
  const previousPdfPath = quotation.output.pdfPath;
  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    dependencies.resolveLogoDataUrl(quotation),
    dependencies.resolveSignatureDataUrl
      ? dependencies.resolveSignatureDataUrl(quotation)
      : Promise.resolve(null),
  ]);
  const templateData = buildQuotationPdfTemplateData({
    quotation,
    generatedAt,
    logoDataUrl,
    signatureDataUrl,
  });
  const bytes = await dependencies.renderPdf(templateData);

  await dependencies.uploadPdf({
    path,
    bytes,
    contentType: "application/pdf",
  });

  try {
    await dependencies.updateOutput({
      pdfPath: path,
      pdfGeneratedAt: generatedAt,
    });
  } catch (error) {
    if (!previousPdfPath) {
      await dependencies.removeUploadedPdf(path).catch(() => undefined);
    }

    throw error;
  }

  if (previousPdfPath && previousPdfPath !== path) {
    await dependencies.removeUploadedPdf(previousPdfPath).catch(() => undefined);
  }

  return {
    fileName,
    path,
    generatedAt,
    bytes,
    shareToken: quotation.output.shareToken,
  };
}

export async function generateQuotationPdfForUser(
  userId: string,
  quotationId: string,
) {
  const supabase = await createClient();

  return generateAndStoreQuotationPdf(
    {
      getHydratedQuotation: async () => getHydratedQuotation(userId, quotationId),
      resolveLogoDataUrl: async (quotation) => {
        if (!quotation.branding.logoPath) {
          return null;
        }

        try {
          const logoFile = await downloadFile(
            STORAGE_BUCKETS.businessAssets,
            quotation.branding.logoPath,
          );

          return buildProfileLogoDataUrl(logoFile);
        } catch {
          return null;
        }
      },
      resolveSignatureDataUrl: async (quotation) => {
        const signaturePath = quotation.quotation.signature_url?.trim();

        if (!signaturePath) {
          return null;
        }

        try {
          const signatureFile = await downloadFile(
            STORAGE_BUCKETS.quotationSignatures,
            signaturePath,
          );

          return buildProfileLogoDataUrl(signatureFile);
        } catch {
          return null;
        }
      },
      renderPdf: async (templateData) => {
        const buffer = await renderToBuffer(
          createQuotationPdfDocument(templateData),
        );

        return new Uint8Array(buffer);
      },
      uploadPdf: async ({ path, bytes, contentType }) => {
        await uploadFile({
          bucket: STORAGE_BUCKETS.quotationPdfs,
          path,
          body: bytes,
          contentType,
          upsert: true,
        });
      },
      updateOutput: async ({ pdfPath, pdfGeneratedAt }) => {
        const { data, error } = await supabase
          .from("quotations")
          .update({
            pdf_path: pdfPath,
            pdf_generated_at: pdfGeneratedAt,
          })
          .eq("id", quotationId)
          .eq("user_id", userId)
          .select("id")
          .maybeSingle();

        if (error || !data) {
          throw new Error("No se pudo guardar la ruta del PDF.");
        }
      },
      removeUploadedPdf: async (path) => {
        await removeFile(STORAGE_BUCKETS.quotationPdfs, path);
      },
    },
    {
      userId,
      quotationId,
    },
  );
}

export async function getStoredQuotationPdf(
  dependencies: GetStoredQuotationPdfDependencies,
) {
  const quotation = await dependencies.getHydratedQuotation();

  if (!quotation) {
    throw new Error("La cotización no existe o no te pertenece.");
  }

  const pdfPath = quotation.output.pdfPath;

  if (!pdfPath) {
    throw new Error("El PDF de la cotización aún no fue generado.");
  }

  const fileName =
    pdfPath.split("/").pop() ?? buildQuotationPdfFileName(quotation.quotation.number);

  return {
    fileName,
    generatedAt: quotation.output.pdfGeneratedAt,
    bytes: await dependencies.downloadPdf(pdfPath),
  };
}

export async function getSharedQuotationPdf(
  dependencies: GetSharedQuotationPdfDependencies,
  shareToken: string,
) {
  const normalizedToken = shareToken.trim();

  if (!normalizedToken) {
    throw new Error("Falta indicar qué cotización compartida quieres abrir.");
  }

  const quotation = await dependencies.getSharedQuotation(normalizedToken);

  if (!quotation) {
    throw new Error("La cotización compartida no existe o ya no está disponible.");
  }

  if (!quotation.pdfPath) {
    throw new Error("El PDF de la cotización aún no fue generado.");
  }

  return {
    fileName: buildQuotationPdfFileName(quotation.number),
    generatedAt: quotation.pdfGeneratedAt,
    bytes: await dependencies.downloadPdf(quotation.pdfPath),
  };
}

export async function publishQuotationSharePdf(
  dependencies: PublishQuotationSharePdfDependencies,
  input: {
    userId: string;
    shareToken: string;
  },
) {
  const normalizedShareToken = input.shareToken.trim();

  if (!normalizedShareToken) {
    throw new Error("No se pudo preparar el PDF público de la cotización.");
  }

  const storedPdf = await dependencies.getStoredPdf();
  const publicSharePath = buildSharedQuotationPdfPath(
    input.userId,
    normalizedShareToken,
  );

  await dependencies.uploadSharedPdf({
    path: publicSharePath,
    body: storedPdf.bytes,
    contentType: "application/pdf",
    upsert: true,
  });

  return {
    fileName: storedPdf.fileName,
    path: publicSharePath,
  };
}

export async function getStoredQuotationPdfForUser(
  userId: string,
  quotationId: string,
) {
  return getStoredQuotationPdf(
    {
      getHydratedQuotation: async () => getHydratedQuotation(userId, quotationId),
      downloadPdf: async (path) => {
        const file = await downloadFile(STORAGE_BUCKETS.quotationPdfs, path);
        return file.bytes;
      },
    },
  );
}

export async function publishQuotationSharePdfForUser(
  userId: string,
  quotationId: string,
  shareToken: string,
) {
  return publishQuotationSharePdf(
    {
      getStoredPdf: async () => getStoredQuotationPdfForUser(userId, quotationId),
      uploadSharedPdf: async ({ path, body, contentType, upsert }) => {
        await uploadFile({
          bucket: STORAGE_BUCKETS.quotationSharePdfs,
          path,
          body,
          contentType,
          upsert,
        });
      },
    },
    {
      userId,
      shareToken,
    },
  );
}

export async function getSharedQuotationPdfForToken(shareToken: string) {
  const supabase = await createClient();
  type SharedQuotationPdfReferenceRow = {
    user_id: string;
    quotation_number: string;
  };

  return getSharedQuotationPdf(
    {
      getSharedQuotation: async (token) => {
        const { data, error } = await supabase
          .rpc("get_shared_quotation_pdf_reference", {
            share_token_input: token,
          })
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo cargar la cotización compartida.");
        }

        const reference =
          (data as SharedQuotationPdfReferenceRow | null | undefined) ?? null;

        if (!reference) {
          return null;
        }

        return {
          number: reference.quotation_number,
          pdfPath: buildSharedQuotationPdfPath(reference.user_id, token),
          pdfGeneratedAt: "shared",
        };
      },
      downloadPdf: async (path) => {
        try {
          const file = await downloadFile(STORAGE_BUCKETS.quotationSharePdfs, path);
          return file.bytes;
        } catch {
          throw new Error("La cotización compartida no existe o ya no está disponible.");
        }
      },
    },
    shareToken,
  );
}

export async function getQuotationAttachments(
  userId: string,
  quotationId: string,
): Promise<HydratedQuotationAttachment[]> {
  const supabase = await createClient();
  const storageModule = await import("@/lib/storage/server");

  return hydrateQuotationAttachments({
    listAttachments: async () => {
      const { data, error } = await supabase
        .from("quotation_attachments")
        .select("*")
        .eq("user_id", userId)
        .eq("quotation_id", quotationId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error("No se pudieron cargar los adjuntos de la cotización.");
      }

      return (data as QuotationAttachment[] | null) ?? [];
    },
    createSignedUrl: async (path) => {
      try {
        return await storageModule.createSignedFileUrl(
          storageModule.STORAGE_BUCKETS.quotationAttachments,
          path,
        );
      } catch {
        return null;
      }
    },
  });
}

export async function getHydratedQuotation(
  userId: string,
  quotationId: string,
): Promise<HydratedQuotation | null> {
  const supabase = await createClient();
  const storageModule = await import("@/lib/storage/server");

  return hydrateCompleteQuotation({
    getQuotation: async () => fetchUserQuotationById(userId, quotationId),
    getProfile: async () => {
      const { getProfileForQuotation } = await import("@/lib/profile");
      return getProfileForQuotation(userId);
    },
    getClient: async (clientId) => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, user_id, name, email, phone, address, created_at")
        .eq("id", clientId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw new Error("No se pudo cargar el cliente de la cotización.");
      }

      return (data as Client | null) ?? null;
    },
    getItems: async () => {
      const { data, error } = await supabase
        .from("quotation_items")
        .select("id, quotation_id, position, catalog_item_id, name, description, quantity, unit, unit_price, total")
        .eq("quotation_id", quotationId)
        .order("position", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        throw new Error("No se pudieron cargar los ítems de la cotización.");
      }

      return (data as QuotationItemRow[] | null) ?? [];
    },
    createSignedLogoUrl: async (path) => {
      try {
        return await storageModule.createSignedFileUrl(
          storageModule.STORAGE_BUCKETS.businessAssets,
          path,
        );
      } catch {
        return null;
      }
    },
  });
}

export async function getQuotations(userId: string): Promise<Quotation[]> {
  return fetchUserQuotations(userId);
}
