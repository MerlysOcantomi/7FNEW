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
  Loader2,
  Activity,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardSummary {
  kpis: {
    totalClientes: number;
    proyectosActivos: number;
    proyectosEnRiesgo: number;
    tareasVencidas: number;
    facturasPendientes: number;
    facturacionMes: number;
    ingresosMes: number;
    gastosMes: number;
  };
  activity: Array<{
    id: string;
    module: string;
    recordId: string;
    type: string;
    label: string;
    detalle: string;
    userName: string | null;
    createdAt: string;
  }>;
  finance: {
    ingresosMes: number;
    gastosMes: number;
    facturasPendientes: number;
    montoFacturasPendientes: number;
    desviacion: number | null;
  };
  alerts: {
    overdueTasks: unknown[];
    overdueInvoices: unknown[];
    nearDeadlineProjects: unknown[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.round((value / safeMax) * 100));
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function fmt(n: number) {
  return "$" + n.toLocaleString("es-AR");
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Hace un momento";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function getActivityIcon(module: string, type: string) {
  if (module === "tareas" || type === "tarea") return Clock;
  if (module === "proyectos" || type === "proyecto") return FolderKanban;
  if (module === "calendario" || module === "eventos") return CalendarDays;
  return Activity;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  const { data: summary, loading, error } = useFetch<DashboardSummary>("/api/dashboard/summary");

  const kpis = summary?.kpis;
  const activity = summary?.activity ?? [];
  const finance = summary?.finance;

  const kpiCards = kpis
    ? [
        {
          label: "Proyectos activos",
          value: String(kpis.proyectosActivos),
          delta: kpis.proyectosActivos > 0 ? "En ejecución" : "Sin proyectos activos",
          trend: "up" as const,
          icon: FolderKanban,
          href: "/proyectos",
        },
        {
          label: "Tareas vencidas",
          value: String(kpis.tareasVencidas),
          delta: kpis.tareasVencidas > 0 ? "Requieren atención" : "Al día",
          trend: (kpis.tareasVencidas > 0 ? "down" : "up") as "up" | "down",
          icon: AlertTriangle,
          href: "/tareas",
        },
        {
          label: "Facturación del mes",
          value: fmt(kpis.facturacionMes),
          delta: "Este mes",
          trend: "up" as const,
          icon: DollarSign,
          href: "/facturacion",
        },
        {
          label: "Facturas pendientes",
          value: String(kpis.facturasPendientes),
          delta: kpis.facturasPendientes > 0 ? `${fmt(finance?.montoFacturasPendientes ?? 0)} por cobrar` : "Sin pendientes",
          trend: (kpis.facturasPendientes > 0 ? "down" : "up") as "up" | "down",
          icon: Bell,
          href: "/facturacion",
        },
      ]
    : [];

  const maxBar = finance
    ? Math.max(finance.ingresosMes, finance.gastosMes, 1)
    : 1;

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="px-4 md:px-8 pt-7 pb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
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
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-[#94A3B8]" />
                </div>
              ) : error ? (
                <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-8 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444] mb-3" />
                  <p className="text-sm font-medium text-[#991B1B]">{error}</p>
                  <p className="text-xs text-[#B91C1C] mt-1">No se pudo cargar el resumen del dashboard</p>
                </div>
              ) : (
                <>
                  {/* ── SECCIÓN 1: RESUMEN GENERAL ── */}
                  <section>
                    <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-4">
                      Resumen general
                    </h2>
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
                      {kpiCards.map(({ label, value, delta, trend, icon: Icon, href }) => (
                        <Link
                          key={label}
                          href={href}
                          className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#BFDBFE] border border-transparent transition-all group"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <Icon
                              size={15}
                              className={
                                trend === "down" && (label === "Tareas vencidas" || label === "Facturas pendientes")
                                  ? "text-[#DC2626]"
                                  : "text-[#3B82F6]"
                              }
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
                          <p className="text-[10px] text-[#DC2626] mt-0.5 sm:hidden font-medium">
                            {trend === "down" ? delta : ""}
                          </p>
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
                        {activity.length === 0 ? (
                          <div className="px-5 py-12 text-center">
                            <Activity size={24} className="text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-[#334155]">Sin actividad reciente</p>
                            <p className="text-xs text-[#94A3B8] mt-1">
                              Los cambios y comentarios aparecerán aquí
                            </p>
                          </div>
                        ) : (
                          activity.map((item, i) => {
                            const Icon = getActivityIcon(item.module, item.type);
                            return (
                              <Link
                                key={item.id}
                                href={`/${item.module}/${item.recordId}`}
                                className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors ${
                                  i < activity.length - 1 ? "border-b border-[#F1F5F9]" : ""
                                }`}
                              >
                                <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                                  <Icon size={12} className="text-[#3B82F6]" strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide leading-none mb-0.5">
                                    {item.label}
                                  </p>
                                  <p className="text-sm text-[#0F172A] leading-snug truncate">{item.detalle}</p>
                                  {item.userName && (
                                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{item.userName}</p>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0 mt-0.5">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </Link>
                            );
                          })
                        )}
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
                        {finance ? (
                          <>
                            <div className="px-5 py-4 border-b border-[#F1F5F9]">
                              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">
                                Ingresos vs Gastos — este mes
                              </p>
                              <div className="space-y-2.5">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-[#334155]">Ingresos</span>
                                    <span className="text-xs font-semibold text-[#16A34A]">
                                      {fmt(finance.ingresosMes)}
                                    </span>
                                  </div>
                                  <ProgressBar value={finance.ingresosMes} max={maxBar} />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-[#334155]">Gastos</span>
                                    <span className="text-xs font-semibold text-[#DC2626]">
                                      {fmt(finance.gastosMes)}
                                    </span>
                                  </div>
                                  <ProgressBar value={finance.gastosMes} max={maxBar} />
                                </div>
                              </div>
                            </div>

                            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-md bg-[#FEF9C3] flex items-center justify-center">
                                  <FileText size={13} className="text-[#854D0E]" strokeWidth={1.75} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-[#0F172A]">Facturas pendientes</p>
                                  <p className="text-[10px] text-[#64748B]">
                                    {finance.facturasPendientes} facturas · {fmt(finance.montoFacturasPendientes)}
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

                            {finance.desviacion != null ? (
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
                                      finance.desviacion >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                                    }`}
                                  >
                                    {finance.desviacion >= 0 ? "+" : ""}
                                    {finance.desviacion}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-5 py-4">
                                <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-0.5">
                                  Desviación presupuestaria
                                </p>
                                <p className="text-xs text-[#94A3B8]">
                                  No hay presupuesto configurado para calcular la desviación
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-5 py-12 text-center">
                            <DollarSign size={24} className="text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-[#334155]">Sin datos financieros</p>
                          </div>
                        )}
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

                    <div className="bg-[#0F172A] rounded-xl px-5 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-md bg-[#1E293B] flex items-center justify-center shrink-0 mt-0.5">
                          <Lightbulb size={13} className="text-[#60A5FA]" strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-[#60A5FA] uppercase tracking-widest mb-0.5">
                            Síntesis ejecutiva · Foresight
                          </p>
                          <p className="text-sm text-[#CBD5E1] leading-relaxed text-pretty">
                            Próximamente: resumen ejecutivo asistido por IA. Esta sección mostrará análisis
                            estratégicos basados en los datos del workspace cuando esté disponible.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/agente"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E293B] text-[#60A5FA] text-xs font-medium hover:bg-[#2D3F58] transition-colors shrink-0 border border-[#334155]"
                      >
                        Ir al agente <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </section>
                </>
              )}
            </div>
          </main>

          <CopilotPanel defaultContext="Flow" />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
