import { cache } from "@/lib/react-cache";
import { auth } from "@clerk/nextjs/server";

import { ensureProfileForClerkUser } from "@/lib/auth/clerk-profile";
import { logError } from "@/lib/log";
import type { Profile } from "@/types";

/** Una sola lectura de Clerk por request (deduplica layout + páginas + Supabase). */
export const getClerkAuth = cache(async () => auth());

export const getClerkUserId = cache(async (): Promise<string | null> => {
  const { userId } = await getClerkAuth();
  return userId ?? null;
});

/** Token JWT de Clerk para Supabase RLS — cacheado por request. */
export const getClerkSupabaseToken = cache(async () => {
  const session = await getClerkAuth();
  return session.getToken();
});

/** Perfil vinculado al usuario Clerk (ensure_clerk_profile), cacheado por request. */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getClerkUserId();

  if (!userId) {
    return null;
  }

  try {
    return await ensureProfileForClerkUser(userId);
  } catch (error) {
    // Antes esto devolvía `null` en silencio. Un fallo de la RPC o de una
    // política RLS quedaba indistinguible de "este usuario todavía no tiene
    // perfil", así que la app lo mandaba al onboarding y en producción no
    // quedaba ningún rastro de la causa real.
    //
    // El clerkId NO se loguea: es un identificador de cliente (ver
    // .claude/claude-security-guidance.md, regla 1).
    logError("auth/session-profile", error);
    return null;
  }
});
