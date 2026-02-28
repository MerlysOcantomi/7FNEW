"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
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
type AnalisisTipo = "Riesgo" | "Oportunidad" | "Estratégico" | "Financiero" | "Operativo";

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
  { label: "Proyectos en riesgo",          value: "2 / 4",  trend: "up",     delta: "+1 esta semana" },
  { label: "Desviaciones financieras",     value: "3.2%",   trend: "up",     delta: "Fondo Crecimiento III" },
  { label: "Oportunidades detectadas",     value: "3",      trend: "up",     delta: "Nuevas esta semana" },
  { label: "Acciones pendientes",          value: "5",      trend: "stable", delta: "Sin cambio" },
  { label: "ARR en riesgo de renovación",  value: "$640K",  trend: "up",     delta: "Vence en 30 días" },
  { label: "Tasa de entrega",              value: "91%",    trend: "down",   delta: "-2% vs trimestre anterior" },
];

const PRIORIDADES: Prioridad[] = [
  {
    titulo: "Sincronizar hitos de Forge con fechas de desembolso",
    nivel: "alto",
    modulo: "Flow",
    accion: "Revisar calendario en Forge antes del 6 de marzo para evitar impacto en flujo de caja.",
  },
  {
    titulo: "Iniciar contacto ejecutivo con Nexus Holdings",
    nivel: "alto",
    modulo: "Funds",
    accion: "Ventana de renovación activa de $640K ARR. Acción esta semana.",
  },
  {
    titulo: "Revisar alcance de proyectos en Fase 3",
    nivel: "medio",
    modulo: "Flow",
    accion: "El 75% de retrasos detectados provienen de cambios de alcance tardíos en Fase 3.",
  },
];

const RIESGOS: Riesgo[] = [
  {
    titulo: "Retraso en cadena de suministro",
    nivel: "alto",
    proyecto: "Alpha Expansion",
    accion: "Escalar a Forge antes del 6 de marzo para evitar retraso en Fase 3.",
  },
  {
    titulo: "Tasa de entrega por debajo del objetivo",
    nivel: "medio",
    proyecto: "Omega Platform",
    accion: "Revisar cambios de alcance tardíos en 3 proyectos con patrón de retraso detectado.",
  },
  {
    titulo: "Renovación de cliente sin contacto ejecutivo",
    nivel: "medio",
    proyecto: "Nexus Holdings",
    accion: "Iniciar contacto ejecutivo esta semana. Ventana de 30 días activa.",
  },
  {
    titulo: "Desviación de fondo persistente",
    nivel: "bajo",
    proyecto: "Fondo Crecimiento III",
    accion: "Reasignación recomendada antes del cierre de mes.",
  },
];

const OPORTUNIDADES: Oportunidad[] = [
  {
    titulo: "Renovación de 4 cuentas enterprise",
    entidad: "Nexus Holdings + 3 más",
    impacto: "$640K ARR protegido",
    accion: "Redactar comunicación ejecutiva",
    icon: Target,
  },
  {
    titulo: "Reasignación estratégica de fondos",
    entidad: "Fondo Crecimiento III",
    impacto: "Recuperación de 15% en Q2",
    accion: "Generar análisis de reasignación",
    icon: TrendingUp,
  },
  {
    titulo: "Expansión de servicio — cliente activo",
    entidad: "Blue Arc Group",
    impacto: "Upsell estimado $120K",
    accion: "Preparar propuesta de expansión",
    icon: Zap,
  },
];

const RELACIONES_CRUZADAS: RelacionCruzada[] = [
  {
    areas: ["Flow", "Funds"],
    tendencia: "Retrasos en proyectos generan presión en flujo de caja",
    insight:
      "Dos proyectos en Fase 3 con retrasos coinciden con las semanas de mayor desviación del Fondo Crecimiento III. Se recomienda sincronizar hitos de Forge con fechas de desembolso en Funds.",
  },
  {
    areas: ["Flow", "Future"],
    tendencia: "Patrón de cambios de alcance tardíos sistemático",
    insight:
      "El 75% de los proyectos retrasados comparten un patrón: cambios de alcance en Fase 3 o superior. La IA recomienda introducir un proceso de congelación de alcance como estándar de operación.",
  },
  {
    areas: ["Funds", "Future"],
    tendencia: "Ventana de renovación coincide con presión financiera",
    insight:
      "Las 4 renovaciones enterprise vencen en el mismo período de mayor desviación de fondos. Una pérdida de $640K ARR agravaría significativamente la desviación detectada.",
  },
];

const HISTORIAL: AnalisisHistorial[] = [
  {
    id: 1,
    fecha: "24 feb 2026",
    tipo: "Estratégico",
    titulo: "Análisis semanal — semana 8",
    resumen: "Convergencia de riesgo operativo y financiero en Alpha Expansion y Nexus Holdings.",
  },
  {
    id: 2,
    fecha: "17 feb 2026",
    tipo: "Financiero",
    titulo: "Revisión de desviación — Fondo Crecimiento III",
    resumen: "Desviación acumulada del 3.2% en últimas 6 semanas. Tres escenarios de reasignación generados.",
  },
  {
    id: 3,
    fecha: "10 feb 2026",
    tipo: "Operativo",
    titulo: "Análisis de tasa de entrega Q1 2026",
    resumen: "Caída de 4 puntos en tasa de entrega. Patrón de cambios de alcance identificado.",
  },
  {
    id: 4,
    fecha: "3 feb 2026",
    tipo: "Oportunidad",
    titulo: "Oportunidades de expansión — cartera activa",
    resumen: "Tres clientes activos con potencial de upsell identificado: $220K combinados.",
  },
  {
    id: 5,
    fecha: "27 ene 2026",
    tipo: "Riesgo",
    titulo: "Mapa de riesgos — cierre enero",
    resumen: "5 riesgos activos, 2 escalados a equipo ejecutivo. Omega Platform bajo observación.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const NIVEL_STYLE: Record<RiesgoNivel, { pill: string; dot: string }> = {
  alto:  { pill: "bg-[#FEE2E2] text-[#991B1B]",  dot: "bg-[#EF4444]" },
  medio: { pill: "bg-[#FEF9C3] text-[#854D0E]",  dot: "bg-[#EAB308]" },
  bajo:  { pill: "bg-[#DCFCE7] text-[#166534]",  dot: "bg-[#22C55E]" },
};

const TIPO_STYLE: Record<AnalisisTipo, string> = {
  Riesgo:      "bg-[#FEE2E2] text-[#991B1B]",
  Oportunidad: "bg-[#DCFCE7] text-[#166534]",
  Estratégico: "bg-[#EFF6FF] text-[#1D4ED8]",
  Financiero:  "bg-[#FEF9C3] text-[#854D0E]",
  Operativo:   "bg-[#F1F5F9] text-[#475569]",
};

function NivelBadge({ nivel }: { nivel: RiesgoNivel }) {
  const s = NIVEL_STYLE[nivel];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0", s.pill)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", s.dot)} />
      {nivel}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.12em] mb-4">
      {children}
    </p>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResumenEjecutivo() {
  return (
    <section>
      <SectionLabel>Resumen ejecutivo del sistema</SectionLabel>
      <div className="bg-[#EFF6FF] rounded-xl shadow-sm overflow-hidden border border-[#DBEAFE]">
        <div className="px-5 py-4 border-b border-[#DBEAFE] flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Síntesis semanal automática</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Semana del {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#BFDBFE]">
            <Sparkles size={9} className="text-[#3B82F6]" />
            <span className="text-[9px] font-bold text-[#2563EB] uppercase tracking-wider">IA activa</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 divide-x-0 sm:divide-x divide-y divide-[#DBEAFE]">
          {INDICADORES.map(({ label, value, trend, delta }) => (
            <div key={label} className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-lg font-bold text-[#0F172A] tracking-tight leading-none">{value}</p>
                {trend === "up"   && <TrendingUp   size={11} className="text-[#EF4444] shrink-0" />}
                {trend === "down" && <TrendingDown size={11} className="text-[#EF4444] shrink-0" />}
              </div>
              <p className="text-[11px] font-medium text-[#334155] leading-snug">{label}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{delta}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#DBEAFE]">
          <p className="text-[13px] text-[#334155] leading-relaxed">
            La cartera mantiene estabilidad operativa con{" "}
            <strong className="text-[#0F172A] font-semibold">dos proyectos en riesgo activo</strong>{" "}
            y una desviación financiera persistente en Fondo Crecimiento III. Se han detectado{" "}
            <strong className="text-[#0F172A] font-semibold">tres oportunidades de alto impacto</strong>{" "}
            esta semana, incluyendo una ventana de renovación enterprise de $640K ARR. La tasa de entrega ha
            descendido 2 puntos — se recomienda revisión de procesos antes del cierre de trimestre.
          </p>
        </div>
      </div>
    </section>
  );
}

function PrioridadesSistema() {
  return (
    <section>
      <SectionLabel>Prioridades del sistema</SectionLabel>
      <div className="space-y-3">
        {PRIORIDADES.map((p) => (
          <div
            key={p.titulo}
            className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Activity size={13} className="text-[#3B82F6]" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-[#0F172A] leading-tight">{p.titulo}</p>
              </div>
              <NivelBadge nivel={p.nivel} />
            </div>
            <div className="flex items-center gap-3 pl-6 sm:pl-10 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-bold uppercase tracking-wider">
                {p.modulo}
              </span>
              <p className="text-[11px] text-[#64748B] leading-relaxed">{p.accion}</p>
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
      <SectionLabel>Riesgos detectados</SectionLabel>
      <div className="space-y-3">
        {RIESGOS.map((r) => (
          <div
            key={r.titulo}
            className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldAlert size={13} className="text-[#3B82F6]" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-[#0F172A] leading-tight">{r.titulo}</p>
              </div>
              <NivelBadge nivel={r.nivel} />
            </div>
            <div className="flex items-start gap-4 pl-6 sm:pl-10 flex-wrap">
              <span className="text-[11px] text-[#64748B] shrink-0">
                <span className="font-medium text-[#334155]">Proyecto: </span>{r.proyecto}
              </span>
              <p className="text-[11px] text-[#64748B] leading-relaxed">{r.accion}</p>
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
      <SectionLabel>Oportunidades detectadas</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
        {OPORTUNIDADES.map(({ titulo, entidad, impacto, accion, icon: Icon }) => (
          <div key={titulo} className="bg-[#DBEAFE] rounded-xl p-5 shadow-sm border border-[#BFDBFE] flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#BFDBFE] flex items-center justify-center shrink-0">
                <Icon size={14} className="text-[#2563EB]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] leading-tight">{titulo}</p>
                <p className="text-[11px] text-[#475569] mt-0.5">{entidad}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="bg-white/70 rounded-lg px-3 py-1.5">
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider mb-0.5">Impacto estimado</p>
                <p className="text-sm font-bold text-[#1D4ED8]">{impacto}</p>
              </div>
              <button className="flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors shrink-0">
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
      <SectionLabel>Análisis transversal</SectionLabel>

      <div className="bg-[#EFF6FF] rounded-xl shadow-sm overflow-hidden border border-[#DBEAFE] mb-4">
        <div className="px-5 py-4 border-b border-[#DBEAFE] flex items-center gap-2 flex-wrap">
          <BarChart3 size={13} className="text-[#3B82F6]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-[#0F172A]">Relaciones entre módulos del sistema</p>
          <span className="text-[10px] font-semibold text-[#94A3B8] ml-auto hidden sm:block">
            Flow · Forge · Funds · Future
          </span>
        </div>

        <div className="divide-y divide-[#DBEAFE]">
          {RELACIONES_CRUZADAS.map((rel, i) => (
            <div key={i} className="px-5 py-5">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {rel.areas.map((area, j) => (
                  <span key={area} className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#BFDBFE] text-[#1D4ED8] text-[10px] font-bold uppercase tracking-wider">
                      {area}
                    </span>
                    {j < rel.areas.length - 1 && (
                      <Link2 size={10} className="text-[#93C5FD]" />
                    )}
                  </span>
                ))}
              </div>
              <p className="text-xs font-semibold text-[#334155] mb-1.5">{rel.tendencia}</p>
              <p className="text-[13px] text-[#475569] leading-relaxed">{rel.insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic insight */}
      <div className="bg-[#0F172A] rounded-xl px-5 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Lightbulb size={15} className="text-[#60A5FA] mt-0.5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="text-[9px] font-bold text-[#3B82F6] uppercase tracking-[0.12em] mb-2">
              Insight estratégico sintetizado
            </p>
            <p className="text-[13px] text-[#CBD5E1] leading-relaxed">
              El patrón dominante esta semana es la{" "}
              <span className="text-white font-semibold">convergencia de riesgo financiero y operativo</span>{" "}
              en el mismo período. La desviación de Fondo Crecimiento III, el retraso en Alpha Expansion y
              la ventana de renovación enterprise coinciden en las próximas tres semanas. La IA recomienda
              priorizar estas tres decisiones antes del 14 de marzo para evitar impacto compuesto.
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
      <SectionLabel>Historial de análisis</SectionLabel>
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center gap-2">
          <History size={13} className="text-[#64748B]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-[#0F172A]">Análisis anteriores</p>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {HISTORIAL.map((item) => (
            <div
              key={item.id}
              className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-[#F8FAFC] transition-colors group"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                  <FileSearch size={13} className="text-[#64748B]" strokeWidth={1.75} />
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
                    <span className="text-[10px] text-[#94A3B8]">{item.fecha}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] leading-tight mb-1">
                    {item.titulo}
                  </p>
                  <p className="text-[11px] text-[#64748B] leading-snug hidden sm:block">
                    {item.resumen}
                  </p>
                </div>
              </div>
              <button className="flex items-center gap-1 text-xs font-semibold text-[#3B82F6] hover:text-[#1D4ED8] transition-colors shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
                Ver detalle
                <ChevronRight size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[#F1F5F9] flex justify-end">
          <button className="flex items-center gap-1 text-xs font-semibold text-[#64748B] hover:text-[#334155] transition-colors">
            Ver historial completo
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
        <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          {/* ── Main ── */}
          <main className="flex-1 min-w-0 overflow-y-auto">

            {/* Page Header */}
            <div className="px-4 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-[0.12em] mb-1">Future</p>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Foresight</h1>
                    <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE]">
                      <Sparkles size={9} className="text-[#3B82F6]" />
                      <span className="text-[9px] font-bold text-[#2563EB] uppercase tracking-wider">IA activa</span>
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Análisis transversal del sistema para detectar riesgos, oportunidades y decisiones prioritarias.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold hover:bg-[#DBEAFE] transition-colors">
                    <FlaskConical size={12} strokeWidth={1.75} />
                    <span className="hidden sm:inline">Simular escenario</span>
                    <span className="sm:hidden">Simular</span>
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors shadow-sm">
                    <FileBarChart size={13} strokeWidth={1.75} />
                    <span className="hidden sm:inline">Generar análisis estratégico</span>
                    <span className="sm:hidden">Analizar</span>
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
          <CopilotPanel defaultContext="Foresight" />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
