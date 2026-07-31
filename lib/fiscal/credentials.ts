import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import {
  EnvelopeError,
  open,
  seal,
} from "@/lib/crypto/envelope";
import { ACTIVE_KEY_ID, getFiscalKeyring } from "@/lib/crypto/fiscal-key";
import { aadFor } from "@/lib/fiscal/aad";
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

const GENERIC_TRANSIENT_MESSAGE =
  "Tuvimos un problema para conectarnos. Probá de nuevo en un momento.";

function pgErrorExtra(error: PostgrestError): Record<string, string> {
  return { code: error.code ?? "" };
}

// PostgREST —lo que efectivamente corre Supabase, no Postgres directo— no
// siempre deja pasar el código crudo de Postgres para "tabla inexistente"
// (42P01). Normalmente lo envuelve y devuelve su propio código PGRST205, con
// un mensaje del estilo "Could not find the table ... in the schema cache".
// Contemplamos las dos señales, más un match de mensaje como red adicional,
// para no depender de asumir cuál de las dos capas terminó respondiendo.
function isMissingArcaTicketsTable(error: PostgrestError): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return true;
  }

  return /schema cache|does not exist|no existe/i.test(error.message ?? "");
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
  const cuitDigits = provisionalCuit.replace(/\D/g, "");
  if (cuitDigits.length !== 11) {
    throw new Error("El CUIT tiene que tener 11 dígitos.");
  }

  const supabase = createServiceRoleClient();
  const keyring = getFiscalKeyring();

  // Red de seguridad: si ya hay una fila con una llave que no podemos abrir
  // (p. ej. FISCAL_ENCRYPTION_KEY se rotó mal, sin dejar la vieja en
  // FISCAL_ENCRYPTION_KEY_PREVIOUS), el upsert de abajo la pisaría con una
  // llave nueva y la buena se perdería para siempre. Un error nuestro de
  // entorno, transitorio y reversible, no puede terminar en la destrucción
  // de la única copia de la llave del usuario.
  const { data: existing, error: existingError } = await supabase
    .from(TABLE)
    .select("private_key_enc")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (existingError) {
    logError("fiscal.savePrivateKey.check", existingError, pgErrorExtra(existingError));
    throw new Error(GENERIC_TRANSIENT_MESSAGE);
  }

  if (existing?.private_key_enc) {
    try {
      open(
        keyring.all,
        Buffer.from(String(existing.private_key_enc), "base64"),
        aadFor(clerkUserId),
      );
    } catch (unsealError) {
      if (unsealError instanceof EnvelopeError) {
        logError("fiscal.savePrivateKey.undecryptable", unsealError);
        throw new Error(
          "Hay un problema con la configuración de cifrado y no pudimos verificar tu llave actual. No se modificó nada: escribinos antes de generar una llave nueva.",
        );
      }
      throw unsealError;
    }
  }

  const blob = seal(keyring.active, privateKeyPem, aadFor(clerkUserId));

  const { error } = await supabase.from(TABLE).upsert(
    {
      clerk_user_id: clerkUserId,
      cuit: cuitDigits,
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
    logError("fiscal.savePrivateKey", error, pgErrorExtra(error));
    throw new Error("No pudimos guardar tu llave. Probá de nuevo en un momento.");
  }

  // Cambiar de llave (y por lo tanto de CUIT provisorio) invalida cualquier
  // ticket WSAA que hubiera quedado del certificado/CUIT anterior.
  await clearTicketsFor(clerkUserId);
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
    .select("private_key_enc")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    // `maybeSingle()` devuelve { data: null, error: null } cuando no hay
    // fila: un `error` no nulo acá es siempre una falla real de Supabase, no
    // "el usuario todavía no generó su llave". Colapsar los dos casos le
    // mentía al usuario y además era el único camino del módulo donde una
    // falla de base no dejaba rastro en los logs.
    logError("fiscal.attachCertificate.select", error, pgErrorExtra(error));
    throw new CertificateError(GENERIC_TRANSIENT_MESSAGE);
  }

  if (!data) {
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

  const { data: updated, error: updateError } = await supabase
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
    .eq("clerk_user_id", clerkUserId)
    .select("clerk_user_id")
    .maybeSingle();

  if (updateError) {
    // El índice único parcial sobre cuit solo aplica a filas verificadas, así
    // que acá un conflicto es otra cosa; igual damos un mensaje humano.
    logError("fiscal.attachCertificate.update", updateError, pgErrorExtra(updateError));
    throw new CertificateError(
      "No pudimos guardar el certificado. Probá de nuevo en un momento.",
    );
  }

  if (!updated) {
    throw new CertificateError(
      "No pudimos guardar el certificado. Probá de nuevo en un momento.",
    );
  }

  await clearTicketsFor(clerkUserId);

  return parsed;
}

export type LoadCredentialsResult =
  | { status: "ok"; cuit: string; certPem: string; privateKeyPem: string }
  // No hay fila, o falta cert o clave: el usuario todavía tiene el
  // onboarding pendiente.
  | { status: "missing" }
  // Falló la consulta a la base: transitorio, vale la pena reintentar.
  | { status: "unavailable" }
  // Hay fila con cert y clave, pero el sobre no abre (p. ej. una rotación
  // mal hecha de FISCAL_ENCRYPTION_KEY). NO es "no configurado": no pisar
  // nada, avisar.
  | { status: "undecryptable" };

/** Devuelve el material listo para hablar con ARCA, con el estado discriminado. */
export async function loadCredentials(
  clerkUserId: string,
): Promise<LoadCredentialsResult> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("cuit, cert_pem, private_key_enc")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    logError("fiscal.loadCredentials", error, pgErrorExtra(error));
    return { status: "unavailable" };
  }

  if (!data?.cert_pem || !data.private_key_enc) {
    return { status: "missing" };
  }

  const keyring = getFiscalKeyring();

  try {
    const privateKeyPem = open(
      keyring.all,
      Buffer.from(String(data.private_key_enc), "base64"),
      aadFor(clerkUserId),
    ).toString("utf8");

    return {
      status: "ok",
      cuit: String(data.cuit),
      certPem: String(data.cert_pem),
      privateKeyPem,
    };
  } catch (unsealError) {
    if (unsealError instanceof EnvelopeError) {
      logError("fiscal.loadCredentials.open", unsealError);
      return { status: "undecryptable" };
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
    logError("fiscal.getCredentialSummary", error, pgErrorExtra(error));
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

/**
 * Devuelve el CSR ya generado, sin tocar la clave privada ni generar nada
 * nuevo. El CSR es material público (lo que el usuario sube a ARCA para pedir
 * el certificado): no está cifrado y no hace falta tratarlo como secreto.
 */
export async function getCsr(clerkUserId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("csr_pem")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    logError("fiscal.getCsr", error, pgErrorExtra(error));
    return null;
  }

  return (data?.csr_pem as string | null) ?? null;
}

/**
 * Sella `verified_at` para el certificado que efectivamente autenticó contra
 * el WSAA. Filtra por `cert_serial` además de `clerk_user_id`: si el
 * certificado cambió mientras la verificación estaba en vuelo (el usuario
 * sube uno nuevo mientras "Probar conexión" todavía no respondió), esta
 * llamada no debe sellar la fila con el certificado que nunca se verificó.
 */
export async function markVerified(
  clerkUserId: string,
  certSerial: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("clerk_user_id", clerkUserId)
    .eq("cert_serial", certSerial)
    .not("cert_pem", "is", null)
    .select("clerk_user_id")
    .maybeSingle();

  if (error) {
    logError("fiscal.markVerified", error, pgErrorExtra(error));
    if (error.code === "23505") {
      throw new Error(
        "Ese CUIT ya está verificado en otra cuenta de Cotizapp. Si te parece un error, escribinos para revisarlo.",
      );
    }
    throw new Error("No pudimos confirmar la verificación. Probá de nuevo.");
  }

  if (!data) {
    throw new Error(
      "El certificado cambió mientras confirmábamos la verificación. Volvé a probar la conexión con ARCA.",
    );
  }
}

export async function clearCredentials(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).delete().eq("clerk_user_id", clerkUserId);

  if (error) {
    logError("fiscal.clearCredentials", error, pgErrorExtra(error));
    throw new Error("No pudimos borrar tus credenciales. Probá de nuevo.");
  }

  await clearTicketsFor(clerkUserId);
}

/**
 * Borra los tickets WSAA del usuario. La tabla `arca_tickets` la crea la Fase B;
 * hasta entonces, que no exista todavía es el ÚNICO caso que se tolera en
 * silencio (a propósito: cambiar de certificado SIEMPRE tiene que invalidar
 * los tickets, y no queremos que el día que exista la tabla haya que
 * acordarse de venir a agregar la llamada). Cualquier otro error se propaga:
 * si no, quien llama (p. ej. `clearCredentials`) le reporta éxito al usuario
 * mientras tickets WSAA utilizables sobreviven a un borrado de credenciales.
 */
async function clearTicketsFor(clerkUserId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("arca_tickets")
    .delete()
    .eq("clerk_user_id", clerkUserId);

  if (!error) {
    return;
  }

  if (isMissingArcaTicketsTable(error)) {
    return;
  }

  logError("fiscal.clearTickets", error, pgErrorExtra(error));
  throw new Error(
    "No pudimos limpiar los datos de conexión anteriores con ARCA. Probá de nuevo en un momento.",
  );
}
