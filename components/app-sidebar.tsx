"use client"

import Link from "next/link"
import {
  House,
  ChevronDown,
  ChevronRight,
  Users,
  FolderKanban,
  FileText,
  Settings,
  DollarSign,
  X,
  Receipt,
  Inbox,
  PenLine,
  Building2,
  BellRing,
  History,
  Workflow,
  CheckSquare,
  FolderOpen,
  Calendar,
  Bot,
  Wrench,
  Sparkles,
  Cpu,
  Banknote,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserMenu } from "@/components/user-menu"
import { useUser } from "@/hooks/use-user"

interface AppSidebarProps {
  currentSection: string
  onClose: () => void
}

type Role = "admin" | "editor" | "viewer"

interface SidebarItem {
  id: string
  label: string
  icon: typeof House
  href: string
  roles: Role[]
}

interface SidebarGroupConfig {
  id: string
  title: string
  icon: typeof House
  items: SidebarItem[]
}

const flowSections: SidebarItem[] = [
  { id: "inbox", label: "Inbox Inteligente", icon: Inbox, href: "/inbox", roles: ["admin", "editor", "viewer"] },
  { id: "entrada", label: "Entrada Manual", icon: PenLine, href: "/entrada", roles: ["admin", "editor"] },
  { id: "clientes", label: "Clientes", icon: Users, href: "/clientes", roles: ["admin", "editor", "viewer"] },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban, href: "/proyectos", roles: ["admin", "editor", "viewer"] },
  { id: "tareas", label: "Tareas", icon: CheckSquare, href: "/tareas", roles: ["admin", "editor", "viewer"] },
  { id: "calendario", label: "Calendario", icon: Calendar, href: "/calendario", roles: ["admin", "editor", "viewer"] },
  { id: "archivos", label: "Archivos", icon: FolderOpen, href: "/archivos", roles: ["admin", "editor", "viewer"] },
  { id: "departamentos", label: "Departamentos", icon: Building2, href: "/departamentos", roles: ["admin", "editor"] },
]

const forgeSections: SidebarItem[] = [
  { id: "contenido", label: "Campañas & Contenido", icon: FileText, href: "/contenido", roles: ["admin", "editor"] },
]

const fundsSections: SidebarItem[] = [
  { id: "finanzas", label: "Finanzas", icon: DollarSign, href: "/finanzas", roles: ["admin", "editor"] },
  { id: "facturacion", label: "Facturación", icon: Receipt, href: "/facturacion", roles: ["admin", "editor"] },
]

const futureSections: SidebarItem[] = [
  { id: "agente", label: "Agente Ejecutivo", icon: Bot, href: "/agente", roles: ["admin", "editor"] },
  { id: "motor", label: "Motor IA", icon: Workflow, href: "/motor", roles: ["admin", "editor"] },
]

const frameworkSections: SidebarItem[] = [
  { id: "notificaciones", label: "Notificaciones", icon: BellRing, href: "/notificaciones", roles: ["admin", "editor", "viewer"] },
  { id: "historial", label: "Historial", icon: History, href: "/historial", roles: ["admin", "editor"] },
  { id: "biblioteca", label: "Herramientas", icon: Wrench, href: "/biblioteca", roles: ["admin", "editor"] },
  { id: "administracion", label: "Gestión", icon: Settings, href: "/administracion", roles: ["admin"] },
]

const groups: SidebarGroupConfig[] = [
  { id: "flow", title: "Flow", icon: Workflow, items: flowSections },
  { id: "forge", title: "Forge", icon: Sparkles, items: forgeSections },
  { id: "funds", title: "Funds", icon: Banknote, items: fundsSections },
  { id: "future", title: "Future", icon: Cpu, items: futureSections },
  { id: "framework", title: "Framework", icon: Wrench, items: frameworkSections },
]

function SidebarGroup({
  title,
  groupIcon: GroupIcon,
  items,
  currentSection,
  userRole,
  collapsed,
  onToggle,
  onNavigate,
}: {
  title: string
  groupIcon: typeof House
  items: SidebarItem[]
  currentSection: string
  userRole: string
  collapsed: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const filtered = items.filter((item) => item.roles.includes(userRole as Role))
  if (filtered.length === 0) return null

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="mb-1.5 flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
      >
        <span className="flex items-center gap-2">
          <GroupIcon className="h-3.5 w-3.5" />
          {title}
        </span>
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {!collapsed && (
        <nav className="flex flex-col gap-0.5">
        {filtered.map((item) => {
          const Icon = item.icon
          const isActive = currentSection === item.id
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "border-l-2 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        </nav>
      )}
    </div>
  )
}

export function AppSidebar({ currentSection, onClose }: AppSidebarProps) {
  const { role } = useUser()
  const [collapsedByGroup, setCollapsedByGroup] = useState<Record<string, boolean>>({
    flow: false,
    forge: false,
    funds: false,
    future: false,
    framework: false,
  })

  const toggleGroup = (groupId: string) =>
    setCollapsedByGroup((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))

  const isDashboardActive = currentSection === "dashboard"

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-bold text-sidebar-primary-foreground">7F</span>
          </div>
          <span className="text-base font-semibold text-sidebar-foreground">7F Platform</span>
        </Link>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
          aria-label="Cerrar sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        {/* Dashboard — fixed link */}
        <Link
          href="/"
          onClick={onClose}
          className={cn(
            "mb-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
            isDashboardActive
              ? "border-l-2 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
          )}
        >
          <House className="h-4 w-4 flex-shrink-0" />
          <span>Dashboard</span>
        </Link>

        {groups.map((group) => (
          <SidebarGroup
            key={group.id}
            title={group.title}
            groupIcon={group.icon}
            items={group.items}
            currentSection={currentSection}
            userRole={role}
            collapsed={!!collapsedByGroup[group.id]}
            onToggle={() => toggleGroup(group.id)}
            onNavigate={onClose}
          />
        ))}
      </ScrollArea>

      {/* User area */}
      <div className="border-t border-sidebar-border px-3 py-2.5">
        <UserMenu />
      </div>
    </div>
  )
}
