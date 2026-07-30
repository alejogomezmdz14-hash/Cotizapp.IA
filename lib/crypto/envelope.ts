// Sobre criptográfico para material fiscal (clave privada de ARCA, tickets WSAA).
//
// Formato, fijo y versionado:
//   magic "CZFK" (4) || version (1) || keyId (1) || iv (12) || tag (16) || ciphertext
//
// Cambiar este layout obliga a re-cifrar el material de todos los usuarios, por
// eso lleva versión y keyId adentro.
//
// La AAD ata el criptograma a su dueño y a su propósito: GCM autentica el
// contenido, no el contexto, así que sin AAD un blob válido se descifra igual
// esté donde esté. La AAD se construye en el servidor a partir del clerkUserId
// del request; NUNCA se lee del blob.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const ENVELOPE_VERSION = 1;

const MAGIC = Buffer.from("CZFK", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + 1 + 1 + IV_BYTES + TAG_BYTES; // 34

const OFFSET_VERSION = MAGIC.length;
const OFFSET_KEY_ID = OFFSET_VERSION + 1;
const OFFSET_IV = OFFSET_KEY_ID + 1;
const OFFSET_TAG = OFFSET_IV + IV_BYTES;

export type EnvelopeKey = {
  keyId: number;
  key: Buffer;
};

export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeError";
  }
}

function buildAad(version: number, keyId: number, aadContext: string): Buffer {
  return Buffer.from(`${version}|${keyId}|${aadContext}`, "utf8");
}

export function seal(
  { keyId, key }: EnvelopeKey,
  plaintext: Buffer | string,
  aadContext: string,
): Buffer {
  if (key.byteLength !== 32) {
    throw new EnvelopeError("La clave de cifrado debe ser de 32 bytes.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  // setAAD va ANTES de cualquier update().
  cipher.setAAD(buildAad(ENVELOPE_VERSION, keyId, aadContext));

  const body = Buffer.concat([
    cipher.update(
      typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext,
    ),
    cipher.final(),
  ]);
  // getAuthTag solo es válido después de final().
  const tag = cipher.getAuthTag();

  return Buffer.concat([
    MAGIC,
    Buffer.from([ENVELOPE_VERSION, keyId]),
    iv,
    tag,
    body,
  ]);
}

export function open(
  keys: EnvelopeKey[],
  blob: Buffer,
  aadContext: string,
): Buffer {
  if (blob.byteLength < HEADER_BYTES || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new EnvelopeError("El material cifrado no tiene el formato esperado.");
  }

  const version = blob[OFFSET_VERSION];
  const keyId = blob[OFFSET_KEY_ID];

  if (version !== ENVELOPE_VERSION) {
    throw new EnvelopeError(`Versión de sobre no soportada: ${version}.`);
  }

  const match = keys.find((candidate) => candidate.keyId === keyId);
  if (!match) {
    throw new EnvelopeError(
      `No hay clave de cifrado disponible para el material guardado (keyId ${keyId}).`,
    );
  }

  const iv = blob.subarray(OFFSET_IV, OFFSET_TAG);
  const tag = blob.subarray(OFFSET_TAG, HEADER_BYTES);
  const body = blob.subarray(HEADER_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", match.key, iv);
  decipher.setAAD(buildAad(version, keyId, aadContext));
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    // Autenticación fallida: clave equivocada, AAD equivocada o blob alterado.
    // No distinguimos cuál para no dar señal a un atacante.
    throw new EnvelopeError("No se pudo descifrar el material fiscal.");
  }
}
