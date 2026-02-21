"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Lightbulb,
  Plus,
  Tag,
  ArrowRight,
  CheckSquare,
  X,
  Search,
} from "lucide-react"

/* ── Types ── */
interface Idea {
  id: string
  title: string
  description: string
  tags: string[]
  client?: string
  project?: string
  createdAt: string
  category: "idea" | "concepto" | "referencia" | "prompt" | "inspiracion" | "nota-editorial"
}

const categoryLabels: Record<string, string> = {
  idea: "Idea",
  concepto: "Concepto",
  referencia: "Referencia",
  prompt: "Prompt",
  inspiracion: "Inspiracion",
  "nota-editorial": "Nota editorial",
}

const categoryColors: Record<string, string> = {
  idea: "bg-[var(--tab-ai)] text-foreground/70",
  concepto: "bg-[var(--tab-info)] text-foreground/70",
  referencia: "bg-[var(--tab-phases)] text-foreground/70",
  prompt: "bg-[var(--tab-docs)] text-foreground/70",
  inspiracion: "bg-[var(--tab-tasks)] text-foreground/70",
  "nota-editorial": "bg-muted text-muted-foreground",
}

const mockIdeas: Idea[] = [
  {
    id: "idea-1",
    title: "Campana visual estilo editorial minimalista",
    description: "Explorar un enfoque fotografico en blanco y negro con tipografia serif para la campana de lanzamiento. Inspirado en editoriales de moda europeas. Puede funcionar como serie de 5 piezas para redes y landing.",
    tags: ["branding", "fotografia", "editorial"],
    client: "Alpha Corp",
    project: "Rebranding Alpha",
    createdAt: "2026-02-18",
    category: "idea",
  },
  {
    id: "idea-2",
    title: "Micro-animaciones para onboarding",
    description: "Crear un set de micro-animaciones Lottie para el flujo de onboarding de la app. Deben ser suaves, sin colores saturados, con estilo line-art. Referencia: Stripe, Linear.",
    tags: ["motion", "UX", "app"],
    client: "Beta Labs",
    project: "App Beta v2",
    createdAt: "2026-02-16",
    category: "concepto",
  },
  {
    id: "idea-3",
    title: "Moodboard: texturas organicas + paleta neutra",
    description: "Recopilar referencias de texturas organicas (papel, tela, madera) combinadas con paletas neutras y calidas. Para el rediseno del packaging.",
    tags: ["moodboard", "packaging", "texturas"],
    client: "Gamma Inc",
    createdAt: "2026-02-14",
    category: "referencia",
  },
  {
    id: "idea-4",
    title: "Prompt: Generar variaciones de logo sobre fondo texturizado",
    description: "Usa un estilo de renderizado realista con luz natural suave. Coloca el logo sobre superficies de concreto, madera clara y papel kraft. Fondo desenfocado, profundidad de campo.",
    tags: ["IA", "logo", "mockup"],
    createdAt: "2026-02-12",
    category: "prompt",
  },
  {
    id: "idea-5",
    title: "Serie de contenido: Detras del proceso creativo",
    description: "Documentar el proceso creativo de un proyecto real en 5 piezas. Desde el brief hasta la entrega. Formato: carrusel o video corto. Muestra bocetos, iteraciones, feedback y resultado final.",
    tags: ["contenido", "storytelling", "proceso"],
    client: "Alpha Corp",
    project: "Rebranding Alpha",
    createdAt: "2026-02-10",
    category: "inspiracion",
  },
  {
    id: "idea-6",
    title: "Guia interna: Tono de voz para clientes tech",
    description: "Redactar una guia de tono de voz especifica para clientes del sector tecnologico. Debe cubrir: headlines, CTAs, descripciones de producto, mensajes de error, y comunicacion interna.",
    tags: ["copy", "guia", "tono-de-voz"],
    createdAt: "2026-02-08",
    category: "nota-editorial",
  },
]

export function ContentIdeas() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("todos")
  const [showNewIdeaForm, setShowNewIdeaForm] = useState(false)
  const [newIdea, setNewIdea] = useState({ title: "", description: "", tags: "", category: "idea" })

  const filtered = mockIdeas.filter(idea => {
    const matchesSearch = !search.trim() ||
      idea.title.toLowerCase().includes(search.toLowerCase()) ||
      idea.description.toLowerCase().includes(search.toLowerCase()) ||
      idea.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = categoryFilter === "todos" || idea.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Banco Creativo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Ideas, conceptos, referencias, prompts e inspiracion</p>
        </div>
        <button
          onClick={() => setShowNewIdeaForm(true)}
          className="flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva idea
        </button>
      </div>

      {/* New idea form */}
      {showNewIdeaForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground">Nueva idea</h4>
            <button onClick={() => setShowNewIdeaForm(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={newIdea.title}
              onChange={e => setNewIdea({ ...newIdea, title: e.target.value })}
              placeholder="Titulo de la idea..."
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              value={newIdea.description}
              onChange={e => setNewIdea({ ...newIdea, description: e.target.value })}
              placeholder="Describe la idea, concepto o referencia..."
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={newIdea.tags}
                onChange={e => setNewIdea({ ...newIdea, tags: e.target.value })}
                placeholder="Etiquetas separadas por coma..."
                className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="relative">
                <select
                  value={newIdea.category}
                  onChange={e => setNewIdea({ ...newIdea, category: e.target.value })}
                  className="appearance-none rounded-lg border border-border bg-background pl-3 pr-8 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ideas, etiquetas..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setCategoryFilter("todos")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors flex-shrink-0",
              categoryFilter === "todos" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            Todos
          </button>
          {Object.entries(categoryLabels).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setCategoryFilter(categoryFilter === k ? "todos" : k)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors flex-shrink-0",
                categoryFilter === k ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Ideas grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(idea => (
            <div key={idea.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 transition-shadow hover:shadow-sm">
              {/* Category + date */}
              <div className="flex items-center justify-between">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", categoryColors[idea.category])}>
                  {categoryLabels[idea.category]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(idea.createdAt + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </span>
              </div>

              {/* Title + description */}
              <div>
                <h4 className="text-sm font-semibold text-foreground leading-snug text-balance">{idea.title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground mt-1.5 line-clamp-3">{idea.description}</p>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {idea.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>

              {/* Client/project */}
              {(idea.client || idea.project) && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {idea.client && <span>{idea.client}</span>}
                  {idea.client && idea.project && <span>&middot;</span>}
                  {idea.project && <span>{idea.project}</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <ArrowRight className="h-3 w-3" />
                  Convertir en contenido
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <CheckSquare className="h-3 w-3" />
                  Convertir en tarea
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Lightbulb className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No se encontraron ideas con esos filtros</p>
        </div>
      )}
    </div>
  )
}
