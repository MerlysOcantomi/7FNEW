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
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Mail,
  FolderKanban,
  Loader2,
  UserCircle,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { ClienteForm } from "@/components/forms/cliente-form";
import { displayLabel, estadoLabel } from "@/lib/api-client";

// API estado: activo, inactivo, prospecto
const ESTADO_OPTIONS = [
  { value: "", label: "All" },
  { value: "activo", label: "Active" },
  { value: "inactivo", label: "Inactive" },
  { value: "prospecto", label: "Prospect" },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  activo: { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  inactivo: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
  prospecto: { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function RowActions({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#334155] transition-colors"
        aria-label="Client actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[170px]">
            <Link
              href={`/clientes/${clientId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors"
            >
              <ArrowUpRight size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
              View client
            </Link>
            <Link
              href="/proyectos"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors"
            >
              <FolderKanban size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
              New project
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (statusFilter) query.set("estado", statusFilter);
  query.set("pageSize", "100");
  const qs = query.toString();
  const url = qs ? `/api/clientes?${qs}` : "/api/clientes";

  const { data: apiData, loading, error, refetch } = useFetch<any>(url, { refreshKey });
  const clientes = Array.isArray(apiData) ? apiData : [];

  const overview = useMemo(() => {
    const activos = clientes.filter((c: any) => c.estado === "activo").length;
    const inactivos = clientes.filter((c: any) => c.estado === "inactivo").length;
    const prospectos = clientes.filter((c: any) => c.estado === "prospecto").length;
    return [
      { label: "Total", value: String(clientes.length), sub: "Clients", icon: Users, color: "text-[#3B82F6]" },
      { label: "Active", value: String(activos), sub: "With activity", icon: CheckCircle2, color: "text-[#22C55E]" },
      { label: "Prospects", value: String(prospectos), sub: "To convert", icon: AlertTriangle, color: "text-[#F59E0B]" },
      { label: "Inactive", value: String(inactivos), sub: "No activity", icon: Clock, color: "text-[#94A3B8]" },
    ];
  }, [clientes]);

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
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Core</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Clients</h1>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus size={14} strokeWidth={2} />
              New client
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-7 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <Icon size={16} className={cn("mb-3", color)} strokeWidth={1.75} />
                <p className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#64748B]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients, company, or email..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between"
              >
                <span>{ESTADO_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "Status"}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
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
          </div>

          {/* Client List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">All clients</h2>
              <span className="text-xs text-[#94A3B8]">{clientes.length} client{clientes.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#94A3B8]" />
              </div>
            ) : error ? (
              <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444] mb-3" />
                <p className="text-sm font-medium text-[#991B1B]">{error}</p>
                <p className="text-xs text-[#B91C1C] mt-1">Clients could not be loaded</p>
              </div>
            ) : clientes.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
                <UserCircle className="mx-auto h-12 w-12 text-[#CBD5E1] mb-4" />
                <p className="text-sm font-medium text-[#334155]">No clients yet</p>
                <p className="text-xs text-[#64748B] mt-1">
                  {search || statusFilter ? "No results for the selected filters." : "Create your first client to get started."}
                </p>
                {!search && !statusFilter && (
                  <button
                    onClick={() => setFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors"
                  >
                    <Plus size={14} />
                    New client
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Company</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Contact</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Projects</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Updated</span>
                    <span className="col-span-1" />
                  </div>
                  {clientes.map((c: any, i: number) => {
                    const s = STATUS_STYLE[c.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };
                    const count = c._count ?? {};
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors",
                          i < clientes.length - 1 && "border-b border-[#F1F5F9]"
                        )}
                      >
                        <div className="col-span-3 flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#DBEAFE] flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-bold text-[#2563EB]">{getInitials(c.nombre)}</span>
                          </div>
                          <div className="min-w-0">
                            <Link href={`/clientes/${c.id}`} className="text-sm font-medium text-[#0F172A] hover:text-[#3B82F6] transition-colors truncate block">
                              {c.nombre}
                            </Link>
                            {c.empresa && (
                              <p className="text-[10px] text-[#64748B] truncate">{c.empresa}</p>
                            )}
                          </div>
                        </div>
                        <span className="col-span-2 text-sm text-[#64748B] truncate">{c.empresa || "—"}</span>
                        <div className="col-span-2 text-sm text-[#64748B] truncate">
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="hover:text-[#3B82F6] truncate block">{c.email}</a>
                          ) : (
                            c.telefono || "—"
                          )}
                        </div>
                        <div className="col-span-1">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>
                            {displayLabel(c.estado, estadoLabel)}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <FolderKanban size={13} className="text-[#94A3B8]" strokeWidth={1.75} />
                          <span className="text-sm text-[#334155]">{count.proyectos ?? 0} proyecto{(count.proyectos ?? 0) !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="col-span-1 text-xs text-[#64748B]">{formatDate(c.updatedAt)}</span>
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <Link
                            href={`/clientes/${c.id}`}
                            className="flex items-center gap-0.5 text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
                          >
                            Ver <ArrowUpRight size={11} />
                          </Link>
                          <RowActions clientId={c.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {clientes.map((c: any) => {
                    const s = STATUS_STYLE[c.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };
                    const count = c._count ?? {};
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-[#DBEAFE] flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-[#2563EB]">{getInitials(c.nombre)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#0F172A] truncate">{c.nombre}</p>
                              <p className="text-xs text-[#64748B]">{c.empresa || c.email || "—"}</p>
                            </div>
                          </div>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", s.bg, s.text)}>
                            {displayLabel(c.estado, estadoLabel)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#F1F5F9]">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-[#64748B]">{count.proyectos ?? 0} proyecto{(count.proyectos ?? 0) !== 1 ? "s" : ""}</span>
                            <span className="text-[10px] text-[#94A3B8]">Updated {formatDate(c.updatedAt)}</span>
                          </div>
                          <Link
                            href={`/clientes/${c.id}`}
                            className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors shrink-0"
                          >
                            Ver <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <CopilotPanel defaultContext="Clients" />

      <ClienteForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} />
    </div>
  );
}
