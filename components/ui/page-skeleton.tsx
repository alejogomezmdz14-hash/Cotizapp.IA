import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonProps = {
  title?: string;
  rows?: number;
};

export function PageSkeleton({ title, rows = 4 }: PageSkeletonProps) {
  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5 space-y-2">
          {title ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="rounded-md border border-token/80 bg-background/70 p-4"
            >
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="mb-2 h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </section>
    </div>
  );
}
