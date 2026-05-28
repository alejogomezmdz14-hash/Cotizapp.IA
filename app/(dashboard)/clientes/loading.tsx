import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function ClientesLoading() {
  return <PageSkeleton title="Cargando clientes" rows={3} />;
}
