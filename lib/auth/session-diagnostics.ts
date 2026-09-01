/**
 * Por qué una request llegó sin sesión, en una forma legible desde los Runtime
 * Logs de Vercel y sin filtrar credenciales.
 *
 * Contexto: el dueño se desloguea de Cotizapp cada vez que abre Safari en el
 * iPhone. El handshake del servidor está sano —verificado con `curl` contra
 * producción: con `__client_uat` Clerk dispara el handshake, y sin ninguna
 * cookie manda a `/sign-in`—, así que lo único que falta saber es **qué cookies
 * llegan realmente desde ese dispositivo**. No hay Mac para el Web Inspector,
 * así que se mide en el servidor.
 *
 * REGLA DE SEGURIDAD: acá nunca se registra el VALOR de una cookie. `__session`
 * es el JWT de sesión y `__client` es material de cliente de Clerk (que ni
 * siquiera es visible desde acá: vive en `clerk.cotizapp.lat`, otro host). Solo
 * se reportan presencia, forma y largo.
 */

/** Nombre base de la cookie que Clerk deja en el dominio de la app. */
const CLIENT_UAT_COOKIE = "__client_uat";
const SESSION_COOKIE = "__session";

/**
 * Clerk sufija sus cookies en algunos setups (`__session_a1b2c3d4`), así que se
 * acepta el nombre exacto o el nombre con sufijo.
 */
function matchesClerkCookie(name: string, base: string) {
  return name === base || name.startsWith(`${base}_`);
}

/**
 * `__client_uat` es un timestamp: `0` significa "Clerk marcó esta sesión como
 * cerrada", que es un caso muy distinto de "la cookie nunca llegó".
 */
export type ClientUatState = "ausente" | "cero" | "presente";

export type SessionVerdict =
  /** El navegador no mandó ninguna cookie. */
  | "sin-cookies"
  /** Mandó cookies, pero `__client_uat` no está entre ellas. */
  | "uat-ausente"
  /** `__client_uat=0`: Clerk cerró la sesión a propósito. */
  | "sesion-cerrada"
  /** Hay `__client_uat` con valor pero no `__session`, y aun así no hubo handshake. */
  | "handshake-pendiente"
  /** Llegaron las dos cookies y Clerk igual no validó la sesión. */
  | "token-rechazado";

export type SessionDiagnosis = {
  clientUat: ClientUatState;
  /** Largo del valor de `__client_uat` (un timestamp de Clerk son 10 dígitos). Nunca el valor. */
  clientUatLength: number;
  hasSessionToken: boolean;
  cookieCount: number;
  verdict: SessionVerdict;
};

export function diagnoseMissingSession(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): SessionDiagnosis {
  const clientUatCookie = cookies.find((cookie) =>
    matchesClerkCookie(cookie.name, CLIENT_UAT_COOKIE),
  );

  // `__client` no se busca nunca acá: además de ser material sensible, su
  // Domain es el de la FAPI (clerk.cotizapp.lat), así que jamás llega a este
  // servidor. Buscarlo por prefijo tampoco serviría: matchearía `__client_uat`.
  const hasSessionToken = cookies.some((cookie) =>
    matchesClerkCookie(cookie.name, SESSION_COOKIE),
  );

  const rawClientUat = clientUatCookie?.value?.trim() ?? null;

  const clientUat: ClientUatState =
    rawClientUat === null || rawClientUat === ""
      ? "ausente"
      : rawClientUat === "0"
        ? "cero"
        : "presente";

  return {
    clientUat,
    clientUatLength: rawClientUat?.length ?? 0,
    hasSessionToken,
    cookieCount: cookies.length,
    verdict: resolveVerdict({
      clientUat,
      hasSessionToken,
      cookieCount: cookies.length,
    }),
  };
}

function resolveVerdict(input: {
  clientUat: ClientUatState;
  hasSessionToken: boolean;
  cookieCount: number;
}): SessionVerdict {
  if (input.cookieCount === 0) {
    return "sin-cookies";
  }

  if (input.clientUat === "ausente") {
    return "uat-ausente";
  }

  if (input.clientUat === "cero") {
    return "sesion-cerrada";
  }

  return input.hasSessionToken ? "token-rechazado" : "handshake-pendiente";
}

/**
 * Qué hacer con cada veredicto. Va escrito en el propio log para que quien lo
 * lea no tenga que abrir el código: el log se mira meses después, una sola vez,
 * y justo cuando hay poco tiempo.
 */
export function explainSessionVerdict(verdict: SessionVerdict): string {
  switch (verdict) {
    case "sin-cookies":
      return "El navegador no mandó ninguna cookie. Puede ser un bot, una pestaña privada, o Safari con las cookies bloqueadas (Ajustes → Safari → Bloquear todas las cookies).";
    case "uat-ausente":
      return "Llegaron cookies pero no __client_uat: se está perdiendo en el dispositivo. Revisar perfiles de Safari (iOS 17+ da un cajón de cookies por perfil), si abrió desde el ícono de pantalla de inicio, y la gestión de almacenamiento del iPhone.";
    case "sesion-cerrada":
      return "__client_uat=0: Clerk cerró la sesión a propósito. Expiró el Maximum lifetime del plan (7 días en free), hubo un sign-out, o se revocó la sesión desde el dashboard.";
    case "handshake-pendiente":
      return "Hay __client_uat pero no __session y aun así no se disparó el handshake. Verificar en el dashboard de Clerk que clerk.cotizapp.lat esté verificado, y que la publishable key de Vercel y la secret key sean de la misma instancia.";
    case "token-rechazado":
      return "Llegaron __client_uat y __session pero Clerk no validó la sesión: el token está vencido o es de otra instancia.";
  }
}

/** El motivo que da Clerk, ya recortado a lo que se puede loguear. */
export type ClerkAuthReason = {
  status: string | null;
  /** Ej.: "session-token-and-uat-missing", "client-uat-but-no-session-token". */
  reason: string | null;
  message: string | null;
};

const EMPTY_AUTH_REASON: ClerkAuthReason = {
  status: null,
  reason: null,
  message: null,
};

/**
 * Los headers `x-clerk-auth-reason` / `x-clerk-auth-status` NO se pueden leer
 * desde adentro de `clerkMiddleware`: Clerk los appendea a la respuesta después
 * de que corre nuestro handler. El motivo sí está en `auth().debug`.
 *
 * PERO `debug()` devuelve el `authenticateContext` ENTERO —publishable key,
 * dominios, contexto de tokens— y solo trunca `secretKey`/`jwtKey` a 7
 * caracteres. Volcarlo crudo a los Runtime Logs sería exactamente la fuga que
 * `lib/log.ts` existe para evitar. Por eso acá se eligen tres campos a mano y
 * se descarta todo lo demás.
 */
export function extractClerkAuthReason(debug: unknown): ClerkAuthReason {
  let data: unknown = debug;

  if (typeof debug === "function") {
    try {
      data = (debug as () => unknown)();
    } catch {
      // El debug de Clerk nunca debería tirar, pero un diagnóstico no puede ser
      // la causa de un 500 en el middleware.
      return EMPTY_AUTH_REASON;
    }
  }

  if (!data || typeof data !== "object") {
    return EMPTY_AUTH_REASON;
  }

  const record = data as Record<string, unknown>;

  return {
    status: pickShortString(record.status),
    reason: pickShortString(record.reason),
    message: pickShortString(record.message),
  };
}

/**
 * Solo strings, y cortos: los identificadores de Clerk son slugs. El tope evita
 * que un campo inesperadamente largo (un token, un XML) entre al log de rebote.
 */
function pickShortString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
}

/**
 * Arma la línea de log. El prefijo `[auth]` es lo que se busca en los Runtime
 * Logs de Vercel.
 */
export function buildMissingSessionLog(input: {
  pathname: string;
  cookies: ReadonlyArray<{ name: string; value: string }>;
  /** `auth().debug` de Clerk. Opcional: si no está, el veredicto por cookies alcanza. */
  authDebug?: unknown;
}): {
  message: string;
  details: Record<string, string | number | boolean>;
} {
  const diagnosis = diagnoseMissingSession(input.cookies);
  const clerk = extractClerkAuthReason(input.authDebug);

  return {
    message: `[auth] sesión ausente: ${diagnosis.verdict}`,
    details: {
      ruta: input.pathname,
      veredicto: diagnosis.verdict,
      clientUat: diagnosis.clientUat,
      clientUatLargo: diagnosis.clientUatLength,
      sessionToken: diagnosis.hasSessionToken,
      cookies: diagnosis.cookieCount,
      clerkEstado: clerk.status ?? "desconocido",
      clerkMotivo: clerk.reason ?? "desconocido",
      siguiente: explainSessionVerdict(diagnosis.verdict),
    },
  };
}
