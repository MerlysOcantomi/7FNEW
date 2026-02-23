"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Settings,
  DollarSign,
  MessageSquare,
  BookOpen,
  UserCircle,
  X,
  Receipt,
  Inbox,
  PenLine,
  Fingerprint,
  Building2,
  BellRing,
  History,
  Workflow,
  CheckSquare,
  FolderOpen,
  Calendar,
  ShieldCheck,
  Bot,
} from "lucide-react"
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
  icon: typeof LayoutDashboard
  href: string
  roles: Role[]
}

const mainSections: SidebarItem[] = [
  { id: "direccion", label: "Direccion General", icon: LayoutDashboard, href: "/", roles: ["admin", "editor", "viewer"] },
  { id: "inbox", label: "Inbox Inteligente", icon: Inbox, href: "/inbox", roles: ["admin", "editor"] },
  { id: "entrada", label: "Entrada Manual", icon: PenLine, href: "/entrada", roles: ["admin", "editor"] },
  { id: "clientes", label: "Clientes", icon: Users, href: "/clientes", roles: ["admin", "editor", "viewer"] },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban, href: "/proyectos", roles: ["admin", "editor", "viewer"] },
  { id: "contenido", label: "Campanas & Contenido", icon: FileText, href: "/contenido", roles: ["admin", "editor"] },
  { id: "tareas", label: "Tareas", icon: CheckSquare, href: "/tareas", roles: ["admin", "editor", "viewer"] },
  { id: "calendario", label: "Calendario", icon: Calendar, href: "/calendario", roles: ["admin", "editor"] },
  { id: "archivos", label: "Archivos", icon: FolderOpen, href: "/archivos", roles: ["admin", "editor", "viewer"] },
]

const managementSections: SidebarItem[] = [
  { id: "departamentos", label: "Departamentos", icon: Building2, href: "/departamentos", roles: ["admin", "editor"] },
  { id: "administracion", label: "Administracion", icon: Settings, href: "/administracion", roles: ["admin"] },
  { id: "finanzas", label: "Finanzas", icon: DollarSign, href: "/finanzas", roles: ["admin"] },
  { id: "facturacion", label: "Facturacion", icon: Receipt, href: "/facturacion", roles: ["admin", "editor"] },
  { id: "comunicacion", label: "Comunicacion", icon: MessageSquare, href: "/comunicacion", roles: ["admin", "editor"] },
  { id: "notificaciones", label: "Notificaciones", icon: BellRing, href: "/notificaciones", roles: ["admin", "editor", "viewer"] },
]

const toolsSections: SidebarItem[] = [
  { id: "agente", label: "Agente Ejecutivo", icon: Bot, href: "/agente", roles: ["admin", "editor"] },
  { id: "motor", label: "Motor IA", icon: Workflow, href: "/motor", roles: ["admin", "editor"] },
  { id: "identidad", label: "Resolucion Identidad", icon: Fingerprint, href: "/identidad", roles: ["admin", "editor"] },
  { id: "historial", label: "Historial", icon: History, href: "/historial", roles: ["admin", "editor", "viewer"] },
  { id: "biblioteca", label: "Biblioteca", icon: BookOpen, href: "/biblioteca", roles: ["admin", "editor", "viewer"] },
  { id: "usuarios", label: "Usuarios", icon: UserCircle, href: "/usuarios", roles: ["admin"] },
  { id: "admin", label: "Admin Usuarios", icon: ShieldCheck, href: "/admin/usuarios", roles: ["admin"] },
]

function SidebarGroup({ title, items, currentSection, userRole }: { title: string; items: SidebarItem[]; currentSection: string; userRole: string }) {
  const filtered = items.filter((item) => item.roles.includes(userRole as Role))
  if (filtered.length === 0) return null

  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <nav className="flex flex-col gap-0.5">
        {filtered.map((item) => {
          const Icon = item.icon
          const isActive = currentSection === item.id
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function AppSidebar({ currentSection, onClose }: AppSidebarProps) {
  const { role } = useUser()

  return (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
            <span className="text-sm font-bold text-background">7F</span>
          </div>
          <span className="text-base font-semibold text-sidebar-foreground">7F Platform</span>
        </Link>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          aria-label="Cerrar sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <SidebarGroup title="Principal" items={mainSections} currentSection={currentSection} userRole={role} />
        <SidebarGroup title="Gestion" items={managementSections} currentSection={currentSection} userRole={role} />
        <SidebarGroup title="Herramientas" items={toolsSections} currentSection={currentSection} userRole={role} />
      </ScrollArea>

      {/* User area */}
      <div className="border-t border-sidebar-border px-3 py-2.5">
        <UserMenu />
      </div>
    </div>
  )
}
