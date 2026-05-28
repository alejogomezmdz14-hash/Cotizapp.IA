import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}

export async function createClient() {
  const { url, anonKey } = getSupabaseServerEnv();
  const cookieStore = cookies();

  return createServerClient(
    url,
    anonKey,
    {
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
    },
  );
}
