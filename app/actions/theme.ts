"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export async function saveThemePreferenceAction(theme: "light" | "dark") {
  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("profiles").update({ theme }).eq("id", user.id);

  revalidatePath("/", "layout");
}
