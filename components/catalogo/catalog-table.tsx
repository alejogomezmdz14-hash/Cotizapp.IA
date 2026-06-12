"use client";

import { useMemo, useState } from "react";
import {
  PackageSearch,
  MoreVertical,
  Search,
  Shapes,
  Tag,
  Wallet,
} from "lucide-react";

import {
  deleteCatalogItemAction,
  updateCatalogItemAction,
} from "@/app/actions/catalog";
import { CatalogItemForm } from "@/components/catalogo/catalog-item-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebouncedSearchParam } from "@/hooks/use-debounced-search-param";
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
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { value: searchValue, setValue: setSearchValue, clearValue, normalizedValue } =
    useDebouncedSearchParam();

  const normalizedSearch = normalizedValue || search.trim();
  const resultLabel = useMemo(() => {
    if (items.length === 1) {
      return "1 ítem";
    }

    return `${items.length} ítems`;
  }, [items.length]);

  function requestDelete(item: CatalogItem) {
    setPendingDelete({
      id: item.id,
      name: formatDisplayName(item.name),
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    const { id } = pendingDelete;
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
      setPendingDelete(null);
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
              <CardTitle className="text-xl">Tus productos y servicios</CardTitle>
              <CardDescription>
                Buscá por nombre, categoría o unidad.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {resultLabel}
              </span>
              {normalizedSearch ? (
                <span className="rounded-full border border-token/80 px-3 py-1 text-xs text-muted-foreground">
                  Filtrar: &quot;{normalizedSearch}&quot;
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por nombre, descripción, categoría o unidad"
                className="pl-9"
                aria-label="Buscar en catálogo"
              />
            </div>
            {normalizedSearch ? (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={clearValue}
              >
                Limpiar
              </Button>
            ) : null}
          </div>
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
                ? `Probá con otro término. Filtro actual: "${normalizedSearch}".`
                : "Cuando cargues tu primer producto o servicio, aparecerá acá listo para usarlo en nuevas cotizaciones."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-token/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              <PackageSearch className="h-4 w-4 shrink-0" />
              <span>
                {normalizedSearch
                  ? "No hubo coincidencias en los resultados actuales."
                  : "Empezá cargando un ítem desde el formulario de esta pantalla."}
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12"
                            disabled={isDeleting}
                            aria-label="Acciones del ítem"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setActionError(null);
                              setEditingId(item.id);
                            }}
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => requestDelete(item)}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar ítem del catálogo"
        description={
          pendingDelete
            ? `¿Seguro que querés eliminar "${pendingDelete.name}"? No se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, eliminar"
        isLoading={Boolean(pendingDelete && deletingId === pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </section>
  );
}
