import {
  FileText,
  Home,
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
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/cotizaciones/nueva", label: "Nuevo", icon: Plus },
  { href: "/catalogo", label: "Catálogo", icon: Package },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
] as const satisfies readonly NavItem[];

export const sidebarNavItems = [
  ...primaryNavItems,
  { href: "/clientes", label: "Clientes", icon: Users },
] as const satisfies readonly NavItem[];
