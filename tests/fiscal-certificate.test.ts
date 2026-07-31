import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import forge from "node-forge";

import {
  CertificateError,
  assertKeyMatchesCertificate,
  generateKeyAndCsr,
  parseCertificate,
} from "../lib/fiscal/certificate";

// CUITs sintéticos que pasan el dígito verificador módulo 11 de AFIP
// (calculados, no inventados a mano) — el punto 6 del review exige que el
// dígito verificador se valide, así que los fixtures tienen que ser CUITs
// que de verdad cierren.
const CUIT_VIGENTE = "20123456786";
const CUIT_OTRO = "27987654320";
// Mismo prefijo que CUIT_VIGENTE, pero con el último dígito cambiado para
// que el dígito verificador NO cierre.
const CUIT_DIGITO_VERIFICADOR_INVALIDO = "20123456787";

/** Genera un par y un certificado autofirmado con el CUIT en el serialNumber. */
function makeFixture(cuit: string, notAfterOffsetMs: number) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = "0a1b2c";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + notAfterOffsetMs);

  const attrs = [
    { name: "commonName", value: "cotizapp" },
    { shortName: "O", value: "Gomez Frate" },
    { name: "serialNumber", value: `CUIT ${cuit}` },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

  return { certPem: forge.pki.certificateToPem(cert), keyPem: privateKey };
}

/**
 * Genera un certificado autofirmado con control total sobre los atributos
 * del subject y las fechas de validez, para ejercitar los casos límite que
 * `makeFixture` no cubre (subject sin CUIT, CUIT duplicado, notBefore futuro,
 * etc).
 */
function makeCustomCert(
  attrs: Array<{ name?: string; shortName?: string; value: string }>,
  options?: { notBeforeOffsetMs?: number; notAfterOffsetMs?: number },
): string {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(
    Date.now() + (options?.notBeforeOffsetMs ?? -86_400_000),
  );
  cert.validity.notAfter = new Date(
    Date.now() + (options?.notAfterOffsetMs ?? 86_400_000),
  );
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

  return forge.pki.certificateToPem(cert);
}

// 2048 bits es lento: se genera una sola vez y se reusa.
const VIGENTE = makeFixture(CUIT_VIGENTE, 365 * 86_400_000);
const VENCIDO = makeFixture(CUIT_VIGENTE, -86_400_000);
const OTRO = makeFixture(CUIT_OTRO, 365 * 86_400_000);

test("parseCertificate extrae el CUIT del serialNumber del subject", () => {
  const parsed = parseCertificate(VIGENTE.certPem);
  assert.equal(parsed.cuit, CUIT_VIGENTE);
  assert.equal(parsed.subjectCommonName, "cotizapp");
  assert.ok(parsed.notAfter.getTime() > Date.now());
  assert.ok(parsed.certSerialNumber.length > 0);
});

test("parseCertificate rechaza un certificado vencido", () => {
  assert.throws(() => parseCertificate(VENCIDO.certPem), CertificateError);
});

test("parseCertificate rechaza algo que no es PEM", () => {
  assert.throws(() => parseCertificate("no soy un certificado"), CertificateError);
});

test("parseCertificate rechaza un certificado sin CUIT en el subject", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attrs = [{ name: "commonName", value: "sin-cuit" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forge.pki.privateKeyFromPem(privateKey), forge.md.sha256.create());

  assert.throws(
    () => parseCertificate(forge.pki.certificateToPem(cert)),
    CertificateError,
  );
});

test("parseCertificate rechaza un CUIT de 10 dígitos en el serialNumber", () => {
  const certPem = makeCustomCert([
    { name: "commonName", value: "cuit-corto" },
    { name: "serialNumber", value: "CUIT 2012345678" },
  ]);

  assert.throws(() => parseCertificate(certPem), CertificateError);
});

test("parseCertificate rechaza un CUIT de 12 dígitos en el serialNumber", () => {
  const certPem = makeCustomCert([
    { name: "commonName", value: "cuit-largo" },
    { name: "serialNumber", value: "CUIT 201234567860" },
  ]);

  assert.throws(() => parseCertificate(certPem), CertificateError);
});

test("parseCertificate rechaza un CUIT con dígito verificador inválido", () => {
  const certPem = makeCustomCert([
    { name: "commonName", value: "cuit-invalido" },
    { name: "serialNumber", value: `CUIT ${CUIT_DIGITO_VERIFICADOR_INVALIDO}` },
  ]);

  assert.throws(() => parseCertificate(certPem), CertificateError);
});

test("parseCertificate falla cerrado si el subject tiene más de un serialNumber", () => {
  // Ataque que probó el revisor: el CUIT de la víctima va primero, el del
  // atacante va segundo. `getField` de forge se queda con el primero sin
  // avisar — el módulo tiene que rechazar en vez de elegir uno.
  const certPem = makeCustomCert([
    { name: "commonName", value: "doble-serialnumber" },
    { name: "serialNumber", value: `CUIT ${CUIT_VIGENTE}` },
    { name: "serialNumber", value: `CUIT ${CUIT_OTRO}` },
  ]);

  assert.throws(() => parseCertificate(certPem), CertificateError);
});

test("parseCertificate rechaza un certificado cuya validez todavía no empezó", () => {
  const certPem = makeCustomCert(
    [
      { name: "commonName", value: "todavia-no-vale" },
      { name: "serialNumber", value: `CUIT ${CUIT_VIGENTE}` },
    ],
    {
      notBeforeOffsetMs: 10 * 365 * 86_400_000,
      notAfterOffsetMs: 11 * 365 * 86_400_000,
    },
  );

  assert.throws(() => parseCertificate(certPem), (error: unknown) => {
    assert.ok(error instanceof CertificateError);
    // El mensaje tiene que ser el de "todavía no vale", no el de "venció" —
    // son casos distintos y confundirlos desorienta al usuario.
    assert.doesNotMatch(error.message, /venció/i);
    assert.match(error.message, /todavía/i);
    return true;
  });
});

test("parseCertificate rechaza un PEM con más de un certificado (cadena completa)", () => {
  const cadenaCompleta = `${VIGENTE.certPem}\n${OTRO.certPem}`;

  assert.throws(() => parseCertificate(cadenaCompleta), CertificateError);
});

test("assertKeyMatchesCertificate acepta el par correcto", () => {
  assert.doesNotThrow(() =>
    assertKeyMatchesCertificate(VIGENTE.certPem, VIGENTE.keyPem),
  );
});

test("assertKeyMatchesCertificate rechaza una clave de otro certificado", () => {
  assert.throws(
    () => assertKeyMatchesCertificate(VIGENTE.certPem, OTRO.keyPem),
    CertificateError,
  );
});

test("assertKeyMatchesCertificate rechaza una clave que no es PEM", () => {
  assert.throws(
    () => assertKeyMatchesCertificate(VIGENTE.certPem, "cualquier cosa"),
    CertificateError,
  );
});

test("assertKeyMatchesCertificate rechaza un mismo módulo con exponente distinto", () => {
  // Mismo n que la clave real, pero con el exponente público alterado — no es
  // un par RSA matemáticamente válido, pero alcanza para ejercitar que la
  // comparación de `e` efectivamente corre (antes solo se comparaba `n`).
  const key = forge.pki.privateKeyFromPem(VIGENTE.keyPem);
  key.e = new forge.jsbn.BigInteger("10003", 16);
  const keyPemConOtroExponente = forge.pki.privateKeyToPem(key);

  assert.throws(
    () => assertKeyMatchesCertificate(VIGENTE.certPem, keyPemConOtroExponente),
    CertificateError,
  );
});

test("generateKeyAndCsr produce una clave y un CSR que se corresponden", () => {
  const { privateKeyPem, csrPem } = generateKeyAndCsr({
    cuit: CUIT_VIGENTE,
    businessName: "Gomez Frate",
    alias: "cotizapp",
  });

  assert.match(privateKeyPem, /-----BEGIN RSA PRIVATE KEY-----/);
  assert.match(csrPem, /-----BEGIN CERTIFICATE REQUEST-----/);

  const csr = forge.pki.certificationRequestFromPem(csrPem);
  assert.equal(csr.verify(), true);

  const key = forge.pki.privateKeyFromPem(privateKeyPem);
  const csrPublicKey = csr.publicKey as forge.pki.rsa.PublicKey;
  assert.equal(csrPublicKey.n.compareTo(key.n), 0);

  const serialNumber = csr.subject.getField({ name: "serialNumber" }) as
    | { value: string }
    | null;
  assert.equal(serialNumber?.value, `CUIT ${CUIT_VIGENTE}`);
});

test("generateKeyAndCsr codifica O y CN como UTF8String para que soporten ñ y tildes", () => {
  const { csrPem } = generateKeyAndCsr({
    cuit: CUIT_VIGENTE,
    businessName: "Ñandú Instalaciones S.R.L.",
    alias: "cotizapp-ñ",
  });

  const csr = forge.pki.certificationRequestFromPem(csrPem);

  // El CSR tiene que seguir verificando su propia firma después de forzar el
  // tag UTF8String en O y CN.
  assert.equal(csr.verify(), true);

  const organizationAttr = csr.subject.attributes.find(
    (attr) => attr.shortName === "O" || attr.name === "organizationName",
  ) as { value: string } | undefined;

  assert.ok(organizationAttr, "el CSR tiene que tener un atributo O");

  // El valor que expone forge es una "binary string" (un byte por char code,
  // sin decodificar), así que no se compara directo contra el texto con ñ.
  // Si el tag es UTF8String de verdad, esos bytes tienen que ser UTF-8 válido
  // y decodificar/recodificar sin pérdida.
  const rawBytes = Buffer.from(organizationAttr!.value, "binary");
  const decoded = rawBytes.toString("utf8");
  assert.equal(decoded, "Ñandú Instalaciones S.R.L.");
  assert.equal(Buffer.from(decoded, "utf8").compare(rawBytes), 0);

  const countryAttr = csr.subject.attributes.find(
    (attr) => attr.name === "countryName",
  ) as { value: string } | undefined;
  assert.equal(countryAttr?.value, "AR");
});
