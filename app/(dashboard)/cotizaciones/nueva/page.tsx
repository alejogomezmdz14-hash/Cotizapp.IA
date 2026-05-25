import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/profile";

export default async function NewQuotationPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Nueva cotizacion
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Punto de entrada MVP para crear cotizaciones
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Esta pantalla deja listo el acceso inicial al flujo. En las
            siguientes tareas se completa el formulario con clientes, items y
            calculos.
          </p>
        </div>
      </section>

      <Card className="border-token bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Que sigue</CardTitle>
          <CardDescription>
            El MVP ya reserva este espacio para construir la experiencia de alta
            de cotizaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Seleccionar cliente o cargar uno nuevo.</li>
            <li>Agregar productos del catalogo y calcular totales.</li>
            <li>Guardar borradores y compartir la cotizacion final.</li>
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="bg-accent-token text-black hover:bg-accent-hover"
            >
              <Link href="/cotizaciones">Volver a cotizaciones</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-token bg-transparent"
            >
              <Link href="/dashboard">Ir al panel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
