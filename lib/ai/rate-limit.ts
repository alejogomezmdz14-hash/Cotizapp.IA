// Rate-limit durable para los endpoints de IA (chat + visión + audio).
//
// Antes era un Map en memoria del proceso: en Vercel serverless cada instancia
// tenía su propio Map y se reiniciaba en cada cold start, así que el límite no
// se aplicaba de verdad entre instancias y el gasto de OpenAI quedaba sin tope
// efectivo. Ahora el conteo vive en Postgres (Supabase) y es atómico vía el RPC
// public.consume_ai_rate_limit, que keyea por el "sub" del JWT de Clerk.

export type AiRateLimitScope = "chat" | "vision" | "transcribe";

export type RateLimitDecision = {
  allowed: boolean;
  reason?: "per_minute" | "per_day";
  retryInSeconds?: number;
};

// Límites por scope. Visión usa gpt-4o (más caro) → tope más bajo que el chat.
export const AI_RATE_LIMITS: Record<
  AiRateLimitScope,
  { perMinute: number; perDay: number }
> = {
  chat: { perMinute: 12, perDay: 200 },
  vision: { perMinute: 8, perDay: 80 },
  transcribe: { perMinute: 15, perDay: 150 },
};

export type RateLimitRpcRow = {
  allowed: boolean;
  reason: string | null;
  retry_seconds: number | null;
};

export type RateLimitRpcArgs = {
  p_scope: AiRateLimitScope;
  p_max_per_minute: number;
  p_max_per_day: number;
};

export type RateLimitRpcCaller = (
  args: RateLimitRpcArgs,
) => Promise<{ data: RateLimitRpcRow | null; error: unknown }>;

/** Mapea la fila que devuelve el RPC al shape de decisión que usa la app. */
export function interpretRateLimitRow(
  row: RateLimitRpcRow | null,
): RateLimitDecision {
  if (!row || row.allowed) {
    return { allowed: true };
  }

  const reason = row.reason === "per_day" ? "per_day" : "per_minute";
  const retryInSeconds =
    typeof row.retry_seconds === "number" && row.retry_seconds > 0
      ? Math.ceil(row.retry_seconds)
      : 60;

  return { allowed: false, reason, retryInSeconds };
}

async function getDefaultRpcCaller(): Promise<RateLimitRpcCaller> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  return async (args) => {
    const { data, error } = await supabase
      .rpc("consume_ai_rate_limit", args)
      .maybeSingle<RateLimitRpcRow>();

    return { data: data ?? null, error };
  };
}

/**
 * Consume un "token" del rate-limit para el scope dado. Falla en modo abierto
 * (permite) si el RPC o la conexión fallan: bloquear toda la IA por un hipo de
 * la base sería peor UX que dejar pasar una request de más.
 */
export async function consumeAiRateLimit(
  scope: AiRateLimitScope,
  deps?: { callRpc?: RateLimitRpcCaller },
): Promise<RateLimitDecision> {
  const limits = AI_RATE_LIMITS[scope];

  try {
    const callRpc = deps?.callRpc ?? (await getDefaultRpcCaller());
    const { data, error } = await callRpc({
      p_scope: scope,
      p_max_per_minute: limits.perMinute,
      p_max_per_day: limits.perDay,
    });

    if (error) {
      console.error("[ai-rate-limit] RPC error; fail-open", {
        scope,
        reason: error instanceof Error ? error.message : "unknown",
      });
      return { allowed: true };
    }

    return interpretRateLimitRow(data);
  } catch (error) {
    console.error("[ai-rate-limit] unexpected error; fail-open", {
      scope,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { allowed: true };
  }
}

/** Mensaje amigable en español para mostrar cuando se alcanza el límite. */
export function buildAiRateLimitMessage(
  scope: AiRateLimitScope,
  decision: RateLimitDecision,
): string | null {
  if (decision.allowed) {
    return null;
  }

  if (decision.reason === "per_day") {
    return scope === "chat"
      ? "Llegaste al límite diario del chat con IA. Volvé a intentarlo mañana."
      : "Llegaste al límite diario de procesamiento con IA. Volvé a intentarlo mañana.";
  }

  const retry = decision.retryInSeconds ?? 60;

  return scope === "chat"
    ? `Demasiadas consultas seguidas al chat. Probá de nuevo en ${retry} segundos.`
    : `Demasiados procesamientos con IA seguidos. Probá de nuevo en ${retry} segundos.`;
}
