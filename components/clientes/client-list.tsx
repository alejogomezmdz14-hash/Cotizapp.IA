"use client";

import { useMemo, useState } from "react";
import { MessageCircle, MoreVertical, Phone, Search, Users } from "lucide-react";

import { useDebouncedSearchParam } from "@/hooks/use-debounced-search-param";

import {
  deleteClientAction,
  getClientQuotationCountAction,
  updateClientAction,
} from "@/app/actions/clients";
import { ClientForm } from "@/components/clientes/client-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Client } from "@/types";

type ClientListProps = {
  clients: Client[];
  search: string;
};

function formatPhoneHref(phone: string) {
  return phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la acción.";
}

export function ClientList({ clients, search }: ClientListProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    quotationCount: number;
  } | null>(null);
  const { value: searchValue, setValue: setSearchValue, clearValue, normalizedValue } =
    useDebouncedSearchParam();
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedSearch = normalizedValue || search.trim();
  const resultLabel = useMemo(() => {
    if (clients.length === 1) {
      return "1 cliente";
    }

    return `${clients.length} clientes`;
  }, [clients.length]);

  async function requestDelete(client: Client) {
    try {
      const impact = await getClientQuotationCountAction(client.id);
      setPendingDelete({
        id: client.id,
        name: formatDisplayName(client.name),
        quotationCount: impact.quotationCount,
      });
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    const { id } = pendingDelete;
    setActionError(null);
    setDeletingId(id);

    try {
      await deleteClientAction(id);

      if (editingId === id) {
        setEditingId(null);
      }
      toast({
        title: "Cliente eliminado",
        description: "El cliente ya no figura en el listado.",
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
      {/* El buscador suelto, sin Card alrededor. Antes esta pantalla decía
          "Clientes" tres veces (pill de la página + h2 + CardTitle) y envolvía
          un input en una tarjeta con p-6: ~200px antes del primer cliente. */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Buscar cliente"
            className="pl-9"
            aria-label="Buscar clientes"
          />
        </div>
        {normalizedSearch ? (
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            onClick={clearValue}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      {normalizedSearch ? (
        <p className="text-xs text-muted-foreground">{resultLabel}</p>
      ) : null}

      {actionError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {clients.length === 0 ? (
        <Card className="border-dashed border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {normalizedSearch
                ? "No encontramos clientes para esa búsqueda"
                : "Todavía no hay clientes guardados"}
            </CardTitle>
            <CardDescription>
              {normalizedSearch
                ? `Probá con otro nombre, email o teléfono. Búsqueda actual: "${normalizedSearch}".`
                  : "Cuando registres tu primer cliente, aparecerá acá. Tocá «Agregar cliente» para empezar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-token/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>
                {normalizedSearch
                  ? "No hubo coincidencias en los resultados actuales."
                  : "Tocá «Agregar cliente» arriba para cargar el primero."}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Filas, no tarjetas. Cada cliente ocupaba ~340px (Card + CardHeader
        // p-6 + CardContent p-6 + una caja con borde por campo): entraban dos
        // por pantalla. Además el menú "⋮" caía DEBAJO del nombre en móvil
        // porque la fila era flex-col hasta sm:, y el email sin truncate
        // empujaba la tarjeta más ancha que la pantalla.
        <ul className="divide-y divide-token/60 border-y border-token/60">
          {clients.map((client) => {
            const isEditing = editingId === client.id;
            const isDeleting = deletingId === client.id;
            const phone = client.phone?.trim();
            const contacto =
              phone || client.email?.trim() || "Sin datos de contacto";

            if (isEditing) {
              return (
                <li key={client.id} className="py-4">
                  <p className="mb-3 font-medium text-foreground">
                    {formatDisplayName(client.name)}
                  </p>
                  <ClientForm
                    mode="edit"
                    initialValues={client}
                    submitLabel="Guardar cambios"
                    onCancel={() => setEditingId(null)}
                    onSuccess={() => setEditingId(null)}
                    onSubmit={async (formData) => {
                      setActionError(null);
                      await updateClientAction(client.id, formData);
                    }}
                  />
                </li>
              );
            }

            return (
              <li
                key={client.id}
                className="flex min-h-16 items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {formatDisplayName(client.name)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {contacto}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      disabled={isDeleting}
                      aria-label={`Acciones de ${formatDisplayName(client.name)}`}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {phone ? (
                      <>
                        <DropdownMenuItem asChild>
                          <a href={`tel:${formatPhoneHref(phone)}`}>
                            <Phone className="mr-2 h-4 w-4" />
                            Llamar
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={`https://wa.me/${formatPhoneHref(phone)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="mr-2 h-4 w-4" />
                            WhatsApp
                          </a>
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={() => {
                        setActionError(null);
                        setEditingId(client.id);
                      }}
                    >
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => {
                        void requestDelete(client);
                      }}
                    >
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      {pendingDelete && pendingDelete.quotationCount > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Cerrar diálogo"
            className="absolute inset-0 bg-black/60"
            onClick={() => setPendingDelete(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-delete-blocked-title"
            aria-describedby="client-delete-blocked-description"
            className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-token bg-background p-6 shadow-2xl"
          >
            <div className="space-y-2">
              <h2
                id="client-delete-blocked-title"
                className="text-lg font-semibold text-foreground"
              >
                No se puede eliminar
              </h2>
              <p
                id="client-delete-blocked-description"
                className="text-sm leading-6 text-muted-foreground"
              >
                {`Este cliente tiene ${pendingDelete.quotationCount} cotización${
                  pendingDelete.quotationCount === 1 ? "" : "es"
                } asociada${
                  pendingDelete.quotationCount === 1 ? "" : "s"
                }. Para eliminarlo, primero eliminá o reasigná esas cotizaciones.`}
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end">
              <Button type="button" onClick={() => setPendingDelete(null)}>
                Entendido
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmDialog
          open={Boolean(pendingDelete)}
          title="Eliminar cliente"
          description={
            pendingDelete
              ? `¿Seguro que querés eliminar a ${pendingDelete.name}? No se puede deshacer.`
              : ""
          }
          confirmLabel="Sí, eliminar"
          isLoading={Boolean(pendingDelete && deletingId === pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      )}
    </section>
  );
}
