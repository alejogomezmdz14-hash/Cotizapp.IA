"use server";

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  UploadActionError,
  getUploadErrorMessage,
  parseInvoiceUploadFormData,
  parseLogoUploadFormData,
  parseQuotationAttachmentUploadFormData,
} from "@/lib/uploads";
import {
  assertDraftQuotationMutationAllowed,
  DRAFT_QUOTATION_STATUS,
  formatCleanupFailureMessage,
  rollbackUploadedQuotationAttachments,
} from "@/lib/quotations";

type UploadedLogoResult = {
  fileName: string;
  logoPath: string;
  previewUrl: string | null;
};

type UploadedAvatarResult = {
  fileName: string;
  avatarPath: string;
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

async function convertPdfFirstPageToPngBuffer(pdfBuffer: Buffer) {
  const { fromPath } = await import("pdf2pic");

  const workDir = join(tmpdir(), `cotizapp-pdf2pic-${randomUUID()}`);
  const inputPdfPath = join(workDir, "invoice.pdf");
  const outputDir = join(workDir, "out");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(inputPdfPath, pdfBuffer);

  try {
    const converter = fromPath(inputPdfPath, {
      density: 220,
      format: "png",
      saveFilename: "page1",
      savePath: outputDir,
    });

    // Convert only the first page.
    const result: unknown = await converter(1);

    const firstResult = Array.isArray(result) ? result[0] : result;
    const imagePathCandidate =
      firstResult && typeof firstResult === "object"
        ? (firstResult as Record<string, unknown>).path
        : null;

    const imagePath: string | null =
      typeof imagePathCandidate === "string" ? imagePathCandidate : null;

    if (!imagePath) {
      throw new Error("No se pudo convertir el PDF a una imagen.");
    }

    return await fs.readFile(imagePath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function buildSignedUrl(bucket: string, path: string) {
  const { createSignedFileUrl } = await import("@/lib/storage/server");

  try {
    return await createSignedFileUrl(bucket, path);
  } catch {
    return null;
  }
}

export async function getProfileLogoUploadState(
  logoPath: string | null,
  profile?: { id: string; clerk_id?: string | null } | null,
) {
  if (!logoPath) {
    return null;
  }

  const { getLogoStoragePathCandidates } = await import(
    "@/lib/storage/profile-paths"
  );
  const { STORAGE_BUCKETS } = await import("@/lib/storage/server");
  const pathCandidates = getLogoStoragePathCandidates(logoPath, profile ?? null);

  for (const candidate of pathCandidates) {
    const previewUrl = await buildSignedUrl(
      STORAGE_BUCKETS.businessAssets,
      candidate,
    );

    if (previewUrl) {
      return {
        logoPath: pathCandidates[0] ?? candidate,
        previewUrl,
      };
    }
  }

  return null;
}

export async function uploadLogoFromFormData(
  formData: FormData,
): Promise<UploadedLogoResult> {
  const { file } = parseLogoUploadFormData(formData);
  const [
    { getCurrentUser, resolveAuthenticatedProfileUserId },
    { createClient },
    storageModule,
    pathsModule,
    profilePathsModule,
  ] = await Promise.all([
    import("@/lib/profile"),
    import("@/lib/supabase/server"),
    import("@/lib/storage/server"),
    import("@/lib/storage/paths"),
    import("@/lib/storage/profile-paths"),
  ]);
  const user = await getCurrentUser();

  if (!user) {
    throw new UploadActionError(
      "Debes iniciar sesión para subir un logo.",
      401,
    );
  }

  const profileUserId = await resolveAuthenticatedProfileUserId(user);
  const supabase = await createClient();
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("logo_url, clerk_id")
    .eq("id", profileUserId)
    .maybeSingle();

  if (currentProfileError) {
    throw new UploadActionError("No se pudo preparar la carga del logo.", 500);
  }

  const logoPath = pathsModule.buildBusinessLogoPath(profileUserId, file.name);
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
        id: profileUserId,
        clerk_id: user.clerkId,
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

    console.error("[uploadLogo] profile upsert:", profileError.message);
    throw new UploadActionError("No se pudo asociar el logo al perfil.", 500);
  }

  if (previousLogoPath && previousLogoPath !== logoPath) {
    const legacyCleanupPaths = profilePathsModule.getLogoStoragePathCandidates(
      previousLogoPath,
      {
        id: profileUserId,
        clerk_id: currentProfile?.clerk_id ?? user.clerkId,
      },
    );

    for (const pathToRemove of legacyCleanupPaths) {
      await storageModule
        .removeFile(storageModule.STORAGE_BUCKETS.businessAssets, pathToRemove)
        .catch(() => undefined);
    }
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

export async function getProfileAvatarUploadState(
  avatarPath: string | null,
) {
  if (!avatarPath) {
    return null;
  }

  const { STORAGE_BUCKETS } = await import("@/lib/storage/server");
  const previewUrl = await buildSignedUrl(STORAGE_BUCKETS.businessAssets, avatarPath);

  if (!previewUrl) {
    return null;
  }

  return {
    avatarPath,
    previewUrl,
  };
}

export async function uploadAvatarFromFormData(
  formData: FormData,
): Promise<UploadedAvatarResult> {
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
    throw new UploadActionError("Debes iniciar sesión para subir una foto.", 401);
  }

  const supabase = await createClient();

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (currentProfileError) {
    throw new UploadActionError(
      "No se pudo preparar la carga de la foto.",
      500,
    );
  }

  const avatarPath = pathsModule.buildUserAvatarPath(user.id, file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(storageModule.STORAGE_BUCKETS.businessAssets)
    .upload(avatarPath, fileBuffer, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    throw new UploadActionError("No se pudo subir la foto.", 500);
  }

  const previousAvatarPath = currentProfile?.avatar_url ?? null;
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        clerk_id: user.clerkId,
        avatar_url: avatarPath,
      },
      {
        onConflict: "id",
      },
    );

  if (profileError) {
    if (previousAvatarPath !== avatarPath) {
      await storageModule.removeFile(
        storageModule.STORAGE_BUCKETS.businessAssets,
        avatarPath,
      ).catch(() => undefined);
    }

    console.error("[uploadAvatar] profile upsert:", profileError.message);
    throw new UploadActionError("No se pudo asociar la foto al perfil.", 500);
  }

  if (previousAvatarPath && previousAvatarPath !== avatarPath) {
    await storageModule.removeFile(
      storageModule.STORAGE_BUCKETS.businessAssets,
      previousAvatarPath,
    ).catch(() => undefined);
  }

  return {
    fileName: file.name,
    avatarPath,
    previewUrl: await buildSignedUrl(
      storageModule.STORAGE_BUCKETS.businessAssets,
      avatarPath,
    ),
  };
}

type UploadedExpenseReceiptResult = {
  fileName: string;
  receiptPath: string;
  previewUrl: string | null;
};

export async function getExpenseReceiptUploadState(receiptPath: string | null) {
  if (!receiptPath) {
    return null;
  }

  const { STORAGE_BUCKETS } = await import("@/lib/storage/server");
  const previewUrl = await buildSignedUrl(
    STORAGE_BUCKETS.expenseReceipts,
    receiptPath,
  );

  if (!previewUrl) {
    return null;
  }

  return {
    receiptPath,
    previewUrl,
  };
}

type UploadedQuotationSignatureResult = {
  fileName: string;
  signaturePath: string;
  previewUrl: string | null;
};

export async function uploadQuotationSignatureFromFormData(
  formData: FormData,
): Promise<UploadedQuotationSignatureResult> {
  const { file } = parseLogoUploadFormData(formData);
  const quotationId = String(formData.get("quotationId") ?? "").trim();

  if (!quotationId) {
    throw new UploadActionError("Falta la cotización para guardar la firma.", 400);
  }

  const [{ getCurrentUser }, { createClient }, storageModule, pathsModule] =
    await Promise.all([
      import("@/lib/profile"),
      import("@/lib/supabase/server"),
      import("@/lib/storage/server"),
      import("@/lib/storage/paths"),
    ]);

  const user = await getCurrentUser();

  if (!user) {
    throw new UploadActionError("Debes iniciar sesión para subir una firma.", 401);
  }

  const signaturePath = pathsModule.buildQuotationSignaturePath(
    user.id,
    quotationId,
    file.name,
  );
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(storageModule.STORAGE_BUCKETS.quotationSignatures)
    .upload(signaturePath, fileBuffer, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) {
    throw new UploadActionError("No se pudo subir la firma.", 500);
  }

  return {
    fileName: file.name,
    signaturePath,
    previewUrl: await buildSignedUrl(
      storageModule.STORAGE_BUCKETS.quotationSignatures,
      signaturePath,
    ),
  };
}

export async function uploadExpenseReceiptFromFormData(
  formData: FormData,
): Promise<UploadedExpenseReceiptResult> {
  const { parseExpenseReceiptUploadFormData } = await import("@/lib/uploads");
  const { file } = parseExpenseReceiptUploadFormData(formData);
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
      "Debes iniciar sesión para subir un recibo.",
      401,
    );
  }

  const receiptPath = pathsModule.buildExpenseReceiptPath(user.id, file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(storageModule.STORAGE_BUCKETS.expenseReceipts)
    .upload(receiptPath, fileBuffer, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    throw new UploadActionError("No se pudo subir el recibo.", 500);
  }

  return {
    fileName: file.name,
    receiptPath,
    previewUrl: await buildSignedUrl(
      storageModule.STORAGE_BUCKETS.expenseReceipts,
      receiptPath,
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
      "Debes iniciar sesión para subir una factura.",
      401,
    );
  }

  const supabase = await createClient();

  const originalFileName = file.name;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  let fileNameForStorage = file.name;
  let contentType = file.type || undefined;
  let fileBuffer = Buffer.from(await file.arrayBuffer());

  let filePath = pathsModule.buildInvoiceUploadPath(user.id, fileNameForStorage);

  if (isPdf) {
    try {
      const pngBuffer = await convertPdfFirstPageToPngBuffer(fileBuffer);
      fileBuffer = pngBuffer;
      fileNameForStorage = fileNameForStorage.replace(/\.pdf$/i, ".png");
      contentType = "image/png";
      filePath = pathsModule.buildInvoiceUploadPath(user.id, fileNameForStorage);
    } catch {
      throw new UploadActionError(
        "Para escanear facturas en PDF, tomá una foto o screenshot de la factura y subila como imagen.",
        400,
      );
    }
  }

  let uploadedFilePath: string | null = null;
  let createdScanId: string | null = null;

  try {
    const { error: uploadError } = await supabase.storage
      .from(storageModule.STORAGE_BUCKETS.invoiceUploads)
      .upload(filePath, fileBuffer, {
        contentType,
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
        file_name: originalFileName,
        status: "uploaded",
      })
      .select("id, file_path, file_name, status, created_at")
      .single();

    if (scanError || !scan) {
      throw new UploadActionError("No se pudo registrar el escaneo.", 500);
    }

    createdScanId = scan.id;

    return {
      id: scan.id,
      filePath: scan.file_path,
      fileName: scan.file_name,
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
      "Debes iniciar sesión para subir adjuntos.",
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
          .eq("status", DRAFT_QUOTATION_STATUS)
          .maybeSingle();

        if (error) {
          throw new UploadActionError("No se pudo validar la cotización.", 500);
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
        "La cotización no existe, no te pertenece o ya no se puede modificar.",
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
