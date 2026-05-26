"use server";

import { revalidatePath } from "next/cache";

import { sanitizeInvoiceReviewItemsForCatalog } from "@/lib/ai/invoice";
import {
  assertSingleCatalogMutation,
  getCatalogDeleteFailureMessage,
  parseCatalogFormData,
} from "@/lib/catalog";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

function revalidateCatalogViews() {
  revalidatePath("/catalogo");
  revalidatePath("/cotizaciones/nueva");
}

export async function createCatalogItemAction(formData: FormData) {
  const user = await requireUser();
  const values = parseCatalogFormData(formData);
  const supabase = await createClient();

  const { error } = await supabase.from("catalog_items").insert({
    user_id: user.id,
    ...values,
  });

  if (error) {
    throw new Error("No se pudo crear el item del catalogo.");
  }

  revalidateCatalogViews();
}

export async function createCatalogItemsFromInvoiceAction(items: unknown) {
  const user = await requireUser();
  const requestedItems = Array.isArray(items) ? items : [];
  const requestedCount = requestedItems.length;
  const normalizedRows = requestedItems
    .map((item) => {
      const catalogItem = sanitizeInvoiceReviewItemsForCatalog([item])[0] ?? null;

      if (!catalogItem) {
        return null;
      }

      return {
        rowId:
          item &&
          typeof item === "object" &&
          "id" in item &&
          typeof item.id === "string"
            ? item.id
            : null,
        catalogItem,
      };
    })
    .filter(
      (
        row,
      ): row is {
        rowId: string | null;
        catalogItem: ReturnType<typeof sanitizeInvoiceReviewItemsForCatalog>[number];
      } => row !== null,
    );
  const catalogItems = normalizedRows.map((row) => row.catalogItem);
  const skippedCount = Math.max(requestedCount - catalogItems.length, 0);

  if (catalogItems.length === 0) {
    throw new Error("No hay items validos para guardar en el catalogo.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").insert(
    catalogItems.map((item) => ({
      user_id: user.id,
      name: item.name,
      description: item.description,
      unit: item.unit,
      price: item.price,
      category: null,
    })),
  );

  if (error) {
    throw new Error("No se pudieron guardar los items seleccionados en el catalogo.");
  }

  revalidateCatalogViews();

  return {
    requestedCount,
    createdCount: catalogItems.length,
    skippedCount,
    savedRowIds: normalizedRows.flatMap((row) => (row.rowId ? [row.rowId] : [])),
  };
}

export async function updateCatalogItemAction(id: string, formData: FormData) {
  const user = await requireUser();
  const values = parseCatalogFormData(formData);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catalog_items")
    .update(values)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error("No se pudo actualizar el item del catalogo.");
  }

  assertSingleCatalogMutation(data, "update");

  revalidateCatalogViews();
}

export async function deleteCatalogItemAction(id: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catalog_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    throw new Error(getCatalogDeleteFailureMessage(error));
  }

  assertSingleCatalogMutation(data, "delete");

  revalidateCatalogViews();
}
