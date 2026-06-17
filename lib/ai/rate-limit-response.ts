import { NextResponse } from "next/server";

import {
  buildAiRateLimitMessage,
  consumeAiRateLimit,
  type AiRateLimitScope,
} from "@/lib/ai/rate-limit";

/**
 * Consume el rate-limit del scope y, si se alcanzó el tope, devuelve una
 * respuesta 429 lista para retornar desde el route handler. Si todavía hay
 * cupo, devuelve null y la ruta sigue normal.
 */
export async function enforceAiRateLimit(
  scope: AiRateLimitScope,
): Promise<NextResponse | null> {
  const decision = await consumeAiRateLimit(scope);

  if (decision.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      error:
        buildAiRateLimitMessage(scope, decision) ??
        "Demasiadas consultas con IA. Probá más tarde.",
    },
    {
      status: 429,
      headers: decision.retryInSeconds
        ? { "Retry-After": String(decision.retryInSeconds) }
        : undefined,
    },
  );
}
