"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { saveAppearanceSettingsAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PDF_ACCENT_COLOR,
  normalizePdfAccentColor,
  PDF_ACCENT_PRESETS,
} from "@/lib/pdf-accent-color";
import { cn } from "@/lib/utils";

type AppearanceSettingsFormProps = {
  initialTheme: string | null;
  initialPdfAccentColor: string | null;
  saved?: boolean;
};

export function AppearanceSettingsForm({
  initialTheme,
  initialPdfAccentColor,
  saved = false,
}: AppearanceSettingsFormProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeValue] = useState<"light" | "dark">(
    initialTheme === "light" ? "light" : "dark",
  );
  const [pdfAccentColor, setPdfAccentColor] = useState(
    normalizePdfAccentColor(initialPdfAccentColor),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const nextTheme = resolvedTheme === "light" ? "light" : "dark";
    setThemeValue(nextTheme);
  }, [mounted, resolvedTheme]);

  const isDark = theme === "dark";

  const handleThemeChange = (nextTheme: "light" | "dark") => {
    setThemeValue(nextTheme);
    setTheme(nextTheme);
  };

  return (
    <form action={saveAppearanceSettingsAction} className="space-y-5">
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="pdf_accent_color" value={pdfAccentColor} />

      {saved ? (
        <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          Los ajustes de apariencia se guardaron correctamente.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-token/70 bg-background/80 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Modo oscuro</p>
          <p className="text-xs text-muted-foreground">
            Alterná entre tema claro y oscuro en toda la app.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={() => handleThemeChange(isDark ? "light" : "dark")}
          className={cn(
            "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition",
            isDark
              ? "border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.2)]"
              : "border-token bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-flex h-6 w-6 translate-x-1 items-center justify-center rounded-full bg-background shadow-sm transition",
              isDark && "translate-x-7",
            )}
          >
            {isDark ? (
              <Moon className="h-3.5 w-3.5 text-foreground" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-foreground" />
            )}
          </span>
        </button>
      </div>

      <div className="space-y-3">
        <Label htmlFor="pdf_accent_color_picker">Color de acento del PDF</Label>
        <div className="flex flex-wrap gap-2">
          {PDF_ACCENT_PRESETS.map((preset) => {
            const active = pdfAccentColor === preset;

            return (
              <button
                key={preset}
                type="button"
                aria-label={`Color ${preset}`}
                aria-pressed={active}
                onClick={() => setPdfAccentColor(preset)}
                className={cn(
                  "h-9 w-9 rounded-full border-2 transition",
                  active ? "border-foreground scale-105" : "border-transparent",
                )}
                style={{ backgroundColor: preset }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <input
            id="pdf_accent_color_picker"
            type="color"
            value={pdfAccentColor}
            onChange={(event) =>
              setPdfAccentColor(normalizePdfAccentColor(event.target.value))
            }
            className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
          />
          <p className="text-sm text-muted-foreground">
            Se usa en líneas y destacados de tus PDFs nuevos.
          </p>
        </div>
        {!PDF_ACCENT_PRESETS.includes(
          pdfAccentColor as (typeof PDF_ACCENT_PRESETS)[number],
        ) && pdfAccentColor !== DEFAULT_PDF_ACCENT_COLOR ? (
          <p className="text-xs text-muted-foreground">Color personalizado: {pdfAccentColor}</p>
        ) : null}
      </div>

      <Button type="submit">Guardar apariencia</Button>
    </form>
  );
}
