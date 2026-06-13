import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { parseClientFormData } from "@/lib/clients";
import { getCurrentUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Crear cliente vía route handler en vez de server action: la respuesta es
 * JSON plano y NO dispara el refetch automático del RSC de /clientes. Así el
 * alta es atómica (o inserta y devuelve 200, o falla limpio) y un hipo de
 * Clerk durante la revalidación no deja el form colgado ni genera duplicados.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión para guardar un cliente." },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const values = parseClientFormData(formData);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("clients")
      .insert({ user_id: user.id, ...values })
      .select("id, user_id, name, email, phone, address, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "No se pudo crear el cliente." },
        { status: 500 },
      );
    }

    // Marca /clientes y la pantalla de nueva cotización como obsoletas para el
    // próximo render, sin acoplar el éxito de esta respuesta a ese render.
    revalidatePath("/clientes");
    revalidatePath("/cotizaciones/nueva");

    return NextResponse.json({ client: data });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "No se pudo crear el cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
