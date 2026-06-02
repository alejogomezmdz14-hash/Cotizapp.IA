import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createCatalogItemAction } from "@/app/actions/catalog";
import { CatalogItemForm } from "@/components/catalogo/catalog-item-form";
import { CatalogTable } from "@/components/catalogo/catalog-table";
import {
  getCatalogCategorySuggestions,
  getCatalogUnitSuggestions,
} from "@/lib/catalog-suggestions";
import { getCatalogItems } from "@/lib/catalog";
import { getProfile, requireUser } from "@/lib/profile";

type CatalogPageProps = {
  searchParams?: {
    search?: string;
  };
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const user = await requireUser();
  const search =
    typeof searchParams?.search === "string" ? searchParams.search : "";
  const [items, profile] = await Promise.all([
    getCatalogItems(user.id, { search }),
    getProfile(user.id),
  ]);
  const categorySuggestions = getCatalogCategorySuggestions(items);
  const unitSuggestions = getCatalogUnitSuggestions(items);

  return (
    <div className="space-y-6 pb-20">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Catálogo
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Productos y servicios disponibles
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Guardá tus productos y servicios para usarlos rápido al cotizar.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl">Agregar producto o servicio</CardTitle>
            <CardDescription>
              Completá los datos del producto o servicio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-token/80 bg-background/60 p-4">
              <p className="text-sm font-medium text-foreground">
                Precio de referencia
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ingresá el precio (solo números). Ejemplo: 1250
              </p>
            </div>

            <CatalogItemForm
              submitLabel="Guardar en mi catálogo"
              categorySuggestions={categorySuggestions}
              unitSuggestions={unitSuggestions}
              onSubmit={createCatalogItemAction}
            />
          </CardContent>
        </Card>

        <CatalogTable
          items={items}
          search={search}
          currency={profile?.currency ?? null}
          categorySuggestions={categorySuggestions}
          unitSuggestions={unitSuggestions}
        />
      </div>
    </div>
  );
}
