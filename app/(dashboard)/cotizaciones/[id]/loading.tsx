import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function QuotationDetailLoading() {
  return <PageSkeleton title="Cargando detalle" rows={4} />;
}
