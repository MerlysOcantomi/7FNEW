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
    client: "Active client",
    confidence: 98,
    status: "confirmed",
    variants: [
      { alias: "Maria Lopez", source: "CRM", type: "name" },
      { alias: "maria@clienteactivo.com", source: "Email", type: "email" },
      { alias: "Ma. Lopez", source: "WhatsApp", type: "alias" },
      { alias: "+52 55 1234 5678", source: "Phone", type: "phone" },
      { alias: "Mrs. Lopez from the client", source: "Manual note", type: "reference" },
    ],
    lastActivity: "1h ago",
  },
  {
    id: "ig-2",
    canonicalName: "Roberto Diaz",
    client: "Active project",
    confidence: 95,
    status: "confirmed",
    variants: [
      { alias: "Roberto Diaz", source: "CRM", type: "name" },
      { alias: "roberto@proyectoactivo.com", source: "Email", type: "email" },
      { alias: "Rob Diaz", source: "Slack", type: "alias" },
      { alias: "+52 55 2345 6789", source: "Phone", type: "phone" },
    ],
    lastActivity: "3h ago",
  },
  {
    id: "ig-3",
    canonicalName: "Fernando Reyes",
    client: "New lead",
    confidence: 72,
    status: "pending",
    variants: [
      { alias: "Fernando Reyes", source: "Web form", type: "name" },
      { alias: "fernando.r@leadnuevo.com", source: "Email", type: "email" },
      { alias: "Fer from the lead", source: "Manual note", type: "reference" },
    ],
    lastActivity: "2h ago",
  },
  {
    id: "ig-4",
    canonicalName: "Laura Chen / L. Chen",
    client: "Account pending review",
    confidence: 65,
    status: "conflict",
    variants: [
      { alias: "Laura Chen", source: "CRM", type: "name" },
      { alias: "L. Chen", source: "Email", type: "alias" },
      { alias: "laura@cuentaporvalidar.com", source: "Email", type: "email" },
      { alias: "Laura C.", source: "WhatsApp", type: "alias" },
      { alias: "Lau Chen", source: "Internal note", type: "reference" },
    ],
    lastActivity: "1d ago",
    conflictNote: "Possible duplicate: 'Laura Chen' appears in 2 different records (an account pending review and an unassigned older lead).",
  },
  {
    id: "ig-5",
    canonicalName: "Carlos Mendez",
    client: "Internal",
    confidence: 100,
    status: "confirmed",
    variants: [
      { alias: "Carlos Mendez", source: "Internal team", type: "name" },
      { alias: "carlos@7f.com", source: "Email", type: "email" },
      { alias: "CMendez", source: "Slack", type: "alias" },
    ],
    lastActivity: "6h ago",
  },
]

const typeIcons: Record<string, typeof User> = {
  name: User,
  email: Mail,
  phone: Phone,
  alias: User,
  reference: Building2,
}

const statusFilters = ["All", "Confirmed", "Pending", "Conflict"]

const statusStyles: Record<string, string> = {
  confirmed: "bg-[var(--tab-phases)] text-foreground/70",
  pending: "bg-[var(--tab-tasks)] text-foreground/70",
  conflict: "bg-[var(--tab-review)] text-foreground/70",
}

export default function IdentidadPage() {
  const [selectedId, setSelectedId] = useState("ig-1")
  const [activeFilter, setActiveFilter] = useState("All")
  const [search, setSearch] = useState("")

  const filtered = identityGroups.filter((g) => {
    if (activeFilter !== "All" && g.status !== activeFilter.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      if (!g.canonicalName.toLowerCase().includes(q) && !g.client.toLowerCase().includes(q) && !g.variants.some(v => v.alias.toLowerCase().includes(q))) return false
    }
    return true
  })

  const selected = identityGroups.find((g) => g.id === selectedId)

  return (
    <AppShell currentSection="identidad" breadcrumbs={[{ label: "7F" }, { label: "Identity Resolution" }]}>
      <SectionPage title="Identity Resolution" description="Fuzzy matching engine that unifies names, aliases, emails, and phone numbers under a canonical contact identity.">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Identities", value: identityGroups.length, color: "var(--tab-info)" },
            { label: "Confirmed", value: identityGroups.filter(g => g.status === "confirmed").length, color: "var(--tab-phases)" },
            { label: "Pending", value: identityGroups.filter(g => g.status === "pending").length, color: "var(--tab-tasks)" },
            { label: "Conflicts", value: identityGroups.filter(g => g.status === "conflict").length, color: "var(--tab-review)" },
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
              placeholder="Search name, email, alias..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
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
                      <p className="text-xs text-muted-foreground">{group.client} &middot; {group.variants.length} variants</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0", statusStyles[group.status])}>
                    {group.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-[52px]">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Confidence:</span>
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
                    {selected.status !== "confirmed" && (
                      <button className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity">
                        <CheckCircle2 className="h-3 w-3" /> Confirm
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Conflict warning */}
              {selected.status === "conflict" && selected.conflictNote && (
                <div className="rounded-xl border border-[var(--tab-review)]/50 bg-[var(--tab-review)]/10 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-foreground/60 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Conflict detected</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{selected.conflictNote}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-80 transition-opacity">
                        <Link2 className="h-3 w-3" /> Merge records
                      </button>
                      <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                        <Unlink className="h-3 w-3" /> Separate identities
                      </button>
                      <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        Ignore
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Variants table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                  <Fingerprint className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Identity variants ({selected.variants.length})</h4>
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
                        <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0" aria-label="Unlink">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-border px-5 py-3">
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <Link2 className="h-3.5 w-3.5" /> Add variant manually
                  </button>
                </div>
              </div>

              {/* AI panel */}
              <div className="rounded-xl border border-[var(--tab-ai)]/50 bg-[var(--tab-ai)]/10 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI suggestions</p>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    "Search matches in recent messages",
                    "Check for duplicates in the client database",
                    "Rebuild communication history",
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
