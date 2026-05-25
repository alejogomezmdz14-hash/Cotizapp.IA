import { redirect } from "next/navigation";

import { saveOnboarding } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (isProfileComplete(profile)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl justify-center">
        <Card className="w-full border-token bg-surface shadow-xl">
          <CardHeader className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Onboarding
            </span>
            <CardTitle className="text-3xl">
              Terminá la configuración de tu negocio
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              Necesitamos algunos datos para personalizar tus cotizaciones y
              dejar tu cuenta lista para usar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveOnboarding} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="business_name">Nombre del negocio</Label>
                  <Input
                    id="business_name"
                    name="business_name"
                    placeholder="Ej. Ferretería San Martín"
                    defaultValue={profile?.business_name ?? ""}
                    required
                    autoComplete="organization"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Rubro</Label>
                  <Input
                    id="industry"
                    name="industry"
                    placeholder="Ej. Materiales de construcción"
                    defaultValue={profile?.industry ?? ""}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Input
                    id="currency"
                    name="currency"
                    placeholder="Ej. MXN"
                    defaultValue={profile?.currency ?? "MXN"}
                    required
                    autoCapitalize="characters"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="Ej. +52 81 1234 5678"
                    defaultValue={profile?.phone ?? ""}
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Ej. ventas@tunegocio.com"
                    defaultValue={profile?.email ?? user.email ?? ""}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    name="address"
                    placeholder="Ej. Av. Principal 123, Monterrey"
                    defaultValue={profile?.address ?? ""}
                    autoComplete="street-address"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-accent-token text-black hover:bg-accent-hover"
              >
                Guardar y continuar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
