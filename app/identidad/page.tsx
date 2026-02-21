"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  Fingerprint,
  Search,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Building2,
  Sparkles,
  ArrowRight,
  Eye,
} from "lucide-react"

const identityGroups = [
  {
    id: "ig-1",
    canonicalName: "Maria Lopez",
    client: "Alpha Corp",
    confidence: 98,
    status: "confirmado",
    variants: [
      { alias: "Maria Lopez", source: "CRM", type: "nombre" },
      { alias: "maria@alphacorp.com", source: "Email", type: "email" },
      { alias: "Ma. Lopez", source: "WhatsApp", type: "alias" },
      { alias: "+52 55 1234 5678", source: "Telefono", type: "telefono" },
      { alias: "Sra. Lopez de Alpha", source: "Nota manual", type: "referencia" },
    ],
    lastActivity: "Hace 1h",
  },
  {
    id: "ig-2",
    canonicalName: "Roberto Diaz",
    client: "Beta Labs",
    confidence: 95,
    status: "confirmado",
    variants: [
      { alias: "Roberto Diaz", source: "CRM", type: "nombre" },
      { alias: "roberto@betalabs.com", source: "Email", type: "email" },
      { alias: "Rob Diaz", source: "Slack", type: "alias" },
      { alias: "+52 55 2345 6789", source: "Telefono", type: "telefono" },
    ],
    lastActivity: "Hace 3h",
  },
  {
    id: "ig-3",
    canonicalName: "Fernando Reyes",
    client: "Nexus Solutions",
    confidence: 72,
    status: "pendiente",
    variants: [
      { alias: "Fernando Reyes", source: "Formulario web", type: "nombre" },
      { alias: "fernando.r@nexus.com", source: "Email", type: "email" },
      { alias: "Fer de Nexus", source: "Nota manual", type: "referencia" },
    ],
    lastActivity: "Hace 2h",
  },
  {
    id: "ig-4",
    canonicalName: "Laura Chen / L. Chen",
    client: "Epsilon Group",
    confidence: 65,
    status: "conflicto",
    variants: [
      { alias: "Laura Chen", source: "CRM", type: "nombre" },
      { alias: "L. Chen", source: "Email", type: "alias" },
      { alias: "laura@epsilongroup.com", source: "Email", type: "email" },
      { alias: "Laura C.", source: "WhatsApp", type: "alias" },
      { alias: "Lau Chen", source: "Nota interna", type: "referencia" },
    ],
    lastActivity: "Hace 1d",
    conflictNote: "Posible duplicado: 'Laura Chen' aparece en 2 registros de cliente distintos (Epsilon Group y un lead antiguo sin asignar).",
  },
  {
    id: "ig-5",
    canonicalName: "Carlos Mendez",
    client: "Interno",
    confidence: 100,
    status: "confirmado",
    variants: [
      { alias: "Carlos Mendez", source: "Equipo interno", type: "nombre" },
      { alias: "carlos@7f.com", source: "Email", type: "email" },
      { alias: "CMendez", source: "Slack", type: "alias" },
    ],
    lastActivity: "Hace 6h",
  },
]

const typeIcons: Record<string, typeof User> = {
  nombre: User,
  email: Mail,
  telefono: Phone,
  alias: User,
  referencia: Building2,
}

const statusFilters = ["Todos", "Confirmado", "Pendiente", "Conflicto"]

const statusStyles: Record<string, string> = {
  confirmado: "bg-[var(--tab-phases)] text-foreground/70",
  pendiente: "bg-[var(--tab-tasks)] text-foreground/70",
  conflicto: "bg-[var(--tab-review)] text-foreground/70",
}

export default function IdentidadPage() {
  const [selectedId, setSelectedId] = useState("ig-1")
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [search, setSearch] = useState("")

  const filtered = identityGroups.filter((g) => {
    if (activeFilter !== "Todos" && g.status !== activeFilter.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      if (!g.canonicalName.toLowerCase().includes(q) && !g.client.toLowerCase().includes(q) && !g.variants.some(v => v.alias.toLowerCase().includes(q))) return false
    }
    return true
  })

  const selected = identityGroups.find((g) => g.id === selectedId)

  return (
    <AppShell currentSection="identidad" breadcrumbs={[{ label: "7F" }, { label: "Resolucion de Identidad" }]}>
      <SectionPage title="Resolucion de Identidad" description="Motor de fuzzy matching que unifica nombres, apodos, correos y telefonos bajo una identidad canonica por contacto.">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Identidades", value: identityGroups.length, color: "var(--tab-info)" },
            { label: "Confirmadas", value: identityGroups.filter(g => g.status === "confirmado").length, color: "var(--tab-phases)" },
            { label: "Pendientes", value: identityGroups.filter(g => g.status === "pendiente").length, color: "var(--tab-tasks)" },
            { label: "Conflictos", value: identityGroups.filter(g => g.status === "conflicto").length, color: "var(--tab-review)" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ backgroundColor: s.color, width: `${(Number(s.value) / identityGroups.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, email, alias..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  activeFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Identity list */}
          <div className="lg:w-96 flex-shrink-0 flex flex-col gap-2">
            {filtered.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedId(group.id)}
                className={cn(
                  "w-full text-left rounded-xl border px-4 py-3.5 transition-all",
                  selectedId === group.id ? "border-foreground/20 bg-card shadow-sm" : "border-border bg-card/60 hover:bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted flex-shrink-0">
                      <span className="text-xs font-bold text-muted-foreground">
                        {group.canonicalName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{group.canonicalName}</p>
                      <p className="text-xs text-muted-foreground">{group.client} &middot; {group.variants.length} variantes</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0", statusStyles[group.status])}>
                    {group.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-[52px]">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Confianza:</span>
                    <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", group.confidence >= 90 ? "bg-[var(--tab-phases)]" : group.confidence >= 70 ? "bg-[var(--tab-tasks)]" : "bg-[var(--tab-review)]")}
                        style={{ width: `${group.confidence}%` }}
                      />
                    </div>
                    <span className="font-medium">{group.confidence}%</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground ml-auto">{group.lastActivity}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          {selected && (
            <div className="flex-1 flex flex-col gap-5 min-w-0">
              {/* Identity card */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <span className="text-sm font-bold text-muted-foreground">
                        {selected.canonicalName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{selected.canonicalName}</h3>
                      <p className="text-xs text-muted-foreground">{selected.client} &middot; {selected.lastActivity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", statusStyles[selected.status])}>
                      {selected.status}
                    </span>
                    {selected.status !== "confirmado" && (
                      <button className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity">
                        <CheckCircle2 className="h-3 w-3" /> Confirmar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Conflict warning */}
              {selected.status === "conflicto" && selected.conflictNote && (
                <div className="rounded-xl border border-[var(--tab-review)]/50 bg-[var(--tab-review)]/10 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-foreground/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Conflicto detectado</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{selected.conflictNote}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <button className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity">
                        <Link2 className="h-3 w-3" /> Fusionar registros
                      </button>
                      <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                        <Unlink className="h-3 w-3" /> Separar identidades
                      </button>
                      <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        Ignorar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Variants table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Variantes de identidad ({selected.variants.length})</h4>
                </div>
                <div className="divide-y divide-border">
                  {selected.variants.map((v, i) => {
                    const TypeIcon = typeIcons[v.type] || User
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{v.alias}</p>
                          <p className="text-xs text-muted-foreground">{v.source}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground flex-shrink-0">
                          {v.type}
                        </span>
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0" aria-label="Desvincular">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-border px-5 py-3">
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <Link2 className="h-3.5 w-3.5" /> Agregar variante manualmente
                  </button>
                </div>
              </div>

              {/* AI panel */}
              <div className="rounded-xl border border-[var(--tab-ai)]/50 bg-[var(--tab-ai)]/10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sugerencias IA</p>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    "Buscar coincidencias en mensajes recientes",
                    "Verificar duplicados en base de clientes",
                    "Reconstruir historial de comunicacion",
                  ].map((s) => (
                    <button key={s} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent text-left">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionPage>
    </AppShell>
  )
}
