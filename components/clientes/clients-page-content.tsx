"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClientAction } from "@/app/actions/clients";
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

export function ClientsPageContent({ clients, search }: ClientsPageContentProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);

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

      <ClientList clients={clients} search={search} />

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
                await createClientAction(formData);
                setIsFormOpen(false);
                router.refresh();
              }}
              onSuccess={() => setIsFormOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
