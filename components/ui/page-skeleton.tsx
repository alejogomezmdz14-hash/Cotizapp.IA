import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonProps = {
  /** Se anuncia a lectores de pantalla. Antes solo cambiaba el ancho de una barra gris. */
  title?: string;
  /** Filas de lista a dibujar. */
  rows?: number;
};

/**
 * Skeleton de las pantallas de lista. Tiene que dibujar lo MISMO que aparece
 * después: en móvil eso es un buscador, una fila de chips y filas separadas por
 * una línea. Antes dibujaba un panel hero con título y párrafo más una grilla
 * de tiles de estadísticas — el "peaje" que se sacó del producto — así que el
 * usuario veía ~860px de gris que al cargar se evaporaban y la lista saltaba
 * media pantalla hacia arriba.
 */
export function PageSkeleton({ title, rows = 4 }: PageSkeletonProps) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{title ?? "Cargando"}</span>

      {/* Buscador */}
      <Skeleton className="h-11 w-full rounded-md" />

      {/* Chips de filtro */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-11 w-20 shrink-0 rounded-full"
            style={{ animationDelay: `${index * 60}ms` }}
          />
        ))}
      </div>

      {/* Filas: nombre + dato secundario a la izquierda, monto + estado a la
          derecha, igual que la lista real. */}
      <ul className="divide-y divide-token/60 border-y border-token/60">
        {Array.from({ length: rows }).map((_, index) => (
          <li
            key={index}
            className="flex min-h-16 items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton
                className="h-4 w-2/3 max-w-[11rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              />
              <Skeleton
                className="h-3 w-1/2 max-w-[8rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Skeleton
                className="h-4 w-20"
                style={{ animationDelay: `${index * 90}ms` }}
              />
              <Skeleton
                className="h-3 w-14"
                style={{ animationDelay: `${index * 90}ms` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
