// Llavero para el material fiscal cifrado.
//
// FISCAL_ENCRYPTION_KEY es base64 de 32 bytes EXACTOS, generada con
// `openssl rand -base64 32`. En Vercel va marcada SOLO para el entorno
// Production: si estuviera en Preview, cualquier deploy de un PR podría
// descifrar el material de producción.
//
// Rotación: se pone la nueva en FISCAL_ENCRYPTION_KEY, la vieja en
// FISCAL_ENCRYPTION_KEY_PREVIOUS, se sube ACTIVE_KEY_ID en una línea de código,
// se re-cifra el material y recién ahí se saca la vieja. El keyId viaja dentro
// del sobre, así que durante la transición conviven blobs de las dos.
//
// La validación es PEREZOSA a propósito: `next build` corre sin las variables de
// producción y un throw al importar rompería el build.

import type { EnvelopeKey } from "@/lib/crypto/envelope";

export const ACTIVE_KEY_ID = 1;

export type FiscalKeyring = {
  active: EnvelopeKey;
  all: EnvelopeKey[];
};

function decodeKey(value: string, varName: string): Buffer {
  const raw = Buffer.from(value.trim(), "base64");

  if (raw.byteLength !== 32) {
    throw new Error(
      `${varName} debe ser base64 de 32 bytes exactos (generala con "openssl rand -base64 32"). ` +
        `Se decodificaron ${raw.byteLength} bytes.`,
    );
  }

  return raw;
}

export function parseFiscalKeyring(env: Record<string, string | undefined>): FiscalKeyring {
  const rawActive = env.FISCAL_ENCRYPTION_KEY?.trim();

  if (!rawActive) {
    throw new Error(
      "Falta configurar FISCAL_ENCRYPTION_KEY. Sin esa clave no se puede guardar ni leer material fiscal.",
    );
  }

  const active: EnvelopeKey = {
    keyId: ACTIVE_KEY_ID,
    key: decodeKey(rawActive, "FISCAL_ENCRYPTION_KEY"),
  };

  const all: EnvelopeKey[] = [active];

  const rawPrevious = env.FISCAL_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (rawPrevious) {
    all.push({
      keyId: ACTIVE_KEY_ID - 1,
      key: decodeKey(rawPrevious, "FISCAL_ENCRYPTION_KEY_PREVIOUS"),
    });
  }

  return { active, all };
}

let cached: FiscalKeyring | null = null;

/** Llavero del proceso. Perezoso y memoizado. Tira si el entorno está mal. */
export function getFiscalKeyring(): FiscalKeyring {
  if (!cached) {
    cached = parseFiscalKeyring(process.env);
  }

  return cached;
}
