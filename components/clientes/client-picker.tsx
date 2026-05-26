"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

type ClientPickerProps = {
  clients: Client[];
  selectedClientId?: string | null;
  onSelectClient: (client: Client | null) => void;
  onCreateClient?: () => void;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
};

function matchesClient(client: Client, query: string) {
  const searchTarget = [
    client.name,
    client.email ?? "",
    client.phone ?? "",
  ].join(" ").toLowerCase();

  return searchTarget.includes(query);
}

export function ClientPicker({
  clients,
  selectedClientId = null,
  onSelectClient,
  onCreateClient,
  allowClear = false,
  disabled = false,
  className,
  title = "Seleccionar cliente",
  description = "Elige un cliente existente para reutilizar sus datos en la cotizacion.",
  emptyMessage = "Todavia no hay clientes disponibles para seleccionar.",
}: ClientPickerProps) {
  const [query, setQuery] = useState("");

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return clients;
    }

    return clients.filter((client) => matchesClient(client, normalizedQuery));
  }, [clients, query]);

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente por nombre, email o telefono"
          className="pl-9"
          disabled={disabled}
        />
      </div>

      {selectedClient ? (
        <div className="rounded-lg border border-token bg-surface px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{selectedClient.name}</p>
          <p className="text-muted-foreground">
            {selectedClient.email?.trim() ||
              selectedClient.phone?.trim() ||
              "Sin datos de contacto"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-token bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          Todavia no seleccionaste ningun cliente. Haz clic en uno de la lista para
          usarlo en esta cotizacion.
        </div>
      )}

      {filteredClients.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-token bg-surface px-4 py-4 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" />
          <span>{query.trim() ? "No hubo coincidencias para esa busqueda." : emptyMessage}</span>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredClients.map((client) => {
            const isSelected = client.id === selectedClientId;

            return (
              <button
                key={client.id}
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-token bg-surface hover:bg-surface-2",
                )}
                onClick={() => onSelectClient(client)}
                disabled={disabled}
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.email?.trim() ||
                      client.phone?.trim() ||
                      "Sin datos de contacto"}
                  </p>
                </div>
                {isSelected ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {allowClear && selectedClient ? (
          <Button
            type="button"
            variant="outline"
            className="border-token bg-surface text-foreground hover:bg-surface-2"
            onClick={() => onSelectClient(null)}
            disabled={disabled}
          >
            Limpiar seleccion
          </Button>
        ) : null}

        {onCreateClient ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCreateClient}
            disabled={disabled}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Button>
        ) : null}
      </div>
    </div>
  );
}
