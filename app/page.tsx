"use client"

import { useMemo } from "react"
import { AppShell } from "@/components/app-shell"
import { StatCard } from "@/components/stat-card"
import {
  FolderKanban, Users, CheckSquare, DollarSign, TrendingUp, Clock,
  Receipt, AlertCircle, ArrowUpRight, ArrowDownRight, Plus, FileText, Zap,
} from "lucide-react"
import Link from "next/link"
import { useFetch } from "@/hooks/use-fetch"
import { useUser } from "@/hooks/use-user"
import { estadoLabel, prioridadLabel, displayLabel } from "@/lib/api-client"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

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

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Buenos dias"
  if (h < 18) return "Buenas tardes"
  return "Buenas noches"
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const statusColorMap: Record<string, string> = {
  en_progreso: "bg-blue-500",
  planificacion: "bg-amber-500",
  completado: "bg-emerald-500",
  pausado: "bg-gray-400",
  cancelado: "bg-red-400",
}

export default function DashboardPage() {
  const { user } = useUser()
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

  const chartData = useMemo(() => {
    const months: Record<string, { name: string; ingresos: number; gastos: number }> = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      months[key] = {
        name: d.toLocaleDateString("es-MX", { month: "short" }),
        ingresos: 0,
        gastos: 0,
      }
    }
    for (const t of transacciones) {
      const fecha = t.fecha ?? t.createdAt
      if (!fecha) continue
      const d = new Date(fecha)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (months[key]) {
        const tipo = (t.tipo ?? "").toLowerCase()
        if (tipo === "ingreso") months[key].ingresos += Number(t.monto) || 0
        else if (tipo === "gasto") months[key].gastos += Number(t.monto) || 0
      }
    }
    return Object.values(months)
  }, [transacciones])

  const allLoading = statsLoading || loadingUsuarios || loadingFacturas

  const summaryParts: string[] = []
  if (!allLoading) {
    if (metrics.tareasUrgentes > 0) summaryParts.push(`${metrics.tareasUrgentes} tarea${metrics.tareasUrgentes > 1 ? "s" : ""} urgente${metrics.tareasUrgentes > 1 ? "s" : ""}`)
    if (metrics.facturasVencidas > 0) summaryParts.push(`${formatCurrency(metrics.facturasVencidas)} en facturas vencidas`)
    if (metrics.proyectosActivos > 0) summaryParts.push(`${metrics.proyectosActivos} proyecto${metrics.proyectosActivos > 1 ? "s" : ""} activo${metrics.proyectosActivos > 1 ? "s" : ""}`)
  }

  const firstName = user?.nombre?.split(" ")[0] ?? ""

  return (
    <AppShell
      currentSection="dashboard"
      breadcrumbs={[{ label: "7F" }, { label: "Dashboard" }]}
    >
      <div className="flex flex-col gap-8">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground capitalize">{getFormattedDate()}</p>
          {summaryParts.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tienes {summaryParts.join(", ")}.
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/proyectos?nuevo=1"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Link>
          <Link
            href="/tareas?nueva=1"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <CheckSquare className="h-4 w-4" />
            Nueva tarea
          </Link>
          <Link
            href="/facturacion?nueva=1"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <FileText className="h-4 w-4" />
            Nueva factura
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Proyectos activos"
            value={statsLoading ? "\u2014" : String(metrics.proyectosActivos)}
            subtitle={statsLoading ? "" : `${totalProyectos} totales`}
            icon={FolderKanban}
            accentColor="#2563EB"
            valueColor="#2563EB"
          />
          <StatCard
            label="Clientes"
            value={statsLoading ? "\u2014" : String(totalClientes)}
            subtitle={statsLoading ? "" : `${clients.filter((c: any) => c.estado === "activo").length} activos`}
            icon={Users}
            accentColor="#1E40AF"
            valueColor="#1E40AF"
          />
          <StatCard
            label="Tareas pendientes"
            value={statsLoading ? "\u2014" : String(tareasPendientes)}
            subtitle={statsLoading ? "" : `${metrics.tareasUrgentes} urgentes`}
            icon={CheckSquare}
            accentColor="#7C3AED"
            valueColor="#7C3AED"
          />
          <StatCard
            label="Ingresos totales"
            value={statsLoading ? "\u2014" : formatCurrency(ingresos)}
            subtitle={statsLoading ? "" : `Gastos: ${formatCurrency(gastos)}`}
            icon={DollarSign}
            accentColor="#9333EA"
            valueColor="#9333EA"
          />
        </div>

        {/* Revenue chart */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Ingresos vs Gastos</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="text-xs text-muted-foreground">Gastos</span>
              </div>
            </div>
          </div>
          <div className="px-2 py-4 sm:px-5">
            {loadingFinanzas ? (
              <div className="flex h-[240px] items-center justify-center">
                <span className="text-sm text-muted-foreground animate-pulse">Cargando datos...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCurrency(v)} width={60} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [formatCurrency(value)]}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 4 }}
                  />
                  <Area type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={2} fill="url(#fillIngresos)" name="Ingresos" />
                  <Area type="monotone" dataKey="gastos" stroke="#EF4444" strokeWidth={2} fill="url(#fillGastos)" name="Gastos" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Recent projects */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Proyectos Recientes</h2>
                </div>
                <Link href="/proyectos" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  Ver todos
                </Link>
              </div>
              {loadingProjects ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                      <div className="flex-1 space-y-2">
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
                        className="flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{project.nombre}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{project.cliente?.nombre ?? "\u2014"}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                          <div className="w-24">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${statusColorMap[project.estado] ?? "bg-primary/40"}`}
                                style={{ width: `${project.progreso ?? 0}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">{project.progreso ?? 0}%</span>
                        </div>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground flex-shrink-0">
                          {displayLabel(project.estado ?? "", estadoLabel) || "\u2014"}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Urgent tasks */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-foreground">Tareas Prioritarias</h2>
                </div>
                <Link href="/tareas" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  Ver todas
                </Link>
              </div>
              <div className="divide-y divide-border">
                {loadingTasks ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="px-5 py-3.5 animate-pulse space-y-2">
                      <div className="h-4 w-32 bg-muted rounded" />
                      <div className="h-3 w-48 bg-muted rounded" />
                    </div>
                  ))
                ) : (
                  (() => {
                    const urgentTasks = (tasks as any[])
                      .filter((t: any) => t.estado !== "completada" && (t.prioridad === "urgente" || t.prioridad === "alta"))
                      .slice(0, 5)
                    const displayTasks = urgentTasks.length > 0 ? urgentTasks : (tasks as any[]).filter((t: any) => t.estado !== "completada").slice(0, 5)
                    if (displayTasks.length === 0) {
                      return (
                        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                          Sin tareas pendientes
                        </div>
                      )
                    }
                    return displayTasks.map((t: any) => (
                      <Link key={t.id} href={`/tareas/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{t.titulo ?? t.nombre ?? "Tarea"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{displayLabel(t.estado ?? "", estadoLabel)}</span>
                            {t.prioridad && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
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
                      </Link>
                    ))
                  })()
                )}
              </div>
            </div>

            {/* Invoices */}
            {!loadingFacturas && (metrics.facturasPendientes > 0 || metrics.facturasVencidas > 0) && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Receipt className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Facturacion</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {metrics.facturasPendientes > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/10 px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3" /> Pendiente de cobro
                      </span>
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{formatCurrency(metrics.facturasPendientes)}</span>
                    </div>
                  )}
                  {metrics.facturasVencidas > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/10 px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" /> Facturas vencidas
                      </span>
                      <span className="text-sm font-bold text-red-700 dark:text-red-400">{formatCurrency(metrics.facturasVencidas)}</span>
                    </div>
                  )}
                  <Link href="/facturacion" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1">
                    Ver facturacion →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Rendimiento</h3>
            </div>
            <div className="flex flex-col gap-3">
              <MetricRow label="Proyectos a tiempo" value={allLoading ? "\u2014" : `${metrics.pctTiempo}%`} />
              <MetricRow label="Tasa de completado" value={allLoading ? "\u2014" : `${metrics.completionRate}%`} />
              <MetricRow label="Tareas completadas" value={allLoading ? "\u2014" : String(tareasCompletadas)} />
              <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${metrics.completionRate}%` }} />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Equipo</h3>
            </div>
            <div className="flex flex-col gap-3">
              <MetricRow label="Miembros activos" value={allLoading ? "\u2014" : String(metrics.usuariosActivos)} />
              <MetricRow label="Tareas/persona" value={allLoading ? "\u2014" : metrics.cargaPromedio} />
              <MetricRow label="Total usuarios" value={allLoading ? "\u2014" : String(usuarios.length)} />
              <Link href="/usuarios" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1">
                Gestionar equipo →
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
                <DollarSign className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Finanzas</h3>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ingresos</span>
                <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="h-3 w-3" />{allLoading ? "\u2014" : formatCurrency(ingresos)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Gastos</span>
                <span className="flex items-center gap-1 text-sm font-bold text-red-500 dark:text-red-400">
                  <ArrowDownRight className="h-3 w-3" />{allLoading ? "\u2014" : formatCurrency(gastos)}
                </span>
              </div>
              <MetricRow label="Margen operativo" value={allLoading ? "\u2014" : `${metrics.margen}%`} />
              <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${metrics.margen >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
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
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}
