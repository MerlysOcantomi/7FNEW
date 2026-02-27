"use client"

import { useMemo } from "react"
import { AppShell } from "@/components/app-shell"
import { StatCard } from "@/components/stat-card"
import {
  FolderKanban, Users, CheckSquare, DollarSign, TrendingUp, Clock,
  Receipt, AlertCircle, ArrowUpRight, ArrowDownRight, Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useFetch } from "@/hooks/use-fetch"
import { estadoLabel, prioridadLabel, displayLabel } from "@/lib/api-client"

function formatCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
  } catch { return value }
}

function buildExecutiveSummary(metrics: {
  tareasUrgentes: number
  proyectosActivos: number
  facturasVencidas: number
  facturasPendientes: number
}, tareasPendientes: number): string {
  const parts: string[] = []

  if (metrics.tareasUrgentes > 0) {
    parts.push(`${metrics.tareasUrgentes} tarea${metrics.tareasUrgentes > 1 ? "s" : ""} urgente${metrics.tareasUrgentes > 1 ? "s" : ""} requieren atencion`)
  } else {
    parts.push("No hay tareas urgentes")
  }

  if (metrics.proyectosActivos > 0) {
    parts.push(`${metrics.proyectosActivos} proyecto${metrics.proyectosActivos > 1 ? "s" : ""} activo${metrics.proyectosActivos > 1 ? "s" : ""}`)
  } else {
    parts.push("no hay proyectos activos")
  }

  if (metrics.facturasVencidas > 0) {
    parts.push(`${formatCurrency(metrics.facturasVencidas)} en facturas vencidas`)
  } else if (metrics.facturasPendientes > 0) {
    parts.push(`${formatCurrency(metrics.facturasPendientes)} pendiente de cobro`)
  } else {
    parts.push("sin pagos pendientes")
  }

  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  return `${first}. Tienes ${parts.slice(1).join(" y ")}.`
}

export default function DashboardPage() {
  const { data: projectsData, loading: loadingProjects } = useFetch<any>("/api/proyectos")
  const { data: clientsData, loading: loadingClients } = useFetch<any>("/api/clientes")
  const { data: tasksData, loading: loadingTasks } = useFetch<any>("/api/tareas")
  const { data: finanzasData, loading: loadingFinanzas } = useFetch<any>("/api/finanzas")
  const { data: usuariosData, loading: loadingUsuarios } = useFetch<any>("/api/usuarios")
  const { data: facturasData, loading: loadingFacturas } = useFetch<any>("/api/facturacion")

  const projects = useMemo(() => (Array.isArray(projectsData) ? projectsData : []), [projectsData])
  const clients = useMemo(() => (Array.isArray(clientsData) ? clientsData : []), [clientsData])
  const tasks = useMemo(() => (Array.isArray(tasksData) ? tasksData : []), [tasksData])
  const usuarios = useMemo(() => (Array.isArray(usuariosData) ? usuariosData : []), [usuariosData])
  const facturas = useMemo(() => (Array.isArray(facturasData) ? facturasData : []), [facturasData])
  const transacciones = useMemo(() => {
    const d = finanzasData ?? {}
    return Array.isArray(d) ? d : (Array.isArray((d as any)?.transacciones) ? (d as any).transacciones : [])
  }, [finanzasData])

  const totalProyectos = projects.length
  const totalClientes = clients.length
  const tareasPendientes = useMemo(() => tasks.filter((t: any) => t.estado === "pendiente" || t.estado === "en_progreso").length, [tasks])
  const tareasCompletadas = useMemo(() => tasks.filter((t: any) => t.estado === "completada").length, [tasks])
  const ingresos = useMemo(() =>
    transacciones.filter((t: any) => (t.tipo ?? "").toLowerCase() === "ingreso").reduce((s: number, t: any) => s + (Number(t.monto) || 0), 0),
  [transacciones])
  const gastos = useMemo(() =>
    transacciones.filter((t: any) => (t.tipo ?? "").toLowerCase() === "gasto").reduce((s: number, t: any) => s + (Number(t.monto) || 0), 0),
  [transacciones])

  const recentProjects = useMemo(() => projects.slice(0, 5), [projects])

  const statsLoading = loadingProjects || loadingClients || loadingTasks || loadingFinanzas

  const metrics = useMemo(() => {
    const now = new Date()
    const proyectosActivos = projects.filter((p: any) => p.estado === "en_progreso" || p.estado === "planificacion").length
    const proyectosTiempo = projects.filter((p: any) => {
      if (!p.fechaFin) return true
      return new Date(p.fechaFin) >= now || p.estado === "completado"
    }).length
    const pctTiempo = projects.length > 0 ? Math.round((proyectosTiempo / projects.length) * 100) : 0

    const tareasUrgentes = tasks.filter((t: any) => t.prioridad === "urgente" || t.prioridad === "alta").length
    const completionRate = tasks.length > 0 ? Math.round((tareasCompletadas / tasks.length) * 100) : 0

    const usuariosActivos = usuarios.filter((u: any) => u.estado === "activo").length
    const cargaPromedio = usuariosActivos > 0 ? (tareasPendientes / usuariosActivos).toFixed(1) : "0"

    const facturasPendientes = facturas.filter((f: any) => f.estado === "enviada").reduce((s: number, f: any) => s + (Number(f.total) || 0), 0)
    const facturasVencidas = facturas.filter((f: any) => f.estado === "vencida").reduce((s: number, f: any) => s + (Number(f.total) || 0), 0)
    const margen = ingresos > 0 ? Math.round(((ingresos - gastos) / ingresos) * 100) : 0

    return {
      proyectosActivos, pctTiempo, tareasUrgentes, completionRate,
      usuariosActivos, cargaPromedio,
      facturasPendientes, facturasVencidas, margen, gastos,
    }
  }, [projects, tasks, tareasCompletadas, tareasPendientes, usuarios, facturas, ingresos, gastos])

  const allLoading = statsLoading || loadingUsuarios || loadingFacturas

  const executiveSummary = useMemo(() => {
    if (allLoading) return ""
    return buildExecutiveSummary(metrics, tareasPendientes)
  }, [allLoading, metrics, tareasPendientes])

  return (
    <AppShell
      currentSection="dashboard"
      breadcrumbs={[{ label: "7F" }, { label: "Dashboard" }]}
    >
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vista general del estado de operaciones.</p>
        </div>

        {/* ─── PANORAMA GENERAL ─── */}
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="h-1 rounded-t-xl bg-purple-600/80" />
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <h2 className="text-sm font-semibold text-[#111827] tracking-tight">Panorama General</h2>
              </div>
              {allLoading ? (
                <div className="h-5 w-80 animate-pulse rounded bg-muted" />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">{executiveSummary}</p>
              )}
            </div>
            <Link
              href="/agente"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1d4ed8] flex-shrink-0"
            >
              Analizar situacion
            </Link>
          </div>
        </div>

        {/* ─── KPIs ─── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Proyectos activos"
            value={statsLoading ? "—" : String(metrics.proyectosActivos)}
            subtitle={statsLoading ? "" : `${totalProyectos} totales`}
            icon={FolderKanban}
          />
          <StatCard
            label="Clientes"
            value={statsLoading ? "—" : String(totalClientes)}
            subtitle={statsLoading ? "" : `${clients.filter((c: any) => c.estado === "activo").length} activos`}
            icon={Users}
          />
          <StatCard
            label="Tareas pendientes"
            value={statsLoading ? "—" : String(tareasPendientes)}
            subtitle={statsLoading ? "" : `${metrics.tareasUrgentes} urgentes`}
            icon={CheckSquare}
          />
          <StatCard
            label="Ingresos totales"
            value={statsLoading ? "—" : formatCurrency(ingresos)}
            subtitle={statsLoading ? "" : `Gastos: ${formatCurrency(gastos)}`}
            icon={DollarSign}
            accent="finance"
          />
        </div>

        {/* ─── PROYECTOS & FINANZAS (tier 2) ─── */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                    <FolderKanban className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-sm font-semibold text-[#111827]">Proyectos Recientes</h2>
                </div>
                <Link href="/proyectos" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                  Ver todos →
                </Link>
              </div>
              {loadingProjects ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-40 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentProjects.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No hay proyectos
                    </div>
                  ) : (
                    recentProjects.map((project: any) => (
                      <Link
                        href={`/proyectos/${project.id}`}
                        key={project.id ?? project.nombre}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">{project.nombre}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{project.cliente?.nombre ?? "—"}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                          <div className="w-20">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500/50" style={{ width: `${project.progreso ?? 0}%` }} />
                            </div>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">{project.progreso ?? 0}%</span>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground flex-shrink-0">
                          {displayLabel(project.estado ?? "", estadoLabel) || "—"}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actividad + Facturación */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-[#111827]">Actividad Reciente</h2>
              </div>
              <div className="divide-y divide-border">
                {loadingTasks ? (
                  [1, 2].map((i) => (
                    <div key={i} className="px-5 py-3.5 animate-pulse space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-48 bg-muted rounded" />
                    </div>
                  ))
                ) : (
                  (() => {
                    const recentTasks = (tasks as any[]).slice(0, 5)
                    if (recentTasks.length === 0) {
                      return (
                        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                          Sin actividad reciente
                        </div>
                      )
                    }
                    return recentTasks.map((t: any) => (
                      <div key={t.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#111827] truncate">{t.titulo ?? t.nombre ?? "Tarea"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{displayLabel(t.estado ?? "", estadoLabel)}</span>
                            {t.prioridad && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                t.prioridad === "urgente" ? "bg-red-50 text-red-600"
                                : t.prioridad === "alta" ? "bg-amber-50 text-amber-600"
                                : "bg-muted text-muted-foreground"
                              }`}>{displayLabel(t.prioridad, prioridadLabel)}</span>
                            )}
                          </div>
                        </div>
                        {t.updatedAt && (
                          <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{formatDate(t.updatedAt)}</span>
                        )}
                      </div>
                    ))
                  })()
                )}
              </div>
            </div>

            {!loadingFacturas && (metrics.facturasPendientes > 0 || metrics.facturasVencidas > 0) && (
              <div className="rounded-xl border border-border border-l-4 border-l-blue-600 bg-card p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                    <Receipt className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#111827]">Facturacion</h3>
                </div>
                <div className="flex flex-col gap-2.5">
                  {metrics.facturasPendientes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Pendiente de cobro
                      </span>
                      <span className="text-sm font-bold text-amber-600">{formatCurrency(metrics.facturasPendientes)}</span>
                    </div>
                  )}
                  {metrics.facturasVencidas > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> Facturas vencidas
                      </span>
                      <span className="text-sm font-bold text-red-600">{formatCurrency(metrics.facturasVencidas)}</span>
                    </div>
                  )}
                  <Link href="/facturacion" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors mt-1">
                    Ver facturacion →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── METRICAS SECUNDARIAS (tier 3) ─── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">Rendimiento</h3>
            </div>
            <div className="flex flex-col gap-3">
              <MetricRow label="Proyectos a tiempo" value={allLoading ? "—" : `${metrics.pctTiempo}%`} />
              <MetricRow label="Tasa de completado" value={allLoading ? "—" : `${metrics.completionRate}%`} />
              <MetricRow label="Tareas completadas" value={allLoading ? "—" : String(tareasCompletadas)} />
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500/40 transition-all" style={{ width: `${metrics.completionRate}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">Equipo</h3>
            </div>
            <div className="flex flex-col gap-3">
              <MetricRow label="Miembros activos" value={allLoading ? "—" : String(metrics.usuariosActivos)} />
              <MetricRow label="Tareas/persona" value={allLoading ? "—" : metrics.cargaPromedio} />
              <MetricRow label="Total usuarios" value={allLoading ? "—" : String(usuarios.length)} />
              <Link href="/usuarios" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors mt-1">
                Gestionar equipo →
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border border-l-4 border-l-blue-600 bg-card p-5 transition-all hover:shadow-md">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-[#111827]">Finanzas</h3>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ingresos</span>
                <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                  <ArrowUpRight className="h-3 w-3" />{allLoading ? "—" : formatCurrency(ingresos)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gastos</span>
                <span className="flex items-center gap-1 text-sm font-bold text-red-500">
                  <ArrowDownRight className="h-3 w-3" />{allLoading ? "—" : formatCurrency(gastos)}
                </span>
              </div>
              <MetricRow label="Margen operativo" value={allLoading ? "—" : `${metrics.margen}%`} />
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${metrics.margen >= 0 ? "bg-emerald-500/40" : "bg-red-500/40"}`}
                  style={{ width: `${Math.min(Math.abs(metrics.margen), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-[#111827]">{value}</span>
    </div>
  )
}
