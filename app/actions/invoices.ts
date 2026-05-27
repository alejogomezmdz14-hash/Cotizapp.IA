"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildNextInvoiceNumber } from "@/lib/invoices";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

function revalidateInvoiceViews() {
  revalidatePath("/facturas");
  revalidatePath("/cotizaciones");
  revalidatePath("/dashboard");
}

export async function convertQuotationToInvoiceAction(quotationId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .select(
      "id, client_id, client_name, notes, subtotal, tax_rate, total, valid_until, signature_url, status",
    )
    .eq("id", quotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quotationError || !quotation) {
    throw new Error("No se pudo cargar la cotización.");
  }

  if (quotation.status?.trim().toLowerCase() !== "accepted") {
    throw new Error("Solo podés convertir cotizaciones aceptadas en factura.");
  }

  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("quotation_id", quotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingInvoice) {
    redirect(`/facturas?invoice=${existingInvoice.id}`);
  }

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select("catalog_item_id, name, description, quantity, unit, unit_price, total, position")
    .eq("quotation_id", quotationId)
    .order("position", { ascending: true });

  if (itemsError) {
    throw new Error("No se pudieron cargar los ítems de la cotización.");
  }

  const invoiceNumber = await buildNextInvoiceNumber(user.id);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      quotation_id: quotationId,
      client_id: quotation.client_id,
      client_name: quotation.client_name,
      invoice_number: invoiceNumber,
      status: "issued",
      notes: quotation.notes,
      subtotal: quotation.subtotal,
      tax_rate: quotation.tax_rate,
      total: quotation.total,
      valid_until: quotation.valid_until,
      signature_url: quotation.signature_url,
    })
    .select("id, invoice_number")
    .single();

  if (invoiceError || !invoice) {
    throw new Error("No se pudo crear la factura.");
  }

  const invoiceItems = (items ?? []).map((item, index) => ({
    invoice_id: invoice.id,
    position: item.position ?? index,
    catalog_item_id: item.catalog_item_id,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total: item.total,
  }));

  if (invoiceItems.length > 0) {
    const { error: insertItemsError } = await supabase
      .from("invoice_items")
      .insert(invoiceItems);

    if (insertItemsError) {
      await supabase.from("invoices").delete().eq("id", invoice.id);
      throw new Error("No se pudieron copiar los ítems a la factura.");
    }
  }

  revalidateInvoiceViews();
  redirect(`/facturas?created=${invoice.id}`);
}
