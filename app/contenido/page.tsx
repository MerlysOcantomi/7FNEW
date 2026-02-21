"use client"

import { useState, useMemo } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { ContentCalendar } from "@/components/content-calendar"
import { ContentList } from "@/components/content-list"
import { ContentIdeas } from "@/components/content-ideas"
import { ContentAI } from "@/components/content-ai"
import { cn } from "@/lib/utils"
import {
  Calendar,
  List,
  Lightbulb,
  Sparkles,
} from "lucide-react"
import type { ContentItem } from "@/components/content-calendar"

/* ── Mock data (will be replaced by backend) ── */
const allContent: ContentItem[] = [
  { id: "c01", title: "Logotipo - Opciones iniciales", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "revision", date: "2026-02-19", type: "diseno", responsible: "Ana Rodriguez", priority: "alta" },
  { id: "c02", title: "Paleta de colores corporativa", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "aprobado", date: "2026-02-16", type: "diseno", responsible: "Ana Rodriguez", priority: "alta" },
  { id: "c03", title: "Copy landing principal", client: "Beta Labs", clientId: "beta-labs", project: "App Beta v2", projectId: "app-beta-v2", status: "en-progreso", date: "2026-02-20", type: "copy", responsible: "Sofia Torres", priority: "alta" },
  { id: "c04", title: "Fotografias de producto", client: "Gamma Inc", clientId: "gamma-inc", project: "Catalogo Gamma", projectId: "catalogo-gamma", status: "en-progreso", date: "2026-02-21", type: "fotografia", responsible: "Carlos Mendez", priority: "media" },
  { id: "c05", title: "Video presentacion corporativa", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "idea", date: "2026-02-25", type: "video", responsible: "Luis Garcia", priority: "media" },
  { id: "c06", title: "Guia de marca - Documento final", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "en-progreso", date: "2026-02-22", type: "documento", responsible: "Ana Rodriguez", priority: "alta" },
  { id: "c07", title: "Pieza redes - Lanzamiento", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "idea", date: "2026-03-01", type: "pieza-creativa", responsible: "Luis Garcia", priority: "baja" },
  { id: "c08", title: "Mockups packaging", client: "Gamma Inc", clientId: "gamma-inc", project: "Catalogo Gamma", projectId: "catalogo-gamma", status: "revision", date: "2026-02-18", type: "diseno", responsible: "Ana Rodriguez", priority: "media" },
  { id: "c09", title: "Textos producto - Fichas tecnicas", client: "Gamma Inc", clientId: "gamma-inc", project: "Catalogo Gamma", projectId: "catalogo-gamma", status: "aprobado", date: "2026-02-14", type: "copy", responsible: "Sofia Torres", priority: "baja" },
  { id: "c10", title: "Manual de onboarding - Pantallas", client: "Beta Labs", clientId: "beta-labs", project: "App Beta v2", projectId: "app-beta-v2", status: "en-progreso", date: "2026-02-23", type: "diseno", responsible: "Carlos Mendez", priority: "alta" },
  { id: "c11", title: "Informe de avance - Febrero", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "entregado", date: "2026-02-15", type: "documento", responsible: "Ana Rodriguez", priority: "baja" },
  { id: "c12", title: "Propuesta creativa - Campana Q2", client: "Delta Tech", clientId: "delta-tech", project: "Campana Delta", projectId: "campana-delta", status: "idea", date: "2026-02-26", type: "pieza-creativa", responsible: "Luis Garcia", priority: "media" },
  { id: "c13", title: "Iconografia app - Set completo", client: "Beta Labs", clientId: "beta-labs", project: "App Beta v2", projectId: "app-beta-v2", status: "revision", date: "2026-02-17", type: "diseno", responsible: "Carlos Mendez", priority: "media" },
  { id: "c14", title: "Brief creativo - Zeta Digital", client: "Zeta Digital", clientId: "zeta-digital", project: "Web Zeta", projectId: "web-zeta", status: "aprobado", date: "2026-02-12", type: "documento", responsible: "Sofia Torres", priority: "baja" },
  { id: "c15", title: "Animacion hero - Landing", client: "Beta Labs", clientId: "beta-labs", project: "App Beta v2", projectId: "app-beta-v2", status: "atrasado", date: "2026-02-10", type: "video", responsible: "Luis Garcia", priority: "alta" },
  { id: "c16", title: "Sesion fotografica oficina", client: "Alpha Corp", clientId: "alpha-corp", project: "Rebranding Alpha", projectId: "rebranding-alpha", status: "entregado", date: "2026-02-08", type: "fotografia", responsible: "Carlos Mendez", priority: "media" },
]

const views = [
  { id: "calendario", label: "Calendario", icon: Calendar },
  { id: "lista", label: "Lista", icon: List },
  { id: "ideas", label: "Banco Creativo", icon: Lightbulb },
  { id: "ia", label: "IA Editorial", icon: Sparkles },
] as const

type ViewId = (typeof views)[number]["id"]

export default function ContenidoPage() {
  const [activeView, setActiveView] = useState<ViewId>("calendario")

  const clients = useMemo(() => [...new Set(allContent.map(c => c.client))], [])
  const projects = useMemo(() => [...new Set(allContent.map(c => c.project))], [])

  const stats = useMemo(() => ({
    total: allContent.length,
    enProgreso: allContent.filter(c => c.status === "en-progreso").length,
    revision: allContent.filter(c => c.status === "revision").length,
    aprobado: allContent.filter(c => c.status === "aprobado").length,
    entregado: allContent.filter(c => c.status === "entregado").length,
    atrasado: allContent.filter(c => c.status === "atrasado").length,
  }), [])

  return (
    <AppShell
      currentSection="contenido"
      breadcrumbs={[{ label: "7F" }, { label: "Contenido" }]}
    >
      <SectionPage
        title="Contenido"
        description="Centraliza todo lo que se produce: disenos, documentos, entregables, piezas creativas, textos e ideas."
      >
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En progreso</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.enProgreso}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Revision</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.revision}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aprobado</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.aprobado}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entregado</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{stats.entregado}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Atrasado</p>
            <p className={cn("text-2xl font-semibold mt-1", stats.atrasado > 0 ? "text-[var(--destructive)]" : "text-foreground")}>{stats.atrasado}</p>
          </div>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {views.map(view => {
            const Icon = view.icon
            const isActive = activeView === view.id
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors flex-shrink-0",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            )
          })}
        </div>

        {/* Active view */}
        {activeView === "calendario" && <ContentCalendar items={allContent} />}
        {activeView === "lista" && <ContentList items={allContent} clients={clients} projects={projects} />}
        {activeView === "ideas" && <ContentIdeas />}
        {activeView === "ia" && <ContentAI />}
      </SectionPage>
    </AppShell>
  )
}
