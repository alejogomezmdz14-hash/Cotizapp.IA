import { NextResponse } from "next/server";

import { getProfileForQuotation, isProfileComplete } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", request.url);
  const onboardingUrl = new URL("/onboarding", request.url);
  const dashboardUrl = new URL("/dashboard", request.url);

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
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

  const existingProfile = await getProfileForQuotation(user.id);

  if (!existingProfile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      logo_onboarding_completed: false,
    });

    if (insertError) {
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(onboardingUrl);
  }

  if (!isProfileComplete(existingProfile as Profile | null)) {
    return NextResponse.redirect(onboardingUrl);
  }

  return NextResponse.redirect(dashboardUrl);
}
