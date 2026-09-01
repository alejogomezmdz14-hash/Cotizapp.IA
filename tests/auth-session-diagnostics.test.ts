import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMissingSessionLog,
  diagnoseMissingSession,
  explainSessionVerdict,
  extractClerkAuthReason,
} from "../lib/auth/session-diagnostics";

test("sin ninguna cookie el veredicto es sin-cookies", () => {
  const diagnosis = diagnoseMissingSession([]);

  assert.equal(diagnosis.verdict, "sin-cookies");
  assert.equal(diagnosis.clientUat, "ausente");
  assert.equal(diagnosis.clientUatLength, 0);
  assert.equal(diagnosis.hasSessionToken, false);
  assert.equal(diagnosis.cookieCount, 0);
});

test("con cookies pero sin __client_uat el veredicto es uat-ausente", () => {
  // Este es el caso que se sospecha en el iPhone del dueño: el navegador manda
  // cookies (o sea que no las tiene bloqueadas) pero la de Clerk no está.
  const diagnosis = diagnoseMissingSession([
    { name: "theme", value: "dark" },
    { name: "NEXT_LOCALE", value: "es" },
  ]);

  assert.equal(diagnosis.verdict, "uat-ausente");
  assert.equal(diagnosis.clientUat, "ausente");
  assert.equal(diagnosis.cookieCount, 2);
});

test("__client_uat=0 se distingue de la cookie ausente", () => {
  // 0 significa "Clerk cerró esta sesión a propósito". Colapsarlo con "no
  // llegó" haría que el log apunte al dispositivo cuando el problema es el
  // Maximum lifetime del plan.
  const diagnosis = diagnoseMissingSession([{ name: "__client_uat", value: "0" }]);

  assert.equal(diagnosis.verdict, "sesion-cerrada");
  assert.equal(diagnosis.clientUat, "cero");
  assert.equal(diagnosis.clientUatLength, 1);
});

test("__client_uat con timestamp y sin __session es handshake pendiente", () => {
  const diagnosis = diagnoseMissingSession([
    { name: "__client_uat", value: "1756600000" },
  ]);

  assert.equal(diagnosis.verdict, "handshake-pendiente");
  assert.equal(diagnosis.clientUat, "presente");
  assert.equal(diagnosis.clientUatLength, 10);
  assert.equal(diagnosis.hasSessionToken, false);
});

test("con las dos cookies presentes el veredicto es token-rechazado", () => {
  const diagnosis = diagnoseMissingSession([
    { name: "__client_uat", value: "1756600000" },
    { name: "__session", value: "eyJhbGciOiJSUzI1NiJ9.payload.firma" },
  ]);

  assert.equal(diagnosis.verdict, "token-rechazado");
  assert.equal(diagnosis.hasSessionToken, true);
});

test("reconoce las cookies de Clerk con sufijo de instancia", () => {
  const diagnosis = diagnoseMissingSession([
    { name: "__client_uat_a1b2c3d4", value: "1756600000" },
    { name: "__session_a1b2c3d4", value: "eyJhbGciOiJSUzI1NiJ9.payload.firma" },
  ]);

  assert.equal(diagnosis.clientUat, "presente");
  assert.equal(diagnosis.hasSessionToken, true);
  assert.equal(diagnosis.verdict, "token-rechazado");
});

test("el log nunca incluye el valor de una cookie", () => {
  // __session es el JWT de sesión: si se filtra a los Runtime Logs, cualquiera
  // con acceso a observabilidad puede hacerse pasar por el usuario.
  const secretoSesion = "eyJhbGciOiJSUzI1NiJ9.PAYLOAD_SECRETO.FIRMA_SECRETA";
  const secretoUat = "1756600000";

  const log = buildMissingSessionLog({
    pathname: "/dashboard",
    cookies: [
      { name: "__client_uat", value: secretoUat },
      { name: "__session", value: secretoSesion },
    ],
  });

  const serializado = JSON.stringify(log);
  assert.equal(serializado.includes("PAYLOAD_SECRETO"), false);
  assert.equal(serializado.includes("FIRMA_SECRETA"), false);
  assert.equal(serializado.includes(secretoUat), false);
});

test("el log lleva el prefijo grepeable y el paso siguiente", () => {
  const log = buildMissingSessionLog({
    pathname: "/cotizaciones",
    cookies: [{ name: "theme", value: "dark" }],
  });

  assert.ok(log.message.startsWith("[auth] "));
  assert.equal(log.details.ruta, "/cotizaciones");
  assert.equal(log.details.veredicto, "uat-ausente");
  assert.equal(log.details.siguiente, explainSessionVerdict("uat-ausente"));
});

test("todos los veredictos tienen una explicación accionable", () => {
  const verdicts = [
    "sin-cookies",
    "uat-ausente",
    "sesion-cerrada",
    "handshake-pendiente",
    "token-rechazado",
  ] as const;

  for (const verdict of verdicts) {
    const explanation = explainSessionVerdict(verdict);
    assert.ok(explanation.length > 30, `${verdict} no explica qué hacer`);
  }
});

test("extractClerkAuthReason se queda solo con status, reason y message", () => {
  // debug() de Clerk devuelve el authenticateContext ENTERO. Si se loguea
  // crudo, la publishable key y los dominios de la instancia terminan en los
  // Runtime Logs de Vercel.
  const debug = () => ({
    status: "signed-out",
    reason: "session-token-and-uat-missing",
    message: "",
    publishableKey: "pk_live_CLAVE_PUBLICABLE",
    secretKey: "sk_live",
    jwtKey: "-----BE",
    domain: "clerk.cotizapp.lat",
    sessionToken: "eyJhbGciOiJSUzI1NiJ9.TOKEN_DE_SESION.FIRMA",
  });

  const extracted = extractClerkAuthReason(debug);

  assert.deepEqual(extracted, {
    status: "signed-out",
    reason: "session-token-and-uat-missing",
    message: null,
  });

  const serializado = JSON.stringify(extracted);
  assert.equal(serializado.includes("CLAVE_PUBLICABLE"), false);
  assert.equal(serializado.includes("TOKEN_DE_SESION"), false);
  assert.equal(serializado.includes("clerk.cotizapp.lat"), false);
});

test("extractClerkAuthReason acepta el objeto ya evaluado o nada", () => {
  assert.deepEqual(extractClerkAuthReason({ reason: "client-uat-but-no-session-token" }), {
    status: null,
    reason: "client-uat-but-no-session-token",
    message: null,
  });

  for (const entrada of [undefined, null, "texto suelto", 42]) {
    assert.deepEqual(extractClerkAuthReason(entrada), {
      status: null,
      reason: null,
      message: null,
    });
  }
});

test("un debug() que explota no rompe el middleware", () => {
  // Un diagnóstico nunca puede ser la causa de un 500 en el camino de auth.
  assert.deepEqual(
    extractClerkAuthReason(() => {
      throw new Error("boom");
    }),
    { status: null, reason: null, message: null },
  );
});

test("extractClerkAuthReason recorta valores largos inesperados", () => {
  const extracted = extractClerkAuthReason({ message: "x".repeat(500) });

  assert.ok(extracted.message);
  assert.ok(extracted.message.length <= 121);
});

test("el log incluye el motivo que da Clerk cuando está disponible", () => {
  const log = buildMissingSessionLog({
    pathname: "/dashboard",
    cookies: [],
    authDebug: () => ({ status: "signed-out", reason: "session-token-and-uat-missing" }),
  });

  assert.equal(log.details.clerkEstado, "signed-out");
  assert.equal(log.details.clerkMotivo, "session-token-and-uat-missing");
});

test("sin debug de Clerk el log igual sirve", () => {
  const log = buildMissingSessionLog({ pathname: "/dashboard", cookies: [] });

  assert.equal(log.details.clerkEstado, "desconocido");
  assert.equal(log.details.clerkMotivo, "desconocido");
  assert.equal(log.details.veredicto, "sin-cookies");
});
