/**
 * Acceso por invitación. Dos ejes independientes en `publicMetadata` de Clerk:
 *
 *   access: "granted"       → el usuario puede entrar a la app
 *   plan:   "lifetime"|"pro" → el usuario es ilimitado (ver lib/auth/plan.ts)
 *
 * Un plan pago implica acceso: no queremos dejar afuera por un descuido a
 * alguien que ya pagó.
 *
 * EL CASO DELICADO: para que `publicMetadata` llegue a los sessionClaims hay que
 * personalizar el session token en el Dashboard de Clerk (Sessions → Customize
 * session token) con { "metadata": "{{user.public_metadata}}" }. Si eso falta, el
 * claim viene vacío para TODOS. Bloquear en ese caso dejaría afuera hasta al
 * dueño, sin forma de entrar al dashboard a arreglarlo — así que ese caso
 * concreto FALLA ABIERTO y se loguea. "Metadata ausente" y "usuario sin permiso"
 * parecen lo mismo y son cosas muy distintas.
 */

import { isActivePlan, planFromSessionClaims } from "@/lib/auth/plan";

export const ACCESS_GRANTED_VALUES = new Set(["granted", "beta", "invited"]);

export type AccessReason =
  | "gate-disabled"
  | "paid-plan"
  | "granted"
  | "claims-unavailable"
  | "not-granted";

export type AccessDecision = {
  allowed: boolean;
  reason: AccessReason;
};

/** El objeto de metadata de los claims, o null si no vino ninguno. */
export function readMetadataFromClaims(
  sessionClaims: unknown,
): Record<string, unknown> | null {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return null;
  }

  const claims = sessionClaims as Record<string, unknown>;

  for (const key of ["metadata", "publicMetadata", "public_metadata"]) {
    const value = claims[key];
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

export function decideAccess(
  sessionClaims: unknown,
  gateEnabled: boolean,
): AccessDecision {
  if (!gateEnabled) {
    return { allowed: true, reason: "gate-disabled" };
  }

  if (isActivePlan(planFromSessionClaims(sessionClaims))) {
    return { allowed: true, reason: "paid-plan" };
  }

  const metadata = readMetadataFromClaims(sessionClaims);

  if (metadata === null) {
    // Clerk no está exponiendo publicMetadata. Es configuración rota, no un
    // usuario sin permiso: dejamos pasar y que el log lo grite.
    return { allowed: true, reason: "claims-unavailable" };
  }

  const access = metadata.access;
  const normalized =
    typeof access === "string" ? access.trim().toLowerCase() : "";

  if (ACCESS_GRANTED_VALUES.has(normalized)) {
    return { allowed: true, reason: "granted" };
  }

  return { allowed: false, reason: "not-granted" };
}
