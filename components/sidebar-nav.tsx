"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  CheckSquare,
  Users,
  CalendarDays,
  Files,
  Building2,
  FileEdit,
  DollarSign,
  FileText,
  Bot,
  Cpu,
  Bell,
  History,
  BookOpen,
  Settings,
  Menu,
  X,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  LogIn,
  ChevronDown,
  Search,
} from "lucide-react";
import { useState, createContext, useContext } from "react";
import { useGlobalSearch } from "@/components/global-search-provider";

// ── Collapse Context ────────────────────────────────────────────────────────
interface SidebarCollapseContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}
export const SidebarCollapseContext = createContext<SidebarCollapseContextType>({
  collapsed: false,
  setCollapsed: () => {},
});
export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}

// ── Types ────────────────────────────────────────────────────────────────────
type NavItem = { label: string; href: string; icon: React.ElementType };
type NavSection = {
  section: string;
  subtitle: string;
  items: NavItem[];
  dividerAbove?: boolean;
};

// ── Navigation Structure ─────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  {
    section: "Dashboard",
    subtitle: "",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    section: "Flow",
    subtitle: "Operación diaria",
    items: [
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Entrada", href: "/entrada", icon: LogIn },
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Solicitudes", href: "/requests", icon: MessageSquarePlus },
      { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
      { label: "Tareas", href: "/tareas", icon: CheckSquare },
      { label: "Calendario", href: "/calendario", icon: CalendarDays },
      { label: "Archivos", href: "/archivos", icon: Files },
      { label: "Departamentos", href: "/departamentos", icon: Building2 },
    ],
  },
  {
    section: "Forge",
    subtitle: "Creación y contenido",
    items: [
      { label: "Contenido", href: "/contenido", icon: FileEdit },
    ],
  },
  {
    section: "Funds",
    subtitle: "Finanzas",
    items: [
      { label: "Finanzas", href: "/finanzas", icon: DollarSign },
      { label: "Facturación", href: "/facturacion", icon: FileText },
    ],
  },
  {
    section: "Future",
    subtitle: "Planificación estratégica",
    items: [
      { label: "Agente", href: "/agente", icon: Bot },
      { label: "Motor IA", href: "/motor", icon: Cpu },
    ],
  },
  {
    section: "System",
    subtitle: "Sistema",
    dividerAbove: true,
    items: [
      { label: "Notificaciones", href: "/notificaciones", icon: Bell },
      { label: "Historial", href: "/historial", icon: History },
      { label: "Herramientas", href: "/biblioteca", icon: BookOpen },
      { label: "Gestión", href: "/administracion", icon: Settings },
    ],
  },
];

// ── Helper: determine which section contains active route ────────────────────
function getActiveSectionFor(pathname: string): string {
  for (const { section, items } of NAV_SECTIONS) {
    for (const { href } of items) {
      if (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")) {
        return section;
      }
    }
  }
  return "Flow";
}

// ── NavLink ──────────────────────────────────────────────────────────────────
function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: NavItem & { collapsed?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150 relative group",
        collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
        isActive
          ? "text-white bg-[#1E293B] shadow-[0_0_0_1px_#3B82F6,0_0_8px_0_rgba(59,130,246,0.18)]"
          : "text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/60"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#3B82F6] rounded-r-full" />
      )}
      <Icon
        size={15}
        strokeWidth={1.75}
        className={cn(isActive ? "text-[#60A5FA]" : "text-[#64748B] group-hover:text-[#94A3B8]")}
      />
      {!collapsed && label}
    </Link>
  );
}

// ── Accordion Section ────────────────────────────────────────────────────────
function AccordionSection({
  section,
  subtitle,
  items,
  dividerAbove,
  collapsed,
  isOpen,
  onToggle,
  onNavClick,
}: NavSection & {
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}) {
  const isDashboard = section === "Dashboard";

  if (isDashboard) {
    return (
      <div className={cn(dividerAbove && "pt-3 border-t border-[#1E293B]")}>
        {items.map((item) => (
          <NavLink key={item.href} {...item} collapsed={collapsed} onClick={onNavClick} />
        ))}
      </div>
    );
  }

  if (collapsed) {
    // Icon-only: just render links without accordion
    return (
      <div className={cn("space-y-0.5", dividerAbove && "pt-3 border-t border-[#1E293B]")}>
        {items.map((item) => (
          <NavLink key={item.href} {...item} collapsed={true} onClick={onNavClick} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(dividerAbove && "pt-3 border-t border-[#1E293B]")}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
      >
        <div className="flex flex-col items-start">
          <span className="text-[11px] font-semibold text-[#475569] group-hover:text-[#94A3B8] transition-colors tracking-wide">
            {section}
          </span>
          {subtitle && (
            <span className="text-[9px] text-[#334155] mt-0.5 tracking-wide">{subtitle}</span>
          )}
        </div>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={cn(
            "text-[#334155] group-hover:text-[#475569] transition-all duration-200",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {isOpen && (
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavLink key={item.href} {...item} collapsed={false} onClick={onNavClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Desktop Sidebar ──────────────────────────────────────────────────────────
export function SidebarNav() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarCollapse();
  const { openSearch } = useGlobalSearch();
  const [openSection, setOpenSection] = useState<string>(
    pathname === "/" ? "Flow" : getActiveSectionFor(pathname)
  );

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? "" : section));
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-screen sticky top-0 bg-[#0F172A] text-[#CBD5E1] overflow-y-auto overflow-x-hidden transition-all duration-300",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo + Collapse Toggle */}
      <div className={cn("flex items-center shrink-0 px-3 pt-5 pb-4", collapsed ? "justify-center" : "justify-between px-5")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold tracking-tight">7F</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">Copilot</span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold tracking-tight">7F</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "text-[#475569] hover:text-[#94A3B8] transition-colors p-1 rounded",
            collapsed && "mt-1"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Search trigger */}
      <div className={cn("shrink-0 px-3 pb-3", collapsed && "px-1.5")}>
        <button
          onClick={openSearch}
          className={cn(
            "w-full flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150",
            collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
            "text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]/60"
          )}
          title="Buscar (Ctrl+K)"
        >
          <Search size={15} strokeWidth={1.75} />
          {!collapsed && <span>Buscar</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 pb-4 space-y-1", collapsed ? "px-1.5" : "px-3")}>
        {NAV_SECTIONS.map(({ section, subtitle, items, dividerAbove }) => (
          <AccordionSection
            key={section}
            section={section}
            subtitle={subtitle}
            items={items}
            dividerAbove={dividerAbove}
            collapsed={collapsed}
            isOpen={openSection === section}
            onToggle={() => toggleSection(section)}
          />
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 pb-5 pt-4 border-t border-[#1E293B] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#1E293B] flex items-center justify-center text-xs font-medium text-[#94A3B8]">
              EA
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[#E2E8F0] truncate">Executive Admin</span>
              <span className="text-[10px] text-[#64748B] truncate">admin@7fcopilot.com</span>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="pb-5 pt-4 border-t border-[#1E293B] shrink-0 flex justify-center">
          <div
            className="w-7 h-7 rounded-full bg-[#1E293B] flex items-center justify-center text-xs font-medium text-[#94A3B8]"
            title="Executive Admin"
          >
            EA
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Mobile Sidebar (Sheet-based) ──────────────────────────────────────────────
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export function MobileSidebarNav() {
  const pathname = usePathname();
  const { openSearch } = useGlobalSearch();
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string>(
    pathname === "/" ? "Flow" : getActiveSectionFor(pathname)
  );

  return (
    <>
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[#0F172A] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#3B82F6] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">7F</span>
          </div>
          <span className="text-white font-semibold text-sm">Copilot</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openSearch}
            className="text-[#94A3B8] hover:text-white p-1"
            aria-label="Buscar"
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => setOpen(true)}
            className="text-[#94A3B8] hover:text-white p-1"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-[#0F172A] border-r-0 [&>button]:hidden"
        >
          <SheetTitle className="sr-only">Navegacion</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
                <span className="text-white text-xs font-bold">7F</span>
              </div>
              <span className="text-white font-semibold text-sm">Copilot</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#94A3B8] hover:text-white"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="px-3 pb-6 flex-1 space-y-1 overflow-y-auto">
            {NAV_SECTIONS.map(({ section, subtitle, items, dividerAbove }) => (
              <AccordionSection
                key={section}
                section={section}
                subtitle={subtitle}
                items={items}
                dividerAbove={dividerAbove}
                collapsed={false}
                isOpen={openSection === section}
                onToggle={() => setOpenSection((prev) => (prev === section ? "" : section))}
                onNavClick={() => setOpen(false)}
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
