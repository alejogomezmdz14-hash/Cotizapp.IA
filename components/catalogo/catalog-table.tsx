"use client";

import { useMemo, useState } from "react";
import {
  PackageSearch,
  Pencil,
  Search,
  Shapes,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";

import {
  deleteCatalogItemAction,
  updateCatalogItemAction,
} from "@/app/actions/catalog";
import { CatalogItemForm } from "@/components/catalogo/catalog-item-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { formatDisplayName } from "@/lib/entity-normalization";
import { formatCurrencyAmount, formatDateTime } from "@/lib/formatting";
import type { CatalogItem } from "@/types";

type CatalogTableProps = {
  items: CatalogItem[];
  search: string;
  currency: string | null;
  categorySuggestions: string[];
  unitSuggestions: string[];
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la acción.";
}

export function CatalogTable({
  items,
  search,
  currency,
  categorySuggestions,
  unitSuggestions,
}: CatalogTableProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedSearch = search.trim();
  const resultLabel = useMemo(() => {
    if (items.length === 1) {
      return "1 ítem";
    }

    return `${items.length} ítems`;
  }, [items.length]);

  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Esta acción eliminará el ítem del catálogo de forma permanente. ¿Querés continuar?",
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeletingId(id);

    try {
      await deleteCatalogItemAction(id);

      if (editingId === id) {
        setEditingId(null);
      }
      toast({
        title: "Ítem eliminado",
        description: "El ítem ya no figura en el catálogo.",
      });
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <Card className="border-token bg-surface shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Listado real del catálogo</CardTitle>
              <CardDescription>
                Busca por nombre, descripción, categoría o unidad y edita cada
                ítem sin salir del panel.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {resultLabel}
              </span>
              <span className="rounded-full border border-token/80 px-3 py-1 text-xs text-muted-foreground">
                {normalizedSearch
                  ? `Filtro: "${normalizedSearch}"`
                  : "Sin filtros"}
              </span>
            </div>
          </div>

          <form action="/catalogo" method="get" className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                defaultValue={search}
                placeholder="Buscar por nombre, descripción, categoría o unidad"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" className="border-token bg-background">
              Buscar
            </Button>
            {normalizedSearch ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  window.location.href = "/catalogo";
                }}
              >
                Limpiar
              </Button>
            ) : null}
          </form>
        </CardHeader>
      </Card>

      {actionError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {items.length === 0 ? (
        <Card className="border-dashed border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {normalizedSearch
                ? "No encontramos ítems para esa búsqueda"
                : "Todavía no hay ítems en tu catálogo"}
            </CardTitle>
            <CardDescription>
              {normalizedSearch
                ? `Proba con otro termino. Filtro actual: "${normalizedSearch}".`
                : "Cuando cargues tu primer producto o servicio, aparecerá acá listo para reutilizarlo en nuevas cotizaciones."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-token/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              <PackageSearch className="h-4 w-4 shrink-0" />
              <span>
                {normalizedSearch
                  ? "No hubo coincidencias en los resultados actuales."
                  : "Empieza cargando un ítem desde el formulario de esta pantalla."}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <Card key={item.id} className="border-token bg-surface shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        {formatDisplayName(item.name)}
                      </CardTitle>
                      <CardDescription>
                        Agregado el {formatDateTime(item.created_at)}
                      </CardDescription>
                    </div>
                    {!isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-token bg-background text-foreground hover:bg-surface-2"
                          onClick={() => {
                            setActionError(null);
                            setEditingId(item.id);
                          }}
                          disabled={isDeleting}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            void handleDelete(item.id);
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isDeleting ? "Eliminando..." : "Eliminar"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {isEditing ? (
                    <CatalogItemForm
                      mode="edit"
                      initialValues={item}
                      categorySuggestions={categorySuggestions}
                      unitSuggestions={unitSuggestions}
                      submitLabel="Guardar cambios"
                      onCancel={() => setEditingId(null)}
                      onSuccess={() => setEditingId(null)}
                      onSubmit={async (formData) => {
                        setActionError(null);
                        await updateCatalogItemAction(item.id, formData);
                      }}
                    />
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            Categoría
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {item.category?.trim() || "Sin categoría"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                            <Shapes className="h-4 w-4 text-muted-foreground" />
                            Unidad
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">{item.unit}</p>
                        </div>

                        <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            Precio
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrencyAmount(item.price, currency)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                        <p className="mb-2 text-sm font-medium text-foreground">
                          Descripción
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {item.description?.trim() ||
                            "Sin descripción cargada para este ítem."}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
