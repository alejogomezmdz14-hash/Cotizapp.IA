import { createBrowserClient } from "@supabase/ssr";

import {
  getSupabaseEnv,
  supabaseBrowserAuthOptions,
  supabaseCookieOptions,
} from "@/lib/supabase/config";

export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createBrowserClient(env.url, env.anonKey, {
    cookieOptions: supabaseCookieOptions,
    isSingleton: true,
    auth: supabaseBrowserAuthOptions,
  });
}
