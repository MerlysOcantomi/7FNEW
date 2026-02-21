"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Info,
  FolderKanban,
  FileText,
  StickyNote,
  Sparkles,
  Plus,
  Calendar,
  ExternalLink,
  MoreHorizontal,
  Receipt,
  History,
  FileText as FileTextIcon,
  CheckCircle2,
  MessageSquare,
  DollarSign,
  UserPlus,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { ClientDocumentsTab } from "@/components/client-documents-tab"
import { ClientBillingTab } from "@/components/client-billing-tab"
import { displayLabel, estadoLabel, prioridadLabel } from "@/lib/api-client"

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  color: string
}

const tabs: Tab[] = [
  { id: "informacion", label: "Informacion", icon: Info, color: "var(--tab-info)" },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban, color: "var(--tab-phases)" },
  { id: "documentos", label: "Documentos", icon: FileText, color: "var(--tab-docs)" },
  { id: "facturacion", label: "Facturacion", icon: Receipt, color: "var(--tab-billing)" },
  { id: "notas", label: "Notas", icon: StickyNote, color: "var(--tab-tasks)" },
  { id: "historial", label: "Historial", icon: History, color: "var(--tab-review)" },
  { id: "ia", label: "IA", icon: Sparkles, color: "var(--tab-ai)" },
]

/* API shape: Cliente & { proyectos?: Proyecto[], tareas?: Tarea[] } */
interface ClientData {
  id?: string
  nombre?: string
  email?: string
  telefono?: string
  empresa?: string
  tipo?: string
  estado?: string
  notas?: string
  createdAt?: string
  updatedAt?: string
  proyectos?: { id: string; nombre: string; estado: string; prioridad: string; progreso: number; clienteId?: string }[]
  tareas?: { id: string; titulo: string; estado: string; prioridad: string; fechaLimite?: string; clienteId?: string }[]
}

interface ClientTabsProps {
  client: ClientData
}

export function ClientTabs({ client }: ClientTabsProps) {
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
                style={{
                  backgroundColor: isActive ? tab.color : "transparent",
                }}
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
        <TabContent tabId={activeTab} client={client} />
      </div>
    </div>
  )
}

/* ─────────────────────── Tab Content ─────────────────────── */

function TabContent({ tabId, client }: { tabId: string; client: ClientData }) {
  switch (tabId) {
    case "informacion":
      return <InformacionTab client={client} />
    case "proyectos":
      return <ProyectosTab proyectos={client.proyectos ?? []} />
    case "documentos":
      return <DocumentosTab />
    case "facturacion":
      return <FacturacionTab />
    case "notas":
      return <NotasTab />
    case "historial":
      return <HistorialTab clientName={client.nombre ?? "—"} />
    case "ia":
      return <IATab clientName={client.nombre ?? "—"} />
    default:
      return null
  }
}

/* ─────────── Informacion ─────────── */

function InformacionTab({ client }: { client: ClientData }) {
  const estadoDisplay = displayLabel(client.estado ?? "", estadoLabel)
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-lg font-semibold text-foreground">Datos Generales</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField label="Nombre" value={client.nombre ?? "—"} />
        <InfoField label="Estado" value={estadoDisplay} />
        <InfoField label="Tipo" value={client.tipo ?? "—"} />
        <InfoField label="Empresa" value={client.empresa ?? "—"} />
        <InfoField label="Email" value={client.email ?? "—"} />
        <InfoField label="Telefono" value={client.telefono ?? "—"} />
        <InfoField label="Fecha de inicio" value={client.createdAt ? new Date(client.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Descripcion
        </p>
        <p className="text-sm leading-relaxed text-foreground/80 max-w-2xl">{client.notas ?? "—"}</p>
      </div>
      {/* Quick notes */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Notas rapidas
        </p>
        <div className="flex flex-col gap-2">
          <QuickNote
            text="Prefieren comunicacion por email. Responden rapido entre 10-14h."
            date="12 feb 2026"
          />
          <QuickNote
            text="Interesados en ampliar servicios de branding el proximo trimestre."
            date="5 feb 2026"
          />
        </div>
      </div>
    </div>
  )
}

function QuickNote({ text, date }: { text: string; date: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3">
      <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
        <p className="text-xs text-muted-foreground mt-1">{date}</p>
      </div>
    </div>
  )
}

/* ─────────── Proyectos ─────────── */

type ProyectoItem = { id: string; nombre: string; estado: string; prioridad: string; progreso: number; clienteId?: string }

function ProyectosTab({ proyectos }: { proyectos: ProyectoItem[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Proyectos Asociados</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Anadir proyecto</span>
        </button>
      </div>
      {proyectos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Sin proyectos</p>
          <p className="text-xs text-muted-foreground mt-1">Este cliente aun no tiene proyectos asociados.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: ProyectoItem }) {
  const statusColors: Record<string, string> = {
    planificacion: "bg-[var(--tab-tasks)] text-foreground/70",
    en_progreso: "bg-[var(--tab-info)] text-foreground/70",
    completado: "bg-[var(--tab-phases)] text-foreground/70",
    cancelado: "bg-muted text-muted-foreground",
  }
  const statusDisplay = displayLabel(project.estado ?? "", estadoLabel)
  const prioridadDisplay = displayLabel(project.prioridad ?? "", prioridadLabel)
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{project.nombre}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{prioridadDisplay}</span>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
            statusColors[project.estado ?? ""] ?? "bg-muted text-muted-foreground"
          )}
        >
          {statusDisplay}
        </span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Progreso</span>
          <span className="text-xs font-medium text-muted-foreground">{project.progreso ?? 0}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/40 transition-all"
            style={{ width: `${project.progreso ?? 0}%` }}
          />
        </div>
      </div>
      <Link href={`/proyectos/${project.id}`} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors self-start">
        <ExternalLink className="h-3 w-3" />
        Ver proyecto
      </Link>
    </div>
  )
}

/* ─────────── Documentos ─────────── */

function DocumentosTab() {
  return <ClientDocumentsTab />
}

/* ─────────── Facturacion ─────────── */

function FacturacionTab() {
  return <ClientBillingTab />
}

/* ─────────── Notas ─────────── */

const clientNotes = [
  {
    id: "n1",
    title: "Reunion de kickoff",
    content:
      "Se definio el alcance del proyecto de rediseno. El cliente quiere mantener los colores corporativos pero modernizar la tipografia y el isotipo. Prioridad alta en el sitio web.",
    date: "15 ene 2026",
    author: "Carlos M.",
  },
  {
    id: "n2",
    title: "Feedback sobre propuesta creativa",
    content:
      "Les gusto la direccion general. Piden ajustar la paleta secundaria hacia tonos mas calidos. Quieren ver opciones de tipografia serif para los titulos.",
    date: "25 ene 2026",
    author: "Ana R.",
  },
  {
    id: "n3",
    title: "Seguimiento comercial",
    content:
      "Interesados en anadir servicio de gestion de redes sociales a partir de Q2. Agendar reunion para presentar propuesta.",
    date: "10 feb 2026",
    author: "Laura G.",
  },
]

function NotasTab() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Notas</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Nueva nota</span>
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clientNotes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    </div>
  )
}

function NoteCard({ note }: { note: (typeof clientNotes)[number] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground leading-tight">{note.title}</h4>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0"
          aria-label="Opciones"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-sm leading-relaxed text-foreground/70 line-clamp-4">{note.content}</p>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">{note.author}</span>
        <span className="text-xs text-muted-foreground">{note.date}</span>
      </div>
    </div>
  )
}

/* ─────────── Historial ─────────── */

const clientHistory = [
  { id: "h1", type: "proyecto", text: "Proyecto 'Rediseno Identidad Visual' creado", date: "15 ene 2026", time: "10:30", icon: FolderKanban },
  { id: "h2", type: "documento", text: "Propuesta creativa.pdf subida al proyecto", date: "18 ene 2026", time: "14:15", icon: FileTextIcon },
  { id: "h3", type: "tarea", text: "Tarea 'Disenar logotipo' completada por Ana R.", date: "22 ene 2026", time: "16:45", icon: CheckCircle2 },
  { id: "h4", type: "comunicacion", text: "Email enviado: Seguimiento de propuesta", date: "25 ene 2026", time: "09:00", icon: MessageSquare },
  { id: "h5", type: "facturacion", text: "Factura #1024 emitida por $3,500 USD", date: "28 ene 2026", time: "11:20", icon: DollarSign },
  { id: "h6", type: "nota", text: "Nota agregada: Interesados en ampliar servicios de branding", date: "5 feb 2026", time: "15:30", icon: StickyNote },
  { id: "h7", type: "proyecto", text: "Proyecto 'Estrategia de Contenidos' creado", date: "1 mar 2026", time: "09:00", icon: FolderKanban },
  { id: "h8", type: "facturacion", text: "Pago recibido: Factura #1024 - $3,500 USD", date: "10 feb 2026", time: "08:45", icon: DollarSign },
  { id: "h9", type: "documento", text: "Brand guidelines v2 subida", date: "12 feb 2026", time: "17:00", icon: FileTextIcon },
  { id: "h10", type: "comunicacion", text: "Reunion virtual: Revision de avances Q1", date: "14 feb 2026", time: "10:00", icon: MessageSquare },
]

const historyTypeColors: Record<string, string> = {
  proyecto: "bg-[var(--tab-info)]",
  documento: "bg-[var(--tab-docs)]",
  tarea: "bg-[var(--tab-phases)]",
  comunicacion: "bg-[var(--tab-ai)]",
  facturacion: "bg-[var(--tab-billing)]",
  nota: "bg-[var(--tab-tasks)]",
}

const historyFilters = ["Todos", "proyecto", "documento", "tarea", "comunicacion", "facturacion", "nota"]
const historyFilterLabels: Record<string, string> = {
  Todos: "Todos",
  proyecto: "Proyectos",
  documento: "Documentos",
  tarea: "Tareas",
  comunicacion: "Comunicacion",
  facturacion: "Facturacion",
  nota: "Notas",
}

function HistorialTab({ clientName }: { clientName: string }) {
  const [filter, setFilter] = useState("Todos")
  const sorted = [...clientHistory].sort((a, b) => new Date(b.date.split(" ").reverse().join("-")).getTime() - new Date(a.date.split(" ").reverse().join("-")).getTime())
  const filtered = filter === "Todos" ? sorted : sorted.filter(h => h.type === filter)

  // Group by date
  const grouped: Record<string, typeof clientHistory> = {}
  for (const item of filtered) {
    if (!grouped[item.date]) grouped[item.date] = []
    grouped[item.date].push(item)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Historial de Actividad</h3>
        <span className="text-xs text-muted-foreground">{clientHistory.length} eventos</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {historyFilters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {historyFilterLabels[f]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{date}</p>
            <div className="flex flex-col gap-2">
              {items.map(item => {
                const Icon = item.icon
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", historyTypeColors[item.type])}>
                      <Icon className="h-4 w-4 text-foreground/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize flex-shrink-0">{item.type}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Sin eventos de este tipo</p>
          <p className="text-xs text-muted-foreground mt-1">Selecciona otro filtro para ver actividad.</p>
        </div>
      )}
    </div>
  )
}

/* ─────────── IA ─────────── */

function IATab({ clientName }: { clientName: string }) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-lg font-semibold text-foreground">Asistente IA del Cliente</h3>
      <p className="text-sm leading-relaxed text-muted-foreground max-w-xl">
        El asistente IA contextual analiza toda la informacion de {clientName} para ofrecerte
        resumenes, sugerencias y respuestas rapidas.
      </p>

      {/* Suggested actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <AIActionCard
          title="Resumen del cliente"
          description="Genera un resumen ejecutivo con el estado actual de todos los proyectos y relacion comercial."
        />
        <AIActionCard
          title="Proximos pasos"
          description="Sugiere las acciones prioritarias basadas en proyectos activos y notas recientes."
        />
        <AIActionCard
          title="Preparar reunion"
          description="Genera un briefing con los puntos clave para la proxima reunion con el cliente."
        />
        <AIActionCard
          title="Analisis de relacion"
          description="Evalua la salud de la relacion comercial y sugiere oportunidades de mejora."
        />
      </div>

      {/* AI response preview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
            <Sparkles className="h-4 w-4 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Resumen automatico</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {clientName} tiene 3 proyectos asociados: 1 en progreso (Rediseno Identidad Visual, 65%),
              1 completado y 1 en planificacion. La relacion comercial esta activa desde enero 2025. El
              cliente ha mostrado interes en ampliar servicios hacia gestion de redes sociales en Q2 2026.
              Se recomienda preparar una propuesta comercial para la proxima reunion.
            </p>
          </div>
        </div>
      </div>

      {/* Query history */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Consultas recientes
        </p>
        <div className="flex flex-col gap-2">
          <QueryRow query="Resume el estado de los proyectos activos" date="14 feb 2026" />
          <QueryRow query="Que documentos faltan por entregar?" date="10 feb 2026" />
          <QueryRow query="Genera un correo de seguimiento" date="5 feb 2026" />
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

/* ─────────── Shared ─────────── */

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
