"use client";

import { useState, useMemo } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
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
  pagada: { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  enviada: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  vencida: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  borrador: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
  cancelada: { bg: "bg-[#F1F5F9]", text: "text-[#94A3B8]" },
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
      { label: "Total billed", value: formatCurrency(totalFacturado), sub: "All invoices", icon: DollarSign, color: "text-[#3B82F6]" },
      { label: "Collected", value: formatCurrency(cobrado), sub: `${countPagadas} paid invoice${countPagadas !== 1 ? "s" : ""}`, icon: CheckCircle2, color: "text-[#22C55E]" },
      { label: "Pending", value: formatCurrency(pendiente), sub: `${countPendientes} pending invoice${countPendientes !== 1 ? "s" : ""}`, icon: Clock, color: "text-[#3B82F6]" },
      { label: "Overdue", value: formatCurrency(vencido), sub: countVencidas > 0 ? `${countVencidas} invoice${countVencidas !== 1 ? "s" : ""} — needs attention` : "No overdue invoices", icon: AlertTriangle, color: "text-[#EF4444]" },
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
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Funds</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/finanzas" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors font-medium">Finance</Link>
              <span className="text-[#E2E8F0]">/</span>
              <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Billing</h1>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus size={14} strokeWidth={2} />
              New invoice
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <Icon size={16} className={cn("mb-3", color)} strokeWidth={1.75} />
                <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#64748B]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Overdue alert */}
          {primeraVencida && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={15} className="text-[#DC2626] mt-0.5 shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold text-[#991B1B]">Overdue invoice — action required</p>
                <p className="text-xs text-[#991B1B] mt-0.5">
                  {primeraVencida.numero} for {primeraVencida.cliente?.nombre ?? "Client"} ({formatCurrency(primeraVencida.total)}) became overdue on {formatDate(primeraVencida.fechaVencimiento)}.
                </p>
              </div>
              <Link
                href={`/facturacion/${primeraVencida.id}`}
                className="shrink-0 text-xs font-medium text-[#991B1B] hover:underline"
              >
                View invoice
              </Link>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice number..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setClienteOpen(false); setStatusOpen(!statusOpen); }}
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between"
              >
                <span>{ESTADO_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "Status"}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                  {ESTADO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      onClick={() => { setStatusFilter(opt.value); setStatusOpen(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm transition-colors", statusFilter === opt.value ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}
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
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[140px] justify-between"
              >
                <span>{clienteFilter ? (clientes.find((c: any) => c.id === clienteFilter)?.nombre ?? "Client") : "Client"}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", clienteOpen && "rotate-180")} />
              </button>
              {clienteOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[180px] max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setClienteFilter(""); setClienteOpen(false); }}
                    className={cn("w-full text-left px-4 py-2 text-sm transition-colors", !clienteFilter ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}
                  >
                    All
                  </button>
                  {clientes.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteFilter(c.id); setClienteOpen(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm transition-colors truncate", clienteFilter === c.id ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}
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
              <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">All invoices</h2>
              <span className="text-xs text-[#94A3B8]">{facturas.length} invoice{facturas.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#94A3B8]" />
              </div>
            ) : error ? (
              <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444] mb-3" />
                <p className="text-sm font-medium text-[#991B1B]">{error}</p>
                <p className="text-xs text-[#B91C1C] mt-1">Invoices could not be loaded</p>
              </div>
            ) : facturas.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
                <Receipt className="mx-auto h-12 w-12 text-[#CBD5E1] mb-4" />
                <p className="text-sm font-medium text-[#334155]">No invoices yet</p>
                <p className="text-xs text-[#64748B] mt-1">
                  {search || statusFilter || clienteFilter ? "No results for the selected filters." : "Create your first invoice to get started."}
                </p>
                {!search && !statusFilter && !clienteFilter && (
                  <button
                    onClick={() => setFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors"
                  >
                    <Plus size={14} />
                    New invoice
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Invoice</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Project</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Amount</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Issued</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Due</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
                    <span className="col-span-1" />
                  </div>
                  {facturas.map((f: any, i: number) => {
                    const s = STATUS_STYLE[f.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };
                    return (
                      <div key={f.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < facturas.length - 1 && "border-b border-[#F1F5F9]")}>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <FileText size={13} className="text-[#94A3B8]" strokeWidth={1.75} />
                          <Link href={`/facturacion/${f.id}`} className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors">#{f.numero}</Link>
                        </div>
                        <span className="col-span-2 text-sm text-[#334155] truncate">{f.cliente?.nombre ?? "—"}</span>
                        <span className="col-span-2 text-xs text-[#64748B] truncate">{f.proyecto?.nombre ?? "—"}</span>
                        <span className="col-span-2 text-sm font-medium text-[#0F172A]">{formatCurrency(f.total)}</span>
                        <span className="col-span-1 text-xs text-[#64748B]">{formatDate(f.fechaEmision)}</span>
                        <span className="col-span-1 text-xs text-[#64748B]">{formatDate(f.fechaVencimiento)}</span>
                        <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s.bg, s.text)}>
                          {displayLabel(f.estado, estadoLabel)}
                        </span>
                        <div className="col-span-1 flex justify-end">
                          <Link href={`/facturacion/${f.id}`} className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors flex items-center gap-0.5">
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
                    const s = STATUS_STYLE[f.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };
                    return (
                      <div key={f.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <Link href={`/facturacion/${f.id}`} className="text-sm font-semibold text-[#3B82F6]">#{f.numero}</Link>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>
                            {displayLabel(f.estado, estadoLabel)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[#0F172A]">{formatCurrency(f.total)}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">{f.cliente?.nombre ?? "—"} · {f.proyecto?.nombre ?? "—"}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
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

      <CopilotPanel defaultContext="Funds" />

      <FacturaForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} />
    </div>
  );
}
