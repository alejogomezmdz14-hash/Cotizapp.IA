import {
  FileText,
  MessageSquare,
  Package,
  Plus,
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
  { href: "/cotizaciones/nueva", label: "Nuevo", icon: Plus },
  { href: "/catalogo", label: "Catálogo", icon: Package },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
] as const satisfies readonly NavItem[];

export const sidebarNavItems = [
  ...primaryNavItems,
  { href: "/clientes", label: "Clientes", icon: Users },
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
