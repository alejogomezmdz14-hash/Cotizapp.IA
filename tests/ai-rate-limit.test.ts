import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RATE_LIMITS,
  buildAiRateLimitMessage,
  consumeAiRateLimit,
  interpretRateLimitRow,
} from "../lib/ai/rate-limit";

test("interpretRateLimitRow permite cuando la fila viene vacía (sin identidad / fail-open)", () => {
  assert.deepEqual(interpretRateLimitRow(null), { allowed: true });
});

test("interpretRateLimitRow permite cuando el RPC autoriza", () => {
  assert.deepEqual(
    interpretRateLimitRow({ allowed: true, reason: null, retry_seconds: null }),
    { allowed: true },
  );
});

test("interpretRateLimitRow bloquea por minuto e incluye retry en segundos", () => {
  assert.deepEqual(
    interpretRateLimitRow({
      allowed: false,
      reason: "per_minute",
      retry_seconds: 42,
    }),
    { allowed: false, reason: "per_minute", retryInSeconds: 42 },
  );
});

test("interpretRateLimitRow bloquea por día", () => {
  assert.deepEqual(
    interpretRateLimitRow({
      allowed: false,
      reason: "per_day",
      retry_seconds: 3600,
    }),
    { allowed: false, reason: "per_day", retryInSeconds: 3600 },
  );
});

test("buildAiRateLimitMessage devuelve null cuando está permitido", () => {
  assert.equal(buildAiRateLimitMessage("chat", { allowed: true }), null);
});

test("buildAiRateLimitMessage usa copy del chat para el scope chat", () => {
  assert.match(
    buildAiRateLimitMessage("chat", { allowed: false, reason: "per_day" }) ?? "",
    /límite diario del chat/i,
  );
  assert.match(
    buildAiRateLimitMessage("chat", {
      allowed: false,
      reason: "per_minute",
      retryInSeconds: 30,
    }) ?? "",
    /chat.*30 segundos/i,
  );
});

test("buildAiRateLimitMessage usa copy genérico de IA para scopes de visión/audio", () => {
  assert.match(
    buildAiRateLimitMessage("vision", { allowed: false, reason: "per_day" }) ?? "",
    /límite diario de procesamiento con IA/i,
  );
  assert.match(
    buildAiRateLimitMessage("transcribe", {
      allowed: false,
      reason: "per_minute",
      retryInSeconds: 15,
    }) ?? "",
    /15 segundos/,
  );
});

test("AI_RATE_LIMITS define límites más estrictos para visión que para chat", () => {
  assert.ok(AI_RATE_LIMITS.vision.perMinute <= AI_RATE_LIMITS.chat.perMinute);
  assert.ok(AI_RATE_LIMITS.vision.perDay <= AI_RATE_LIMITS.chat.perDay);
});

test("consumeAiRateLimit pasa el scope y sus límites al RPC y mapea la respuesta", async () => {
  const calls: Array<Record<string, unknown>> = [];

  const decision = await consumeAiRateLimit("vision", {
    callRpc: async (args) => {
      calls.push(args);
      return {
        data: { allowed: false, reason: "per_minute", retry_seconds: 9 },
        error: null,
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    p_scope: "vision",
    p_max_per_minute: AI_RATE_LIMITS.vision.perMinute,
    p_max_per_day: AI_RATE_LIMITS.vision.perDay,
  });
  assert.deepEqual(decision, {
    allowed: false,
    reason: "per_minute",
    retryInSeconds: 9,
  });
});

test("consumeAiRateLimit hace fail-open (permite) si el RPC devuelve error", async () => {
  const decision = await consumeAiRateLimit("chat", {
    callRpc: async () => ({ data: null, error: { message: "boom" } }),
  });

  assert.deepEqual(decision, { allowed: true });
});

test("consumeAiRateLimit hace fail-open (permite) si el RPC lanza una excepción", async () => {
  const decision = await consumeAiRateLimit("chat", {
    callRpc: async () => {
      throw new Error("network down");
    },
  });

  assert.deepEqual(decision, { allowed: true });
});
