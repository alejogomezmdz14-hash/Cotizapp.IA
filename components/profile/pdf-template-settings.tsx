"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Palette, ScrollText } from "lucide-react";

import { savePdfTemplateSettingsAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePdfAccentColor } from "@/lib/pdf-accent-color";
import {
  PDF_TEMPLATE_OPTIONS,
  normalizePdfTemplate,
  type PdfTemplateId,
} from "@/lib/pdf-template";
import { cn } from "@/lib/utils";

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type PdfTemplateSettingsProps = {
  initialTemplate: string | null;
  initialAccentColor: string | null;
  initialPdfFooter?: string | null;
  businessName: string | null;
  saved?: boolean;
};

function PreviewDocument({
  template,
  accentColor,
  businessName,
}: {
  template: PdfTemplateId;
  accentColor: string;
  businessName: string;
}) {
  const isModern = template === "modern";
  const isMinimal = template === "minimal";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white text-[11px] text-gray-900 shadow-sm",
        isMinimal ? "border-gray-300" : "border-gray-200",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 p-4",
          isModern && "text-white",
        )}
        style={
          isModern
            ? { backgroundColor: accentColor }
            : { backgroundColor: "#ffffff" }
        }
      >
        <div>
          <p className="font-semibold">{businessName}</p>
          <p className={cn("mt-1", isModern ? "text-white/80" : "text-gray-500")}>
            contacto@empresa.com
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              isModern ? "text-white/80" : "text-gray-500",
            )}
          >
            Cotización
          </p>
          <p className="text-lg font-bold">COT-0001</p>
        </div>
      </div>

      {!isMinimal ? (
        <div
          className="h-0.5"
          style={{ backgroundColor: isModern ? accentColor : accentColor }}
        />
      ) : (
        <div className="mx-4 border-t border-gray-300" />
      )}

      <div className="space-y-3 p-4">
        <div
          className={cn(
            "rounded-lg p-3",
            isMinimal ? "border border-gray-200" : "bg-gray-100",
          )}
        >
          <p className="text-[10px] font-semibold uppercase text-gray-500">
            Cliente
          </p>
          <p className="font-semibold">Cliente ejemplo</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div
            className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px] font-semibold uppercase"
            style={{
              backgroundColor: isMinimal
                ? "#f9fafb"
                : isModern
                  ? accentColor
                  : "#1a2a4a",
              color: isMinimal ? "#111827" : "#ffffff",
            }}
          >
            <span className="col-span-2">Descripción</span>
            <span className="text-center">Cant.</span>
            <span className="text-right">Importe</span>
          </div>
          {["Servicio A", "Material B"].map((item, index) => (
            <div
              key={item}
              className={cn(
                "grid grid-cols-4 gap-2 border-t border-gray-100 px-3 py-2",
                template !== "minimal" && index % 2 === 1 && "bg-gray-50",
              )}
            >
              <span className="col-span-2 font-medium">{item}</span>
              <span className="text-center">1</span>
              <span className="text-right">$ 10.000</span>
            </div>
          ))}
        </div>

        <div className="ml-auto w-40 space-y-1 text-right">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>$ 20.000</span>
          </div>
          <div
            className="flex justify-between rounded-md px-2 py-2 font-semibold text-white"
            style={{
              backgroundColor: isMinimal ? "#f3f4f6" : isModern ? accentColor : "#1a2a4a",
              color: isMinimal ? "#111827" : "#ffffff",
            }}
          >
            <span>Total</span>
            <span>$ 24.200</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PdfTemplateSettings({
  initialTemplate,
  initialAccentColor,
  initialPdfFooter = null,
  businessName,
  saved = false,
}: PdfTemplateSettingsProps) {
  const [template, setTemplate] = useState<PdfTemplateId>(
    normalizePdfTemplate(initialTemplate),
  );
  const [accentColor, setAccentColor] = useState(
    normalizePdfAccentColor(initialAccentColor),
  );
  const [showColorCode, setShowColorCode] = useState(false);

  const previewBusinessName = useMemo(
    () => businessName?.trim() || "Tu empresa",
    [businessName],
  );

  return (
    <form action={savePdfTemplateSettingsAction} className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ScrollText className="h-3.5 w-3.5 text-accent-token" />
        Plantilla PDF
      </div>

      {saved ? (
        <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          La plantilla y el color del PDF se guardaron correctamente.
        </p>
      ) : null}

      <input type="hidden" name="pdf_template" value={template} />
      <input type="hidden" name="pdf_accent_color" value={accentColor} />

      <div className="grid gap-3 md:grid-cols-3">
        {PDF_TEMPLATE_OPTIONS.map((option) => {
          const isActive = template === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTemplate(option.id)}
              className={cn(
                "rounded-[1.5rem] border p-4 text-left transition",
                isActive
                  ? "border-[rgb(var(--accent-rgb)/0.45)] bg-[rgb(var(--accent-rgb)/0.08)]"
                  : "border-token/80 bg-background/70 hover:border-token",
              )}
            >
              <p className="font-medium text-foreground">{option.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-3">
          <Label htmlFor="pdf_accent_color_picker">Color de acento del PDF</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-token/80 bg-background/70 px-3 py-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Input
                id="pdf_accent_color_picker"
                type="color"
                value={accentColor}
                className="h-10 w-14 cursor-pointer border-0 bg-transparent p-0"
                onChange={(event) => setAccentColor(event.target.value)}
                aria-label="Elegir color de acento del PDF"
              />
              <span
                className="h-6 w-6 rounded-full border border-token/80"
                style={{ backgroundColor: accentColor }}
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              onClick={() => setShowColorCode((current) => !current)}
            >
              {showColorCode ? "Ocultar código" : "Elegir color"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition",
                  showColorCode && "rotate-180",
                )}
              />
            </button>
          </div>
          {showColorCode ? (
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {accentColor}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Vista previa</Label>
          <PreviewDocument
            template={template}
            accentColor={accentColor}
            businessName={previewBusinessName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pdf_footer">Pie de página del PDF</Label>
        <textarea
          id="pdf_footer"
          name="pdf_footer"
          rows={4}
          defaultValue={initialPdfFooter ?? ""}
          placeholder="Ej. Precios sujetos a cambios sin previo aviso."
          className={textareaClassName}
        />
      </div>

      <Button type="submit" className="min-h-12 w-full sm:w-auto">
        Guardar diseño
      </Button>
    </form>
  );
}
