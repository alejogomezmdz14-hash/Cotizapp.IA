"use client";

import { saveFiscalProfileAction } from "@/app/actions/fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiscalProfile } from "@/lib/fiscal-profile";

type FiscalProfileFormProps = {
  fiscalProfile: FiscalProfile | null;
  defaultCuit: string;
  defaultBusinessName: string;
};

const selectClassName =
  "flex h-10 w-full rounded-md border border-token bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function FiscalProfileForm({
  fiscalProfile,
  defaultCuit,
  defaultBusinessName,
}: FiscalProfileFormProps) {
  return (
    <section className="shell-panel space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight">Datos Fiscales</h3>
        <p className="text-sm text-muted-foreground">
          Necesarios para emitir facturas en Argentina.
        </p>
      </div>

      <form action={saveFiscalProfileAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cuit">CUIT</Label>
          <Input
            id="cuit"
            name="cuit"
            placeholder="Ej. 20-12345678-9"
            defaultValue={fiscalProfile?.cuit ?? defaultCuit}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contributor_type">Tipo de contribuyente</Label>
          <select
            id="contributor_type"
            name="contributor_type"
            defaultValue={fiscalProfile?.contributor_type ?? ""}
            required
            className={selectClassName}
          >
            <option value="">Elegí una opción</option>
            <option value="monotributista">Monotributista</option>
            <option value="responsable_inscripto">Responsable Inscripto</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sales_point">Punto de venta</Label>
          <Input
            id="sales_point"
            name="sales_point"
            placeholder="Ej. 0001"
            defaultValue={fiscalProfile?.sales_point ?? ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="environment">Entorno de facturación</Label>
          <select
            id="environment"
            name="environment"
            defaultValue={
              (fiscalProfile as { environment?: string } | null)?.environment ??
              "homologacion"
            }
            className={selectClassName}
          >
            <option value="homologacion">Homologación (pruebas)</option>
            <option value="produccion">Producción (facturas reales)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_name">Razón social</Label>
          <Input
            id="business_name"
            name="business_name"
            placeholder="Ej. Juan Pérez"
            defaultValue={fiscalProfile?.business_name ?? defaultBusinessName}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cert">Certificado ARCA (.crt)</Label>
            <Input id="cert" name="cert" type="file" accept=".crt" />
            {fiscalProfile?.cert_path ? (
              <p className="text-xs text-accent-token">Certificado cargado ✓</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="key">Clave privada ARCA (.key)</Label>
            <Input id="key" name="key" type="file" accept=".key" />
            {fiscalProfile?.key_path ? (
              <p className="text-xs text-accent-token">Clave cargada ✓</p>
            ) : null}
          </div>
        </div>

        <Button type="submit" className="min-h-11">
          Guardar datos fiscales
        </Button>
      </form>

      <p className="text-xs leading-5 text-muted-foreground">
        Cotizapp emite facturas con los datos que vos cargás. Para dudas sobre tu
        situación fiscal, consultá a tu contador.
      </p>
    </section>
  );
}
