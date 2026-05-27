"use server";

import { revalidatePath } from "next/cache";

import {
  assertSingleClientMutation,
  countClientQuotations,
  getClientDeleteFailureMessage,
  parseClientFormData,
} from "@/lib/clients";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

function revalidateClientViews() {
  revalidatePath("/clientes");
  revalidatePath("/cotizaciones/nueva");
}

export async function createClientAction(formData: FormData) {
  const user = await requireUser();
  const values = parseClientFormData(formData);
  const supabase = await createClient();

  const { error } = await supabase.from("clients").insert({
    user_id: user.id,
    ...values,
  });

  if (error) {
    throw new Error("No se pudo crear el cliente.");
  }

  revalidateClientViews();
}

export async function updateClientAction(id: string, formData: FormData) {
  const user = await requireUser();
  const values = parseClientFormData(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .update(values)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error("No se pudo actualizar el cliente.");
  }

  assertSingleClientMutation(data, "update");

  revalidateClientViews();
}

export async function getClientQuotationCountAction(clientId: string) {
  const user = await requireUser();
  const quotationCount = await countClientQuotations(user.id, clientId);

  return {
    quotationCount,
  };
}

export async function deleteClientAction(id: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error(getClientDeleteFailureMessage(error));
  }

  assertSingleClientMutation(data, "delete");

  revalidateClientViews();
}
