// AAD (Additional Authenticated Data) del sobre criptográfico de material
// fiscal (clave privada de ARCA).
//
// Módulo PURO a propósito: SIN `import "server-only"`. `lib/fiscal/credentials.ts`
// (server-only, corre en el runtime de Next.js) y
// `scripts/migrar-credenciales-fiscales.ts` (corre con `tsx`, fuera de ese
// runtime) necesitan armar EXACTAMENTE la misma AAD para el mismo
// `clerkUserId` — si divergen aunque sea en un carácter, `open()` en
// producción no puede descifrar lo que el otro lado selló: GCM no distingue
// "clave equivocada" de "AAD equivocada", así que el material queda
// ilegible para siempre y el síntoma aparece recién cuando un usuario
// intenta facturar. Antes cada lugar armaba el string a mano por separado;
// ahora hay una sola definición y los dos la importan.
//
// No importa `lib/supabase/service-role` ni nada que dependa de Next.js, así
// que no choca con la regla de ESLint que restringe quién puede importar el
// cliente service_role.

export const PURPOSE_PRIVATE_KEY = "fiscal-private-key";

export function aadFor(clerkUserId: string): string {
  return `${clerkUserId}|${PURPOSE_PRIVATE_KEY}`;
}
