"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  FileBarChart,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  ShieldAlert,
  Target,
  Zap,
  Link2,
  History,
  FlaskConical,
  ChevronRight,
  FileSearch,
  Activity,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type RiesgoNivel = "alto" | "medio" | "bajo";
type PrioridadNivel = "alto" | "medio" | "bajo";
type AnalisisTipo = "Risk" | "Opportunity" | "Strategic" | "Financial" | "Operational";

interface IndicadorClave {
  label: string;
  value: string;
  trend: "up" | "down" | "stable";
  delta: string;
}

interface Prioridad {
  titulo: string;
  nivel: PrioridadNivel;
  modulo: string;
  accion: string;
}

interface Riesgo {
  titulo: string;
  nivel: RiesgoNivel;
  proyecto: string;
  accion: string;
}

interface Oportunidad {
  titulo: string;
  entidad: string;
  impacto: string;
  accion: string;
  icon: React.ElementType;
}

interface RelacionCruzada {
  areas: string[];
  tendencia: string;
  insight: string;
}

interface AnalisisHistorial {
  id: number;
  fecha: string;
  tipo: AnalisisTipo;
  titulo: string;
  resumen: string;
}

// ── Static data ───────────────────────────────────────────────────────────────

const INDICADORES: IndicadorClave[] = [
  { label: "Projects at risk",             value: "2 / 4",  trend: "up",     delta: "+1 this week" },
  { label: "Financial variances",          value: "3.2%",   trend: "up",     delta: "Finance workspace" },
  { label: "Detected opportunities",       value: "3",      trend: "up",     delta: "New this week" },
  { label: "Pending actions",              value: "5",      trend: "stable", delta: "No change" },
  { label: "ARR at renewal risk",          value: "$640K",  trend: "up",     delta: "Due in 30 days" },
  { label: "Delivery rate",                value: "91%",    trend: "down",   delta: "-2% vs previous quarter" },
];

const PRIORIDADES: Prioridad[] = [
  {
    titulo: "Sync project milestones with billing dates",
    nivel: "alto",
    modulo: "Projects",
    accion: "Review the project timeline before March 6 to avoid cash flow impact.",
  },
  {
    titulo: "Start executive outreach with a priority client",
    nivel: "alto",
    modulo: "Finance",
    accion: "$640K ARR renewal window is active. Action needed this week.",
  },
  {
    titulo: "Review project scope in Phase 3",
    nivel: "medio",
    modulo: "Projects",
    accion: "75% of detected delays come from late scope changes in Phase 3.",
  },
];

const RIESGOS: Riesgo[] = [
  {
    titulo: "Supply chain delay",
    nivel: "alto",
    proyecto: "Current project",
    accion: "Escalate to the project lead before March 6 to avoid a Phase 3 delay.",
  },
  {
    titulo: "Delivery rate below target",
    nivel: "medio",
    proyecto: "Project portfolio",
    accion: "Review late scope changes in 3 projects with a detected delay pattern.",
  },
  {
    titulo: "Client renewal without executive outreach",
    nivel: "medio",
    proyecto: "Priority client",
    accion: "Start executive outreach this week. 30-day window is active.",
  },
  {
    titulo: "Persistent fund variance",
    nivel: "bajo",
    proyecto: "Finance workspace",
    accion: "Reallocation recommended before month-end.",
  },
];

const OPORTUNIDADES: Oportunidad[] = [
  {
    titulo: "Renewal of 4 enterprise accounts",
    entidad: "Priority clients + 3 more",
    impacto: "$640K ARR protected",
    accion: "Draft executive communication",
    icon: Target,
  },
  {
    titulo: "Strategic budget reallocation",
    entidad: "Finance workspace",
    impacto: "15% recovery in Q2",
    accion: "Generate reallocation analysis",
    icon: TrendingUp,
  },
  {
    titulo: "Service expansion — active client",
    entidad: "Active client account",
    impacto: "Estimated $120K upsell",
    accion: "Prepare expansion proposal",
    icon: Zap,
  },
];

const RELACIONES_CRUZADAS: RelacionCruzada[] = [
  {
    areas: ["Projects", "Finance"],
    tendencia: "Project delays are creating cash flow pressure",
    insight:
      "Two Phase 3 projects with delays overlap with the weeks of highest finance variance. Syncing project milestones with billing dates is recommended.",
  },
  {
    areas: ["Projects", "Insights"],
    tendencia: "Systemic late scope-change pattern",
    insight:
      "75% of delayed projects share the same pattern: scope changes in Phase 3 or later. AI recommends introducing a scope-freeze process as a standard operating practice.",
  },
  {
    areas: ["Finance", "Insights"],
    tendencia: "Renewal window overlaps with financial pressure",
    insight:
      "All 4 enterprise renewals fall within the same period of highest fund variance. Losing $640K ARR would significantly worsen the detected variance.",
  },
];

const HISTORIAL: AnalisisHistorial[] = [
  {
    id: 1,
    fecha: "Feb 24, 2026",
    tipo: "Strategic",
    titulo: "Weekly analysis — week 8",
    resumen: "Convergence of operational and financial risk across a current project and a priority client account.",
  },
  {
    id: 2,
    fecha: "Feb 17, 2026",
    tipo: "Financial",
    titulo: "Variance review — finance workspace",
    resumen: "3.2% accumulated variance over the last 6 weeks. Three reallocation scenarios generated.",
  },
  {
    id: 3,
    fecha: "Feb 10, 2026",
    tipo: "Operational",
    titulo: "Delivery rate analysis Q1 2026",
    resumen: "4-point drop in delivery rate. Scope-change pattern identified.",
  },
  {
    id: 4,
    fecha: "Feb 3, 2026",
    tipo: "Opportunity",
    titulo: "Expansion opportunities — active portfolio",
    resumen: "Three active clients with identified upsell potential: $220K combined.",
  },
  {
    id: 5,
    fecha: "Jan 27, 2026",
    tipo: "Risk",
    titulo: "Risk map — January close",
    resumen: "5 active risks, 2 escalated to the executive team. One priority project remains under watch.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const NIVEL_STYLE: Record<RiesgoNivel, { pill: string; dot: string }> = {
  alto:  { pill: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",   dot: "bg-[var(--status-danger-text)]" },
  medio: { pill: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]", dot: "bg-[var(--status-warning-text)]" },
  bajo:  { pill: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]", dot: "bg-[var(--status-success-text)]" },
};

const TIPO_STYLE: Record<AnalisisTipo, string> = {
  Risk:        "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  Opportunity: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  Strategic:   "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  Financial:   "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  Operational: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
};

function NivelBadge({ nivel }: { nivel: RiesgoNivel }) {
  const s = NIVEL_STYLE[nivel];
  const levelLabel =
    nivel === "alto" ? "high" : nivel === "medio" ? "medium" : "low";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0", s.pill)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {levelLabel}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">
      {children}
    </p>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResumenEjecutivo() {
  return (
    <section>
      <SectionLabel>System executive summary</SectionLabel>
      <div className="bg-[var(--accent-muted)] rounded-xl shadow-sm overflow-hidden border border-[var(--accent-muted-border)]">
        <div className="px-5 py-4 border-b border-[var(--accent-muted-border)] flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Automatic weekly summary</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Week of {new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-[var(--accent-muted-border)]">
            <Sparkles size={9} className="text-[var(--accent-on-dark)]" />
            <span className="text-[9px] font-bold text-[var(--accent-on-dark)] uppercase tracking-wider">AI active</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 divide-x-0 sm:divide-x divide-y divide-[var(--accent-muted-border)]">
          {INDICADORES.map(({ label, value, trend, delta }) => (
            <div key={label} className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-lg font-bold text-foreground tracking-tight leading-none">{value}</p>
                {trend === "up"   && <TrendingUp   size={11} className="text-[var(--status-danger-text)] shrink-0" />}
                {trend === "down" && <TrendingDown size={11} className="text-[var(--status-danger-text)] shrink-0" />}
              </div>
              <p className="text-[11px] font-medium text-foreground leading-snug">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{delta}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[var(--accent-muted-border)]">
          <p className="text-[13px] text-foreground leading-relaxed">
            The portfolio remains operationally stable with{" "}
            <strong className="text-foreground font-semibold">two projects at active risk</strong>{" "}
            and a persistent financial variance in the finance workspace.{" "}
            <strong className="text-foreground font-semibold">Three high-impact opportunities</strong>{" "}
            were detected this week, including a $640K ARR enterprise renewal window. Delivery rate is down
            by 2 points, so a process review is recommended before quarter close.
          </p>
        </div>
      </div>
    </section>
  );
}

function PrioridadesSistema() {
  return (
    <section>
      <SectionLabel>System priorities</SectionLabel>
      <div className="space-y-3">
        {PRIORIDADES.map((p) => (
          <div
            key={p.titulo}
            className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center shrink-0 mt-0.5">
                  <Activity size={13} className="text-[var(--accent-on-dark)]" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight">{p.titulo}</p>
              </div>
              <NivelBadge nivel={p.nivel} />
            </div>
            <div className="flex items-center gap-3 pl-6 sm:pl-10 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--accent-muted)] text-[var(--accent-on-dark)] text-[10px] font-bold uppercase tracking-wider">
                {p.modulo}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{p.accion}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiesgosDetectados() {
  return (
    <section>
      <SectionLabel>Detected risks</SectionLabel>
      <div className="space-y-3">
        {RIESGOS.map((r) => (
          <div
            key={r.titulo}
            className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert size={13} className="text-[var(--accent-on-dark)]" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight">{r.titulo}</p>
              </div>
              <NivelBadge nivel={r.nivel} />
            </div>
            <div className="flex items-start gap-4 pl-6 sm:pl-10 flex-wrap">
              <span className="text-[11px] text-muted-foreground shrink-0">
                <span className="font-medium text-foreground">Project: </span>{r.proyecto}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{r.accion}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Oportunidades() {
  return (
    <section>
      <SectionLabel>Detected opportunities</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
        {OPORTUNIDADES.map(({ titulo, entidad, impacto, accion, icon: Icon }) => (
          <div key={titulo} className="bg-[var(--accent-muted)] rounded-xl p-5 shadow-sm border border-[var(--accent-muted-border)] flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center shrink-0">
                <Icon size={14} className="text-[var(--accent-on-dark)]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{titulo}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{entidad}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="bg-card/70 rounded-lg px-3 py-1.5">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Estimated impact</p>
                <p className="text-sm font-bold text-[var(--accent-on-dark)]">{impacto}</p>
              </div>
              <button className="flex items-center gap-1 text-xs font-semibold text-[var(--accent-on-dark)] hover:text-[var(--accent-primary)] transition-colors shrink-0">
                {accion}
                <ArrowUpRight size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalisisCruzado() {
  return (
    <section>
      <SectionLabel>Cross-analysis</SectionLabel>

      <div className="bg-[var(--accent-muted)] rounded-xl shadow-sm overflow-hidden border border-[var(--accent-muted-border)] mb-4">
        <div className="px-5 py-4 border-b border-[var(--accent-muted-border)] flex items-center gap-2 flex-wrap">
          <BarChart3 size={13} className="text-[var(--accent-on-dark)]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-foreground">Relationships between system modules</p>
          <span className="text-[10px] font-semibold text-muted-foreground ml-auto hidden sm:block">
            Projects · Finance · Insights
          </span>
        </div>

        <div className="divide-y divide-[var(--accent-muted-border)]">
          {RELACIONES_CRUZADAS.map((rel, i) => (
            <div key={i} className="px-5 py-5">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {rel.areas.map((area, j) => (
                  <span key={area} className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[var(--accent-muted)] text-[var(--accent-on-dark)] text-[10px] font-bold uppercase tracking-wider">
                      {area}
                    </span>
                    {j < rel.areas.length - 1 && (
                      <Link2 size={10} className="text-[var(--accent-on-dark)]" />
                    )}
                  </span>
                ))}
              </div>
              <p className="text-xs font-semibold text-foreground mb-1.5">{rel.tendencia}</p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{rel.insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic insight */}
      <div className="bg-[var(--app-surface-dark-elevated)] border border-[var(--border-dark)] rounded-xl px-5 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Lightbulb size={15} className="text-[var(--accent-on-dark)] mt-0.5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="text-[9px] font-bold text-[var(--accent-on-dark)] uppercase tracking-[0.12em] mb-2">
              Synthesized strategic insight
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              The dominant pattern this week is the{" "}
              <span className="text-foreground font-semibold">convergence of financial and operational risk</span>{" "}
              within the same period. The finance variance, the current project delay, and the
              enterprise renewal window all converge over the next three weeks. AI recommends prioritizing
              these three decisions before March 14 to avoid compounded impact.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HistorialAnalisis() {
  return (
    <section>
      <SectionLabel>Analysis history</SectionLabel>
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <History size={13} className="text-muted-foreground" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-foreground">Previous analyses</p>
        </div>
        <div className="divide-y divide-border">
          {HISTORIAL.map((item) => (
            <div
              key={item.id}
              className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-muted transition-colors group"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <FileSearch size={13} className="text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        TIPO_STYLE[item.tipo]
                      )}
                    >
                      {item.tipo}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{item.fecha}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-tight mb-1">
                    {item.titulo}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug hidden sm:block">
                    {item.resumen}
                  </p>
                </div>
              </div>
              <button className="flex items-center gap-1 text-xs font-semibold text-[var(--accent-on-dark)] hover:text-[var(--accent-primary)] transition-colors shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
                View details
                <ChevronRight size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            View full history
            <ArrowUpRight size={11} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-background font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          {/* ── Main ── */}
          <main className="flex-1 min-w-0 overflow-y-auto">

            {/* Page Header */}
            <div className="px-4 md:px-8 pt-7 pb-5 border-b border-border bg-background">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em] mb-1">Overview insights</p>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                    <h1 className="text-xl font-semibold text-foreground tracking-tight">See what&apos;s coming</h1>
                    <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-muted)] border border-[var(--accent-muted-border)]">
                      <Sparkles size={9} className="text-[var(--accent-on-dark)]" />
                      <span className="text-[9px] font-bold text-[var(--accent-on-dark)] uppercase tracking-wider">Francis active</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Francis explains what is changing, what needs attention, and what is likely to happen next.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] text-[var(--accent-on-dark)] text-xs font-semibold hover:bg-[var(--accent-muted-border)] transition-colors">
                    <FlaskConical size={12} strokeWidth={1.75} />
                    <span className="hidden sm:inline">Simulate scenario</span>
                    <span className="sm:hidden">Simulate</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors shadow-sm">
                    <FileBarChart size={13} strokeWidth={1.75} />
                    <span className="hidden sm:inline">Generate business insight</span>
                    <span className="sm:hidden">Analyze</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Page Body — 2-column desktop layout */}
            <div className="px-4 md:px-8 py-8">
              {/* Resumen ejecutivo spans full width */}
              <div className="mb-10">
                <ResumenEjecutivo />
              </div>

              {/* 2-column grid: left = Prioridades + Riesgos + Historial / right = Oportunidades + Análisis cruzado */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {/* Left column */}
                <div className="space-y-10">
                  <PrioridadesSistema />
                  <RiesgosDetectados />
                  <HistorialAnalisis />
                </div>

                {/* Right column */}
                <div className="space-y-10">
                  <Oportunidades />
                  <AnalisisCruzado />
                </div>
              </div>
            </div>
          </main>

          {/* Copilot Panel */}
          <CopilotPanel defaultContext="Overview" />

          <LegacyTodayChrome />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
