/**
 * Migra las credenciales fiscales del bucket `fiscal` (clave privada en CLARO) a
 * la tabla `fiscal_credentials` (cifrada), y borra el material en claro.
 *
 * Orden estricto y no negociable, por perfil:
 *   1. leer y validar   2. escribir cifrado   3. RELEER Y DESCIFRAR para
 *   verificar   4. recién ahí borrar el objeto en claro   5. barrido final
 *
 * Si el paso 3 falla, no se borra nada: es preferible dejar el archivo en claro
 * a dejar a un usuario sin clave recuperable.
 *
 * Es idempotente: si un perfil ya tiene fila en `fiscal_credentials` (porque una
 * corrida anterior lo migró, o porque el usuario ya pasó por el flujo nuevo),
 * no se vuelve a cifrar nada — el material que hay en la tabla ya es la
 * autoridad. Solo se reintenta el borrado del archivo en claro, por si había
 * quedado pendiente.
 *
 * Uso (desde la raíz del repo):
 *   npx tsx scripts/migrar-credenciales-fiscales.ts          (simulacro, no toca nada)
 *   npx tsx scripts/migrar-credenciales-fiscales.ts --aplicar
 *
 * Variables de entorno requeridas: NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, FISCAL_ENCRYPTION_KEY (ver .env.local).
 *
 * Nota sobre imports: este script corre con `tsx`, fuera del runtime de
 * Next.js. Por eso usa `createClient` de `@supabase/supabase-js` directo en
 * vez de `lib/supabase/service-role.ts` (que tiene `import "server-only"` y
 * revienta apenas se importa fuera de un Server Component), y arma la AAD a
 * mano en vez de importar `lib/fiscal/credentials.ts` (mismo problema: también
 * tiene `import "server-only"`). La AAD de acá tiene que coincidir carácter
 * por carácter con la que arma `aadFor()` en ese módulo — ver el comentario
 * junto a `buildAad` más abajo.
 */

import { createClient } from "@supabase/supabase-js";

import { open, seal } from "../lib/crypto/envelope";
import { ACTIVE_KEY_ID, parseFiscalKeyring } from "../lib/crypto/fiscal-key";
import {
  assertKeyMatchesCertificate,
  parseCertificate,
} from "../lib/fiscal/certificate";

const APLICAR = process.argv.includes("--aplicar");

// Misma AAD que `aadFor()` en lib/fiscal/credentials.ts:
//   const PURPOSE_PRIVATE_KEY = "fiscal-private-key";
//   function aadFor(clerkUserId: string): string {
//     return `${clerkUserId}|${PURPOSE_PRIVATE_KEY}`;
//   }
// Si esto difiere aunque sea en un carácter, lo que migremos acá queda
// cifrado para siempre: `open()` en producción usa la AAD de ese módulo, no
// la de este script, y GCM no distingue "clave equivocada" de "AAD
// equivocada" — el síntoma aparece recién cuando el usuario intenta facturar.
function buildAad(clerkUserId: string): string {
  return `${clerkUserId}|fiscal-private-key`;
}

function requireEnv(): { supabaseUrl: string; serviceRoleKey: string } {
  const checks: Array<[string, string | undefined]> = [
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["FISCAL_ENCRYPTION_KEY", process.env.FISCAL_ENCRYPTION_KEY],
  ];

  const faltantes = checks.filter(([, value]) => !value?.trim()).map(([name]) => name);

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${faltantes.join(", ")}.\n` +
        `Cargalas en .env.local (o exportalas en la terminal donde corrés el script) e intentá de nuevo.`,
    );
  }

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  };
}

type FiscalProfileRow = {
  clerk_user_id: string;
  cuit: string | null;
  cert_path: string | null;
  key_path: string | null;
};

async function main() {
  const { supabaseUrl, serviceRoleKey } = requireEnv();

  // parseFiscalKeyring ya valida que FISCAL_ENCRYPTION_KEY sea base64 de 32
  // bytes exactos, con su propio mensaje claro si no lo es.
  const keyring = parseFiscalKeyring(process.env);

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(APLICAR ? "Modo: APLICAR (va a escribir y borrar).\n" : "Modo: SIMULACRO (no toca nada).\n");

  const { data: perfiles, error: perfilesError } = await db
    .from("fiscal_profiles")
    .select("clerk_user_id, cuit, cert_path, key_path");

  if (perfilesError) {
    throw new Error(`No se pudieron listar los perfiles fiscales: ${perfilesError.message}`);
  }

  let migrados = 0;
  let yaMigrados = 0;
  let salteados = 0;
  let fallidos = 0;

  for (const perfilRaw of (perfiles ?? []) as FiscalProfileRow[]) {
    const clerkUserId = String(perfilRaw.clerk_user_id);

    if (!perfilRaw.cert_path || !perfilRaw.key_path) {
      console.log(`- ${clerkUserId}: sin certificado cargado, se saltea.`);
      salteados += 1;
      continue;
    }

    const certPath = String(perfilRaw.cert_path);
    const keyPath = String(perfilRaw.key_path);

    try {
      // Chequeo de idempotencia: si ya hay fila en fiscal_credentials, el
      // material ya está migrado y verificado (esa fila solo se crea después
      // del paso 3 exitoso, más abajo). No la volvemos a pisar — total, la
      // fuente de verdad ya es esa tabla. Solo confirmamos que no haya
      // quedado el archivo en claro colgado de una corrida anterior que
      // falló justo en el paso 4.
      const { data: existente, error: existenteError } = await db
        .from("fiscal_credentials")
        .select("clerk_user_id")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (existenteError) {
        throw new Error(`no se pudo chequear si ya estaba migrado: ${existenteError.message}`);
      }

      if (existente) {
        if (!APLICAR) {
          console.log(`- ${clerkUserId}: ya migrado en una corrida anterior, no hay nada para hacer.`);
          yaMigrados += 1;
          continue;
        }

        const { error: removeError } = await db.storage.from("fiscal").remove([keyPath]);
        if (removeError) {
          throw new Error(
            `ya estaba migrado, pero no se pudo confirmar el borrado del archivo en claro: ${removeError.message}`,
          );
        }

        console.log(`- ${clerkUserId}: YA ESTABA MIGRADO (se confirmó que no quedó el archivo en claro).`);
        yaMigrados += 1;
        continue;
      }

      // 1. Leer y validar, antes de tocar nada.
      const [certFile, keyFile] = await Promise.all([
        db.storage.from("fiscal").download(certPath),
        db.storage.from("fiscal").download(keyPath),
      ]);

      if (certFile.error || !certFile.data) {
        throw new Error(`no se pudo descargar el certificado (${certPath}): ${certFile.error?.message ?? "sin datos"}`);
      }
      if (keyFile.error || !keyFile.data) {
        throw new Error(`no se pudo descargar la clave privada (${keyPath}): ${keyFile.error?.message ?? "sin datos"}`);
      }

      const certPem = await certFile.data.text();
      const privateKeyPem = await keyFile.data.text();

      const parsed = parseCertificate(certPem);
      assertKeyMatchesCertificate(certPem, privateKeyPem);

      const declarado = String(perfilRaw.cuit ?? "").replace(/\D/g, "");
      if (declarado && declarado !== parsed.cuit) {
        console.warn(
          `  ! ${clerkUserId}: el CUIT declarado (${declarado}) no es el del certificado (${parsed.cuit}). Gana el del certificado.`,
        );
      }

      if (!APLICAR) {
        console.log(
          `- ${clerkUserId}: LISTO PARA MIGRAR (CUIT ${parsed.cuit}, vence ${parsed.notAfter.toISOString().slice(0, 10)}).`,
        );
        migrados += 1;
        continue;
      }

      // 2. Escribir cifrado. Base64 porque `private_key_enc` es `text`, no
      // `bytea`: PostgREST transporta JSON y no puede llevar binario — un
      // Buffer se serializaría como {"type":"Buffer","data":[...]} y
      // corrompería el sobre.
      const aad = buildAad(clerkUserId);
      const blob = seal(keyring.active, privateKeyPem, aad);

      const { error: upsertError } = await db.from("fiscal_credentials").upsert(
        {
          clerk_user_id: clerkUserId,
          cuit: parsed.cuit,
          private_key_enc: blob.toString("base64"),
          cert_pem: certPem.trim(),
          cert_serial: parsed.certSerialNumber,
          cert_not_after: parsed.notAfter.toISOString(),
          key_id: ACTIVE_KEY_ID,
          verified_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clerk_user_id" },
      );

      if (upsertError) {
        throw new Error(`upsert falló: ${upsertError.message}`);
      }

      // 3. Releer y descifrar: sin esto no se borra nada.
      const { data: releido, error: releerError } = await db
        .from("fiscal_credentials")
        .select("private_key_enc")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (releerError || !releido) {
        throw new Error(`no se pudo releer lo que acabamos de escribir: ${releerError?.message ?? "fila no encontrada"}`);
      }

      const recuperado = open(
        keyring.all,
        Buffer.from(String(releido.private_key_enc), "base64"),
        aad,
      ).toString("utf8");

      if (recuperado.trim() !== privateKeyPem.trim()) {
        throw new Error("lo descifrado no coincide con el original: no se borra el archivo en claro.");
      }

      // 4. Recién ahora se borra el material en claro. Si esto falla, el
      // usuario queda con la clave migrada Y respaldada en el bucket — no es
      // ideal, pero no es una pérdida de datos, así que lo reportamos como
      // fallo para que se reintente (el reintento entra por la rama
      // "ya migrado" de arriba y solo reintenta este borrado).
      const { error: removeError } = await db.storage.from("fiscal").remove([keyPath]);

      if (removeError) {
        throw new Error(
          `la clave quedó cifrada OK pero NO se pudo borrar el archivo en claro: ${removeError.message}`,
        );
      }

      console.log(`- ${clerkUserId}: MIGRADO (CUIT ${parsed.cuit}).`);
      migrados += 1;
    } catch (err) {
      fallidos += 1;
      console.error(
        `- ${clerkUserId}: FALLÓ — ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    }
  }

  // 5. Barrido final: que no quede ninguna clave en claro en el bucket.
  if (APLICAR) {
    const { data: carpetas, error: listError } = await db.storage.from("fiscal").list("", { limit: 1000 });

    if (listError) {
      console.error(`\nNo se pudo hacer el barrido final del bucket: ${listError.message}`);
      console.error("No podemos confirmar que no hayan quedado claves en claro. Revisá el bucket a mano.");
      process.exitCode = 1;
    } else {
      const sospechosos: string[] = [];
      let erroresDeListado = false;

      for (const carpeta of carpetas ?? []) {
        const { data: dentro, error: dentroError } = await db.storage.from("fiscal").list(carpeta.name);

        if (dentroError) {
          erroresDeListado = true;
          console.error(`  ! no se pudo listar "${carpeta.name}/": ${dentroError.message}`);
          continue;
        }

        for (const objeto of dentro ?? []) {
          if (objeto.name.endsWith(".key")) {
            sospechosos.push(`${carpeta.name}/${objeto.name}`);
          }
        }
      }

      if (sospechosos.length > 0) {
        console.error("\n!! QUEDARON CLAVES EN CLARO EN EL BUCKET:");
        sospechosos.forEach((s) => console.error(`   ${s}`));
        process.exitCode = 1;
      } else if (erroresDeListado) {
        console.error("\nBarrido final INCOMPLETO: no se pudieron listar algunas carpetas (ver arriba).");
        process.exitCode = 1;
      } else {
        console.log("\nBarrido final OK: no quedan claves en claro en el bucket.");
      }
    }
  }

  console.log(
    `\n${APLICAR ? "Aplicado" : "Simulacro"} — migrados: ${migrados}, ya migrados: ${yaMigrados}, salteados: ${salteados}, fallidos: ${fallidos}.`,
  );

  if (fallidos > 0) {
    console.error("\nHubo perfiles que fallaron. No se cierra el bucket hasta que esto dé 0 fallidos.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  const mensaje = err instanceof Error ? err.message : String(err);
  console.error(`\n${mensaje}`);
  process.exitCode = 1;
});
