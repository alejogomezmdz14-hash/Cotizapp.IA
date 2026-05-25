import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogItems } from "@/lib/catalog";
import { requireUser } from "@/lib/profile";

function formatAmount(value: number) {
  return `$ ${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export default async function CatalogPage() {
  const user = await requireUser();
  const items = await getCatalogItems(user.id);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Catalogo
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Productos y servicios disponibles
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Este listado usa tus datos reales para mostrar lo que ya esta listo
            para incluir en futuras cotizaciones.
          </p>
        </div>
      </section>

      {items.length === 0 ? (
        <Card className="border-dashed border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Tu catalogo todavia esta vacio</CardTitle>
            <CardDescription>
              Cuando cargues tus primeros productos o servicios, vas a verlos
              aca listos para reutilizar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Por ahora no encontramos elementos en `catalog_items` para tu
              cuenta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="border-token bg-surface shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{item.name}</CardTitle>
                    <CardDescription>
                      {item.category?.trim() || "Sin categoria"}
                    </CardDescription>
                  </div>
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {item.unit?.trim() || "unidad"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.description?.trim() ||
                    "Sin descripcion cargada para este elemento."}
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-token pt-4">
                  <span className="text-sm text-muted-foreground">
                    Precio base
                  </span>
                  <span className="text-lg font-semibold">
                    {formatAmount(item.price)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
