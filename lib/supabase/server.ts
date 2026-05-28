import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  getSupabaseEnv,
  supabaseCookieOptions,
} from "@/lib/supabase/config";

function getSupabaseServerEnv() {
  const env = getSupabaseEnv();

  if (env) {
    return env;
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
  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies without being allowed to write
          // them. Middleware handles the refresh path when writes are needed.
        }
      },
    },
  });
}
