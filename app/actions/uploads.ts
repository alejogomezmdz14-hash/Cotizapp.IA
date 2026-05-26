"use server";

import {
  UploadActionError,
  getUploadErrorMessage,
  parseInvoiceUploadFormData,
  parseLogoUploadFormData,
  parseQuotationAttachmentUploadFormData,
} from "@/lib/uploads";
import {
  assertDraftQuotationMutationAllowed,
  formatCleanupFailureMessage,
  rollbackUploadedQuotationAttachments,
} from "@/lib/quotations";

type UploadedLogoResult = {
  fileName: string;
  logoPath: string;
  previewUrl: string | null;
};

type UploadedQuotationAttachmentResult = {
  id: string;
  quotationId: string;
  filePath: string;
  fileName: string | null;
  fileType: string | null;
  createdAt: string | null;
  url: string | null;
};

type UploadedInvoiceScanResult = {
  id: string;
  filePath: string;
  fileName: string;
  createdAt: string | null;
  status: string | null;
};

async function buildSignedUrl(bucket: string, path: string) {
  const { createSignedFileUrl } = await import("@/lib/storage/server");

  try {
    return await createSignedFileUrl(bucket, path);
  } catch {
    return null;
  }
}

export async function getProfileLogoUploadState(logoPath: string | null) {
  if (!logoPath) {
    return null;
  }

  const { STORAGE_BUCKETS } = await import("@/lib/storage/server");
  const previewUrl = await buildSignedUrl(STORAGE_BUCKETS.businessAssets, logoPath);

  if (!previewUrl) {
    return null;
  }

  return {
    logoPath,
    previewUrl,
  };
}

export async function uploadLogoFromFormData(
  formData: FormData,
): Promise<UploadedLogoResult> {
  const { file } = parseLogoUploadFormData(formData);
  const [{ getCurrentUser }, { createClient }, storageModule, pathsModule] =
    await Promise.all([
      import("@/lib/profile"),
      import("@/lib/supabase/server"),
      import("@/lib/storage/server"),
      import("@/lib/storage/paths"),
    ]);
  const user = await getCurrentUser();

  if (!user) {
    throw new UploadActionError(
      "Debes iniciar sesion para subir un logo.",
      401,
    );
  }

  const supabase = await createClient();
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("logo_url")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfileError) {
    throw new UploadActionError("No se pudo preparar la carga del logo.", 500);
  }

  const logoPath = pathsModule.buildBusinessLogoPath(user.id, file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(storageModule.STORAGE_BUCKETS.businessAssets)
    .upload(logoPath, fileBuffer, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    throw new UploadActionError("No se pudo subir el logo.", 500);
  }

  const previousLogoPath = currentProfile?.logo_url ?? null;
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        logo_url: logoPath,
      },
      {
        onConflict: "id",
      },
    );

  if (profileError) {
    if (previousLogoPath !== logoPath) {
      await storageModule.removeFile(
        storageModule.STORAGE_BUCKETS.businessAssets,
        logoPath,
      ).catch(() => undefined);
    }

    throw new UploadActionError("No se pudo asociar el logo al perfil.", 500);
  }

  if (previousLogoPath && previousLogoPath !== logoPath) {
    await storageModule.removeFile(
      storageModule.STORAGE_BUCKETS.businessAssets,
      previousLogoPath,
    ).catch(() => undefined);
  }

  return {
    fileName: file.name,
    logoPath,
    previewUrl: await buildSignedUrl(
      storageModule.STORAGE_BUCKETS.businessAssets,
      logoPath,
    ),
  };
}

export async function uploadInvoiceForScanFromFormData(
  formData: FormData,
): Promise<UploadedInvoiceScanResult> {
  const { file } = parseInvoiceUploadFormData(formData);
  const [{ getCurrentUser }, { createClient }, storageModule, pathsModule] =
    await Promise.all([
      import("@/lib/profile"),
      import("@/lib/supabase/server"),
      import("@/lib/storage/server"),
      import("@/lib/storage/paths"),
    ]);
  const user = await getCurrentUser();

  if (!user) {
    throw new UploadActionError(
      "Debes iniciar sesion para subir una factura.",
      401,
    );
  }

  const supabase = await createClient();
  const filePath = pathsModule.buildInvoiceUploadPath(user.id, file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  let uploadedFilePath: string | null = null;
  let createdScanId: string | null = null;

  try {
    const { error: uploadError } = await supabase.storage
      .from(storageModule.STORAGE_BUCKETS.invoiceUploads)
      .upload(filePath, fileBuffer, {
        contentType: file.type || undefined,
      });

    if (uploadError) {
      throw new UploadActionError("No se pudo subir la factura.", 500);
    }

    uploadedFilePath = filePath;

    const { data: scan, error: scanError } = await supabase
      .from("invoice_scans")
      .insert({
        user_id: user.id,
        file_path: filePath,
        status: "uploaded",
      })
      .select("id, file_path, status, created_at")
      .single();

    if (scanError || !scan) {
      throw new UploadActionError("No se pudo registrar el escaneo.", 500);
    }

    createdScanId = scan.id;

    return {
      id: scan.id,
      filePath: scan.file_path,
      fileName: file.name,
      createdAt: scan.created_at,
      status: scan.status,
    };
  } catch (error) {
    if (createdScanId) {
      try {
        await supabase
          .from("invoice_scans")
          .delete()
          .eq("id", createdScanId)
          .eq("user_id", user.id);
      } catch {
        // Ignore cleanup failures so we can surface the original upload error.
      }
    }

    if (uploadedFilePath) {
      await storageModule
        .removeFile(storageModule.STORAGE_BUCKETS.invoiceUploads, uploadedFilePath)
        .catch(() => undefined);
    }

    throw new UploadActionError(
      getUploadErrorMessage(error, "No se pudo subir la factura."),
      error instanceof UploadActionError ? error.status : 500,
    );
  }
}

export async function uploadQuotationAttachmentsFromFormData(
  formData: FormData,
): Promise<UploadedQuotationAttachmentResult[]> {
  const { quotationId, files } = parseQuotationAttachmentUploadFormData(formData);
  const [{ getCurrentUser }, { createClient }, storageModule, pathsModule] =
    await Promise.all([
      import("@/lib/profile"),
      import("@/lib/supabase/server"),
      import("@/lib/storage/server"),
      import("@/lib/storage/paths"),
    ]);
  const user = await getCurrentUser();

  if (!user) {
    throw new UploadActionError(
      "Debes iniciar sesion para subir adjuntos.",
      401,
    );
  }

  const supabase = await createClient();
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
          throw new UploadActionError("No se pudo validar la cotizacion.", 500);
        }

        return data;
      },
    },
    quotationId,
  ).catch((error) => {
    if (error instanceof UploadActionError) {
      throw error;
    }

    throw new UploadActionError(
      getUploadErrorMessage(
        error,
        "La cotizacion no existe, no te pertenece o ya no se puede modificar.",
      ),
      409,
    );
  });

  const createdAttachments: Array<{ id: string; filePath: string }> = [];
  const uploadedFilePaths: string[] = [];

  try {
    const attachments: UploadedQuotationAttachmentResult[] = [];

    for (const file of files) {
      const filePath = pathsModule.buildQuotationAttachmentPath(
        user.id,
        quotationId,
        file.name,
      );
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(storageModule.STORAGE_BUCKETS.quotationAttachments)
        .upload(filePath, fileBuffer, {
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw new UploadActionError("No se pudo subir uno de los adjuntos.", 500);
      }

      uploadedFilePaths.push(filePath);

      const { data: attachment, error: attachmentError } = await supabase
        .from("quotation_attachments")
        .insert({
          quotation_id: quotationId,
          user_id: user.id,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type || null,
        })
        .select("id, quotation_id, file_path, file_name, file_type, created_at")
        .single();

      if (attachmentError || !attachment) {
        throw new UploadActionError("No se pudo registrar el adjunto.", 500);
      }

      createdAttachments.push({
        id: attachment.id,
        filePath,
      });

      attachments.push({
        id: attachment.id,
        quotationId: attachment.quotation_id,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        fileType: attachment.file_type,
        createdAt: attachment.created_at,
        url: await buildSignedUrl(
          storageModule.STORAGE_BUCKETS.quotationAttachments,
          attachment.file_path,
        ),
      });
    }

    return attachments;
  } catch (error) {
    const cleanupFailures = await rollbackUploadedQuotationAttachments(
      {
        deleteAttachmentRecord: async (attachmentId) => {
          const { error: deleteError } = await supabase
            .from("quotation_attachments")
            .delete()
            .eq("id", attachmentId)
            .eq("user_id", user.id);

          if (deleteError) {
            throw deleteError;
          }
        },
        removeAttachmentFile: async (filePath) => {
          await storageModule.removeFile(
            storageModule.STORAGE_BUCKETS.quotationAttachments,
            filePath,
          );
        },
      },
      {
        createdAttachments,
        uploadedFilePaths,
      },
    );

    throw new UploadActionError(
      formatCleanupFailureMessage(
        getUploadErrorMessage(error, "No se pudieron subir los adjuntos."),
        cleanupFailures,
      ),
      error instanceof UploadActionError ? error.status : 500,
    );
  }
}
