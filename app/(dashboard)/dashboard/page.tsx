import Link from "next/link";
import { ArrowRight, FileText, MessageSquare, Package, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardStats } from "@/lib/dashboard";
import { requireUser } from "@/lib/profile";

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats(user.id);

  const summaryCards = [
    {
      title: "Cotizaciones",
      value: stats.quotations,
      description: "Documentos generados para tus clientes.",
      href: "/cotizaciones",
      icon: FileText,
    },
    {
      title: "Clientes",
      value: stats.clients,
      description: "Contactos guardados para dar seguimiento.",
      href: "/clientes",
      icon: Users,
    },
    {
      title: "Catalogo",
      value: stats.catalogItems,
      description: "Productos y servicios listos para cotizar.",
      href: "/catalogo",
      icon: Package,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Panel general
        </span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              Resumen de tu operacion
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Revisa el estado actual de tu cuenta y entra rapido a las
              secciones principales de Cotizapp.
            </p>
          </div>

          <Button
            asChild
            className="bg-accent-token text-black hover:bg-accent-hover"
          >
            <Link href="/cotizaciones/nueva">Crear una cotizacion</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title} className="border-token bg-surface shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl bg-surface-2 p-3">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <Link
                    href={card.href}
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Ver mas
                  </Link>
                </div>
                <div className="space-y-1">
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className="text-4xl">{card.value}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {card.description}
                </p>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Siguiente paso recomendado</CardTitle>
            <CardDescription>
              Empeza por crear una cotizacion nueva o revisar tu informacion
              cargada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="bg-accent-token text-black hover:bg-accent-hover"
            >
              <Link href="/cotizaciones/nueva">Nueva cotizacion</Link>
            </Button>
            <Button asChild variant="outline" className="border-token bg-transparent">
              <Link href="/catalogo">Abrir catalogo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Chat IA</CardTitle>
            <CardDescription>
              El espacio conversacional ya tiene su punto de entrada para las
              siguientes tareas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-token bg-transparent">
              <Link href="/chat" className="inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Ir al chat
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
