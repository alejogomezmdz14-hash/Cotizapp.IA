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

// 2048 bits es lento: se genera una sola vez y se reusa.
const VIGENTE = makeFixture("20123456789", 365 * 86_400_000);
const VENCIDO = makeFixture("20123456789", -86_400_000);
const OTRO = makeFixture("27987654321", 365 * 86_400_000);

test("parseCertificate extrae el CUIT del serialNumber del subject", () => {
  const parsed = parseCertificate(VIGENTE.certPem);
  assert.equal(parsed.cuit, "20123456789");
  assert.equal(parsed.subjectCommonName, "cotizapp");
  assert.ok(parsed.notAfter.getTime() > Date.now());
  assert.ok(parsed.serialNumber.length > 0);
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

test("generateKeyAndCsr produce una clave y un CSR que se corresponden", () => {
  const { privateKeyPem, csrPem } = generateKeyAndCsr({
    cuit: "20123456789",
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
  assert.equal(serialNumber?.value, "CUIT 20123456789");
});
