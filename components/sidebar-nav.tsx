"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  PenLine,
} from "lucide-react"
import { useState, createContext, useContext } from "react"
import { UserMenu } from "@/components/user-menu"
import { useUser } from "@/hooks/use-user"

interface SidebarCollapseContextType {
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}
export const SidebarCollapseContext = createContext<SidebarCollapseContextType>({
  collapsed: false,
  setCollapsed: () => {},
})
export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext)
}

type Role = "admin" | "editor" | "viewer"
type NavItem = { label: string; href: string; icon: React.ElementType; roles: Role[] }
type NavSection = {
  section: string
  subtitle: string
  items: NavItem[]
  dividerAbove?: boolean
}

const NAV_SECTIONS: NavSection[] = [
  {
    section: "Dashboard",
    subtitle: "",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "editor", "viewer"] },
    ],
  },
  {
    section: "Flow",
    subtitle: "Operacion diaria",
    items: [
      { label: "Inbox", href: "/inbox", icon: Inbox, roles: ["admin", "editor", "viewer"] },
      { label: "Entrada", href: "/entrada", icon: PenLine, roles: ["admin", "editor"] },
      { label: "Clientes", href: "/clientes", icon: Users, roles: ["admin", "editor", "viewer"] },
      { label: "Proyectos", href: "/proyectos", icon: FolderKanban, roles: ["admin", "editor", "viewer"] },
      { label: "Tareas", href: "/tareas", icon: CheckSquare, roles: ["admin", "editor", "viewer"] },
      { label: "Calendario", href: "/calendario", icon: CalendarDays, roles: ["admin", "editor", "viewer"] },
      { label: "Archivos", href: "/archivos", icon: Files, roles: ["admin", "editor", "viewer"] },
      { label: "Departamentos", href: "/departamentos", icon: Building2, roles: ["admin", "editor"] },
    ],
  },
  {
    section: "Forge",
    subtitle: "Creacion y contenido",
    items: [
      { label: "Campañas & Contenido", href: "/contenido", icon: FileEdit, roles: ["admin", "editor"] },
    ],
  },
  {
    section: "Funds",
    subtitle: "Finanzas",
    items: [
      { label: "Finanzas", href: "/finanzas", icon: DollarSign, roles: ["admin", "editor"] },
      { label: "Facturacion", href: "/facturacion", icon: FileText, roles: ["admin", "editor"] },
    ],
  },
  {
    section: "Future",
    subtitle: "Inteligencia y estrategia",
    items: [
      { label: "Asistente", href: "/agente", icon: Bot, roles: ["admin", "editor"] },
      { label: "Motor IA", href: "/motor", icon: Cpu, roles: ["admin", "editor"] },
    ],
  },
  {
    section: "System",
    subtitle: "Sistema",
    dividerAbove: true,
    items: [
      { label: "Notificaciones", href: "/notificaciones", icon: Bell, roles: ["admin", "editor", "viewer"] },
      { label: "Historial", href: "/historial", icon: History, roles: ["admin", "editor"] },
      { label: "Herramientas", href: "/biblioteca", icon: BookOpen, roles: ["admin", "editor"] },
      { label: "Gestion", href: "/administracion", icon: Settings, roles: ["admin"] },
    ],
  },
]

function getActiveSectionFor(pathname: string): string {
  for (const { section, items } of NAV_SECTIONS) {
    for (const { href } of items) {
      if (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")) {
        return section
      }
    }
  }
  return "Flow"
}

function NavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: { href: string; icon: React.ElementType; label: string; collapsed?: boolean; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 relative group",
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
  )
}

function AccordionSection({
  section,
  subtitle,
  items,
  dividerAbove,
  collapsed,
  isOpen,
  onToggle,
  onNavClick,
  userRole,
}: NavSection & {
  collapsed: boolean
  isOpen: boolean
  onToggle: () => void
  onNavClick?: () => void
  userRole: string
}) {
  const filtered = items.filter((item) => item.roles.includes(userRole as Role))
  if (filtered.length === 0) return null

  const isDashboard = section === "Dashboard"

  if (isDashboard) {
    return (
      <div className={cn(dividerAbove && "pt-3 border-t border-[#1E293B]")}>
        {filtered.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} collapsed={collapsed} onClick={onNavClick} />
        ))}
      </div>
    )
  }

  if (collapsed) {
    return (
      <div className={cn("space-y-0.5", dividerAbove && "pt-3 border-t border-[#1E293B]")}>
        {filtered.map((item) => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} collapsed onClick={onNavClick} />
        ))}
      </div>
    )
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
          {filtered.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} collapsed={false} onClick={onNavClick} />
          ))}
        </div>
      )}
    </div>
  )
}

export function SidebarNav() {
  const pathname = usePathname()
  const { role } = useUser()
  const { collapsed, setCollapsed } = useSidebarCollapse()
  const [openSection, setOpenSection] = useState<string>(getActiveSectionFor(pathname))

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-screen sticky top-0 bg-[#0F172A] text-[#CBD5E1] overflow-y-auto overflow-x-hidden transition-all duration-300",
        collapsed ? "w-14" : "w-52"
      )}
    >
      <div className={cn("flex items-center shrink-0 px-3 pt-5 pb-4", collapsed ? "justify-center" : "justify-between px-5")}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold tracking-tight">7F</span>
            </div>
            <span className="text-white font-semibold text-sm tracking-wide">Platform</span>
          </Link>
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
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

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
            onToggle={() => setOpenSection((prev) => (prev === section ? "" : section))}
            userRole={role}
          />
        ))}
      </nav>

      <div className={cn("border-t border-[#1E293B] shrink-0", collapsed ? "px-1.5 py-3" : "px-3 py-2.5")}>
        <UserMenu />
      </div>
    </aside>
  )
}

export function MobileSidebarNav() {
  const pathname = usePathname()
  const { role } = useUser()
  const [open, setOpen] = useState(false)
  const [openSection, setOpenSection] = useState<string>(getActiveSectionFor(pathname))

  return (
    <>
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[#0F172A] sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#3B82F6] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">7F</span>
          </div>
          <span className="text-white font-semibold text-sm">Platform</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="text-[#94A3B8] hover:text-white p-1"
          aria-label="Abrir navegacion"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-[#0F172A] transition-transform duration-300 flex flex-col overflow-y-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
              <span className="text-white text-xs font-bold">7F</span>
            </div>
            <span className="text-white font-semibold text-sm">Platform</span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="text-[#94A3B8] hover:text-white"
            aria-label="Cerrar navegacion"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 pb-6 flex-1 space-y-1">
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
              userRole={role}
            />
          ))}
        </nav>

        <div className="border-t border-[#1E293B] px-3 py-2.5 shrink-0">
          <UserMenu />
        </div>
      </div>
    </>
  )
}
