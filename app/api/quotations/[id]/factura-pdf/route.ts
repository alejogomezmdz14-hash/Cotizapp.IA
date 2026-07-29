import { NextResponse } from "next/server";

import { FacturaPdfError, renderFacturaPdfForUser } from "@/lib/arca/factura-pdf";
import { getCurrentUser } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const { buffer, numeroFactura } = await renderFacturaPdfForUser(
      user.id,
      user.clerkId,
      id,
    );

    const download = new URL(request.url).searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="factura-${numeroFactura}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof FacturaPdfError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[factura-pdf] error", error);
    return NextResponse.json(
      { error: "No se pudo generar la factura." },
      { status: 500 },
    );
  }
}
