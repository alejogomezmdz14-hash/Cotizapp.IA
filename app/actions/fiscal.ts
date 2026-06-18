"use server";

import { revalidatePath } from "next/cache";

import {
  isValidCuitFormat,
  normalizeContributorType,
  normalizeCuit,
  normalizeSalesPoint,
} from "@/lib/fiscal-profile";
import { requireUser } from "@/lib/profile";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { uploadFile } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertValidFiscalCredential,
  UploadActionError,
  type FiscalCredentialKind,
} from "@/lib/uploads";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function saveFiscalProfileAction(formData: FormData) {
  const user = await requireUser();

  const cuit = normalizeCuit(readText(formData, "cuit"));
  const contributorType = normalizeContributorType(
    readText(formData, "contributor_type"),
  );
  const salesPoint = normalizeSalesPoint(readText(formData, "sales_point"));
  const businessName = readText(formData, "business_name");

  if (!isValidCuitFormat(cuit)) {
    throw new Error("El CUIT debe tener el formato XX-XXXXXXXX-X.");
  }
  if (!contributorType) {
    throw new Error("Elegí un tipo de contribuyente válido.");
  }
  if (!salesPoint) {
    throw new Error("Ingresá el punto de venta.");
  }
  if (!businessName) {
    throw new Error("Ingresá la razón social.");
  }

  const supabase = await createClient();

  // 1) Upsert de los textos (crea la fila si no existe; satisface NOT NULL).
  const { error: upsertError } = await supabase.from("fiscal_profiles").upsert(
    {
      clerk_user_id: user.clerkId,
      cuit,
      contributor_type: contributorType,
      sales_point: salesPoint,
      business_name: businessName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" },
  );

  if (upsertError) {
    console.error("[fiscal] upsert failed", { reason: upsertError.message });
    throw new Error("No se pudieron guardar los datos fiscales.");
  }

  // 2) Subir cert/key si vinieron en este submit, y guardar el path.
  const uploads: Array<{
    kind: FiscalCredentialKind;
    column: "cert_path" | "key_path";
    objectName: string;
  }> = [
    { kind: "cert", column: "cert_path", objectName: "cert.crt" },
    { kind: "key", column: "key_path", objectName: "private.key" },
  ];

  for (const { kind, column, objectName } of uploads) {
    const file = readFile(formData, kind);

    if (!file) {
      continue;
    }

    try {
      assertValidFiscalCredential(file, kind);
    } catch (error) {
      if (error instanceof UploadActionError) {
        throw new Error(error.message);
      }
      throw error;
    }

    const path = `${user.clerkId}/${objectName}`;
    const body = await file.arrayBuffer();

    await uploadFile({
      bucket: STORAGE_BUCKETS.fiscal,
      path,
      body,
      upsert: true,
    });

    const { error: pathError } = await supabase
      .from("fiscal_profiles")
      .update({ [column]: path, updated_at: new Date().toISOString() })
      .eq("clerk_user_id", user.clerkId);

    if (pathError) {
      console.error("[fiscal] path update failed", { reason: pathError.message });
      throw new Error("No se pudo asociar el archivo a tus datos fiscales.");
    }
  }

  revalidatePath("/perfil-empresa");
}
