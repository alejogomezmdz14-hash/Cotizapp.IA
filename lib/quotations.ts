import { normalizeCatalogUnit } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import type {
  HydratedQuotationAttachment,
  Quotation,
  QuotationAttachment,
} from "@/types";

type QuotationRow = Omit<Quotation, "subtotal" | "tax_rate" | "total"> & {
  subtotal: number | string | null;
  tax_rate: number | string | null;
  total: number | string | null;
};

type QuotationMutationRow = {
  id: string;
};

type QuotationRollbackEntity = "quotation" | "client";

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
  getDraftQuotation: () => Promise<Pick<Quotation, "id" | "number"> | null>;
  getAttachments: () => Promise<HydratedQuotationAttachment[]>;
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

function isValidDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseInlineClientPayload(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error("Completa los datos del cliente antes de guardar la cotizacion.");
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;
    const name = getOptionalStringValue(parsedValue.name);

    if (!name) {
      throw new Error("Completa los datos del cliente antes de guardar la cotizacion.");
    }

    return {
      name,
      email: getOptionalStringValue(parsedValue.email),
      phone: getOptionalStringValue(parsedValue.phone),
      address: getOptionalStringValue(parsedValue.address),
    };
  } catch {
    throw new Error("Completa los datos del cliente antes de guardar la cotizacion.");
  }
}

function parseItemsPayload(rawValue: FormDataEntryValue | null) {
  const validationMessages = new Set([
    "Agrega al menos un item a la cotizacion antes de guardarla.",
    "Cada item necesita un concepto, una cantidad valida y un precio valido.",
  ]);

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error("Agrega al menos un item a la cotizacion antes de guardarla.");
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Array<Record<string, unknown>>;

    if (!Array.isArray(parsedValue) || parsedValue.length === 0) {
      throw new Error("Agrega al menos un item a la cotizacion antes de guardarla.");
    }

    return parsedValue.map((item) => {
      const name = getOptionalStringValue(item.name);
      const quantity = parsePositiveDecimal(item.quantity);
      const unitPrice = parseNonNegativeDecimal(item.unitPrice);

      if (!name || quantity === null || unitPrice === null) {
        throw new Error(
          "Cada item necesita un concepto, una cantidad valida y un precio valido.",
        );
      }

      return {
        catalogItemId: getOptionalStringValue(item.catalogItemId),
        name,
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

    throw new Error("No se pudieron leer los items de la cotizacion.");
  }
}

function parseTaxRate(formData: FormData) {
  const parsedValue = parseNonNegativeDecimal(getStringValue(formData, "tax_rate"));

  if (parsedValue === null) {
    throw new Error("Ingresa una tasa de impuesto valida.");
  }

  return parsedValue;
}

function parseValidUntil(formData: FormData) {
  const value = getStringValue(formData, "valid_until");

  if (!value) {
    return null;
  }

  if (!isValidDateInput(value)) {
    throw new Error("Ingresa una fecha de validez valida.");
  }

  return value;
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

export function parseQuotationFormData(
  formData: FormData,
): ParsedQuotationFormData {
  const clientMode = getStringValue(formData, "client_mode") === "inline"
    ? "inline"
    : "existing";
  const items = parseItemsPayload(formData.get("items_payload"));
  const notes = getOptionalStringValue(formData.get("notes"));
  const taxRate = parseTaxRate(formData);
  const validUntil = parseValidUntil(formData);

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
      "Selecciona un cliente existente o crea uno nuevo dentro de la cotizacion.",
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
    throw new Error("No se pudo revertir la cotizacion borrador.");
  }

  throw new Error(
    "No se pudo eliminar el cliente temporal creado para la cotizacion.",
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

  throw new Error("La cotizacion no existe, no te pertenece o ya no se puede modificar.");
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
      "No se pudo guardar la cotizacion borrador.",
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

export function isDraftQuotationStatus(value: string | null) {
  return value?.trim().toLowerCase() === "draft";
}

export function getDraftQuotationEditorHref(
  quotation: Pick<Quotation, "id" | "status">,
) {
  return isDraftQuotationStatus(quotation.status)
    ? `/cotizaciones/nueva?quotationId=${quotation.id}`
    : null;
}

export async function getQuotationDraft(
  userId: string,
  quotationId: string,
): Promise<Pick<Quotation, "id" | "number"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, number")
    .eq("id", quotationId)
    .eq("user_id", userId)
    .eq("status", "draft")
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo cargar la cotizacion borrador.");
  }

  return data ?? null;
}

export async function loadDraftQuotationHydrationContext(
  dependencies: LoadDraftQuotationHydrationContextDependencies,
): Promise<{
  draftQuotation: Pick<Quotation, "id" | "number"> | null;
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
        throw new Error("No se pudieron cargar los adjuntos de la cotizacion.");
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

export async function getQuotations(userId: string): Promise<Quotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, user_id, client_id, client_name, number, status, notes, subtotal, tax_rate, total, valid_until, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar las cotizaciones.");
  }

  return ((data ?? []) as QuotationRow[]).map((quotation) => ({
    ...quotation,
    subtotal: normalizeAmount(quotation.subtotal),
    tax_rate: normalizeAmount(quotation.tax_rate),
    total: normalizeAmount(quotation.total),
  }));
}
