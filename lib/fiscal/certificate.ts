// Parseo y validación de certificados X.509 de ARCA.
//
// La regla que arregla el hallazgo crítico de la auditoría: el CUIT que se usa
// para hablar con ARCA sale del `serialNumber` del subject del certificado, NO
// del campo que teclea el usuario. El formulario deja de ser una credencial.
//
// ARCA pone el CUIT en el subject como `serialNumber = "CUIT 20123456789"`.

import { generateKeyPairSync } from "node:crypto";

import forge from "node-forge";

export class CertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateError";
  }
}

export type ParsedCertificate = {
  cuit: string;
  serialNumber: string;
  notAfter: Date;
  subjectCommonName: string | null;
};

function readSubjectField(
  subject:
    | forge.pki.Certificate["subject"]
    | forge.pki.CertificateSigningRequest["subject"],
  name: string,
): string | null {
  const field = subject.getField({ name }) as { value?: unknown } | null;
  return typeof field?.value === "string" ? field.value : null;
}

export function parseCertificate(certPem: string): ParsedCertificate {
  const trimmed = certPem.trim();

  if (!trimmed.includes("-----BEGIN CERTIFICATE-----")) {
    throw new CertificateError(
      "El archivo no parece un certificado. Subí el .crt que bajaste de ARCA.",
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

  const rawSerialNumber = readSubjectField(cert.subject, "serialNumber");
  const cuitDigits = rawSerialNumber?.replace(/\D/g, "") ?? "";

  if (cuitDigits.length !== 11) {
    throw new CertificateError(
      "El certificado no tiene un CUIT en sus datos. Revisá que hayas bajado el correcto de ARCA.",
    );
  }

  if (cert.validity.notAfter.getTime() <= Date.now()) {
    throw new CertificateError(
      `Este certificado venció el ${cert.validity.notAfter.toLocaleDateString("es-AR")}. Generá uno nuevo en ARCA.`,
    );
  }

  return {
    cuit: cuitDigits,
    serialNumber: cert.serialNumber,
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

  if (publicKey.n.compareTo(privateKey.n) !== 0) {
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
    { shortName: "O", value: input.businessName.slice(0, 64) },
    { name: "commonName", value: input.alias.slice(0, 64) },
    { name: "serialNumber", value: `CUIT ${cuitDigits}` },
  ]);
  csr.sign(forgeKey, forge.md.sha256.create());

  return {
    privateKeyPem: privateKey,
    csrPem: forge.pki.certificationRequestToPem(csr),
  };
}
