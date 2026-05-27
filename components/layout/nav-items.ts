import {
  FileText,
  FileSpreadsheet,
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

export const primaryNavItems = [
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/facturas", label: "Facturas", icon: FileSpreadsheet },
  { href: "/cotizaciones/nueva", label: "Nuevo", icon: Plus },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/catalogo", label: "Catálogo", icon: Package },
] as const satisfies readonly NavItem[];

export const secondaryNavItems = [
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
] as const satisfies readonly NavItem[];

export const sidebarNavItems = [
  ...primaryNavItems,
  ...secondaryNavItems,
] as const satisfies readonly NavItem[];

export const sidebarFooterNavItems = [
  { href: "/ajustes", label: "Ajustes", icon: Settings },
] as const satisfies readonly NavItem[];

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
