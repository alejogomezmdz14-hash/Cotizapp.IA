import { currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export async function getProfileByClerkId(clerkId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_id", clerkId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Profile | null) ?? null;
}

export async function ensureProfileForClerkUser(clerkId: string) {
  const existing = await getProfileByClerkId(clerkId);

  if (existing) {
    return existing;
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_clerk_profile", {
    p_clerk_id: clerkId,
    p_email: email,
  });

  if (error) {
    console.error("[clerk-profile] ensure_clerk_profile:", error.message);
    throw new Error(
      "No pudimos preparar tu cuenta. Verificá que la integración Clerk + Supabase esté activa en ambos dashboards.",
    );
  }

  return data as Profile;
}
