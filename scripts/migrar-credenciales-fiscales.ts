/**
 * Migra las credenciales fiscales del bucket `fiscal` (clave privada en CLARO) a
 * la tabla `fiscal_credentials` (cifrada), y borra el material en claro.
 *
 * ORDEN OBLIGATORIO. Esto no es una checklist opcional: invertir el orden es
 * lo que evita que un error se vuelva irreversible.
 *
 *   1. Generá FISCAL_ENCRYPTION_KEY en tu máquina: `openssl rand -base64 32`.
 *   2. Guardala en tu gestor de contraseñas ANTES de seguir. Si la perdés
 *      después de migrar, perdés la clave de ARCA de todos los usuarios de
 *      forma irrecuperable — no hay "recuperar contraseña" para esto.
 *   3. Cargala en tu `.env.local` junto con las otras variables requeridas
 *      (ver más abajo) y corré el simulacro (sin --aplicar) para revisar qué
 *      va a pasar.
 *   4. Corré `--aplicar --confirmo-llave-respaldada` con esa misma clave.
 *   5. Recién ACÁ, con la migración ya terminada en "fallidos: 0", pegá ese
 *      MISMO valor de `.env.local` (no generes uno nuevo) en Vercel →
 *      Settings → Environment Variables → `FISCAL_ENCRYPTION_KEY`, marcada
 *      SOLO para el entorno Production.
 *
 * Por qué este orden y no el inverso (poner la clave en Vercel primero y
 * migrar después contra "la de producción"): Vercel no expone ninguna huella
 * ni forma de leer de vuelta una variable de entorno para comparar. No hay
 * nada del otro lado contra qué verificar que la clave de tu terminal es la
 * misma. Generando la clave acá primero y subiéndola a Vercel al final, el
 * peor caso posible es un error de tipeo al pegarla en Vercel — reversible,
 * se pega de nuevo. Migrar con una clave que después resulta no ser la que
 * queda en Vercel es, en cambio, irreversible: el script ya borró el PEM en
 * claro y el material queda ilegible en producción para siempre.
 *
 * Dentro de la migración en sí, por perfil, el orden también es estricto:
 *   1. leer y validar   2. escribir cifrado   3. RELEER Y DESCIFRAR para
 *   verificar   4. recién ahí borrar el objeto en claro   5. barrido final
 *
 * Si el paso 3 falla, no se borra nada: es preferible dejar el archivo en claro
 * a dejar a un usuario sin clave recuperable.
 *
 * Es idempotente: si un perfil ya tiene fila en `fiscal_credentials` (porque una
 * corrida anterior lo migró, o porque el usuario ya pasó por el flujo nuevo),
 * no se vuelve a cifrar nada — el material que hay en la tabla ya es la
 * autoridad. Se reintenta el borrado del archivo en claro, por si había
 * quedado pendiente, pero SOLO después de descifrar esa fila y (si el archivo
 * todavía está en el bucket) confirmar que coincide con él. Nunca se borra a
 * ciegas solo porque existe la fila.
 *
 * Uso (desde la raíz del repo). OJO: `tsx` NO carga `.env.local` solo —
 * hace falta `--env-file` explícito, si no el script va a decir "Faltan
 * variables de entorno" aunque `.env.local` las tenga:
 *   npx tsx --env-file=.env.local scripts/migrar-credenciales-fiscales.ts
 *     (simulacro, no toca nada)
 *   npx tsx --env-file=.env.local scripts/migrar-credenciales-fiscales.ts --aplicar --confirmo-llave-respaldada
 *
 * La huella que imprime el script (sha256 de la clave activa, nunca la clave
 * en sí) NO se compara contra nada de Vercel — no existe tal cosa. Sirve para
 * un único propósito legítimo: confirmar que dos corridas de este script (dos
 * terminales, o esta corrida y una anterior) están usando la misma
 * FISCAL_ENCRYPTION_KEY. `--huella=<hex>` es un chequeo opcional para ese caso.
 *
 * Variables de entorno requeridas: NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, FISCAL_ENCRYPTION_KEY (ver .env.local).
 *
 * Nota sobre imports: este script corre con `tsx`, fuera del runtime de
 * Next.js. Por eso usa `createClient` de `@supabase/supabase-js` directo en
 * vez de `lib/supabase/service-role.ts` (que tiene `import "server-only"` y
 * revienta apenas se importa fuera de un Server Component). La AAD, en
 * cambio, SÍ se importa de `lib/fiscal/aad.ts`: ese módulo es puro (sin
 * `import "server-only"`) exactamente para que este script y
 * `lib/fiscal/credentials.ts` compartan una única definición y no puedan
 * divergir.
 */

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { open, seal } from "../lib/crypto/envelope";
import { ACTIVE_KEY_ID, parseFiscalKeyring } from "../lib/crypto/fiscal-key";
import { aadFor } from "../lib/fiscal/aad";
import {
  CertificateError,
  assertKeyMatchesCertificate,
  parseCertificate,
  type ParsedCertificate,
} from "../lib/fiscal/certificate";

const APLICAR = process.argv.includes("--aplicar");
const CONFIRMO_LLAVE_RESPALDADA = process.argv.includes("--confirmo-llave-respaldada");
const HUELLA_HEX_LENGTH = 16;

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
        `Cargalas en .env.local y volvé a correr el script con --env-file, porque tsx NO carga ` +
        `.env.local solo:\n` +
        `  npx tsx --env-file=.env.local scripts/migrar-credenciales-fiscales.ts\n` +
        `(o exportalas a mano en la terminal donde corrés el script).`,
    );
  }

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  };
}

function calcularHuella(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, HUELLA_HEX_LENGTH);
}

function parseHuellaArg(argv: string[]): string | null {
  const prefijo = "--huella=";
  const arg = argv.find((a) => a.startsWith(prefijo));
  return arg ? arg.slice(prefijo.length).trim().toLowerCase() : null;
}

// Esta huella NO prueba nada contra Vercel: Vercel no expone ninguna huella
// de sus variables de entorno para comparar del otro lado, así que un
// chequeo "compará esto contra Production" no tiene con qué compararse — el
// camino de menor esfuerzo termina siendo copiar el número que este mismo
// proceso acaba de imprimir y pegarlo, lo que coincide siempre y no protege
// nada. El paso 3 de la migración (seal con keyring.active, open con
// keyring.all) tampoco prueba eso: corre TODO en este mismo proceso, así que
// solo confirma que la clave es autoconsistente consigo misma.
//
// Lo que sí sirve, y para lo que existe esta función: imprimir la huella
// siempre, para que el operador pueda confirmar que dos corridas propias de
// este script (dos terminales, o esta corrida contra una anterior) están
// usando la misma FISCAL_ENCRYPTION_KEY. Para eso alcanza con mirar el
// número a simple vista, y `--huella=<hex>` lo automatiza si hace falta.
//
// La garantía real de que la clave migrada es la que va a terminar en
// Vercel Production no sale de acá — sale de invertir el orden del
// procedimiento (ver el encabezado del archivo): generarla local primero,
// migrar con ella, y recién después pegar ese mismo valor en Vercel. Por
// eso el gate de --aplicar no pide una huella: pide una confirmación
// explícita de que el operador siguió ese orden.
function imprimirHuella(activeKey: Buffer, argv: string[]): void {
  const huellaCalculada = calcularHuella(activeKey);
  const huellaArgumento = parseHuellaArg(argv);

  console.log(
    `Huella de FISCAL_ENCRYPTION_KEY activa (sha256, primeros ${HUELLA_HEX_LENGTH} hex): ${huellaCalculada}`,
  );
  console.log(
    "Esta huella no se compara contra nada de Vercel (no existe tal cosa). Sirve solo para " +
      "confirmar que dos corridas de este script están usando la misma clave.\n",
  );

  if (huellaArgumento && huellaArgumento !== huellaCalculada) {
    throw new Error(
      `--huella=${huellaArgumento} no coincide con la huella calculada acá (${huellaCalculada}). ` +
        "Abortando sin tocar nada: esta terminal no tiene la misma FISCAL_ENCRYPTION_KEY que la corrida " +
        "con la que estás comparando.",
    );
  }
}

// Gate real de --aplicar. No pide una huella (ver `imprimirHuella` arriba
// sobre por qué eso no verifica nada): pide que el operador reconozca
// explícitamente que siguió el procedimiento seguro descripto en el
// encabezado del archivo, en particular que ya guardó la clave en su
// gestor de contraseñas. Sin este flag, --aplicar se niega a correr.
function exigirConfirmacionDeAplicar(): void {
  if (APLICAR && !CONFIRMO_LLAVE_RESPALDADA) {
    throw new Error(
      "Falta --confirmo-llave-respaldada para aplicar.\n\n" +
        "Ese flag confirma, bajo tu responsabilidad, que ya hiciste esto en este orden:\n" +
        "  1. Generaste FISCAL_ENCRYPTION_KEY vos (openssl rand -base64 32).\n" +
        "  2. La guardaste en tu gestor de contraseñas. Si la perdés después de esta migración, " +
        "el material fiscal de todos los usuarios queda irrecuperable.\n" +
        "  3. Corriste el simulacro (sin --aplicar) con esa clave y revisaste que lo que va a " +
        "pasar tiene sentido.\n" +
        "  4. Vas a pegar ESA MISMA clave (no una nueva) en Vercel → Production recién DESPUÉS " +
        "de que esta corrida con --aplicar termine en \"fallidos: 0\".\n\n" +
        "Si todo eso es cierto, volvé a correr agregando --confirmo-llave-respaldada. Si todavía no " +
        "generaste ni guardaste la clave, hacelo antes de seguir: no hay vuelta atrás una vez que " +
        "este script borra el material en claro del bucket.",
    );
  }
}

type FiscalProfileRow = {
  clerk_user_id: string;
  cuit: string | null;
  cert_path: string | null;
  key_path: string | null;
};

type BucketEntry = { name: string; id: string | null };

// PostgREST y Supabase Storage devuelven como máximo 1000 filas/objetos por
// página aunque se pida un límite mayor. Un solo `select`/`list` sin
// paginar corta en silencio: con más de 1000 perfiles, carpetas u objetos,
// el barrido reporta "OK" sin haber mirado el resto.
const PAGE_SIZE = 1000;

async function main() {
  const { supabaseUrl, serviceRoleKey } = requireEnv();

  // parseFiscalKeyring ya valida que FISCAL_ENCRYPTION_KEY sea base64 de 32
  // bytes exactos, con su propio mensaje claro si no lo es.
  const keyring = parseFiscalKeyring(process.env);

  console.log(APLICAR ? "Modo: APLICAR (va a escribir y borrar).\n" : "Modo: SIMULACRO (no toca nada).\n");

  // La huella es informativa (ver `imprimirHuella` sobre por qué no verifica
  // nada contra Vercel) y el gate real de --aplicar es la confirmación
  // explícita del operador. Los dos pueden abortar sin haber tocado la red.
  imprimirHuella(keyring.active.key, process.argv);
  exigirConfirmacionDeAplicar();

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function listarTodosLosPerfiles(): Promise<{
    perfiles: FiscalProfileRow[];
    error: string | null;
  }> {
    const perfiles: FiscalProfileRow[] = [];
    let desde = 0;

    for (;;) {
      const { data, error } = await db
        .from("fiscal_profiles")
        .select("clerk_user_id, cuit, cert_path, key_path")
        // Postgres no garantiza orden estable entre páginas sin ORDER BY: sin
        // esto, con muchas filas una podría repetirse o saltearse entre una
        // página y la siguiente.
        .order("clerk_user_id")
        .range(desde, desde + PAGE_SIZE - 1);

      if (error) {
        return { perfiles, error: error.message };
      }

      const pagina = (data ?? []) as FiscalProfileRow[];
      perfiles.push(...pagina);

      if (pagina.length < PAGE_SIZE) {
        break;
      }
      desde += PAGE_SIZE;
    }

    return { perfiles, error: null };
  }

  async function listarBucketCompleto(
    prefix: string,
  ): Promise<{ entradas: BucketEntry[]; error: string | null }> {
    const entradas: BucketEntry[] = [];
    let offset = 0;

    for (;;) {
      const { data, error } = await db.storage
        .from("fiscal")
        .list(prefix, { limit: PAGE_SIZE, offset });

      if (error) {
        return { entradas, error: error.message };
      }

      const pagina = data ?? [];
      entradas.push(...pagina.map((entrada) => ({ name: entrada.name, id: entrada.id })));

      if (pagina.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    return { entradas, error: null };
  }

  const { perfiles, error: perfilesError } = await listarTodosLosPerfiles();

  if (perfilesError) {
    throw new Error(`No se pudieron listar los perfiles fiscales: ${perfilesError}`);
  }

  let migrados = 0;
  let yaMigrados = 0;
  let salteados = 0;
  let fallidos = 0;

  for (const perfilRaw of perfiles) {
    const clerkUserId = String(perfilRaw.clerk_user_id);

    // Solo la clave privada es el material sensible que esta migración
    // existe para sacar del bucket. Sin `key_path` no hay nada en claro que
    // migrar (con o sin certificado).
    if (!perfilRaw.key_path) {
      console.log(`- ${clerkUserId}: no subió ninguna clave privada, se saltea.`);
      salteados += 1;
      continue;
    }

    const keyPath = String(perfilRaw.key_path);
    const certPath = perfilRaw.cert_path ? String(perfilRaw.cert_path) : null;
    const aad = aadFor(clerkUserId);

    try {
      // Chequeo de idempotencia: si ya hay fila en fiscal_credentials, el
      // upsert del paso 2 (de una corrida anterior) ya corrió. NO alcanza con
      // que la fila exista para borrar el archivo en claro: esa corrida
      // anterior pudo haber fallado justo en el paso 3 (verificación) y
      // haber dejado el PEM en claro a propósito. Por eso acá se repite la
      // verificación real — descifrar la fila y, si el archivo todavía está
      // en el bucket, compararlo — antes de decidir si hay algo para borrar.
      const { data: existente, error: existenteError } = await db
        .from("fiscal_credentials")
        .select("private_key_enc")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle();

      if (existenteError) {
        throw new Error(`no se pudo chequear si ya estaba migrado: ${existenteError.message}`);
      }

      if (existente) {
        let recuperadoExistente: string;
        try {
          recuperadoExistente = open(
            keyring.all,
            Buffer.from(String(existente.private_key_enc), "base64"),
            aad,
          ).toString("utf8");
        } catch (unsealError) {
          throw new Error(
            "ya había fila en fiscal_credentials, pero no se pudo descifrar " +
              `(${unsealError instanceof Error ? unsealError.message : "error desconocido"}); no se toca el archivo en claro.`,
          );
        }

        if (!APLICAR) {
          console.log(`- ${clerkUserId}: ya migrado en una corrida anterior, se verificó que descifra OK.`);
          yaMigrados += 1;
          continue;
        }

        const { data: keyFileExistente, error: keyFileDescargaError } = await db.storage
          .from("fiscal")
          .download(keyPath);

        if (keyFileDescargaError || !keyFileExistente) {
          // Lo más probable es que una corrida anterior ya haya borrado el
          // archivo en claro (remove() es idempotente) y solo faltara
          // confirmarlo. No hay nada para comparar ni para borrar acá. Si en
          // realidad el archivo seguía ahí por un error transitorio de esta
          // descarga puntual, el barrido final (paso 5) lo va a detectar y
          // reportar — esta rama no es la garantía final de eso.
          console.log(
            `- ${clerkUserId}: YA ESTABA MIGRADO (descifra OK); el archivo en claro ya no está en el bucket.`,
          );
          yaMigrados += 1;
          continue;
        }

        const contenidoEnClaro = (await keyFileExistente.text()).trim();

        if (contenidoEnClaro !== recuperadoExistente.trim()) {
          throw new Error(
            "ya había fila en fiscal_credentials, pero lo descifrado NO coincide con el archivo en claro " +
              "del bucket: no se borra nada. Revisar a mano antes de reintentar.",
          );
        }

        const { error: removeError } = await db.storage.from("fiscal").remove([keyPath]);
        if (removeError) {
          throw new Error(
            `ya estaba migrado y se verificó que coincide, pero no se pudo borrar el archivo en claro: ${removeError.message}`,
          );
        }

        console.log(
          `- ${clerkUserId}: YA ESTABA MIGRADO (se verificó que lo descifrado coincide con el archivo en claro; se borró).`,
        );
        yaMigrados += 1;
        continue;
      }

      // 1. Leer y validar, antes de tocar nada. La clave es obligatoria; el
      // certificado es opcional (ver Importante 3): si falta, está vencido o
      // no corresponde a la clave, igual migramos la clave — es el material
      // sensible que hay que sacar del bucket — y dejamos el certificado
      // pendiente de recarga.
      const keyFile = await db.storage.from("fiscal").download(keyPath);

      if (keyFile.error || !keyFile.data) {
        throw new Error(`no se pudo descargar la clave privada (${keyPath}): ${keyFile.error?.message ?? "sin datos"}`);
      }

      const privateKeyPem = await keyFile.data.text();

      let certPem: string | null = null;
      let parsed: ParsedCertificate | null = null;
      let motivoSinCertificado: string | null = null;

      if (certPath) {
        const certFile = await db.storage.from("fiscal").download(certPath);

        if (certFile.error || !certFile.data) {
          throw new Error(
            `no se pudo descargar el certificado (${certPath}): ${certFile.error?.message ?? "sin datos"}`,
          );
        }

        const certPemDescargado = await certFile.data.text();

        try {
          parsed = parseCertificate(certPemDescargado);
          assertKeyMatchesCertificate(certPemDescargado, privateKeyPem);
          certPem = certPemDescargado.trim();
        } catch (certError) {
          // Un certificado vencido o que no corresponde a la clave es una
          // validación inapropiada para material EN REPOSO: un certificado
          // vencido no hace que la clave privada deje de ser sensible ni de
          // necesitar salir del bucket. Solo los errores de validación del
          // certificado (CertificateError) toman este camino; un fallo real
          // de red/descarga arriba sigue siendo un FALLÓ normal.
          if (certError instanceof CertificateError) {
            motivoSinCertificado = certError.message;
          } else {
            throw certError;
          }
        }
      } else {
        motivoSinCertificado = "no subió certificado";
      }

      let cuitFinal: string;

      if (parsed) {
        cuitFinal = parsed.cuit;
        const declarado = String(perfilRaw.cuit ?? "").replace(/\D/g, "");
        if (declarado && declarado !== parsed.cuit) {
          console.warn(
            `  ! ${clerkUserId}: el CUIT declarado (${declarado}) no es el del certificado (${parsed.cuit}). Gana el del certificado.`,
          );
        }
      } else {
        // Sin certificado válido no hay de dónde leer el CUIT con confianza
        // (ver el contrato de confianza en lib/fiscal/certificate.ts): se
        // usa el que el perfil tiene declarado, a sabiendas de que es
        // provisorio, igual que hace `savePrivateKey` mientras el usuario
        // todavía no subió certificado.
        cuitFinal = String(perfilRaw.cuit ?? "").replace(/\D/g, "");
        if (cuitFinal.length !== 11) {
          throw new Error(
            `no tiene certificado válido (${motivoSinCertificado}) y tampoco hay un CUIT de 11 dígitos ` +
              "cargado en fiscal_profiles para poder migrar la clave igual.",
          );
        }
      }

      if (!APLICAR) {
        if (parsed) {
          console.log(
            `- ${clerkUserId}: LISTO PARA MIGRAR (CUIT ${parsed.cuit}, vence ${parsed.notAfter.toISOString().slice(0, 10)}).`,
          );
        } else {
          console.log(
            `- ${clerkUserId}: LISTO PARA MIGRAR SOLO LA CLAVE, sin certificado (${motivoSinCertificado}; ` +
              `CUIT ${cuitFinal} tomado de fiscal_profiles). Va a tener que resubir el certificado después.`,
          );
        }
        migrados += 1;
        continue;
      }

      // 2. Escribir cifrado. Base64 porque `private_key_enc` es `text`, no
      // `bytea`: PostgREST transporta JSON y no puede llevar binario — un
      // Buffer se serializaría como {"type":"Buffer","data":[...]} y
      // corrompería el sobre.
      const blob = seal(keyring.active, privateKeyPem, aad);

      const { error: upsertError } = await db.from("fiscal_credentials").upsert(
        {
          clerk_user_id: clerkUserId,
          cuit: cuitFinal,
          private_key_enc: blob.toString("base64"),
          cert_pem: certPem,
          cert_serial: parsed?.certSerialNumber ?? null,
          cert_not_after: parsed?.notAfter.toISOString() ?? null,
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
      // "ya migrado" de arriba y solo reintenta este borrado, previa
      // reverificación).
      const { error: removeError } = await db.storage.from("fiscal").remove([keyPath]);

      if (removeError) {
        throw new Error(
          `la clave quedó cifrada OK pero NO se pudo borrar el archivo en claro: ${removeError.message}`,
        );
      }

      if (parsed) {
        console.log(`- ${clerkUserId}: MIGRADO (CUIT ${parsed.cuit}).`);
      } else {
        console.log(
          `- ${clerkUserId}: MIGRADO SOLO LA CLAVE, sin certificado (${motivoSinCertificado}). ` +
            `CUIT ${cuitFinal} tomado de fiscal_profiles — va a tener que resubir el certificado en Cotizapp.`,
        );
      }
      migrados += 1;
    } catch (err) {
      fallidos += 1;
      console.error(
        `- ${clerkUserId}: FALLÓ — ${err instanceof Error ? err.message : "error desconocido"}`,
      );
    }
  }

  // 5. Barrido final: reporta qué claves en claro quedan en el bucket.
  // Corre SIEMPRE, también en simulacro — es de solo lectura, así que no hay
  // riesgo, y en simulacro es lo que le muestra al operador el trabajo
  // pendiente real (todo lo que todavía no se migró) antes de decidir aplicar.
  // Solo en --aplicar el resultado hace fallar el script: en simulacro,
  // encontrar claves en claro es el estado esperado, no un error.
  //
  // Pagina de verdad el listado de la raíz y el de cada carpeta (Supabase
  // Storage corta en 100 objetos por página si no se pide `limit`
  // explícito, y en 1000 aunque se pida más), y contempla un `.key` suelto
  // directamente en la raíz del bucket (no todo lo que hay en la raíz es una
  // carpeta: los objetos de Supabase Storage traen `id` no nulo, las
  // "carpetas" —en realidad prefijos— traen `id: null`).
  {
    const { entradas: raiz, error: raizError } = await listarBucketCompleto("");

    if (raizError) {
      console.error(`\nEl barrido final NO pudo completarse: no se pudo listar la raíz del bucket (${raizError}).`);
      console.error("No podemos confirmar el estado del bucket. Revisalo a mano.");
      if (APLICAR) {
        process.exitCode = 1;
      }
    } else {
      const sospechosos: string[] = [];
      let barridoIncompleto = false;

      for (const entrada of raiz) {
        if (entrada.id !== null) {
          // Es un archivo suelto en la raíz, no una carpeta.
          if (entrada.name.endsWith(".key")) {
            sospechosos.push(entrada.name);
          }
          continue;
        }

        const { entradas: dentro, error: dentroError } = await listarBucketCompleto(entrada.name);

        if (dentroError) {
          barridoIncompleto = true;
          console.error(`  ! no se pudo listar "${entrada.name}/": ${dentroError}`);
          continue;
        }

        for (const objeto of dentro) {
          if (objeto.name.endsWith(".key")) {
            sospechosos.push(`${entrada.name}/${objeto.name}`);
          }
        }
      }

      if (sospechosos.length > 0) {
        if (APLICAR) {
          console.error("\n!! QUEDARON CLAVES EN CLARO EN EL BUCKET:");
          sospechosos.forEach((s) => console.error(`   ${s}`));
          process.exitCode = 1;
        } else {
          console.log(`\nBarrido (simulacro) — trabajo pendiente: ${sospechosos.length} clave(s) en claro todavía en el bucket:`);
          sospechosos.forEach((s) => console.log(`   ${s}`));
        }
      } else if (barridoIncompleto) {
        console.error(
          "\nEl barrido NO pudo completarse: no se pudieron listar algunas carpetas (ver arriba). " +
            "No lo tomes como OK — revisá el bucket a mano" +
            (APLICAR ? " antes de cerrar el acceso." : "."),
        );
        if (APLICAR) {
          process.exitCode = 1;
        }
      } else if (APLICAR) {
        console.log("\nBarrido final OK: no quedan claves en claro en el bucket.");
      } else {
        console.log("\nBarrido (simulacro): no queda ninguna clave en claro en el bucket.");
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
