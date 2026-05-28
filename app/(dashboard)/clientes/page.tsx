import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClientAction } from "@/app/actions/clients";
import { ClientForm } from "@/components/clientes/client-form";
import { ClientList } from "@/components/clientes/client-list";
import { getClients } from "@/lib/clients";
import { requireUser } from "@/lib/profile";

type ClientsPageProps = {
  searchParams?: {
    search?: string;
  };
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const user = await requireUser();
  const search =
    typeof searchParams?.search === "string" ? searchParams.search : "";
  const clients = await getClients(user.id, search);

  return (
    <div className="space-y-6 pb-20">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Clientes
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Base de clientes cargados
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Consulta los contactos disponibles para reutilizarlos en tus
            cotizaciones y seguir su actividad.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Nuevo cliente</CardTitle>
            <CardDescription>
              Carga nombre, contacto y dirección para reutilizar este cliente en
              futuras cotizaciones.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientForm
              submitLabel="Guardar cliente"
              onSubmit={createClientAction}
            />
          </CardContent>
        </Card>

        <ClientList clients={clients} search={search} />
      </div>
    </div>
  );
}
