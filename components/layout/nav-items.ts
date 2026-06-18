import {
  FileText,
  Home,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const dashboardNavItem = {
  href: "/dashboard",
  label: "Inicio",
  icon: Home,
} as const satisfies NavItem;

export const primaryNavItems = [
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/cotizaciones/nueva", label: "Nuevo", icon: Plus },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
  { href: "/catalogo", label: "Catálogo", icon: Package },
] as const satisfies readonly NavItem[];

export const secondaryNavItems = [] as const satisfies readonly NavItem[];

export const sidebarNavItems = [
  dashboardNavItem,
  ...primaryNavItems,
  ...secondaryNavItems,
] as const satisfies readonly NavItem[];

export const sidebarFooterNavItems = [
  { href: "/ajustes", label: "Ajustes", icon: Settings },
] as const satisfies readonly NavItem[];

const MOBILE_MORE_HREFS: readonly string[] = ["/chat", "/catalogo"];

export const mobileBarNavItems: readonly NavItem[] = [
  dashboardNavItem,
  ...primaryNavItems.filter((item) => !MOBILE_MORE_HREFS.includes(item.href)),
];

export const mobileMoreNavItems: readonly NavItem[] = primaryNavItems.filter(
  (item) => MOBILE_MORE_HREFS.includes(item.href),
);

function isNestedPath(pathname: string, href: string) {
  return pathname.startsWith(`${href}/`);
}

export function getActiveNavHref(
  pathname: string,
  items: readonly NavItem[],
): string | null {
  const exactMatch = items.find((item) => item.href === pathname);

  if (exactMatch) {
    return exactMatch.href;
  }

  const nestedMatch = items
    .filter((item) => isNestedPath(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];

  return nestedMatch?.href ?? null;
}
