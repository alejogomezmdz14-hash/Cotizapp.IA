import { CatalogPageContent } from "@/components/catalogo/catalog-page-content";
import {
  getCatalogCategorySuggestions,
  getCatalogUnitSuggestions,
} from "@/lib/catalog-suggestions";
import { getCatalogItems } from "@/lib/catalog";
import { getProfile, requireUser } from "@/lib/profile";

type CatalogPageProps = {
  searchParams?: {
    search?: string;
  };
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const user = await requireUser();
  const search =
    typeof searchParams?.search === "string" ? searchParams.search : "";
  const [items, profile] = await Promise.all([
    getCatalogItems(user.id, { search }),
    getProfile(user.id),
  ]);
  const categorySuggestions = getCatalogCategorySuggestions(items);
  const unitSuggestions = getCatalogUnitSuggestions(items);

  return (
    <CatalogPageContent
      items={items}
      search={search}
      currency={profile?.currency ?? null}
      categorySuggestions={categorySuggestions}
      unitSuggestions={unitSuggestions}
    />
  );
}
