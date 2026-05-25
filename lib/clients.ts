import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types";

export async function getClients(userId: string): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, user_id, name, email, phone, address, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar los clientes.");
  }

  return (data as Client[] | null) ?? [];
}
