"use client"

import { useMemo } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { StatCard } from "@/components/stat-card"
import {
  FolderKanban, Users, CheckSquare, DollarSign, TrendingUp, Clock,
  Receipt, AlertCircle, ArrowUpRight, ArrowDownRight,
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

export default function DireccionGeneralPage() {
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

  return (
    <AppShell
      currentSection="direccion"
      breadcrumbs={[{ label: "7F" }, { label: "Direccion General" }]}
    >
      <SectionPage
        title="Direccion General"
        description="Vista general del estado de todos los proyectos, clientes y operaciones."
      >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Proyectos activos"
            value={statsLoading ? "—" : String(metrics.proyectosActivos)}
            subtitle={statsLoading ? "" : `${totalProyectos} totales`}
            icon={FolderKanban}
            accentColor="var(--tab-info)"
          />
          <StatCard
            label="Clientes"
            value={statsLoading ? "—" : String(totalClientes)}
            subtitle={statsLoading ? "" : `${clients.filter((c: any) => c.estado === "activo").length} activos`}
            icon={Users}
            accentColor="var(--tab-phases)"
          />
          <StatCard
            label="Tareas pendientes"
            value={statsLoading ? "—" : String(tareasPendientes)}
            subtitle={statsLoading ? "" : `${metrics.tareasUrgentes} urgentes`}
            icon={CheckSquare}
            accentColor="var(--tab-tasks)"
          />
          <StatCard
            label="Ingresos totales"
            value={statsLoading ? "—" : formatCurrency(ingresos)}
            subtitle={statsLoading ? "" : `Gastos: ${formatCurrency(gastos)}`}
            icon={DollarSign}
            accentColor="var(--tab-docs)"
          />
        </div>

        {/* Two column layout */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Recent projects */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Proyectos Recientes</h2>
                </div>
                <Link href="/proyectos" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Ver todos
                </Link>
              </div>
              {loadingProjects ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                      <div className="flex-1 space-y-1">
                        <div className="h-4 w-40 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentProjects.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No hay proyectos
                    </div>
                  ) : (
                    recentProjects.map((project: any) => (
                      <Link
                        href={`/proyectos/${project.id}`}
                        key={project.id ?? project.nombre}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{project.nombre}</p>
                          <p className="text-xs text-muted-foreground">{project.cliente?.nombre ?? "—"}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                          <div className="w-20">
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-foreground/40" style={{ width: `${project.progreso ?? 0}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{project.progreso ?? 0}%</span>
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

          {/* Recent activity + urgent tasks */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Actividad Reciente</h2>
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
                        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                          Sin actividad reciente
                        </div>
                      )
                    }
                    return recentTasks.map((t: any) => (
                      <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t.titulo ?? t.nombre ?? "Tarea"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{displayLabel(t.estado ?? "", estadoLabel)}</span>
                            {t.prioridad && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                t.prioridad === "urgente" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : t.prioridad === "alta" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
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

            {/* Facturas pendientes */}
            {!loadingFacturas && (metrics.facturasPendientes > 0 || metrics.facturasVencidas > 0) && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Facturacion</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {metrics.facturasPendientes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Pendiente de cobro
                      </span>
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(metrics.facturasPendientes)}</span>
                    </div>
                  )}
                  {metrics.facturasVencidas > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> Facturas vencidas
                      </span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(metrics.facturasVencidas)}</span>
                    </div>
                  )}
                  <Link href="/facturacion" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-1">
                    Ver facturacion →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Rendimiento</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              <MetricRow label="Proyectos a tiempo" value={allLoading ? "—" : `${metrics.pctTiempo}%`} />
              <MetricRow label="Tasa de completado" value={allLoading ? "—" : `${metrics.completionRate}%`} />
              <MetricRow label="Tareas completadas" value={allLoading ? "—" : String(tareasCompletadas)} />
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground/30 transition-all" style={{ width: `${metrics.completionRate}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Equipo</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              <MetricRow label="Miembros activos" value={allLoading ? "—" : String(metrics.usuariosActivos)} />
              <MetricRow label="Tareas/persona" value={allLoading ? "—" : metrics.cargaPromedio} />
              <MetricRow label="Total usuarios" value={allLoading ? "—" : String(usuarios.length)} />
              <Link href="/usuarios" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-1">
                Gestionar equipo →
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Finanzas</h3>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ingresos</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="h-3 w-3" />{allLoading ? "—" : formatCurrency(ingresos)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gastos</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-red-600 dark:text-red-400">
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
      </SectionPage>
    </AppShell>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}
