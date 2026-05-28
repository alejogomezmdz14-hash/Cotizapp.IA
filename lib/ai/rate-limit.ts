type RateLimitWindow = {
  count: number;
  windowStart: number;
};

const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;
const CHAT_RATE_LIMIT_MAX_REQUESTS = 12;
const DAILY_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1_000;
const DAILY_RATE_LIMIT_MAX_REQUESTS = 200;

const minuteUsage = new Map<string, RateLimitWindow>();
const dailyUsage = new Map<string, RateLimitWindow>();

function consumeWindow(
  store: Map<string, RateLimitWindow>,
  key: string,
  windowMs: number,
  maxRequests: number,
) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || now - current.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (current.count >= maxRequests) {
    const retryInMs = windowMs - (now - current.windowStart);
    return { allowed: false, remaining: 0, retryInMs };
  }

  current.count += 1;
  return { allowed: true, remaining: maxRequests - current.count };
}

export type ChatRateLimitResult = {
  allowed: boolean;
  reason?: "per_minute" | "per_day";
  retryInSeconds?: number;
};

export function consumeChatRateLimit(userId: string): ChatRateLimitResult {
  const perMinute = consumeWindow(
    minuteUsage,
    userId,
    CHAT_RATE_LIMIT_WINDOW_MS,
    CHAT_RATE_LIMIT_MAX_REQUESTS,
  );

  if (!perMinute.allowed) {
    return {
      allowed: false,
      reason: "per_minute",
      retryInSeconds: Math.ceil((perMinute.retryInMs ?? 0) / 1000),
    };
  }

  const perDay = consumeWindow(
    dailyUsage,
    userId,
    DAILY_RATE_LIMIT_WINDOW_MS,
    DAILY_RATE_LIMIT_MAX_REQUESTS,
  );

  if (!perDay.allowed) {
    return {
      allowed: false,
      reason: "per_day",
      retryInSeconds: Math.ceil((perDay.retryInMs ?? 0) / 1000),
    };
  }

  return { allowed: true };
}

export function buildChatRateLimitMessage(result: ChatRateLimitResult) {
  if (result.allowed) {
    return null;
  }

  if (result.reason === "per_day") {
    return "Llegaste al límite diario del chat con IA. Volvé a intentarlo mañana.";
  }

  const retry = result.retryInSeconds ?? 60;
  return `Demasiadas consultas seguidas al chat. Probá de nuevo en ${retry} segundos.`;
}
