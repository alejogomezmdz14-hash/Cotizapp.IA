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
    <div className="space-y-6 pb-20">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Clientes
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Tus clientes
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Encontrá a tus clientes y usalos directamente al armar una cotización.
          </p>
        </div>
      </section>

      <ClientsPageContent clients={clients} search={search} />
    </div>
  );
}
