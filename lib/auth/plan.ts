/**
 * Autorización por plan. El acceso a la app se controla con
 * `publicMetadata.plan` de Clerk: sólo "lifetime" y "pro" entran; el resto
 * va a la lista de espera (`/waitlist`).
 *
 * IMPORTANTE: para que el plan llegue a los sessionClaims (y el middleware
 * pueda leerlo en el edge), hay que personalizar el session token en el
 * Clerk Dashboard → Sessions → Customize session token, agregando:
 *   { "metadata": "{{user.public_metadata}}" }
 * Sin eso, `sessionClaims.metadata` viene vacío y nadie pasa el gate.
 */

const ACTIVE_PLANS = new Set(["lifetime", "pro"]);

/** Extrae el plan de los sessionClaims, tolerando las distintas formas en
 * que Clerk puede exponer publicMetadata según cómo esté configurado el JWT. */
export function planFromSessionClaims(sessionClaims: unknown): string | null {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return null;
  }

  const claims = sessionClaims as Record<string, unknown>;
  const metadata =
    (claims.metadata as Record<string, unknown> | undefined) ??
    (claims.publicMetadata as Record<string, unknown> | undefined) ??
    (claims.public_metadata as Record<string, unknown> | undefined) ??
    null;

  const plan = metadata?.plan;
  return typeof plan === "string" ? plan : null;
}

export function isActivePlan(plan: string | null | undefined): boolean {
  return typeof plan === "string" && ACTIVE_PLANS.has(plan.trim().toLowerCase());
}

export function hasActivePlanFromClaims(sessionClaims: unknown): boolean {
  return isActivePlan(planFromSessionClaims(sessionClaims));
}
