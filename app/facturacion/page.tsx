"use client";

import { useState, useMemo } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  Plus,
  ArrowUpRight,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  Loader2,
  Receipt,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { FacturaForm } from "@/components/forms/factura-form";
import { displayLabel, estadoLabel } from "@/lib/api-client";

// API estado: borrador, enviada, pagada, vencida, cancelada
const ESTADO_OPTIONS = [
  { value: "", label: "All" },
  { value: "pagada", label: "Paid" },
  { value: "enviada", label: "Pending" },
  { value: "vencida", label: "Overdue" },
  { value: "borrador", label: "Draft" },
  { value: "cancelada", label: "Canceled" },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pagada: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  enviada: { bg: "bg-[var(--status-info-bg)]", text: "text-[var(--status-info-text)]" },
  vencida: { bg: "bg-[var(--status-danger-bg)]", text: "text-[var(--status-danger-text)]" },
  borrador: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
  cancelada: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "CHF" }).format(value);
}

export default function FacturacionPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [clienteOpen, setClienteOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: clientesData } = useFetch<any[]>("/api/clientes");
  const clientes = Array.isArray(clientesData) ? clientesData : [];

  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (statusFilter) query.set("estado", statusFilter);
  if (clienteFilter) query.set("clienteId", clienteFilter);
  query.set("pageSize", "100");
  const qs = query.toString();
  const url = qs ? `/api/facturacion?${qs}` : "/api/facturacion";

  const { data: apiData, loading, error, refetch } = useFetch<any>(url, { refreshKey });
  const facturas = Array.isArray(apiData) ? apiData : [];

  const overview = useMemo(() => {
    const totalFacturado = facturas.reduce((s: number, f: any) => s + (f.total ?? 0), 0);
    const cobrado = facturas.filter((f: any) => f.estado === "pagada").reduce((s: number, f: any) => s + (f.total ?? 0), 0);
    const pendiente = facturas.filter((f: any) => f.estado === "enviada").reduce((s: number, f: any) => s + (f.total ?? 0), 0);
    const vencido = facturas.filter((f: any) => f.estado === "vencida").reduce((s: number, f: any) => s + (f.total ?? 0), 0);
    const countPagadas = facturas.filter((f: any) => f.estado === "pagada").length;
    const countPendientes = facturas.filter((f: any) => f.estado === "enviada").length;
    const countVencidas = facturas.filter((f: any) => f.estado === "vencida").length;
    return [
      { label: "Total billed", value: formatCurrency(totalFacturado), sub: "All invoices", icon: DollarSign, iconClass: "text-primary" },
      { label: "Collected", value: formatCurrency(cobrado), sub: `${countPagadas} paid invoice${countPagadas !== 1 ? "s" : ""}`, icon: CheckCircle2, iconClass: "text-[var(--status-success-text)]" },
      { label: "Pending", value: formatCurrency(pendiente), sub: `${countPendientes} pending invoice${countPendientes !== 1 ? "s" : ""}`, icon: Clock, iconClass: "text-primary" },
      { label: "Overdue", value: formatCurrency(vencido), sub: countVencidas > 0 ? `${countVencidas} invoice${countVencidas !== 1 ? "s" : ""} — needs attention` : "No overdue invoices", icon: AlertTriangle, iconClass: "text-destructive" },
    ];
  }, [facturas]);

  const primeraVencida = useMemo(() => {
    return facturas.find((f: any) => f.estado === "vencida");
  }, [facturas]);

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader
          eyebrow="Revenue"
          title="Invoices"
          actions={
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} strokeWidth={2} />
              New invoice
            </Button>
          }
        />

        <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.map(({ label, value, sub, icon, iconClass }) => (
              <StatCard
                key={label}
                label={label}
                value={value}
                subtitle={sub}
                icon={icon}
                iconClassName={iconClass}
                className="bg-accent shadow-sm"
              />
            ))}
          </div>

          {/* Overdue alert */}
          {primeraVencida && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold text-destructive">Overdue invoice — action required</p>
                <p className="text-xs text-destructive/80 mt-0.5">
                  {primeraVencida.numero} for {primeraVencida.cliente?.nombre ?? "Client"} ({formatCurrency(primeraVencida.total)}) became overdue on {formatDate(primeraVencida.fechaVencimiento)}.
                </p>
              </div>
              <Link
                href={`/facturacion/${primeraVencida.id}`}
                className="shrink-0 text-xs font-medium text-destructive hover:underline"
              >
                View invoice
              </Link>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice number..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setClienteOpen(false); setStatusOpen(!statusOpen); }}
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground hover:border-primary transition-colors min-w-[130px] justify-between"
              >
                <span>{ESTADO_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "Status"}</span>
                <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                  {ESTADO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      onClick={() => { setStatusFilter(opt.value); setStatusOpen(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm transition-colors", statusFilter === opt.value ? "bg-accent text-primary font-medium" : "text-foreground hover:bg-background")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setStatusOpen(false); setClienteOpen(!clienteOpen); }}
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground hover:border-primary transition-colors min-w-[140px] justify-between"
              >
                <span>{clienteFilter ? (clientes.find((c: any) => c.id === clienteFilter)?.nombre ?? "Client") : "Client"}</span>
                <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", clienteOpen && "rotate-180")} />
              </button>
              {clienteOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[180px] max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setClienteFilter(""); setClienteOpen(false); }}
                    className={cn("w-full text-left px-4 py-2 text-sm transition-colors", !clienteFilter ? "bg-accent text-primary font-medium" : "text-foreground hover:bg-background")}
                  >
                    All
                  </button>
                  {clientes.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteFilter(c.id); setClienteOpen(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm transition-colors truncate", clienteFilter === c.id ? "bg-accent text-primary font-medium" : "text-foreground hover:bg-background")}
                    >
                      {c.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Invoice List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">All invoices</h2>
              <span className="text-xs text-muted-foreground">{facturas.length} invoice{facturas.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-destructive/80 mt-1">Invoices could not be loaded</p>
              </div>
            ) : facturas.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-16 text-center">
                <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-foreground">No invoices yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter || clienteFilter ? "No results for the selected filters." : "Create your first invoice to get started."}
                </p>
                {!search && !statusFilter && !clienteFilter && (
                  <Button onClick={() => setFormOpen(true)} className="mt-4">
                    <Plus size={14} />
                    New invoice
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-muted bg-background">
                    <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice</span>
                    <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</span>
                    <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Project</span>
                    <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</span>
                    <span className="col-span-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Issued</span>
                    <span className="col-span-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Due</span>
                    <span className="col-span-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
                    <span className="col-span-1" />
                  </div>
                  {facturas.map((f: any, i: number) => {
                    const s = STATUS_STYLE[f.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
                    return (
                      <div key={f.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-background transition-colors", i < facturas.length - 1 && "border-b border-muted")}>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <FileText size={13} className="text-muted-foreground" strokeWidth={1.75} />
                          <Link href={`/facturacion/${f.id}`} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">#{f.numero}</Link>
                        </div>
                        <span className="col-span-2 text-sm text-foreground truncate">{f.cliente?.nombre ?? "—"}</span>
                        <span className="col-span-2 text-xs text-muted-foreground truncate">{f.proyecto?.nombre ?? "—"}</span>
                        <span className="col-span-2 text-sm font-medium text-foreground">{formatCurrency(f.total)}</span>
                        <span className="col-span-1 text-xs text-muted-foreground">{formatDate(f.fechaEmision)}</span>
                        <span className="col-span-1 text-xs text-muted-foreground">{formatDate(f.fechaVencimiento)}</span>
                        <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s.bg, s.text)}>
                          {displayLabel(f.estado, estadoLabel)}
                        </span>
                        <div className="col-span-1 flex justify-end">
                          <Link href={`/facturacion/${f.id}`} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-0.5">
                            View <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {facturas.map((f: any) => {
                    const s = STATUS_STYLE[f.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
                    return (
                      <div key={f.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <Link href={`/facturacion/${f.id}`} className="text-sm font-semibold text-primary">#{f.numero}</Link>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>
                            {displayLabel(f.estado, estadoLabel)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{formatCurrency(f.total)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{f.cliente?.nombre ?? "—"} · {f.proyecto?.nombre ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Issued {formatDate(f.fechaEmision)}
                          {f.fechaVencimiento && <> · Due {formatDate(f.fechaVencimiento)}</>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <CopilotPanel defaultContext="Billing" />

      <LegacyTodayChrome />

      <FacturaForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} />
    </div>
  );
}
