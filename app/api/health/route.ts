import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Health check + keep-alive de la base. El cron de Vercel (ver vercel.json) lo
// pega periódicamente: la query trivial mantiene despierto el proyecto de
// Supabase (el plan free se auto-pausa tras ~7 días sin actividad). Devuelve 503
// si la DB no responde, para que un uptime monitor externo pueda alertar.
export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, db: "error", detail: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, db: "up" });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: "unreachable",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 503 },
    );
  }
}
