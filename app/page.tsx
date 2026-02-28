"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FolderKanban,
  DollarSign,
  Bell,
  Clock,
  CalendarDays,
  ArrowUpRight,
  FileText,
  Lightbulb,
  ChevronRight,
  FileBarChart,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const kpis = [
  {
    label: "Proyectos activos",
    value: "14",
    delta: "+2 este mes",
    trend: "up",
    icon: FolderKanban,
    href: "/proyectos",
  },
  {
    label: "Proyectos en riesgo",
    value: "3",
    delta: "Requieren atención",
    trend: "down",
    icon: AlertTriangle,
    href: "/proyectos",
  },
  {
    label: "Facturación del mes",
    value: "$148.200",
    delta: "+12% vs mes anterior",
    trend: "up",
    icon: DollarSign,
    href: "/facturacion",
  },
  {
    label: "Alertas críticas",
    value: "2",
    delta: "Sin resolver",
    trend: "down",
    icon: Bell,
    href: "/inbox",
  },
];

const actividadReciente = [
  {
    tipo: "tarea",
    label: "Nueva tarea creada",
    detalle: "Revisión de contrato — Proyecto Alcántara",
    tiempo: "Hace 18 min",
    icon: Clock,
  },
  {
    tipo: "proyecto",
    label: "Cambio en proyecto",
    detalle: "Urbanización Montblanc pasó a estado En riesgo",
    tiempo: "Hace 1 h",
    icon: FolderKanban,
  },
  {
    tipo: "evento",
    label: "Evento próximo",
    detalle: "Reunión de avance — Proyecto Alcántara · mañana 10:00",
    tiempo: "En 18 h",
    icon: CalendarDays,
  },
  {
    tipo: "tarea",
    label: "Tarea vencida",
    detalle: "Entrega de planos — Torre Sur",
    tiempo: "Ayer",
    icon: Clock,
  },
  {
    tipo: "proyecto",
    label: "Nuevo proyecto",
    detalle: "Residencial Las Flores iniciado en fase 1",
    tiempo: "Hace 2 días",
    icon: FolderKanban,
  },
];

const estadoFinanciero = {
  ingresos: 148200,
  gastos: 97400,
  facturasPendientes: 4,
  montoFacturasPendientes: 38500,
  desviacion: +2.4,
};

const insights = [
  {
    tipo: "insight",
    titulo: "Concentración de riesgo en ejecución",
    cuerpo:
      "3 de los 14 proyectos activos están en fase crítica simultáneamente. El equipo de obra presenta sobrecarga operativa estimada en un 22%.",
    icon: Lightbulb,
  },
  {
    tipo: "insight",
    titulo: "Ventana de facturación óptima",
    cuerpo:
      "5 hitos certificables se acumulan en los próximos 12 días. Facturar antes del cierre de mes podría adelantar $62.000 en ingresos.",
    icon: TrendingUp,
  },
  {
    tipo: "riesgo",
    titulo: "Riesgo: retraso en Montblanc",
    cuerpo:
      "El proveedor de estructura no ha confirmado entrega. Si no se escala antes del viernes, el hito Q2 queda comprometido.",
    icon: AlertTriangle,
  },
  {
    tipo: "oportunidad",
    titulo: "Oportunidad: Cliente Ferrer en renovación",
    cuerpo:
      "El contrato del cliente Ferrer vence en 28 días. Hay margen para ampliar el alcance en un 15% basado en historial de pagos.",
    icon: ArrowUpRight,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR");
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          {/* Main Content */}
          <main className="flex-1 min-w-0 overflow-y-auto">

            {/* Header */}
            <div className="px-6 md:px-8 pt-7 pb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div>
                <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
                  7F Copilot
                </p>
                <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
                  Panel Ejecutivo
                </h1>
                <p className="text-xs text-[#64748B] mt-1 text-pretty">
                  Visión general del estado operativo y estratégico del workspace
                </p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm shrink-0 self-start sm:self-auto">
                <FileBarChart size={14} strokeWidth={1.75} />
                Generar reporte ejecutivo
              </button>
            </div>

            <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8 sm:space-y-10">

              {/* ── SECCIÓN 1: RESUMEN GENERAL ── */}
              <section>
                <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-4">
                  Resumen general
                </h2>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
                  {kpis.map(({ label, value, delta, trend, icon: Icon, href }) => (
                    <Link
                      key={label}
                      href={href}
                      className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#BFDBFE] border border-transparent transition-all group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Icon
                          size={15}
                          className={trend === "down" && label !== "Proyectos en riesgo" ? "text-[#3B82F6]" : trend === "down" ? "text-[#DC2626]" : "text-[#3B82F6]"}
                          strokeWidth={1.75}
                        />
                        <span
                          className={`flex items-center gap-0.5 text-[10px] font-medium ${
                            trend === "up" ? "text-[#16A34A]" : "text-[#DC2626]"
                          }`}
                        >
                          {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          <span className="hidden sm:inline">{delta}</span>
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                      <p className="text-xs text-[#64748B] mt-0.5 leading-snug">{label}</p>
                      <p className="text-[10px] text-[#DC2626] mt-0.5 sm:hidden font-medium">{trend === "down" ? delta : ""}</p>
                    </Link>
                  ))}
                </div>
              </section>

              {/* ── GRID: Secciones 2 y 3 en desktop ── */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* ── SECCIÓN 2: ACTIVIDAD RECIENTE (FLOW) ── */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                      Actividad reciente
                      <span className="ml-1.5 text-[#3B82F6]">· Flow</span>
                    </h2>
                    <Link
                      href="/inbox"
                      className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5"
                    >
                      Ver todo <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    {actividadReciente.map(({ label, detalle, tiempo, icon: Icon }, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 px-4 py-3.5 ${
                          i < actividadReciente.length - 1 ? "border-b border-[#F1F5F9]" : ""
                        }`}
                      >
                        <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={12} className="text-[#3B82F6]" strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide leading-none mb-0.5">
                            {label}
                          </p>
                          <p className="text-sm text-[#0F172A] leading-snug">{detalle}</p>
                        </div>
                        <span className="text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0 mt-0.5">
                          {tiempo}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── SECCIÓN 3: ESTADO FINANCIERO (FUNDS) ── */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                      Estado financiero
                      <span className="ml-1.5 text-[#3B82F6]">· Funds</span>
                    </h2>
                    <Link
                      href="/finanzas"
                      className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5"
                    >
                      Ver finanzas <ChevronRight size={11} />
                    </Link>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">

                    {/* Ingresos vs Gastos */}
                    <div className="px-5 py-4 border-b border-[#F1F5F9]">
                      <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">
                        Ingresos vs Gastos — este mes
                      </p>
                      <div className="space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[#334155]">Ingresos</span>
                            <span className="text-xs font-semibold text-[#16A34A]">
                              {fmt(estadoFinanciero.ingresos)}
                            </span>
                          </div>
                          <ProgressBar value={estadoFinanciero.ingresos} max={200000} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[#334155]">Gastos</span>
                            <span className="text-xs font-semibold text-[#DC2626]">
                              {fmt(estadoFinanciero.gastos)}
                            </span>
                          </div>
                          <ProgressBar value={estadoFinanciero.gastos} max={200000} />
                        </div>
                      </div>
                    </div>

                    {/* Facturas pendientes */}
                    <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-[#FEF9C3] flex items-center justify-center">
                          <FileText size={13} className="text-[#854D0E]" strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[#0F172A]">Facturas pendientes</p>
                          <p className="text-[10px] text-[#64748B]">
                            {estadoFinanciero.facturasPendientes} facturas · {fmt(estadoFinanciero.montoFacturasPendientes)}
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/facturacion"
                        className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        Ver <ChevronRight size={11} />
                      </Link>
                    </div>

                    {/* Desviación */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-0.5">
                            Desviación presupuestaria
                          </p>
                          <p className="text-xs text-[#334155]">
                            Gasto real vs presupuesto aprobado del mes
                          </p>
                        </div>
                        <span
                          className={`text-lg font-bold ${
                            estadoFinanciero.desviacion >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                          }`}
                        >
                          {estadoFinanciero.desviacion >= 0 ? "+" : ""}
                          {estadoFinanciero.desviacion}%
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* ── SECCIÓN 4: INSIGHTS ESTRATÉGICOS (FORESIGHT) ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                    Insights estratégicos
                    <span className="ml-1.5 text-[#3B82F6]">· Foresight</span>
                  </h2>
                  <Link
                    href="/agente"
                    className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5"
                  >
                    Ver análisis completo <ArrowUpRight size={11} />
                  </Link>
                </div>

                {/* Highlight strip */}
                <div className="bg-[#0F172A] rounded-xl px-5 py-4 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-md bg-[#1E293B] flex items-center justify-center shrink-0 mt-0.5">
                      <Lightbulb size={13} className="text-[#60A5FA]" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-[#60A5FA] uppercase tracking-widest mb-0.5">
                        Síntesis ejecutiva · Foresight
                      </p>
                      <p className="text-sm text-[#CBD5E1] leading-relaxed text-pretty">
                        El workspace presenta señales de sobrecarga en ejecución simultánea. La ventana financiera
                        de los próximos 12 días es estratégicamente favorable. Se recomienda escalar el riesgo de
                        Montblanc y activar proceso de renovación con cliente Ferrer esta semana.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/agente"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E293B] text-[#60A5FA] text-xs font-medium hover:bg-[#2D3F58] transition-colors shrink-0 border border-[#334155]"
                  >
                    Ver análisis completo <ArrowUpRight size={12} />
                  </Link>
                </div>

                {/* Insight cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {insights.map(({ tipo, titulo, cuerpo, icon: Icon }) => (
                    <div key={titulo} className="bg-[#DBEAFE] rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="w-6 h-6 rounded-md bg-[#BFDBFE] flex items-center justify-center shrink-0">
                          <Icon size={12} className="text-[#2563EB]" strokeWidth={1.75} />
                        </div>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ${
                            tipo === "riesgo"
                              ? "bg-[#FEE2E2] text-[#991B1B]"
                              : tipo === "oportunidad"
                              ? "bg-[#DCFCE7] text-[#166534]"
                              : "bg-[#EFF6FF] text-[#1D4ED8]"
                          }`}
                        >
                          {tipo === "riesgo" ? "Riesgo" : tipo === "oportunidad" ? "Oportunidad" : "Insight"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#0F172A] leading-snug mb-1.5 text-pretty">
                        {titulo}
                      </p>
                      <p className="text-xs text-[#334155] leading-relaxed">{cuerpo}</p>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </main>

          {/* Copilot Panel */}
          <CopilotPanel defaultContext="Flow" />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
