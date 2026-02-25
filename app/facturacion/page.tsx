"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { displayLabel, estadoLabel } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import {
  Search,
  Download,
  Eye,
  X,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
  CreditCard,
  Receipt,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  SlidersHorizontal,
  Building,
  TrendingUp,
  Users,
  FolderKanban,
  ChevronDown,
} from "lucide-react"
import { FacturaForm } from "@/components/forms/factura-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { apiDelete } from "@/lib/api-client"
import { toast } from "sonner"
import { CanEdit, CanDelete, RoleGate } from "@/components/role-gate"
import { ExportCSVButton } from "@/components/export-button"
import { FACTURA_COLUMNS } from "@/lib/export/csv"

/* ─────────── Helpers ─────────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return value
  }
}

const INVOICE_ESTADOS = ["borrador", "enviada", "pagada", "vencida", "cancelada"] as const
const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  borrador: { label: "Borrador", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", icon: FileText },
  enviada: { label: "Enviada", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Clock },
  pagada: { label: "Pagada", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  vencida: { label: "Vencida", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", icon: AlertCircle },
  cancelada: { label: "Cancelada", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", icon: X },
}

type SortKey = "date" | "total" | "status" | "client"

function sortInvoices(list: any[], key: SortKey, asc: boolean): any[] {
  return [...list].sort((a, b) => {
    let cmp = 0
    const clientA = a.cliente?.nombre ?? ""
    const clientB = b.cliente?.nombre ?? ""
    switch (key) {
      case "date":
        cmp = new Date(a.fechaEmision || 0).getTime() - new Date(b.fechaEmision || 0).getTime()
        break
      case "total":
        cmp = (Number(a.total) || 0) - (Number(b.total) || 0)
        break
      case "status": {
        const order: Record<string, number> = { vencida: 0, enviada: 1, borrador: 2, pagada: 3, cancelada: 4 }
        cmp = (order[a.estado] ?? 99) - (order[b.estado] ?? 99)
        break
      }
      case "client":
        cmp = clientA.localeCompare(clientB)
        break
    }
    return asc ? cmp : -cmp
  })
}

/* ─────────── Main Page ─────────── */

export default function FacturacionPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [clientFilter, setClientFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortAsc, setSortAsc] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  const query = new URLSearchParams()
  if (search.trim()) query.set("search", search.trim())
  if (statusFilter !== "all") query.set("estado", statusFilter)
  const qs = query.toString()
  const url = qs ? `/api/facturacion?${qs}` : "/api/facturacion"

  const { data: apiData, loading, error, refetch } = useFetch<any>(url)
  const allInvoices = Array.isArray(apiData) ? apiData : []

  const uniqueClients = useMemo(() => {
    const set = new Set<string>()
    allInvoices.forEach((i: any) => {
      const n = i.cliente?.nombre
      if (n) set.add(n)
    })
    return Array.from(set).sort()
  }, [allInvoices])

  const filtered = useMemo(() => {
    let list = allInvoices.filter((inv: any) => {
      const matchSearch =
        search === "" ||
        (inv.numero && String(inv.numero).toLowerCase().includes(search.toLowerCase())) ||
        (inv.cliente?.nombre && inv.cliente.nombre.toLowerCase().includes(search.toLowerCase())) ||
        (inv.proyecto?.nombre && inv.proyecto.nombre.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = statusFilter === "all" || inv.estado === statusFilter
      const matchClient = clientFilter === "all" || inv.cliente?.nombre === clientFilter
      return matchSearch && matchStatus && matchClient
    })
    return sortInvoices(list, sortKey, sortAsc)
  }, [allInvoices, search, statusFilter, clientFilter, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/facturacion/${deleteItem.id}`)
      toast.success("Factura eliminada")
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleteItem(null)
    }
  }

  const stats = useMemo(() => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth()
    const totalThisMonth = allInvoices
      .filter((i: any) => {
        const d = i.fechaEmision ? new Date(i.fechaEmision) : null
        return d && d.getFullYear() === thisYear && d.getMonth() === thisMonth
      })
      .reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)
    const totalPending = allInvoices
      .filter((i: any) => i.estado === "enviada")
      .reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)
    const totalOverdue = allInvoices
      .filter((i: any) => i.estado === "vencida")
      .reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)
    const totalPaid = allInvoices
      .filter((i: any) => i.estado === "pagada")
      .reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)
    const totalAll = allInvoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0)

    const byClient: Record<string, number> = {}
    allInvoices.forEach((i: any) => {
      const name = i.cliente?.nombre ?? "—"
      byClient[name] = (byClient[name] || 0) + (Number(i.total) || 0)
    })
    const clientBreakdown = Object.entries(byClient).sort((a, b) => b[1] - a[1])

    const byProject: Record<string, number> = {}
    allInvoices.forEach((i: any) => {
      const name = i.proyecto?.nombre
      if (name) byProject[name] = (byProject[name] || 0) + (Number(i.total) || 0)
    })
    const projectBreakdown = Object.entries(byProject).sort((a, b) => b[1] - a[1])

    return { totalThisMonth, totalPending, totalOverdue, totalPaid, totalAll, clientBreakdown, projectBreakdown }
  }, [allInvoices])

  if (selectedInvoice) {
    return (
      <AppShell
        currentSection="facturacion"
        breadcrumbs={[{ label: "7F" }, { label: "Facturacion", href: "/facturacion" }, { label: selectedInvoice.numero }]}
      >
        <InvoiceDetail
          invoice={selectedInvoice}
          onBack={() => setSelectedInvoice(null)}
          onEdit={() => { setEditingItem(selectedInvoice); setFormOpen(true) }}
          onDelete={() => setDeleteItem(selectedInvoice)}
        />
        <FacturaForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title="Eliminar factura"
          description={`¿Seguro que quieres eliminar la factura "${deleteItem?.numero}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      currentSection="facturacion"
      breadcrumbs={[{ label: "7F" }, { label: "Facturacion" }]}
    >
      <SectionPage
        title="Facturacion General"
        description="Panel central de facturacion. Consulta, filtra y gestiona todas las facturas de la empresa."
      >
        {/* ── Financial Indicators ── */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <IndicatorCard
            label="Facturado este mes"
            amount={stats.totalThisMonth}
            icon={Calendar}
            bgColor="#7C3AED"
          />
          <IndicatorCard
            label="Total cobrado"
            amount={stats.totalPaid}
            icon={CheckCircle2}
            bgColor="#6D28D9"
          />
          <IndicatorCard
            label="Pendiente de cobro"
            amount={stats.totalPending}
            icon={Clock}
            bgColor="#9333EA"
          />
          <IndicatorCard
            label="Facturas vencidas"
            amount={stats.totalOverdue}
            icon={AlertCircle}
            bgColor="#64748B"
          />
          <IndicatorCard
            label="Total general"
            amount={stats.totalAll}
            icon={TrendingUp}
            bgColor="#475569"
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {/* ── Revenue Breakdown ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownCard
            title="Ingresos por cliente"
            icon={Users}
            items={stats.clientBreakdown}
            total={stats.totalAll}
          />
          <BreakdownCard
            title="Ingresos por proyecto"
            icon={FolderKanban}
            items={stats.projectBreakdown}
            total={stats.totalAll}
          />
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Todas las facturas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Cargando..." : `${filtered.length} de ${allInvoices.length} factura${allInvoices.length !== 1 ? "s" : ""}`}
              {(statusFilter !== "all" || clientFilter !== "all") && " (filtradas)"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ExportCSVButton
              data={filtered}
              columns={FACTURA_COLUMNS}
              filename={`facturas-${new Date().toISOString().slice(0, 10)}`}
            />
            <button
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors shadow-sm",
                showAIPanel
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">IA</span>
            </button>
            <CanEdit>
              <button
                onClick={() => { setEditingItem(null); setFormOpen(true) }}
                className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Crear factura</span>
              </button>
            </CanEdit>
          </div>
        </div>

        {/* ── AI Panel ── */}
        {showAIPanel && (
          <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">IA de Facturacion</p>
              </div>
              <button
                onClick={() => setShowAIPanel(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              El asistente analiza todas las facturas de la empresa para ofrecerte insights financieros y acciones rapidas.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <AIAction title="Resumir facturas" description="Genera un resumen ejecutivo de la facturacion actual." />
              <AIAction title="Detectar inconsistencias" description="Revisa montos, fechas y estados en busca de errores." />
              <AIAction title="Sugerir recordatorios" description="Identifica facturas vencidas y prepara recordatorios." />
              <AIAction title="Mensajes para clientes" description="Genera mensajes de cobro profesionales y cordiales." />
              <AIAction title="Analizar ingresos" description="Desglosa tendencias de ingresos por periodo y cliente." />
            </div>
            <div className="rounded-lg border border-border bg-background shadow-sm p-4 flex items-start gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Resumen automatico</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  La empresa tiene {allInvoices.length} facturas registradas por un total de {formatCurrency(stats.totalAll)}.
                  De ese monto, {formatCurrency(stats.totalPaid)} estan cobrados, {formatCurrency(stats.totalPending)} pendientes
                  y {formatCurrency(stats.totalOverdue)} vencidos.
                  {stats.totalOverdue > 0 && " Se recomienda dar seguimiento inmediato a las facturas vencidas."}
                  {" "}Este mes se ha facturado {formatCurrency(stats.totalThisMonth)}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Search & Filters ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por numero, cliente o proyecto..."
                className="w-full rounded-lg bg-muted/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar busqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors shadow-sm",
                showFilters
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtros</span>
            </button>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-border bg-card shadow-sm px-4 py-3 flex flex-col gap-3">
              {/* Status filter row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["all", ...INVOICE_ESTADOS].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        statusFilter === s
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {s === "all" ? "Todas" : displayLabel(s, estadoLabel)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client filter row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cliente:</span>
                <div className="relative">
                  <button
                    onClick={() => setShowClientDropdown(!showClientDropdown)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      clientFilter !== "all"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {clientFilter === "all" ? "Todos los clientes" : clientFilter}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showClientDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-20 w-56 rounded-lg border border-border bg-card shadow-lg py-1">
                      <button
                        onClick={() => { setClientFilter("all"); setShowClientDropdown(false) }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent",
                          clientFilter === "all" ? "text-primary bg-primary/10" : "text-muted-foreground"
                        )}
                      >
                        Todos los clientes
                      </button>
                      {uniqueClients.map((c) => (
                        <button
                          key={c}
                          onClick={() => { setClientFilter(c); setShowClientDropdown(false) }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent",
                            clientFilter === c ? "text-primary bg-primary/10" : "text-muted-foreground"
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort */}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground hidden sm:inline">
                    Ordenar:
                  </span>
                  <SortButton label="Fecha" sortKey="date" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortButton label="Monto" sortKey="total" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortButton label="Cliente" sortKey="client" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                  <SortButton label="Estado" sortKey="status" currentKey={sortKey} asc={sortAsc} onToggle={toggleSort} />
                </div>
              </div>

              {/* Active filters */}
              {(statusFilter !== "all" || clientFilter !== "all") && (
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">Filtros activos:</span>
                  {statusFilter !== "all" && (
                    <button
                      onClick={() => setStatusFilter("all")}
                      className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      {displayLabel(statusFilter, estadoLabel)}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {clientFilter !== "all" && (
                    <button
                      onClick={() => setClientFilter("all")}
                      className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      {clientFilter}
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Desktop Table ── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Factura</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Proyecto</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Fecha</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Monto</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No se encontraron facturas</p>
                        <p className="text-xs text-muted-foreground">Intenta ajustar los filtros o la busqueda.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv: any) => {
                    const sc = statusConfig[inv.estado] || statusConfig.borrador
                    const StatusIcon = sc.icon
                    return (
                      <tr key={inv.id} className="hover:bg-muted/40 transition-colors group">
                        <td className="px-5 py-4">
                          <Link
                            href={`/facturacion/${inv.id}`}
                            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            {inv.numero}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">Vence: {formatDate(inv.fechaVencimiento)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted flex-shrink-0">
                              <Building className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <span className="text-sm text-foreground">{inv.cliente?.nombre ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{inv.proyecto?.nombre ?? "—"}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(inv.fechaEmision)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-foreground text-right">{formatCurrency(Number(inv.total) || 0)}</td>
                        <td className="px-5 py-4">
                          <span className={cn("flex items-center gap-1.5 w-fit rounded-md px-2.5 py-1 text-xs font-medium", sc.bg, sc.text)}>
                            <StatusIcon className="h-3 w-3" />
                            {displayLabel(inv.estado ?? "", estadoLabel)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                              aria-label="Ver factura"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                              aria-label="Descargar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <CanEdit>
                              <button
                                onClick={() => { setEditingItem(inv); setFormOpen(true) }}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </CanEdit>
                            <CanDelete>
                              <button
                                onClick={() => setDeleteItem(inv)}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </CanDelete>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="flex flex-col gap-3 md:hidden">
          {loading ? (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No se encontraron facturas</p>
              <p className="text-xs text-muted-foreground mt-1">Intenta ajustar los filtros o la busqueda.</p>
            </div>
          ) : (
            filtered.map((inv: any) => (
              <MobileInvoiceCard
                key={inv.id}
                invoice={inv}
                onView={() => setSelectedInvoice(inv)}
                onEdit={() => { setEditingItem(inv); setFormOpen(true) }}
                onDelete={() => setDeleteItem(inv)}
              />
            ))
          )}
        </div>

        <FacturaForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title="Eliminar factura"
          description={`¿Seguro que quieres eliminar la factura "${deleteItem?.numero}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      </SectionPage>
    </AppShell>
  )
}

/* ─────────── Indicator Card ─────────── */

function IndicatorCard({
  label, amount, icon: Icon, bgColor, className,
}: {
  label: string; amount: number; icon: typeof CheckCircle2; bgColor: string; className?: string
}) {
  return (
    <div
      className={cn("rounded-xl p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5", className)}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 flex-shrink-0">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-white">{label}</p>
        <p className="text-xl font-bold text-white mt-1">{formatCurrency(amount)}</p>
      </div>
    </div>
  )
}

/* ─────────── Breakdown Card ─────────── */

function BreakdownCard({
  title, icon: Icon, items, total,
}: {
  title: string; icon: typeof Users; items: [string, number][]; total: number
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {items.slice(0, 5).map(([name, amount]) => {
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0
          return (
            <div key={name} className="px-5 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/30"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-foreground">{formatCurrency(amount)}</p>
                <p className="text-xs text-muted-foreground">{pct}%</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────── Mobile Invoice Card ─────────── */

function MobileInvoiceCard({ invoice, onView, onEdit, onDelete }: { invoice: any; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const sc = statusConfig[invoice.estado] || statusConfig.borrador
  const StatusIcon = sc.icon

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tab-billing)] flex-shrink-0">
            <Receipt className="h-5 w-5 text-foreground/60" />
          </div>
          <div className="min-w-0">
            <button onClick={onView} className="text-sm font-semibold text-primary hover:text-primary/80 text-left transition-colors">
              {invoice.numero}
            </button>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.cliente?.nombre ?? "—"}</p>
          </div>
        </div>
        <span className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium flex-shrink-0", sc.bg, sc.text)}>
          <StatusIcon className="h-3 w-3" />
          {sc.label}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {invoice.proyecto?.nombre && (
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {invoice.proyecto.nombre}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(invoice.fechaEmision)}
        </span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-lg font-bold text-foreground">{formatCurrency(Number(invoice.total) || 0)}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Eye className="h-3 w-3" />
            Ver
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
            <Download className="h-3 w-3" />
            PDF
          </button>
          <CanEdit>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </CanEdit>
          <CanDelete>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-accent transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </CanDelete>
        </div>
      </div>
    </div>
  )
}

/* ─────────── Invoice Detail ─────────── */

function InvoiceDetail({ invoice, onBack, onEdit, onDelete }: { invoice: any; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const sc = statusConfig[invoice.estado] || statusConfig.borrador
  const StatusIcon = sc.icon
  const items = Array.isArray(invoice.items) ? invoice.items : []
  const subtotal = Number(invoice.subtotal) || 0
  const impuesto = Number(invoice.impuesto) || 0
  const total = Number(invoice.total) || 0

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors self-start"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        Volver a facturas
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tab-billing)] flex-shrink-0">
            <Receipt className="h-6 w-6 text-foreground/60" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{invoice.numero}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", sc.bg, sc.text)}>
                <StatusIcon className="h-3 w-3" />
                {displayLabel(invoice.estado ?? "", estadoLabel)}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building className="h-3 w-3" />
                {invoice.cliente?.nombre ?? "—"}
              </span>
              {invoice.proyecto?.nombre && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {invoice.proyecto.nombre}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Download className="h-4 w-4" />
            Descargar PDF
          </button>
          {invoice.estado !== "pagada" && (
            <button className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors">
              <CreditCard className="h-4 w-4" />
              Registrar pago
            </button>
          )}
          <CanEdit>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          </CanEdit>
          <CanDelete>
            <button
              onClick={onDelete}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-destructive hover:bg-accent transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </button>
          </CanDelete>
        </div>
      </div>

      {/* Summary fields */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <DetailField label="Fecha de emision" value={formatDate(invoice.fechaEmision)} />
        <DetailField label="Fecha de vencimiento" value={formatDate(invoice.fechaVencimiento)} />
        <DetailField label="Subtotal" value={formatCurrency(subtotal)} />
        <DetailField label="Total" value={formatCurrency(total)} highlight />
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Desglose de cargos</h3>
        </div>
        <div className="hidden sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Concepto</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Cant.</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">P. Unitario</th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-foreground">{item.descripcion ?? "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground text-right">{item.cantidad ?? 0}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground text-right">{formatCurrency(Number(item.precioUnitario) || 0)}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground text-right">{formatCurrency(Number(item.total) || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={3} className="px-5 py-3 text-sm text-muted-foreground text-right">Subtotal</td>
                <td className="px-5 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-5 py-3 text-sm text-muted-foreground text-right">IVA</td>
                <td className="px-5 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(impuesto)}</td>
              </tr>
              <tr className="border-t border-border bg-muted/30">
                <td colSpan={3} className="px-5 py-4 text-sm font-semibold text-foreground text-right">Total</td>
                <td className="px-5 py-4 text-base font-bold text-foreground text-right">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="sm:hidden divide-y divide-border">
          {items.map((item: any, i: number) => (
            <div key={i} className="px-5 py-4 flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">{item.descripcion ?? "—"}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{(item.cantidad ?? 0)} x {formatCurrency(Number(item.precioUnitario) || 0)}</span>
                <span className="font-medium text-foreground">{formatCurrency(Number(item.total) || 0)}</span>
              </div>
            </div>
          ))}
          <div className="px-5 py-4 flex flex-col gap-2 bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>IVA</span>
              <span className="font-medium text-foreground">{formatCurrency(impuesto)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-foreground pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history - API does not provide payments; show empty state */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Historial de pagos</h3>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No hay pagos registrados para esta factura.</p>
        </div>
      </div>
    </div>
  )
}

/* ─────────── Shared pieces ─────────── */

function DetailField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm", highlight ? "text-foreground text-base font-bold" : "font-medium text-foreground")}>
        {value}
      </p>
    </div>
  )
}

function SortButton({
  label, sortKey, currentKey, asc, onToggle,
}: {
  label: string; sortKey: SortKey; currentKey: SortKey; asc: boolean; onToggle: (key: SortKey) => void
}) {
  const isActive = sortKey === currentKey
  return (
    <button
      onClick={() => onToggle(sortKey)}
      className={cn(
        "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
      {isActive && (
        <ArrowUpDown className={cn("h-3 w-3 transition-transform", !asc && "rotate-180")} />
      )}
    </button>
  )
}

function AIAction({ title, description }: { title: string; description: string }) {
  return (
    <button className="rounded-xl border border-border bg-background shadow-sm p-4 text-left transition-shadow hover:shadow-md flex flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  )
}
