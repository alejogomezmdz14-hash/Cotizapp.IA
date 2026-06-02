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
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      clerk_id: clerkId,
      email,
      logo_onboarding_completed: false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}
