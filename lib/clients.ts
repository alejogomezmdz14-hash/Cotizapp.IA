import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/types";

export type ClientFormValues = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

function getRequiredClientValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalClientValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function parseClientFormData(formData: FormData): ClientFormValues {
  const name = getRequiredClientValue(formData, "name");

  if (!name) {
    throw new Error("El nombre del cliente es obligatorio.");
  }

  return {
    name,
    email: getOptionalClientValue(formData, "email"),
    phone: getOptionalClientValue(formData, "phone"),
    address: getOptionalClientValue(formData, "address"),
  };
}

export type ClientMutationAction = "update" | "delete";

type ClientMutationRow = {
  id: string;
};

type DatabaseErrorLike = {
  code?: string | null;
} | null;

export function escapeClientSearchTerm(search: string) {
  return search
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll("*", "\\*");
}

export function buildClientSearchFilter(search?: string) {
  const normalizedSearch = search?.trim();

  if (!normalizedSearch) {
    return null;
  }

  const escapedSearch = escapeClientSearchTerm(normalizedSearch);
  const pattern = `"%${escapedSearch}%"`;

  return `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`;
}

export function assertSingleClientMutation(
  rows: ClientMutationRow[] | null,
  action: ClientMutationAction,
) {
  if ((rows?.length ?? 0) === 1) {
    return;
  }

  if (action === "update") {
    throw new Error("El cliente no existe o no tenes permisos para actualizarlo.");
  }

  throw new Error("El cliente no existe, no te pertenece o ya fue eliminado.");
}

export function getClientDeleteFailureMessage(error: DatabaseErrorLike) {
  if (error?.code === "23503") {
    return "No se puede eliminar el cliente porque tiene cotizaciones u otros datos asociados.";
  }

  return "No se pudo eliminar el cliente.";
}

export async function getClients(userId: string, search?: string): Promise<Client[]> {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, user_id, name, email, phone, address, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const searchFilter = buildClientSearchFilter(search);

  if (searchFilter) {
    query = query.or(searchFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("No se pudieron cargar los clientes.");
  }

  return (data as Client[] | null) ?? [];
}
