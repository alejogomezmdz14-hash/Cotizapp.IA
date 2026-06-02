import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isProfileComplete } from "@/lib/profile";
import type { Profile } from "@/types";

function redirectWithSessionCookies(
  url: URL,
  sessionResponse: NextResponse,
) {
  const redirectResponse = NextResponse.redirect(url);

  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", request.url);
  const onboardingUrl = new URL("/onboarding", request.url);
  const dashboardUrl = new URL("/dashboard", request.url);

  const code = requestUrl.searchParams.get("code");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!code || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(loginUrl);
  }

  let sessionResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        sessionResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          sessionResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (exchangeError) {
    return NextResponse.redirect(loginUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, business_name, industry, logo_onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.redirect(loginUrl);
  }

  if (!existingProfile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      logo_onboarding_completed: false,
    });

    if (insertError) {
      return NextResponse.redirect(loginUrl);
    }

    return redirectWithSessionCookies(onboardingUrl, sessionResponse);
  }

  if (!isProfileComplete(existingProfile as Profile | null)) {
    return redirectWithSessionCookies(onboardingUrl, sessionResponse);
  }

  return redirectWithSessionCookies(dashboardUrl, sessionResponse);
}
