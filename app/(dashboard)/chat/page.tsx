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

export default async function ChatPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Chat IA
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Espacio conversacional del MVP
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Este punto de entrada deja preparada la ruta del chat para integrar
            ayuda comercial y automatizaciones en las siguientes tareas.
          </p>
        </div>
      </section>

      <Card className="border-token bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Proximamente en este modulo</CardTitle>
          <CardDescription>
            La base de navegacion ya esta lista y el proximo paso es conectar la
            experiencia conversacional con tus datos del negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
            <li>Consultar productos y clientes desde una conversacion.</li>
            <li>Generar borradores de cotizacion con asistencia de IA.</li>
            <li>Recibir ayuda contextual sobre el estado de tu cuenta.</li>
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="bg-accent-token text-black hover:bg-accent-hover"
            >
              <Link href="/dashboard">Volver al panel</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-token bg-transparent"
            >
              <Link href="/cotizaciones">Ver cotizaciones</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
