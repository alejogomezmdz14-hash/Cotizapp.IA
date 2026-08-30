import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Select nativo, estilado para que se vea igual que `Input`.
 *
 * Nativo a propósito: en el celular abre el selector del sistema operativo, que
 * es mejor que cualquier dropdown que podamos construir — más rápido, accesible
 * y familiar. El público de Cotizapp trabaja desde el teléfono.
 *
 * Existe porque había once `<select>` sueltos repartidos en ocho archivos, con
 * seis estilos distintos entre sí. Dos problemas concretos que eso causaba:
 *
 *   - `text-sm` (14px) hace que Safari en iPhone le haga ZOOM a la página al
 *     tocar el control, y después el usuario queda con la pantalla corrida.
 *     Cualquier tamaño menor a 16px lo dispara. Por eso acá va `text-base`.
 *   - Alturas de 36 y 40px, por debajo de los 44px de área táctil que exige el
 *     CLAUDE.md del proyecto.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full appearance-none rounded-md border border-input bg-[rgb(var(--input-bg-rgb)/1)] px-3 py-2 pr-9 text-base text-foreground shadow-none ring-offset-background",
          "transition-[border-color,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {/* `appearance-none` saca la flecha del sistema, así que la reponemos.
          pointer-events-none para que el click siga llegando al select. */}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
});
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
