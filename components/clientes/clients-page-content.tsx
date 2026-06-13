"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { ClientForm } from "@/components/clientes/client-form";
import { ClientList } from "@/components/clientes/client-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Client } from "@/types";

type ClientsPageContentProps = {
  clients: Client[];
  search: string;
};

async function createClientViaApi(formData: FormData): Promise<Client> {
  const response = await fetch("/api/clients", {
    method: "POST",
    body: formData,
  });

  let payload: { client?: Client; error?: string } = {};
  try {
    payload = (await response.json()) as { client?: Client; error?: string };
  } catch {
    payload = {};
  }

  if (!response.ok || !payload.client) {
    throw new Error(payload.error || "No se pudo crear el cliente.");
  }

  return payload.client;
}

export function ClientsPageContent({ clients, search }: ClientsPageContentProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Clientes recién creados que todavía pueden no estar en el prop del server
  // (si el refresh tardó o falló). Se deduplican por id cuando el server los trae.
  const [optimisticClients, setOptimisticClients] = useState<Client[]>([]);

  const mergedClients = useMemo(() => {
    const serverIds = new Set(clients.map((client) => client.id));
    const pending = optimisticClients.filter(
      (client) => !serverIds.has(client.id),
    );
    return [...pending, ...clients];
  }, [clients, optimisticClients]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          className="bg-accent-token text-black hover:bg-accent-hover"
          onClick={() => setIsFormOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar cliente
        </Button>
      </div>

      <ClientList clients={mergedClients} search={search} />

      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto border-token bg-surface"
        >
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle>Nuevo cliente</SheetTitle>
            <SheetDescription>
              Guardá los datos del cliente para usarlo en tus cotizaciones.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <ClientForm
              submitLabel="Guardar cliente"
              onSubmit={async (formData) => {
                const created = await createClientViaApi(formData);
                // Mostrar el cliente al instante, sin depender del refresh.
                setOptimisticClients((current) => [created, ...current]);
                setIsFormOpen(false);
                // Best-effort: trae la lista fresca del server. Si falla por un
                // hipo transitorio, el cliente ya quedó visible y guardado.
                try {
                  router.refresh();
                } catch {
                  // Ignorado a propósito: el alta ya fue exitosa.
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
