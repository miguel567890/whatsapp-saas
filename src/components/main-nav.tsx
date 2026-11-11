"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Store,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavKey = "hoy" | "agenda" | "inbox" | "negocio" | "dashboard" | "settings" | "agency";

const ITEMS: Record<NavKey, { href: string; label: string; Icon: LucideIcon }> = {
  hoy: { href: "/hoy", label: "Hoy", Icon: Sun },
  agenda: { href: "/agenda", label: "Agenda", Icon: CalendarDays },
  inbox: { href: "/inbox", label: "Mensajes", Icon: MessageCircle },
  negocio: { href: "/negocio", label: "Mi negocio", Icon: Store },
  dashboard: { href: "/dashboard", label: "Métricas", Icon: LayoutDashboard },
  settings: { href: "/settings", label: "Ajustes", Icon: Settings },
  agency: { href: "/workspaces", label: "Agencia", Icon: Building2 },
};

const BUSINESS: NavKey[] = ["hoy", "agenda", "inbox", "negocio"];
const AGENCY_TOP: NavKey[] = [
  "hoy",
  "agenda",
  "inbox",
  "negocio",
  "dashboard",
  "settings",
  "agency",
];
const AGENCY_BOTTOM: NavKey[] = ["hoy", "agenda", "inbox", "settings", "agency"];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Enlaces de la cabecera (pantallas medianas y grandes). */
export function TopNav({ agency }: { agency: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex items-center gap-1" aria-label="Navegación">
      {(agency ? AGENCY_TOP : BUSINESS).map((key) => {
        const { href, label, Icon } = ITEMS[key];
        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className={cn(agency && "hidden lg:inline")}>{label}</span>
            {agency && <span className="sr-only lg:hidden">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior en el móvil. */
export function BottomNav({ agency }: { agency: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-50 h-16",
        "glass-strong border-t border-border/50",
        "flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]",
      )}
      aria-label="Navegación móvil"
    >
      {(agency ? AGENCY_BOTTOM : BUSINESS).map((key) => {
        const { href, label, Icon } = ITEMS[key];
        const active = isActive(pathname, href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
