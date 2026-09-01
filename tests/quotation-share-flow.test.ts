import assert from "node:assert/strict";
import test from "node:test";

import {
  canUndoQuotationShare,
  describeQuotationShareAttempt,
  retryQuotationShare,
  runNativeQuotationShare,
  type QuotationShareOutcome,
} from "../lib/quotation-share-flow";

type Registro = string[];

function armarDependencias(options: {
  soportado?: boolean;
  archivo?: string | null;
  outcome?: QuotationShareOutcome;
  registro: Registro;
}) {
  const { registro } = options;

  return {
    isSupported: () => options.soportado ?? true,
    prepareShare: async () => {
      registro.push("prepareShare");
      return { shareToken: "tok", whatsappFileText: "texto" };
    },
    buildShareFile: async () => {
      registro.push("buildShareFile");
      return options.archivo === undefined ? "archivo.pdf" : options.archivo;
    },
    presentShare: async () => {
      registro.push("presentShare");
      return options.outcome ?? ("shared" as QuotationShareOutcome);
    },
    markAsSent: async () => {
      registro.push("markAsSent");
    },
  };
}

test("solo se marca como enviada cuando el sistema entregó el archivo", async () => {
  // ESTE ES EL TEST DEL BUG. Antes se escribía status y sent_at en la base 24
  // líneas y dos await ANTES de que apareciera el menú nativo.
  const registro: Registro = [];
  const resultado = await runNativeQuotationShare(
    armarDependencias({ outcome: "shared", registro }),
  );

  assert.equal(resultado.status, "shared");
  assert.deepEqual(registro, [
    "prepareShare",
    "buildShareFile",
    "presentShare",
    "markAsSent",
  ]);
});

test("markAsSent va DESPUÉS de presentShare, nunca antes", async () => {
  const registro: Registro = [];
  await runNativeQuotationShare(armarDependencias({ outcome: "shared", registro }));

  assert.ok(
    registro.indexOf("markAsSent") > registro.indexOf("presentShare"),
    "se marcó como enviada antes de abrir el menú de compartir",
  );
});

test("cancelar el menú no marca la cotización como enviada", async () => {
  const registro: Registro = [];
  const resultado = await runNativeQuotationShare(
    armarDependencias({ outcome: "cancelled", registro }),
  );

  assert.equal(resultado.status, "cancelled");
  assert.equal(
    registro.includes("markAsSent"),
    false,
    'la app dijo "Enviada" cuando el usuario canceló',
  );
});

test("un gesto vencido tampoco la marca como enviada, y conserva el archivo", async () => {
  const registro: Registro = [];
  const resultado = await runNativeQuotationShare(
    armarDependencias({ outcome: "blocked", registro }),
  );

  assert.equal(resultado.status, "blocked");
  assert.equal(registro.includes("markAsSent"), false);
  assert.equal(
    resultado.status === "blocked" ? resultado.prepared : null,
    "archivo.pdf",
    "sin el archivo preparado el segundo toque no puede funcionar",
  );
});

test("cancelado y bloqueado son estados distintos", async () => {
  // Antes se colapsaban en el mismo bloque: quien cancelaba a propósito igual
  // recibía "Tocá «Compartir PDF»".
  const cancelado = await runNativeQuotationShare(
    armarDependencias({ outcome: "cancelled", registro: [] }),
  );
  const bloqueado = await runNativeQuotationShare(
    armarDependencias({ outcome: "blocked", registro: [] }),
  );

  assert.notEqual(cancelado.status, bloqueado.status);
  assert.notEqual(
    describeQuotationShareAttempt(cancelado.status)?.text,
    describeQuotationShareAttempt(bloqueado.status)?.text,
  );
});

test("sin soporte de compartir archivos no se toca nada y se cae a wa.me", async () => {
  const registro: Registro = [];
  const resultado = await runNativeQuotationShare(
    armarDependencias({ soportado: false, registro }),
  );

  assert.equal(resultado.status, "unsupported");
  assert.deepEqual(registro, [], "se preparó el envío en un dispositivo que no puede");
});

test("si no se puede armar el archivo, se cae a wa.me sin marcar nada", async () => {
  const registro: Registro = [];
  const resultado = await runNativeQuotationShare(
    armarDependencias({ archivo: null, registro }),
  );

  assert.equal(resultado.status, "unavailable");
  assert.deepEqual(registro, ["prepareShare", "buildShareFile"]);
});

test("el segundo toque marca como enviada solo si compartió", async () => {
  for (const outcome of ["shared", "cancelled", "blocked"] as const) {
    const registro: Registro = [];

    const resultado = await retryQuotationShare({
      prepared: "archivo.pdf",
      presentShare: async () => {
        registro.push("presentShare");
        return outcome;
      },
      markAsSent: async () => {
        registro.push("markAsSent");
      },
    });

    assert.equal(resultado, outcome);
    assert.equal(
      registro.includes("markAsSent"),
      outcome === "shared",
      `el segundo toque se comportó mal con outcome ${outcome}`,
    );
  }
});

test("el segundo toque no tiene awaits antes de abrir el menú", async () => {
  // iOS exige que navigator.share() salga inmediatamente después del toque.
  const registro: Registro = [];

  await retryQuotationShare({
    prepared: "archivo.pdf",
    presentShare: async () => {
      registro.push("presentShare");
      return "cancelled";
    },
    markAsSent: async () => {
      registro.push("markAsSent");
    },
  });

  assert.equal(registro[0], "presentShare");
});

test("ningún desenlace deja al usuario sin respuesta", async () => {
  for (const status of ["shared", "cancelled", "blocked"] as const) {
    const mensaje = describeQuotationShareAttempt(status);
    assert.ok(mensaje, `${status} no le dice nada al usuario`);
    assert.ok(mensaje.text.length > 20);
  }

  // Estos dos siguen al camino wa.me, que pone su propio mensaje.
  assert.equal(describeQuotationShareAttempt("unsupported"), null);
  assert.equal(describeQuotationShareAttempt("unavailable"), null);
});

test("el copy no afirma que el cliente recibió nada", async () => {
  // "shared" significa que el sistema entregó el payload al destino, no que el
  // usuario haya apretado enviar dentro de WhatsApp.
  const compartida = describeQuotationShareAttempt("shared");

  assert.ok(compartida);
  assert.equal(/recib/i.test(compartida.text), false);
  assert.ok(/compartiste/i.test(compartida.text));
});

test("el deshacer se ofrece solo si marcar como enviada cambió algo", () => {
  // Si ya estaba enviada, volver a borrador no sería deshacer sino romper.
  assert.equal(canUndoQuotationShare(null), true);
  assert.equal(canUndoQuotationShare("2026-08-30T10:00:00.000Z"), false);
});
