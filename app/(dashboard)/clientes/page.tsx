import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getClients } from "@/lib/clients";
import { requireUser } from "@/lib/profile";

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

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await getClients(user.id);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
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

      {clients.length === 0 ? (
        <Card className="border-dashed border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Todavia no hay clientes guardados</CardTitle>
            <CardDescription>
              Cuando empieces a registrar contactos, esta vista mostrara sus
              datos principales para reutilizarlos rapido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              Por ahora no encontramos filas en `clients` para tu usuario.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {clients.map((client) => (
            <Card key={client.id} className="border-token bg-surface shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">{client.name}</CardTitle>
                <CardDescription>
                  Agregado el {formatDate(client.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Correo</p>
                  <p className="text-sm font-medium text-foreground">
                    {client.email?.trim() || "Sin correo cargado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefono</p>
                  <p className="text-sm font-medium text-foreground">
                    {client.phone?.trim() || "Sin telefono cargado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Direccion</p>
                  <p className="text-sm font-medium leading-6 text-foreground">
                    {client.address?.trim() || "Sin direccion cargada"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
