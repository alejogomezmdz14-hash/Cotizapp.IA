import "server-only";

import {
  EnvelopeError,
  open,
  seal,
} from "@/lib/crypto/envelope";
import { ACTIVE_KEY_ID, getFiscalKeyring } from "@/lib/crypto/fiscal-key";
import {
  CertificateError,
  assertKeyMatchesCertificate,
  parseCertificate,
  type ParsedCertificate,
} from "@/lib/fiscal/certificate";
import { logError } from "@/lib/log";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Único lugar del sistema que descifra material fiscal.
//
// `fiscal_credentials` tiene RLS de negación total, así que todo acá pasa por el
// cliente service_role. Como ese cliente saltea RLS, CADA query filtra
// explícitamente por clerk_user_id. No hay excepción.
//
// `private_key_enc` es `text` en la base, no `bytea`: PostgREST transporta
// JSON, así que un bytea vuelve como string hexadecimal "\x..." al leer y no
// acepta un Buffer al escribir. Por eso el sobre que arma `seal()` se guarda
// en base64 (`blob.toString("base64")`) y se decodifica con
// `Buffer.from(valor, "base64")` antes de pasárselo a `open()`, que exige un
// Buffer de verdad.

const TABLE = "fiscal_credentials";
const PURPOSE_PRIVATE_KEY = "fiscal-private-key";

function aadFor(clerkUserId: string): string {
  return `${clerkUserId}|${PURPOSE_PRIVATE_KEY}`;
}

export type FiscalCredentialSummary = {
  cuit: string;
  certNotAfter: string | null;
  verifiedAt: string | null;
  hasCert: boolean;
};

/** Guarda la clave privada recién generada, cifrada. El CUIT todavía es provisorio. */
export async function savePrivateKey(
  clerkUserId: string,
  privateKeyPem: string,
  csrPem: string,
  provisionalCuit: string,
): Promise<void> {
  const keyring = getFiscalKeyring();
  const blob = seal(keyring.active, privateKeyPem, aadFor(clerkUserId));

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      clerk_user_id: clerkUserId,
      cuit: provisionalCuit.replace(/\D/g, ""),
      private_key_enc: blob.toString("base64"),
      csr_pem: csrPem,
      key_id: ACTIVE_KEY_ID,
      // Una llave nueva invalida cualquier verificación previa.
      cert_pem: null,
      cert_serial: null,
      cert_not_after: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" },
  );

  if (error) {
    logError("fiscal.savePrivateKey", error);
    throw new Error("No pudimos guardar tu llave. Probá de nuevo en un momento.");
  }
}

/**
 * Asocia el certificado que bajó el usuario de ARCA. Valida que corresponda a la
 * clave guardada y ESCRIBE el CUIT del certificado: esa es la autoridad.
 */
export async function attachCertificate(
  clerkUserId: string,
  certPem: string,
): Promise<ParsedCertificate> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("private_key_enc, key_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error || !data) {
    throw new CertificateError(
      "Primero generá tu llave desde Cotizapp y después subí el certificado.",
    );
  }

  const keyring = getFiscalKeyring();
  let privateKeyPem: string;
  try {
    privateKeyPem = open(
      keyring.all,
      Buffer.from(String(data.private_key_enc), "base64"),
      aadFor(clerkUserId),
    ).toString("utf8");
  } catch (unsealError) {
    logError("fiscal.attachCertificate.open", unsealError);
    throw new CertificateError(
      "No pudimos leer tu llave guardada. Generá una nueva y rehacé el trámite en ARCA.",
    );
  }

  const parsed = parseCertificate(certPem);
  assertKeyMatchesCertificate(certPem, privateKeyPem);

  const { error: updateError } = await supabase
    .from(TABLE)
    .update({
      // El CUIT del certificado manda. El del formulario nunca fue autoridad.
      cuit: parsed.cuit,
      cert_pem: certPem.trim(),
      cert_serial: parsed.certSerialNumber,
      cert_not_after: parsed.notAfter.toISOString(),
      verified_at: null, // se sella recién cuando "Probar conexión" pasa
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", clerkUserId);

  if (updateError) {
    // El índice único parcial sobre cuit solo aplica a filas verificadas, así
    // que acá un conflicto es otra cosa; igual damos un mensaje humano.
    logError("fiscal.attachCertificate.update", updateError);
    throw new CertificateError(
      "No pudimos guardar el certificado. Probá de nuevo en un momento.",
    );
  }

  await clearTicketsFor(clerkUserId);

  return parsed;
}

/** Devuelve el material listo para hablar con ARCA, o null si no está completo. */
export async function loadCredentials(
  clerkUserId: string,
): Promise<{ cuit: string; certPem: string; privateKeyPem: string } | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("cuit, cert_pem, private_key_enc")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    logError("fiscal.loadCredentials", error);
    return null;
  }

  if (!data?.cert_pem || !data.private_key_enc) {
    return null;
  }

  const keyring = getFiscalKeyring();

  try {
    const privateKeyPem = open(
      keyring.all,
      Buffer.from(String(data.private_key_enc), "base64"),
      aadFor(clerkUserId),
    ).toString("utf8");

    return {
      cuit: String(data.cuit),
      certPem: String(data.cert_pem),
      privateKeyPem,
    };
  } catch (unsealError) {
    if (unsealError instanceof EnvelopeError) {
      logError("fiscal.loadCredentials.open", unsealError);
      return null;
    }
    throw unsealError;
  }
}

/** Datos no sensibles para mostrar en la UI. Nunca devuelve material criptográfico. */
export async function getCredentialSummary(
  clerkUserId: string,
): Promise<FiscalCredentialSummary | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("cuit, cert_pem, cert_not_after, verified_at")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    logError("fiscal.getCredentialSummary", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    cuit: String(data.cuit),
    certNotAfter: (data.cert_not_after as string | null) ?? null,
    verifiedAt: (data.verified_at as string | null) ?? null,
    hasCert: Boolean(data.cert_pem),
  };
}

export async function markVerified(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("clerk_user_id", clerkUserId);

  if (error) {
    logError("fiscal.markVerified", error);
    throw new Error("No pudimos confirmar la verificación. Probá de nuevo.");
  }
}

export async function clearCredentials(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).delete().eq("clerk_user_id", clerkUserId);

  if (error) {
    logError("fiscal.clearCredentials", error);
    throw new Error("No pudimos borrar tus credenciales. Probá de nuevo.");
  }

  await clearTicketsFor(clerkUserId);
}

/**
 * Borra los tickets WSAA del usuario. La tabla `arca_tickets` la crea la Fase B;
 * hasta entonces esto es un no-op silencioso, a propósito: cambiar de certificado
 * SIEMPRE tiene que invalidar los tickets, y no queremos que el día que exista la
 * tabla haya que acordarse de venir a agregar la llamada.
 */
async function clearTicketsFor(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("arca_tickets")
    .delete()
    .eq("clerk_user_id", clerkUserId);

  // 42P01 = undefined_table: la Fase B todavía no corrió su migración.
  if (error && error.code !== "42P01") {
    logError("fiscal.clearTickets", error);
  }
}
