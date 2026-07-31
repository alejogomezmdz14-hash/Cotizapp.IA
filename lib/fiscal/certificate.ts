// Parseo y validación de certificados X.509 de ARCA.
//
// La regla que arregla el hallazgo crítico de la auditoría: el CUIT que se usa
// para hablar con ARCA sale del `serialNumber` del subject del certificado, NO
// del campo que teclea el usuario. El formulario deja de ser una credencial.
//
// ARCA pone el CUIT en el subject como `serialNumber = "CUIT 20123456789"`.
//
// ============================================================================
// CONTRATO DE CONFIANZA — LEÉ ESTO ANTES DE USAR EL CUIT QUE DEVUELVE ESTE MÓDULO
// ============================================================================
//
// El CUIT que devuelve `parseCertificate` NO ES CONFIABLE hasta que una
// autenticación real contra el WSAA de ARCA haya tenido éxito usando ESE
// MISMO certificado. Acá se verifica FORMA Y POSESIÓN: que el PEM esté bien
// armado y traiga un solo certificado, que el subject tenga un único CUIT con
// dígito verificador válido, que la clave privada se corresponda con el
// certificado, y que el certificado esté vigente (ni vencido ni todavía sin
// empezar). Lo que este módulo NO verifica es PROCEDENCIA: nada acá comprueba
// que el certificado lo haya emitido de verdad ARCA.
//
// Un certificado autofirmado con el CUIT de otra persona pasa todas estas
// validaciones sin ningún problema — lo sube el propio usuario, así que el
// CUIT del serialNumber sigue siendo ni más ni menos que un dato que el
// usuario controla, exactamente igual que si lo hubiera tecleado a mano en un
// formulario. Lo único que de verdad impide emitir con una identidad ajena es
// que ARCA rechaza un CMS firmado con un certificado que ella no emitió — esa
// es la barrera real, y vive del otro lado, en el WSAA.
//
// Por eso: NINGÚN caché, NINGUNA clave de identidad y NINGÚN índice puede
// keyearse por este CUIT antes de esa verificación contra WSAA. La identidad
// del inquilino es SIEMPRE el `clerk_user_id`, nunca el CUIT del certificado.
//
// Deliberadamente NO se valida acá la cadena de certificación contra la CA
// raíz de ARCA — implicaría empaquetar y rotar ese certificado raíz en el
// repo. Es una decisión de alcance para esta fase, no un descuido.

import { generateKeyPairSync } from "node:crypto";

import forge from "node-forge";

import { isValidCuitFormat, normalizeCuit } from "@/lib/fiscal-profile";

export class CertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateError";
  }
}

export type ParsedCertificate = {
  /**
   * CUIT leído del `serialNumber` del subject del certificado.
   *
   * NO CONFIABLE hasta que una autenticación real contra el WSAA de ARCA haya
   * tenido éxito con este mismo certificado — ver el contrato de confianza en
   * la cabecera de este archivo. No usar como clave de caché, de identidad ni
   * de índice antes de esa verificación.
   */
  cuit: string;
  /**
   * Número de serie X.509 del certificado (el que asigna quien lo firma).
   * OJO: no es lo mismo que el `serialNumber` del subject, que es el campo
   * donde vive el CUIT — son dos datos distintos con nombres parecidos, a
   * propósito separados acá para no confundirlos.
   */
  certSerialNumber: string;
  notAfter: Date;
  subjectCommonName: string | null;
};

// @types/node-forge tipa `valueTagClass` como `asn1.Class` (la clase del tag:
// UNIVERSAL/APPLICATION/CONTEXT/PRIVATE), pero en runtime lo que forge espera
// ahí es el tag del tipo de string ASN.1 (UTF8String = 12), que vive en
// `asn1.Type`. Es un error del paquete de tipos, no nuestro — casteamos acá,
// puntualmente, para no tener que usar `any` en el resto del archivo.
const UTF8_STRING_TAG = forge.asn1.Type.UTF8 as unknown as forge.asn1.Class;

function readSubjectField(
  subject:
    | forge.pki.Certificate["subject"]
    | forge.pki.CertificateSigningRequest["subject"],
  name: string,
): string | null {
  const field = subject.getField({ name }) as { value?: unknown } | null;
  return typeof field?.value === "string" ? field.value : null;
}

/**
 * Devuelve el valor del `serialNumber` del subject (donde ARCA pone el
 * CUIT), pero falla cerrado si aparece más de una vez. `getField` de forge
 * devuelve la primera coincidencia y no avisa si hay otra — eso permite armar
 * un subject con el CUIT de la víctima primero y el propio después, y que el
 * sistema se quede con el de la víctima sin que nadie se entere. Por eso acá
 * se recorren los atributos a mano en vez de usar `getField`.
 */
function readCuitSerialNumber(
  subject: forge.pki.Certificate["subject"],
): string | null {
  const matches = subject.attributes.filter(
    (attribute) => attribute.name === "serialNumber",
  );

  if (matches.length > 1) {
    throw new CertificateError(
      "El certificado tiene más de un CUIT cargado en sus datos y no podemos saber cuál es el correcto. Pedí que te generen un certificado nuevo en ARCA.",
    );
  }

  const value = matches[0]?.value;
  return typeof value === "string" ? value : null;
}

export function parseCertificate(certPem: string): ParsedCertificate {
  const trimmed = certPem.trim();

  if (!trimmed.includes("-----BEGIN CERTIFICATE-----")) {
    throw new CertificateError(
      "El archivo no parece un certificado. Subí el .crt que bajaste de ARCA.",
    );
  }

  const certificateBlockCount = (
    trimmed.match(/-----BEGIN CERTIFICATE-----/g) ?? []
  ).length;

  if (certificateBlockCount > 1) {
    throw new CertificateError(
      "El archivo tiene más de un certificado, como si fuera la cadena completa con el intermedio incluido. Subí solo tu certificado, el que ARCA generó para tu CUIT.",
    );
  }

  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(trimmed);
  } catch {
    throw new CertificateError(
      "No pudimos leer el certificado. Revisá que sea el archivo que bajaste de ARCA y que esté completo.",
    );
  }

  const rawSerialNumber = readCuitSerialNumber(cert.subject);
  const cuitDigits = rawSerialNumber?.replace(/\D/g, "") ?? "";

  if (cuitDigits.length !== 11) {
    throw new CertificateError(
      "El certificado no tiene un CUIT en sus datos. Revisá que hayas bajado el correcto de ARCA.",
    );
  }

  if (!isValidCuitFormat(normalizeCuit(cuitDigits))) {
    throw new CertificateError(
      "El CUIT que trae el certificado no es válido: el dígito verificador no cierra. Puede que el archivo esté dañado — descargá de nuevo el certificado desde ARCA.",
    );
  }

  const now = Date.now();

  if (cert.validity.notBefore.getTime() > now) {
    throw new CertificateError(
      `Este certificado todavía no es válido: empieza a regir el ${cert.validity.notBefore.toLocaleDateString("es-AR")}. Si la fecha te parece rara, generá uno nuevo en ARCA.`,
    );
  }

  if (cert.validity.notAfter.getTime() <= now) {
    throw new CertificateError(
      `Este certificado venció el ${cert.validity.notAfter.toLocaleDateString("es-AR")}. Generá uno nuevo en ARCA.`,
    );
  }

  return {
    cuit: cuitDigits,
    certSerialNumber: cert.serialNumber,
    notAfter: cert.validity.notAfter,
    subjectCommonName: readSubjectField(cert.subject, "commonName"),
  };
}

export function assertKeyMatchesCertificate(
  certPem: string,
  privateKeyPem: string,
): void {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(certPem.trim());
  } catch {
    throw new CertificateError("No pudimos leer el certificado.");
  }

  let privateKey: forge.pki.rsa.PrivateKey;
  try {
    // privateKeyFromPem acepta tanto PKCS#1 ("RSA PRIVATE KEY") como PKCS#8
    // ("PRIVATE KEY") sin cifrar, que son los dos formatos que entrega openssl.
    privateKey = forge.pki.privateKeyFromPem(privateKeyPem.trim());
  } catch {
    throw new CertificateError(
      "No pudimos leer la clave privada. Tiene que ser el .key sin contraseña.",
    );
  }

  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;

  // Comparamos módulo (n) Y exponente (e). Compartir el módulo con el
  // exponente distinto no es una falla de seguridad (haría falta factorizar
  // n para explotarlo), pero si no lo chequeamos acá el error recién aparece
  // más adelante, del lado de ARCA, con un mensaje que no le va a decir nada
  // al usuario.
  const modulusMatches = publicKey.n.compareTo(privateKey.n) === 0;
  const exponentMatches = publicKey.e.compareTo(privateKey.e) === 0;

  if (!modulusMatches || !exponentMatches) {
    throw new CertificateError(
      "El certificado y la clave privada no se corresponden. Subí el .crt que ARCA generó a partir de tu pedido.",
    );
  }
}

export function generateKeyAndCsr(input: {
  cuit: string;
  businessName: string;
  alias: string;
}): { privateKeyPem: string; csrPem: string } {
  const cuitDigits = input.cuit.replace(/\D/g, "");

  if (cuitDigits.length !== 11) {
    throw new CertificateError("El CUIT tiene que tener 11 dígitos.");
  }

  // Generación nativa: node-forge en JS puro tarda segundos para 2048 bits.
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const forgeKey = forge.pki.privateKeyFromPem(privateKey);

  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = forge.pki.setRsaPublicKey(forgeKey.n, forgeKey.e);
  csr.setSubject([
    { name: "countryName", value: "AR" },
    // O (razón social) y CN se fuerzan a UTF8String: el default de forge es
    // PrintableString, que ni siquiera tiene ñ ni tildes en su charset, y
    // "Ñandú Instalaciones S.R.L." es un nombre de fantasía tan común como
    // cualquier otro en Argentina. countryName se deja como PrintableString
    // porque "AR" es ASCII puro y ese es el tag correcto para ese campo.
    {
      shortName: "O",
      value: input.businessName.slice(0, 64),
      valueTagClass: UTF8_STRING_TAG,
    },
    {
      name: "commonName",
      value: input.alias.slice(0, 64),
      valueTagClass: UTF8_STRING_TAG,
    },
    { name: "serialNumber", value: `CUIT ${cuitDigits}` },
  ]);
  csr.sign(forgeKey, forge.md.sha256.create());

  return {
    privateKeyPem: privateKey,
    csrPem: forge.pki.certificationRequestToPem(csr),
  };
}
