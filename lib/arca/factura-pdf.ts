import { renderToBuffer } from "@react-pdf/renderer";

import { getArgentinaToday } from "@/lib/argentina-time";
import { buildAfipQrDataUrl } from "@/lib/arca/factura-qr";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createFacturaPdfDocument,
  type FacturaPdfItem,
} from "@/components/factura/factura-pdf-template";

const CBTE_TIPO_FACTURA_C = 11;

export class FacturaPdfError extends Error {}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Convierte un campo fiscal (punto de venta, número de comprobante o CAE) a
 * número para el QR de ARCA. A diferencia de `toNumber`, acá un valor no
 * numérico en un comprobante real es un dato corrupto: antes se devolvía 0 en
 * silencio y el QR salía inválido sin que nadie lo notara. Ahora cortamos con
 * un error amigable. En un comprobante de prueba el CAE es "DEMO-..." a
 * propósito (no numérico), así que ahí no cortamos: seguimos renderizando,
 * ya con el cartel de "comprobante de prueba" puesto.
 */
function toFiscalNumber(value: unknown, esPrueba: boolean): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  if (esPrueba) {
    return 0;
  }
  throw new FacturaPdfError(
    "No pudimos generar el PDF: los datos fiscales de esta factura son inválidos. Contactá a soporte.",
  );
}

/** "YYYY-MM-DD" → "DD/MM/YYYY". Si no matchea, devuelve el original. */
function toDisplayDate(isoDate: string | null): string {
  if (!isoDate) {
    return "—";
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : isoDate;
}

/**
 * Arma y renderiza el PDF de la factura (Factura C) con CAE + QR de AFIP.
 * `userId` es el UUID de perfil (para RLS de quotations); `clerkId` el de Clerk
 * (para fiscal_profiles).
 */
export async function renderFacturaPdfForUser(
  userId: string,
  clerkId: string,
  quotationId: string,
): Promise<{ buffer: Buffer; numeroFactura: string }> {
  const supabase = await createClient();

  const { data: quotation, error } = await supabase
    .from("quotations")
    .select(
      "id, client_name, total, facturado_at, cae, cae_vencimiento, numero_factura",
    )
    .eq("id", quotationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !quotation) {
    throw new FacturaPdfError("No se pudo cargar la cotización.");
  }
  if (!quotation.cae || !quotation.numero_factura) {
    throw new FacturaPdfError("Esta cotización todavía no fue facturada.");
  }

  const fiscal = await getFiscalProfile(clerkId);
  if (!fiscal) {
    throw new FacturaPdfError("No se encontraron tus datos fiscales.");
  }

  const { data: itemRows } = await supabase
    .from("quotation_items")
    .select("name, description, quantity, unit, unit_price, total")
    .eq("quotation_id", quotationId)
    .order("position", { ascending: true });

  // "0001-00000123" o "DEMO-0001-00000123": el punto de venta y el número son
  // siempre los dos últimos segmentos.
  const partes = String(quotation.numero_factura).split("-");
  const numeroComprobante = partes[partes.length - 1] ?? "";
  const puntoVenta = partes[partes.length - 2] ?? "";
  const total = toNumber(quotation.total);
  const cae = String(quotation.cae);
  const fechaIso = getArgentinaToday(
    quotation.facturado_at ? new Date(quotation.facturado_at) : new Date(),
  );
  // El cartel de "comprobante de prueba" se deriva del prefijo `DEMO-` que
  // `simulateFacturaC` (lib/arca/billing.ts) le pone al número de factura al
  // emitir en modo demo, no del entorno ACTUAL del perfil fiscal: ese puede
  // cambiar después de facturar (p. ej. al verificarse el certificado), y si
  // usáramos el entorno actual una factura demo vieja perdería el cartel y
  // pasaría a verse como un comprobante real con un CAE falso. Este dato en
  // cambio viaja con la factura y nunca cambia.
  // Solución definitiva: columna `facturas.environment`, cuando exista la
  // tabla propia de facturas (Fase C).
  const esPrueba = quotation.numero_factura.startsWith("DEMO-");

  const qrDataUrl = await buildAfipQrDataUrl({
    fecha: fechaIso,
    cuit: toNumber(fiscal.cuit.replace(/\D/g, "")),
    ptoVta: toFiscalNumber(puntoVenta, esPrueba),
    tipoCmp: CBTE_TIPO_FACTURA_C,
    nroCmp: toFiscalNumber(numeroComprobante, esPrueba),
    importe: total,
    moneda: "PES",
    ctz: 1,
    codAut: toFiscalNumber(cae, esPrueba),
  });

  const items: FacturaPdfItem[] = (itemRows ?? []).map((row) => ({
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    quantity: toNumber(row.quantity),
    unit: String(row.unit ?? "unidad"),
    unitPrice: toNumber(row.unit_price),
    total: toNumber(row.total),
  }));

  const buffer = await renderToBuffer(
    createFacturaPdfDocument({
      razonSocial: fiscal.business_name || "—",
      cuit: fiscal.cuit,
      puntoVenta,
      numeroComprobante,
      fechaEmision: toDisplayDate(fechaIso),
      clienteNombre: quotation.client_name ?? "Consumidor Final",
      items,
      total,
      currency: "ARS",
      cae,
      caeVencimiento: toDisplayDate(quotation.cae_vencimiento),
      qrDataUrl,
      esPrueba,
    }),
  );

  return { buffer, numeroFactura: quotation.numero_factura };
}
