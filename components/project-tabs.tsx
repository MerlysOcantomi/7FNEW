"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Info,
  Layers,
  CheckSquare,
  FileText,
  MessageSquareText,
  Sparkles,
  Receipt,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Clock,
  Upload,
  Search,
  Grid3X3,
  List,
  Download,
  Eye,
  X,
  Flag,
  Check,
  ArrowUpRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { ProjectReviewTab } from "@/components/project-review-tab"
import { estadoLabel, prioridadLabel, displayLabel } from "@/lib/api-client"

/* ═══════════════ TYPES & DATA ═══════════════ */

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  color: string
}

const tabs: Tab[] = [
  { id: "informacion", label: "Informacion", icon: Info, color: "var(--tab-info)" },
  { id: "fases", label: "Fases", icon: Layers, color: "var(--tab-phases)" },
  { id: "tareas", label: "Tareas", icon: CheckSquare, color: "var(--tab-tasks)" },
  { id: "documentos", label: "Documentos", icon: FileText, color: "var(--tab-docs)" },
  { id: "revision", label: "Revision", icon: MessageSquareText, color: "var(--tab-review)" },
  { id: "facturacion", label: "Facturacion", icon: Receipt, color: "var(--tab-billing)" },
  { id: "ia", label: "IA", icon: Sparkles, color: "var(--tab-ai)" },
]

export interface ProjectTabsProps {
  project?: any
  tareas?: any[]
  cliente?: any
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */

export function ProjectTabs({ project, tareas = [], cliente }: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState("informacion")
  const activeTabData = tabs.find((t) => t.id === activeTab)

  return (
    <div className="flex flex-col">
      {/* Tabs bar */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: "none" }}>
        <div className="flex min-w-max gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 px-5 md:px-6 py-4 md:py-5 text-sm font-semibold transition-all border-b-[3px] whitespace-nowrap",
                  isActive
                    ? "border-foreground/30 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/70 hover:border-border"
                )}
                style={{ backgroundColor: isActive ? tab.color : "transparent" }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div
        className="rounded-b-xl border border-t-0 border-border p-5 md:p-8"
        style={{
          backgroundColor: activeTabData
            ? `color-mix(in srgb, ${activeTabData.color} 30%, white)`
            : undefined,
        }}
      >
        <TabContent tabId={activeTab} project={project} tareas={tareas} cliente={cliente} />
      </div>
    </div>
  )
}

function TabContent({ tabId, project, tareas, cliente }: { tabId: string; project?: any; tareas?: any[]; cliente?: any }) {
  switch (tabId) {
    case "informacion":
      return <InformacionTab project={project} cliente={cliente} />
    case "fases":
      return <FasesTab />
    case "tareas":
      return <TareasTab tareas={tareas ?? []} />
    case "documentos":
      return <DocumentosTab />
    case "revision":
      return <ProjectReviewTab project={project} tareas={tareas} cliente={cliente} />
    case "facturacion":
      return <FacturacionProyectoTab />
    case "ia":
      return <IATab project={project} />
    default:
      return null
  }
}

/* ═══════════════ 1. INFORMACION ═══════════════ */

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
  } catch {
    return dateStr
  }
}

function InformacionTab({ project, cliente }: { project?: any; cliente?: any }) {
  const estadoDisplay = project ? displayLabel(project.estado ?? "", estadoLabel) : "—"
  const prioridadDisplay = project ? displayLabel(project.prioridad ?? "", prioridadLabel) : "—"
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold text-foreground">Informacion del Proyecto</h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField label="Cliente" value={cliente?.nombre ?? "—" } />
        <InfoField label="Fecha de inicio" value={project ? formatDate(project.fechaInicio) : "—"} />
        <InfoField label="Fecha estimada" value={project ? formatDate(project.fechaFin) : "—"} />
        <InfoField label="Estado" value={estadoDisplay} />
        <InfoField label="Prioridad" value={prioridadDisplay} />
        {cliente?.empresa && <InfoField label="Empresa" value={cliente.empresa} />}
      </div>

      <Section title="Descripcion">
        <p className="text-sm leading-relaxed text-foreground/80 max-w-2xl">
          {project?.descripcion ?? "Sin descripcion."}
        </p>
      </Section>

      <Section title="Objetivos">
        <ul className="list-disc list-inside text-sm leading-relaxed text-foreground/80 space-y-1.5 max-w-2xl">
          <li>Modernizar la identidad visual manteniendo el reconocimiento de marca</li>
          <li>Redisenar el sitio web con enfoque en conversion y experiencia de usuario</li>
          <li>Crear una guia de estilo completa para uso interno y externo</li>
          <li>Desarrollar materiales impresos alineados con la nueva identidad</li>
        </ul>
      </Section>

      <Section title="Alcance">
        <div className="grid gap-3 sm:grid-cols-2">
          <ScopeItem label="Logotipo e identidad" included />
          <ScopeItem label="Sitio web (8 paginas)" included />
          <ScopeItem label="Guia de estilo" included />
          <ScopeItem label="Papeleria corporativa" included />
          <ScopeItem label="Redes sociales" included={false} />
          <ScopeItem label="Video corporativo" included={false} />
        </div>
      </Section>

      <Section title="Entregables principales">
        <div className="flex flex-col gap-2">
          <DeliverableRow name="Manual de identidad visual" dueDate="28 feb 2026" status="En progreso" />
          <DeliverableRow name="Sitio web funcional" dueDate="15 abr 2026" status="Pendiente" />
          <DeliverableRow name="Kit de papeleria" dueDate="30 abr 2026" status="Pendiente" />
          <DeliverableRow name="Presentacion de marca" dueDate="15 feb 2026" status="Completado" />
        </div>
      </Section>

      <Section title="Equipo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TeamMember name="Carlos Mendez" role="Director del proyecto" />
          <TeamMember name="Ana Rodriguez" role="Disenadora principal" />
          <TeamMember name="Luis Garcia" role="Disenador UI/UX" />
          <TeamMember name="Sofia Torres" role="Copywriter" />
          <TeamMember name="Andres Ruiz" role="Desarrollador frontend" />
        </div>
      </Section>

      <Section title="Notas">
        <div className="flex flex-col gap-2">
          <NoteItem text="El cliente prefiere comunicacion por email. Responde rapido entre 10-14h." date="12 feb 2026" author="Carlos M." />
          <NoteItem text="Confirmar tipografia serif para titulos con el cliente antes del 20 feb." date="15 feb 2026" author="Ana R." />
        </div>
      </Section>
    </div>
  )
}

function ScopeItem({ label, included }: { label: string; included: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3">
      {included ? (
        <Check className="h-4 w-4 text-foreground/50 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
      )}
      <span className={cn("text-sm", included ? "text-foreground" : "text-muted-foreground line-through")}>{label}</span>
    </div>
  )
}

function DeliverableRow({ name, dueDate, status }: { name: string; dueDate: string; status: string }) {
  const statusColors: Record<string, string> = {
    Completado: "bg-[var(--tab-phases)] text-foreground/70",
    "En progreso": "bg-[var(--tab-info)] text-foreground/70",
    Pendiente: "bg-muted text-muted-foreground",
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
      </div>
      <span className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">{dueDate}</span>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0", statusColors[status] || "bg-muted text-muted-foreground")}>
        {status}
      </span>
    </div>
  )
}

function TeamMember({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground flex-shrink-0">
        {name.split(" ").map(n => n[0]).join("")}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
  )
}

function NoteItem({ text, date, author }: { text: string; date: string; author: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
        <p className="text-xs text-muted-foreground mt-1">{author} &middot; {date}</p>
      </div>
    </div>
  )
}

/* ═══════════════ 2. FASES ═══════════════ */

interface PhaseTask {
  name: string
  status: string
  assignee: string
}

interface PhaseDeliverable {
  name: string
  status: string
}

interface Phase {
  id: string
  name: string
  status: string
  progress: number
  startDate: string
  endDate: string
  responsible: string
  tasks: PhaseTask[]
  deliverables: PhaseDeliverable[]
}

const phases: Phase[] = [
  {
    id: "p1", name: "Descubrimiento", status: "Completada", progress: 100,
    startDate: "15 ene", endDate: "28 ene", responsible: "Carlos M.",
    tasks: [
      { name: "Entrevistas con stakeholders", status: "completada", assignee: "Carlos M." },
      { name: "Analisis de competencia", status: "completada", assignee: "Sofia T." },
      { name: "Definicion de audiencia", status: "completada", assignee: "Luis G." },
    ],
    deliverables: [
      { name: "Reporte de investigacion", status: "Completado" },
      { name: "Mapa de stakeholders", status: "Completado" },
    ],
  },
  {
    id: "p2", name: "Estrategia", status: "Completada", progress: 100,
    startDate: "29 ene", endDate: "10 feb", responsible: "Sofia T.",
    tasks: [
      { name: "Definir posicionamiento", status: "completada", assignee: "Sofia T." },
      { name: "Crear moodboard", status: "completada", assignee: "Ana R." },
      { name: "Validar con cliente", status: "completada", assignee: "Carlos M." },
    ],
    deliverables: [
      { name: "Documento de estrategia", status: "Completado" },
      { name: "Moodboard aprobado", status: "Completado" },
    ],
  },
  {
    id: "p3", name: "Diseno", status: "En progreso", progress: 65,
    startDate: "11 feb", endDate: "15 mar", responsible: "Ana R.",
    tasks: [
      { name: "Definir paleta de colores", status: "completada", assignee: "Ana R." },
      { name: "Disenar logotipo", status: "en progreso", assignee: "Ana R." },
      { name: "Tipografia y sistema visual", status: "en progreso", assignee: "Luis G." },
      { name: "Diseno de paginas web", status: "pendiente", assignee: "Luis G." },
    ],
    deliverables: [
      { name: "Logotipo final", status: "En progreso" },
      { name: "Sistema de diseno", status: "En progreso" },
      { name: "Mockups web", status: "Pendiente" },
    ],
  },
  {
    id: "p4", name: "Desarrollo", status: "Pendiente", progress: 0,
    startDate: "16 mar", endDate: "15 abr", responsible: "Andres R.",
    tasks: [
      { name: "Maquetacion frontend", status: "pendiente", assignee: "Andres R." },
      { name: "Integracion CMS", status: "pendiente", assignee: "Andres R." },
      { name: "Testing y QA", status: "pendiente", assignee: "Luis G." },
    ],
    deliverables: [
      { name: "Sitio web funcional", status: "Pendiente" },
    ],
  },
  {
    id: "p5", name: "Lanzamiento", status: "Pendiente", progress: 0,
    startDate: "16 abr", endDate: "30 abr", responsible: "Carlos M.",
    tasks: [
      { name: "Revision final con cliente", status: "pendiente", assignee: "Carlos M." },
      { name: "Despliegue a produccion", status: "pendiente", assignee: "Andres R." },
      { name: "Entrega de materiales", status: "pendiente", assignee: "Ana R." },
    ],
    deliverables: [
      { name: "Entrega final completa", status: "Pendiente" },
      { name: "Kit de papeleria", status: "Pendiente" },
    ],
  },
]

function FasesTab() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>("p3")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Fases del Proyecto</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Anadir fase</span>
        </button>
      </div>

      {/* Timeline progress */}
      <div className="flex items-center gap-1 overflow-hidden rounded-full h-2.5 bg-muted">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className="h-full transition-all first:rounded-l-full last:rounded-r-full"
            style={{
              flex: 1,
              backgroundColor: phase.progress === 100 ? "var(--tab-phases)" : phase.progress > 0 ? "var(--tab-info)" : "transparent",
              opacity: phase.progress > 0 ? 1 : 0.3,
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {phases.map((phase) => {
          const isExpanded = expandedPhase === phase.id
          return (
            <div key={phase.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Phase header */}
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{phase.name}</p>
                    <StatusBadge status={phase.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {phase.startDate} - {phase.endDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {phase.responsible}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-2 w-24">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground/40 transition-all"
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-8 text-right">{phase.progress}%</span>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border px-5 py-4 flex flex-col gap-4">
                  {/* Tasks */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2.5">Tareas</p>
                    <div className="flex flex-col gap-1.5">
                      {phase.tasks.map((task) => (
                        <div key={task.name} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3.5 py-2.5">
                          <TaskCheckbox status={task.status} />
                          <span className={cn("text-sm flex-1 min-w-0 truncate", task.status === "completada" ? "text-muted-foreground line-through" : "text-foreground")}>{task.name}</span>
                          <span className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">{task.assignee}</span>
                          <StatusBadge status={task.status} small />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Deliverables */}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2.5">Entregables</p>
                    <div className="flex flex-col gap-1.5">
                      {phase.deliverables.map((d) => (
                        <div key={d.name} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3.5 py-2.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm flex-1 min-w-0 truncate text-foreground">{d.name}</span>
                          <StatusBadge status={d.status} small />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskCheckbox({ status }: { status: string }) {
  const isComplete = status === "completada"
  return (
    <div className={cn(
      "flex h-4 w-4 items-center justify-center rounded border flex-shrink-0",
      isComplete ? "bg-foreground/60 border-foreground/60" : "border-border bg-card"
    )}>
      {isComplete && <Check className="h-2.5 w-2.5 text-background" />}
    </div>
  )
}

/* ═══════════════ 3. TAREAS ═══════════════ */

function formatTaskDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
  } catch {
    return dateStr
  }
}

function TareasTab({ tareas = [] }: { tareas?: any[] }) {
  const [filterStatus, setFilterStatus] = useState<string>("todas")
  const [filterPriority, setFilterPriority] = useState<string>("todas")
  const [search, setSearch] = useState("")

  const filtered = tareas.filter((t: any) => {
    if (filterStatus !== "todas" && t.estado !== filterStatus) return false
    if (filterPriority !== "todas" && t.prioridad !== filterPriority) return false
    if (search && !String(t.titulo ?? "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Tareas</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Anadir tarea</span>
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Completadas" value={tareas.filter((t: any) => t.estado === "completada" || t.estado === "completado").length} total={tareas.length} color="var(--tab-phases)" />
        <MiniStat label="En progreso" value={tareas.filter((t: any) => t.estado === "en_progreso" || t.estado === "en progreso").length} total={tareas.length} color="var(--tab-info)" />
        <MiniStat label="Pendientes" value={tareas.filter((t: any) => t.estado === "pendiente" || (t.estado !== "completada" && t.estado !== "completado" && t.estado !== "en_progreso" && t.estado !== "en progreso")).length} total={tareas.length} color="var(--tab-tasks)" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar tareas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="todas">Todos los estados</option>
          <option value="completada">Completada</option>
          <option value="completado">Completado</option>
          <option value="en_progreso">En progreso</option>
          <option value="pendiente">Pendiente</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="todas">Todas las prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {filtered.map((task: any) => {
          const isComplete = task.estado === "completada" || task.estado === "completado"
          return (
            <div key={task.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-shadow hover:shadow-sm">
              <TaskCheckbox status={isComplete ? "completada" : task.estado} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", isComplete ? "text-muted-foreground line-through" : "text-foreground")}>{task.titulo}</p>
              </div>
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                <Clock className="h-3 w-3" /> {formatTaskDate(task.fechaLimite)}
              </span>
              <PriorityBadge priority={displayLabel(task.prioridad ?? "", prioridadLabel)} />
              <StatusBadge status={displayLabel(task.estado ?? "", estadoLabel)} small />
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No se encontraron tareas con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${(value / total) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Alta: "text-red-600",
    Media: "text-amber-600",
    Baja: "text-foreground/40",
  }
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium flex-shrink-0", colors[priority] || "text-muted-foreground")}>
      <Flag className="h-3 w-3" />
      <span className="hidden lg:inline">{priority}</span>
    </span>
  )
}

/* ═══════════════ 4. DOCUMENTOS ═══════════════ */

interface DocItem {
  id: string
  name: string
  type: string
  date: string
  size: string
  phase: string
  isDeliverable: boolean
  version: number
}

const projectDocs: DocItem[] = [
  { id: "d1", name: "Brief del proyecto.pdf", type: "PDF", date: "15 ene 2026", size: "2.4 MB", phase: "Descubrimiento", isDeliverable: false, version: 1 },
  { id: "d2", name: "Reporte de investigacion.pdf", type: "PDF", date: "28 ene 2026", size: "5.8 MB", phase: "Descubrimiento", isDeliverable: true, version: 2 },
  { id: "d3", name: "Moodboard aprobado.fig", type: "FIG", date: "10 feb 2026", size: "18.3 MB", phase: "Estrategia", isDeliverable: true, version: 1 },
  { id: "d4", name: "Propuesta creativa v3.pdf", type: "PDF", date: "8 feb 2026", size: "3.2 MB", phase: "Estrategia", isDeliverable: false, version: 3 },
  { id: "d5", name: "Paleta de colores.png", type: "PNG", date: "15 feb 2026", size: "0.8 MB", phase: "Diseno", isDeliverable: false, version: 2 },
  { id: "d6", name: "Logotipo opciones.ai", type: "AI", date: "18 feb 2026", size: "45.6 MB", phase: "Diseno", isDeliverable: true, version: 1 },
  { id: "d7", name: "Presentacion avance.pptx", type: "PPTX", date: "14 feb 2026", size: "8.7 MB", phase: "Diseno", isDeliverable: false, version: 1 },
  { id: "d8", name: "Guia de estilo draft.pdf", type: "PDF", date: "19 feb 2026", size: "12.1 MB", phase: "Diseno", isDeliverable: true, version: 1 },
]

function DocumentosTab() {
  const [search, setSearch] = useState("")
  const [filterPhase, setFilterPhase] = useState("todas")
  const [filterType, setFilterType] = useState("todos")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)

  const filtered = projectDocs.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPhase !== "todas" && d.phase !== filterPhase) return false
    if (filterType !== "todos" && d.type !== filterType) return false
    return true
  })

  const uniquePhases = [...new Set(projectDocs.map(d => d.phase))]
  const uniqueTypes = [...new Set(projectDocs.map(d => d.type))]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Documentos del Proyecto</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Subir archivo</span>
        </button>
      </div>

      {/* Upload zone */}
      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          isDragOver ? "border-foreground/40 bg-muted/50" : "border-border bg-card/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false) }}
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Arrastra archivos aqui o haz click para seleccionar</p>
        <p className="text-xs text-muted-foreground/60 mt-1">PDF, DOC, FIG, AI, PNG, PPTX hasta 100MB</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="todas">Todas las fases</option>
          {uniquePhases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="todos">Todos los tipos</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden">
          <button onClick={() => setViewMode("list")} className={cn("p-2 transition-colors", viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")} aria-label="Vista lista"><List className="h-4 w-4" /></button>
          <button onClick={() => setViewMode("grid")} className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")} aria-label="Vista cuadricula"><Grid3X3 className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Docs */}
      {viewMode === "list" ? (
        <div className="flex flex-col gap-2">
          {filtered.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-shadow hover:shadow-sm">
              <DocTypeIcon type={doc.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                  {doc.isDeliverable && <span className="rounded-full bg-[var(--tab-phases)] px-2 py-0.5 text-[10px] font-medium text-foreground/70 flex-shrink-0">Entregable</span>}
                  {doc.version > 1 && <span className="text-[10px] text-muted-foreground flex-shrink-0">v{doc.version}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{doc.phase} &middot; {doc.date}</p>
              </div>
              <span className="hidden sm:block text-xs text-muted-foreground flex-shrink-0">{doc.size}</span>
              <button onClick={() => setPreviewDoc(doc)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0" aria-label="Ver"><Eye className="h-4 w-4" /></button>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0" aria-label="Descargar"><Download className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm">
              <div className="flex items-center gap-3">
                <DocTypeIcon type={doc.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.type} &middot; {doc.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{doc.phase}</span>
                {doc.isDeliverable && <span className="rounded-full bg-[var(--tab-phases)] px-2 py-0.5 text-[10px] font-medium text-foreground/70">Entregable</span>}
                {doc.version > 1 && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">v{doc.version}</span>}
              </div>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">{doc.date}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPreviewDoc(doc)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Ver"><Eye className="h-3.5 w-3.5" /></button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Descargar"><Download className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No se encontraron documentos.</div>}

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewDoc(null)}>
          <div className="w-full max-w-lg rounded-xl bg-card border border-border p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-foreground">{previewDoc.name}</h4>
              <button onClick={() => setPreviewDoc(null)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cerrar"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center justify-center h-40 rounded-lg bg-muted">
              <DocTypeIcon type={previewDoc.type} large />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Tipo</p><p className="text-foreground font-medium">{previewDoc.type}</p></div>
              <div><p className="text-xs text-muted-foreground">Tamano</p><p className="text-foreground font-medium">{previewDoc.size}</p></div>
              <div><p className="text-xs text-muted-foreground">Fase</p><p className="text-foreground font-medium">{previewDoc.phase}</p></div>
              <div><p className="text-xs text-muted-foreground">Version</p><p className="text-foreground font-medium">v{previewDoc.version}</p></div>
              <div><p className="text-xs text-muted-foreground">Fecha</p><p className="text-foreground font-medium">{previewDoc.date}</p></div>
              <div><p className="text-xs text-muted-foreground">Entregable</p><p className="text-foreground font-medium">{previewDoc.isDeliverable ? "Si" : "No"}</p></div>
            </div>
            <button className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80">
              <Download className="h-4 w-4" /> Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DocTypeIcon({ type, large }: { type: string; large?: boolean }) {
  const colors: Record<string, string> = {
    PDF: "bg-red-100 text-red-600",
    FIG: "bg-purple-100 text-purple-600",
    AI: "bg-orange-100 text-orange-600",
    PNG: "bg-green-100 text-green-600",
    PPTX: "bg-amber-100 text-amber-600",
  }
  const cls = colors[type] || "bg-muted text-muted-foreground"
  return (
    <div className={cn(
      "flex items-center justify-center rounded-lg flex-shrink-0",
      large ? "h-16 w-16" : "h-9 w-9",
      cls
    )}>
      {large ? (
        <span className="text-sm font-bold">{type}</span>
      ) : (
        <span className="text-[10px] font-bold">{type}</span>
      )}
    </div>
  )
}

/* ═══════════════ 5b. FACTURACION DEL PROYECTO ═══════════════ */

const projectInvoices = [
  { id: "fac-001", number: "FAC-2026-017", concept: "Fase Descubrimiento", amount: 45000, status: "Pagada", date: "30 ene 2026", dueDate: "15 feb 2026" },
  { id: "fac-002", number: "FAC-2026-024", concept: "Fase Estrategia", amount: 35000, status: "Pagada", date: "12 feb 2026", dueDate: "28 feb 2026" },
  { id: "fac-003", number: "FAC-2026-031", concept: "Fase Diseno (anticipo 50%)", amount: 55000, status: "Pendiente", date: "18 feb 2026", dueDate: "5 mar 2026" },
  { id: "fac-004", number: "FAC-2026-038", concept: "Fase Diseno (restante 50%)", amount: 55000, status: "Borrador", date: "", dueDate: "20 mar 2026" },
  { id: "fac-005", number: "FAC-2026-045", concept: "Fase Desarrollo", amount: 70000, status: "Borrador", date: "", dueDate: "20 abr 2026" },
]

function FacturacionProyectoTab() {
  const totalBudget = projectInvoices.reduce((a, i) => a + i.amount, 0)
  const totalPaid = projectInvoices.filter(i => i.status === "Pagada").reduce((a, i) => a + i.amount, 0)
  const totalPending = projectInvoices.filter(i => i.status === "Pendiente").reduce((a, i) => a + i.amount, 0)
  const totalDraft = projectInvoices.filter(i => i.status === "Borrador").reduce((a, i) => a + i.amount, 0)

  const fmt = (n: number) => `$${n.toLocaleString("es-MX")}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-foreground">Facturacion del Proyecto</h3>
        <a
          href="/facturacion"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Ver facturacion general <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Presupuesto total</p>
          <p className="text-xl font-bold text-foreground mt-1">{fmt(totalBudget)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cobrado</p>
          <p className="text-xl font-bold text-foreground mt-1">{fmt(totalPaid)}</p>
          <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-[var(--tab-phases)]" style={{ width: `${(totalPaid / totalBudget) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendiente</p>
          <p className="text-xl font-bold text-foreground mt-1">{fmt(totalPending)}</p>
          <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-[var(--tab-tasks)]" style={{ width: `${(totalPending / totalBudget) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Por emitir</p>
          <p className="text-xl font-bold text-foreground mt-1">{fmt(totalDraft)}</p>
          <div className="h-1 rounded-full bg-muted mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: `${(totalDraft / totalBudget) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">Progreso de cobro</p>
          <p className="text-xs font-semibold text-foreground">{Math.round((totalPaid / totalBudget) * 100)}% cobrado</p>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted gap-0.5">
          <div className="h-full rounded-l-full bg-[var(--tab-phases)] transition-all" style={{ width: `${(totalPaid / totalBudget) * 100}%` }} />
          <div className="h-full bg-[var(--tab-tasks)] transition-all" style={{ width: `${(totalPending / totalBudget) * 100}%` }} />
          <div className="h-full rounded-r-full bg-muted-foreground/20 transition-all" style={{ width: `${(totalDraft / totalBudget) * 100}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--tab-phases)]" />Cobrado</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--tab-tasks)]" />Pendiente</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/20" />Por emitir</span>
        </div>
      </div>

      {/* Invoices list */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Facturas del proyecto</p>
        <div className="flex flex-col gap-2">
          {projectInvoices.map((inv) => {
            const statusStyles: Record<string, string> = {
              Pagada: "bg-[var(--tab-phases)] text-foreground/70",
              Pendiente: "bg-[var(--tab-tasks)] text-foreground/70",
              Borrador: "bg-muted text-muted-foreground",
              Vencida: "bg-[var(--tab-review)] text-foreground/70",
            }
            return (
              <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-shadow hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tab-billing)] flex-shrink-0">
                  <Receipt className="h-4 w-4 text-foreground/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{inv.number}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0", statusStyles[inv.status] || "bg-muted text-muted-foreground")}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{inv.concept}</p>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-sm font-semibold text-foreground">{fmt(inv.amount)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inv.status === "Borrador" ? `Vence: ${inv.dueDate}` : inv.date}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground sm:hidden flex-shrink-0">{fmt(inv.amount)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ 6. IA ═══════════════ */

function IATab({ project }: { project?: any }) {
  const [query, setQuery] = useState("")
  const projectName = project?.nombre ?? "este proyecto"

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-lg font-semibold text-foreground">Asistente IA del Proyecto</h3>
      <p className="text-sm leading-relaxed text-muted-foreground max-w-xl">
        El asistente IA contextual analiza toda la informacion del proyecto para ofrecerte
        resumenes, sugerencias, analisis y generacion de contenido.
      </p>

      {/* Suggested actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AIActionCard title="Resumen de avance" description="Genera un resumen ejecutivo del estado actual del proyecto." />
        <AIActionCard title="Proximos pasos" description="Sugiere las acciones prioritarias basadas en el progreso y fechas limite." />
        <AIActionCard title="Analisis de riesgos" description="Identifica posibles riesgos y retrasos en las fases pendientes." />
        <AIActionCard title="Preparar reporte" description="Genera un reporte de avance para enviar al cliente." />
        <AIActionCard title="Sugerir tareas" description="Recomienda tareas adicionales basadas en el alcance del proyecto." />
        <AIActionCard title="Revisar entregables" description="Analiza los entregables y sugiere mejoras o ajustes." />
      </div>

      {/* AI response */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
            <Sparkles className="h-4 w-4 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Resumen automatico del proyecto</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              El proyecto &quot;{projectName}&quot; avanza al {project?.progreso ?? 0}% general. La fase de Diseno esta activa con
              2 de 4 tareas completadas. Hay 2 solicitudes de cambio del cliente en el entregable de logotipo
              (1 en progreso, 1 pendiente). La paleta de colores y el moodboard estan aprobados. Se recomienda
              priorizar la finalizacion del logotipo antes de avanzar a mockups web para mantener la fecha
              estimada de entrega del 30 de abril.
            </p>
          </div>
        </div>
      </div>

      {/* Query input */}
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pregunta algo sobre el proyecto..."
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-80 flex-shrink-0" aria-label="Enviar consulta">
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Recent queries */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2.5">Consultas recientes</p>
        <div className="flex flex-col gap-2">
          <QueryRow query="Resume el estado de las fases activas" date="19 feb 2026" />
          <QueryRow query="Que tareas son prioritarias esta semana?" date="17 feb 2026" />
          <QueryRow query="Genera un correo de avance para el cliente" date="14 feb 2026" />
          <QueryRow query="Analiza los riesgos del cronograma" date="12 feb 2026" />
        </div>
      </div>
    </div>
  )
}

function AIActionCard({ title, description }: { title: string; description: string }) {
  return (
    <button className="rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm flex flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  )
}

function QueryRow({ query, date }: { query: string; date: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <Sparkles className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <p className="flex-1 text-sm text-foreground truncate">{query}</p>
      <span className="text-xs text-muted-foreground flex-shrink-0">{date}</span>
    </div>
  )
}

/* ═══════════════ SHARED COMPONENTS ═══════════════ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const colors: Record<string, string> = {
    Completada: "bg-[var(--tab-phases)] text-foreground/70",
    completada: "bg-[var(--tab-phases)] text-foreground/70",
    Completado: "bg-[var(--tab-phases)] text-foreground/70",
    "En progreso": "bg-[var(--tab-info)] text-foreground/70",
    "en progreso": "bg-[var(--tab-info)] text-foreground/70",
    Pendiente: "bg-muted text-muted-foreground",
    pendiente: "bg-muted text-muted-foreground",
  }
  return (
    <span className={cn(
      "rounded-full font-medium capitalize flex-shrink-0",
      small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
      colors[status] || "bg-muted text-muted-foreground"
    )}>
      {status}
    </span>
  )
}
