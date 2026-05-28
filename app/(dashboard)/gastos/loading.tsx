import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function GastosLoading() {
  return <PageSkeleton title="Cargando gastos" rows={3} />;
}
