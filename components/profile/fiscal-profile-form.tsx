"use client";

import { saveFiscalProfileAction } from "@/app/actions/fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { FiscalProfile } from "@/lib/fiscal-profile";

type FiscalProfileFormProps = {
  fiscalProfile: FiscalProfile | null;
  defaultCuit: string;
  defaultBusinessName: string;
};

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
          <NativeSelect
            id="contributor_type"
            name="contributor_type"
            defaultValue={fiscalProfile?.contributor_type ?? ""}
            required
          >
            <option value="">Elegí una opción</option>
            <option value="monotributista">Monotributista</option>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Por ahora Cotizapp emite Factura C, así que la facturación electrónica
            está disponible solo para monotributistas.
          </p>
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
          <Label htmlFor="business_name">Razón social</Label>
          <Input
            id="business_name"
            name="business_name"
            placeholder="Ej. Juan Pérez"
            defaultValue={fiscalProfile?.business_name ?? defaultBusinessName}
            required
          />
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
