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
  { id: "informacion", label: "Information", icon: Info, color: "var(--tab-info)" },
  { id: "proyectos", label: "Projects", icon: FolderKanban, color: "var(--tab-phases)" },
  { id: "documentos", label: "Files", icon: FileText, color: "var(--tab-docs)" },
  { id: "facturacion", label: "Invoices", icon: Receipt, color: "var(--tab-billing)" },
  { id: "notas", label: "Notes", icon: StickyNote, color: "var(--tab-tasks)" },
  { id: "historial", label: "History", icon: History, color: "var(--tab-review)" },
  { id: "ia", label: "AI Assistant", icon: Sparkles, color: "var(--tab-ai)" },
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
      <h3 className="text-lg font-semibold text-foreground">General Information</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoField label="Name" value={client.nombre ?? "—"} />
        <InfoField label="Status" value={estadoDisplay} />
        <InfoField label="Type" value={client.tipo ?? "—"} />
        <InfoField label="Company" value={client.empresa ?? "—"} />
        <InfoField label="Email" value={client.email ?? "—"} />
        <InfoField label="Phone" value={client.telefono ?? "—"} />
        <InfoField label="Client Since" value={client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Description
        </p>
        <p className="text-sm leading-relaxed text-foreground/80 max-w-2xl">{client.notas ?? "—"}</p>
      </div>
      {/* Quick notes */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Quick Notes
        </p>
        <div className="flex flex-col gap-2">
          <QuickNote
            text="They prefer email communication. They respond quickly between 10 AM and 2 PM."
            date="Feb 12, 2026"
          />
          <QuickNote
            text="Interested in expanding branding services next quarter."
            date="Feb 5, 2026"
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
        <h3 className="text-lg font-semibold text-foreground">Projects</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Project</span>
        </button>
      </div>
      {proyectos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No projects</p>
          <p className="text-xs text-muted-foreground mt-1">This client does not have any associated projects yet.</p>
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
          <span className="text-xs text-muted-foreground">Progress</span>
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
    title: "Kickoff Meeting",
    content:
      "The redesign scope was defined. The client wants to keep the corporate colors while modernizing the typography and symbol. High priority on the website.",
    date: "Jan 15, 2026",
    author: "Carlos M.",
  },
  {
    id: "n2",
    title: "Creative Proposal Feedback",
    content:
      "They liked the overall direction. They asked to shift the secondary palette toward warmer tones and want serif typography options for headings.",
    date: "Jan 25, 2026",
    author: "Ana R.",
  },
  {
    id: "n3",
    title: "Commercial Follow-up",
    content:
      "Interested in adding social media management services starting in Q2. Schedule a meeting to present a proposal.",
    date: "Feb 10, 2026",
    author: "Laura G.",
  },
]

function NotasTab() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Notes</h3>
        <button className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New Note</span>
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
          aria-label="Options"
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
  { id: "h1", type: "proyecto", text: "Project 'Visual Identity Redesign' created", date: "Jan 15, 2026", time: "10:30", icon: FolderKanban },
  { id: "h2", type: "documento", text: "creative-proposal.pdf uploaded to the project", date: "Jan 18, 2026", time: "14:15", icon: FileTextIcon },
  { id: "h3", type: "tarea", text: "Task 'Design Logo' completed by Ana R.", date: "Jan 22, 2026", time: "16:45", icon: CheckCircle2 },
  { id: "h4", type: "comunicacion", text: "Email sent: Proposal follow-up", date: "Jan 25, 2026", time: "09:00", icon: MessageSquare },
  { id: "h5", type: "facturacion", text: "Invoice #1024 issued for $3,500 USD", date: "Jan 28, 2026", time: "11:20", icon: DollarSign },
  { id: "h6", type: "nota", text: "Note added: Interested in expanding branding services", date: "Feb 5, 2026", time: "15:30", icon: StickyNote },
  { id: "h7", type: "proyecto", text: "Project 'Content Strategy' created", date: "Mar 1, 2026", time: "09:00", icon: FolderKanban },
  { id: "h8", type: "facturacion", text: "Payment received: Invoice #1024 - $3,500 USD", date: "Feb 10, 2026", time: "08:45", icon: DollarSign },
  { id: "h9", type: "documento", text: "Brand guidelines v2 uploaded", date: "Feb 12, 2026", time: "17:00", icon: FileTextIcon },
  { id: "h10", type: "comunicacion", text: "Virtual meeting: Q1 progress review", date: "Feb 14, 2026", time: "10:00", icon: MessageSquare },
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
  Todos: "All",
  proyecto: "Projects",
  documento: "Files",
  tarea: "Tasks",
  comunicacion: "Conversations",
  facturacion: "Invoices",
  nota: "Notes",
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
        <h3 className="text-lg font-semibold text-foreground">History</h3>
        <span className="text-xs text-muted-foreground">{clientHistory.length} events</span>
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
          <p className="text-sm font-medium text-foreground">No events of this type</p>
          <p className="text-xs text-muted-foreground mt-1">Select another filter to view activity.</p>
        </div>
      )}
    </div>
  )
}

/* ─────────── IA ─────────── */

function IATab({ clientName }: { clientName: string }) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-lg font-semibold text-foreground">AI Assistant</h3>
      <p className="text-sm leading-relaxed text-muted-foreground max-w-xl">
        The AI Assistant analyzes all information related to {clientName} to provide
        summaries, suggestions, and quick answers.
      </p>

      {/* Suggested actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <AIActionCard
          title="Client Summary"
          description="Generate an executive summary with the current status of all projects and the commercial relationship."
        />
        <AIActionCard
          title="Next Steps"
          description="Suggest the highest-priority actions based on active projects and recent notes."
        />
        <AIActionCard
          title="Prepare Meeting"
          description="Generate a briefing with the key points for the next client meeting."
        />
        <AIActionCard
          title="Relationship Analysis"
          description="Evaluate the health of the commercial relationship and suggest improvement opportunities."
        />
      </div>

      {/* AI response preview */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tab-ai)] flex-shrink-0">
            <Sparkles className="h-4 w-4 text-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Automatic Summary</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {clientName} has 3 associated projects: 1 in progress (Visual Identity Redesign, 65%),
              1 completed, and 1 in planning. The commercial relationship has been active since January 2025.
              The client has shown interest in expanding services into social media management in Q2 2026.
              Preparing a commercial proposal for the next meeting is recommended.
            </p>
          </div>
        </div>
      </div>

      {/* Query history */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Recent Queries
        </p>
        <div className="flex flex-col gap-2">
          <QueryRow query="Summarize the status of active projects" date="Feb 14, 2026" />
          <QueryRow query="Which files are still pending delivery?" date="Feb 10, 2026" />
          <QueryRow query="Generate a follow-up email" date="Feb 5, 2026" />
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
