import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (url && anonKey) {
    return { url, anonKey };
  }

  const isProductionBuild =
    process.env.NEXT_PHASE === "phase-production-build";

  if (isProductionBuild) {
    return {
      url: "https://placeholder.supabase.co",
      anonKey: "placeholder-anon-key",
    };
  }

  throw new Error(
    "Falta configurar NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export async function createClient() {
  const { url, anonKey } = getSupabaseServerEnv();

  return createSupabaseClient(url, anonKey, {
    async accessToken() {
      const session = await auth();
      return session.getToken();
    },
  });
}
