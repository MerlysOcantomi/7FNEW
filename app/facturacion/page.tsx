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
import { useI18n } from "@/components/i18n-provider";
import { resolveStatusLabel } from "@core/i18n/ui";
import { formatCurrency, formatDate } from "@core/i18n/format";

// API estado VALUES (persisted — labels resolve via the shared `statuses` catalog).
const ESTADO_VALUES = ["", "pagada", "enviada", "vencida", "borrador", "cancelada"] as const;

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pagada: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  enviada: { bg: "bg-[var(--status-info-bg)]", text: "text-[var(--status-info-text)]" },
  vencida: { bg: "bg-[var(--status-danger-bg)]", text: "text-[var(--status-danger-text)]" },
  borrador: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
  cancelada: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
};

// Invoices don't persist a currency of their own yet — the workspace default.
const INVOICE_CURRENCY = "CHF";

function formatDay(value: string | Date | null | undefined, locale: string): string {
  if (!value) return "—";
  const formatted = formatDate(value instanceof Date ? value : String(value), { locale });
  return formatted || "—";
}

function formatMoney(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return formatCurrency(value, { locale, currency: INVOICE_CURRENCY }) || "—";
}

export default function FacturacionPage() {
  const { t, locale } = useI18n();
  const B = t.billing;
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
    const stats = B.list.stats;
    return [
      { label: stats.totalBilled, value: formatMoney(totalFacturado, locale), sub: stats.allInvoices, icon: DollarSign, iconClass: "text-primary" },
      { label: stats.collected, value: formatMoney(cobrado, locale), sub: stats.paidCount(countPagadas), icon: CheckCircle2, iconClass: "text-[var(--status-success-text)]" },
      { label: stats.pending, value: formatMoney(pendiente, locale), sub: stats.pendingCount(countPendientes), icon: Clock, iconClass: "text-primary" },
      { label: stats.overdue, value: formatMoney(vencido, locale), sub: countVencidas > 0 ? stats.overdueCount(countVencidas) : stats.noOverdue, icon: AlertTriangle, iconClass: "text-destructive" },
    ];
  }, [facturas, B, locale]);

  const primeraVencida = useMemo(() => {
    return facturas.find((f: any) => f.estado === "vencida");
  }, [facturas]);

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[var(--app-shell-bg)] font-sans md:flex-row">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        <PageHeader
          eyebrow={B.eyebrow}
          title={B.invoices}
          tone="canvas"
          actions={
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} strokeWidth={2} />
              {B.newInvoice}
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
                tone="canvas"
              />
            ))}
          </div>

          {/* Overdue alert */}
          {primeraVencida && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold text-destructive">{B.list.overdueBanner.title}</p>
                <p className="text-xs text-destructive/80 mt-0.5">
                  {B.list.overdueBanner.body({
                    numero: String(primeraVencida.numero),
                    client: primeraVencida.cliente?.nombre ?? B.list.overdueBanner.clientFallback,
                    amount: formatMoney(primeraVencida.total, locale),
                    date: formatDay(primeraVencida.fechaVencimiento, locale),
                  })}
                </p>
              </div>
              <Link
                href={`/facturacion/${primeraVencida.id}`}
                className="shrink-0 text-xs font-medium text-destructive hover:underline"
              >
                {B.list.overdueBanner.viewInvoice}
              </Link>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary-light)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={B.list.searchPlaceholder}
                className="w-full rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] py-2.5 pl-9 pr-4 text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] transition-colors focus:border-[var(--accent-primary)]/50 focus:outline-none"
              />
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setClienteOpen(false); setStatusOpen(!statusOpen); }}
                className="flex w-full lg:w-auto min-w-[130px] items-center justify-between gap-2 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-2.5 text-sm text-[var(--text-primary-light)] transition-colors hover:border-[var(--accent-primary)]/45"
              >
                <span>
                  {statusFilter
                    ? resolveStatusLabel(t.statuses, statusFilter)
                    : B.list.filters.statusFallback}
                </span>
                <ChevronDown size={14} className={cn("text-[var(--text-secondary-light)] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(60vh,20rem)] min-w-[130px] overflow-hidden overflow-y-auto rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-lg lg:right-auto">
                  {ESTADO_VALUES.map((value) => (
                    <button
                      key={value || "all"}
                      onClick={() => { setStatusFilter(value); setStatusOpen(false); }}
                      className={cn(
                        "w-full px-4 py-2 text-left text-sm transition-colors",
                        statusFilter === value
                          ? "bg-white/[0.08] font-medium text-[var(--accent-primary)]"
                          : "text-[var(--text-primary-light)] hover:bg-white/[0.06]",
                      )}
                    >
                      {value ? resolveStatusLabel(t.statuses, value) : B.list.filters.all}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setStatusOpen(false); setClienteOpen(!clienteOpen); }}
                className="flex w-full lg:w-auto min-w-[140px] items-center justify-between gap-2 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-2.5 text-sm text-[var(--text-primary-light)] transition-colors hover:border-[var(--accent-primary)]/45"
              >
                <span>{clienteFilter ? (clientes.find((c: any) => c.id === clienteFilter)?.nombre ?? B.list.filters.clientFallback) : B.list.filters.clientFallback}</span>
                <ChevronDown size={14} className={cn("text-[var(--text-secondary-light)] transition-transform", clienteOpen && "rotate-180")} />
              </button>
              {clienteOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 min-w-[180px] overflow-hidden overflow-y-auto rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-lg lg:right-auto">
                  <button
                    onClick={() => { setClienteFilter(""); setClienteOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm transition-colors",
                      !clienteFilter ? "bg-white/[0.08] font-medium text-[var(--accent-primary)]" : "text-[var(--text-primary-light)] hover:bg-white/[0.06]",
                    )}
                  >
                    {B.list.filters.all}
                  </button>
                  {clientes.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteFilter(c.id); setClienteOpen(false); }}
                      className={cn(
                        "truncate w-full px-4 py-2 text-left text-sm transition-colors",
                        clienteFilter === c.id ? "bg-white/[0.08] font-medium text-[var(--accent-primary)]" : "text-[var(--text-primary-light)] hover:bg-white/[0.06]",
                      )}
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary-light)]">{B.list.heading}</h2>
              <span className="text-xs text-[var(--text-secondary-light)]">{B.list.count(facturas.length)}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
              </div>
            ) : error ? (
              <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-destructive/80 mt-1">{B.list.loadErrorNote}</p>
              </div>
            ) : facturas.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-16 text-center">
                <Receipt className="mx-auto mb-4 h-12 w-12 text-[var(--text-secondary-light)]" />
                <p className="text-sm font-medium text-[var(--text-primary-light)]">{B.list.empty.title}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary-light)]">
                  {search || statusFilter || clienteFilter ? B.list.empty.filtered : B.list.empty.default}
                </p>
                {!search && !statusFilter && !clienteFilter && (
                  <Button onClick={() => setFormOpen(true)} className="mt-4">
                    <Plus size={14} />
                    {B.newInvoice}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden overflow-hidden rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] ring-1 ring-white/[0.04] shadow-[0_4px_24px_-12px_rgba(0,0,0,0.45)] sm:block">
                  <div className="grid grid-cols-12 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-5 py-2.5">
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.invoice}</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.client}</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.project}</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.amount}</span>
                    <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.issued}</span>
                    <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.due}</span>
                    <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">{B.list.columns.status}</span>
                    <span className="col-span-1" />
                  </div>
                  {facturas.map((f: any, i: number) => {
                    const s = STATUS_STYLE[f.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
                    return (
                      <div key={f.id} className={cn("grid grid-cols-12 items-center px-5 py-4 transition-colors hover:bg-white/[0.04]", i < facturas.length - 1 && "border-b border-[var(--border-dark)]")}>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <FileText size={13} className="text-[var(--text-secondary-light)]" strokeWidth={1.75} />
                          <Link href={`/facturacion/${f.id}`} className="text-sm font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85">#{f.numero}</Link>
                        </div>
                        <span className="col-span-2 truncate text-sm text-[var(--text-primary-light)]">{f.cliente?.nombre ?? "—"}</span>
                        <span className="col-span-2 truncate text-xs text-[var(--text-secondary-light)]">{f.proyecto?.nombre ?? "—"}</span>
                        <span className="col-span-2 text-sm font-medium text-[var(--text-primary-light)]">{formatMoney(f.total, locale)}</span>
                        <span className="col-span-1 text-xs text-[var(--text-secondary-light)]">{formatDay(f.fechaEmision, locale)}</span>
                        <span className="col-span-1 text-xs text-[var(--text-secondary-light)]">{formatDay(f.fechaVencimiento, locale)}</span>
                        <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s.bg, s.text)}>
                          {resolveStatusLabel(t.statuses, f.estado)}
                        </span>
                        <div className="col-span-1 flex justify-end">
                          <Link href={`/facturacion/${f.id}`} className="flex items-center gap-0.5 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85">
                            {B.list.view} <ArrowUpRight size={11} />
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
                      <div key={f.id} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 ring-1 ring-white/[0.04]">
                        <div className="mb-1.5 flex items-center justify-between">
                          <Link href={`/facturacion/${f.id}`} className="text-sm font-semibold text-[var(--accent-primary)]">#{f.numero}</Link>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>
                            {resolveStatusLabel(t.statuses, f.estado)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[var(--text-primary-light)]">{formatMoney(f.total, locale)}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary-light)]">{f.cliente?.nombre ?? "—"} · {f.proyecto?.nombre ?? "—"}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-secondary-light)]">
                          {B.list.issuedOn(formatDay(f.fechaEmision, locale))}
                          {f.fechaVencimiento && <> · {B.list.dueOn(formatDay(f.fechaVencimiento, locale))}</>}
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
