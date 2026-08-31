import { ClientsPageContent } from "@/components/clientes/clients-page-content";
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
    <div className="space-y-6">
      {/* Solo escritorio: en el celular la barra de abajo ya marca en qué
          pantalla estás, así que el pill + "Tus clientes" en text-3xl eran
          ~120px de scroll repitiendo algo que el usuario ya sabe. */}
      <section className="hidden space-y-3 lg:block">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Clientes
        </span>
        <h2 className="text-3xl font-semibold tracking-tight">Tus clientes</h2>
      </section>

      <ClientsPageContent clients={clients} search={search} />
    </div>
  );
}
