import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md border-token bg-surface shadow-xl">
        <CardHeader className="space-y-3">
          <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Acceso seguro
          </span>
          <CardTitle className="text-3xl">Entrá a Cotizapp</CardTitle>
          <CardDescription className="text-sm leading-6">
            Usá tu cuenta de Google para ingresar y terminar la configuración
            inicial de tu negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleSignInButton />
          <p className="text-sm text-muted-foreground">
            Si tu perfil todavía no está completo, te vamos a guiar al
            onboarding antes de entrar al panel.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
