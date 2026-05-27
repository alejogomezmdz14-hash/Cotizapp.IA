"use client";

import { useMemo, useState } from "react";
import { Mail, MapPin, Pencil, Phone, Search, Trash2, Users } from "lucide-react";

import {
  deleteClientAction,
  getClientQuotationCountAction,
  updateClientAction,
} from "@/app/actions/clients";
import { ClientForm } from "@/components/clientes/client-form";
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
import type { Client } from "@/types";

type ClientListProps = {
  clients: Client[];
  search: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedSearch = search.trim();
  const resultLabel = useMemo(() => {
    if (clients.length === 1) {
      return "1 cliente";
    }

    return `${clients.length} clientes`;
  }, [clients.length]);

  async function handleDelete(id: string) {
    let quotationCount = 0;

    try {
      const impact = await getClientQuotationCountAction(id);
      quotationCount = impact.quotationCount;
    } catch (error) {
      setActionError(getErrorMessage(error));
      return;
    }

    const confirmed = window.confirm(
      quotationCount > 0
        ? `Este cliente tiene ${quotationCount} cotización${
            quotationCount === 1 ? "" : "es"
          } asociada${
            quotationCount === 1 ? "" : "s"
          }. Si lo eliminás, el historial puede quedar inconsistente. ¿Querés continuar igualmente?`
        : "Esta acción eliminará el cliente de forma permanente. ¿Querés continuar?",
    );

    if (!confirmed) {
      return;
    }

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
              <CardTitle className="text-xl">Listado real de clientes</CardTitle>
              <CardDescription>
                Busca por nombre, email o teléfono y gestiona cada ficha sin salir
                del panel.
              </CardDescription>
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {resultLabel}
            </span>
          </div>

          <form action="/clientes" method="get" className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                defaultValue={search}
                placeholder="Buscar por nombre, email o teléfono"
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
                  window.location.href = "/clientes";
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
                ? `Proba con otro nombre, email o teléfono. Búsqueda actual: "${normalizedSearch}".`
                : "Cuando registres tu primer cliente, aparecerá en este listado para reutilizarlo en nuevas cotizaciones."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-token/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>
                {normalizedSearch
                  ? "No hubo coincidencias en los resultados actuales."
                  : "Empieza cargando un cliente desde el formulario de esta pantalla."}
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
                      <CardTitle className="text-xl">{client.name}</CardTitle>
                      <CardDescription>
                        Agregado el {formatDate(client.created_at)}
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
                            setEditingId(client.id);
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
                            void handleDelete(client.id);
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
                        <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Email
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {client.email?.trim() || "Sin email cargado"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            Teléfono
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {client.phone?.trim() || "Sin teléfono cargado"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-token/80 bg-background/60 p-4">
                        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Dirección
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {client.address?.trim() || "Sin dirección cargada"}
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
