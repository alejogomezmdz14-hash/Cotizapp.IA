"use client";

import { useMemo, useState } from "react";
import { Mail, MapPin, MoreVertical, Phone, Search, Users } from "lucide-react";

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
      <Card className="border-token bg-surface shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Clientes</CardTitle>
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground">
              {resultLabel}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por nombre, email o teléfono"
                className="pl-9"
                aria-label="Buscar clientes"
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
        <div className="grid gap-4">
          {clients.map((client) => {
            const isEditing = editingId === client.id;
            const isDeleting = deletingId === client.id;

            return (
              <Card key={client.id} className="border-token bg-surface shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        {formatDisplayName(client.name)}
                      </CardTitle>
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
                            aria-label="Acciones del cliente"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {isEditing ? (
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
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        {client.email?.trim() ? (
                          <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              Email
                            </p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {client.email.trim()}
                            </p>
                          </div>
                        ) : null}
                        {client.phone?.trim() ? (
                          <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              Teléfono
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`tel:${formatPhoneHref(client.phone)}`}
                                className="inline-flex min-h-12 items-center rounded-md border border-token px-4 text-sm font-medium text-foreground"
                              >
                                Llamar
                              </a>
                              <a
                                href={`https://wa.me/${formatPhoneHref(client.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex min-h-12 items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                              >
                                WhatsApp
                              </a>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {client.address?.trim() ? (
                        <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Dirección
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {client.address.trim()}
                          </p>
                        </div>
                      ) : null}
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
        title="Eliminar cliente"
        description={
          pendingDelete
            ? pendingDelete.quotationCount > 0
              ? `¿Seguro que querés eliminar a ${pendingDelete.name}? Tiene ${pendingDelete.quotationCount} cotización${
                  pendingDelete.quotationCount === 1 ? "" : "es"
                } asociada${
                  pendingDelete.quotationCount === 1 ? "" : "s"
                }. No se puede deshacer.`
              : `¿Seguro que querés eliminar a ${pendingDelete.name}? No se puede deshacer.`
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
