"use client";

import { useState, useMemo } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import {
  Search,
  ChevronDown,
  Plus,
  ArrowUpRight,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Loader2,
  FolderKanban,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFetch } from "@/hooks/use-fetch";
import { ProyectoForm } from "@/components/forms/proyecto-form";
import { displayLabel, estadoLabel, prioridadLabel } from "@/lib/api-client";

// API estado: planificacion, en_progreso, revision, completado, cancelado
// API prioridad: baja, media, alta, urgente

const ESTADO_OPTIONS = [
  { value: "", label: "All" },
  { value: "planificacion", label: "Planning" },
  { value: "en_progreso", label: "In progress" },
  { value: "revision", label: "In review" },
  { value: "completado", label: "Completed" },
  { value: "cancelado", label: "Canceled" },
];

const PRIORIDAD_OPTIONS = [
  { value: "", label: "All" },
  { value: "urgente", label: "Urgent" },
  { value: "alta", label: "High" },
  { value: "media", label: "Medium" },
  { value: "baja", label: "Low" },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  planificacion: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  en_progreso: { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  revision: { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  completado: { bg: "bg-[#F0FDF4]", text: "text-[#166534]" },
  cancelado: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const s = STATUS_STYLE[estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };
  const label = displayLabel(estado, estadoLabel) || estado;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", s.bg, s.text)}>
      {label}
    </span>
  );
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function ProyectosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (statusFilter) query.set("estado", statusFilter);
  if (priorityFilter) query.set("prioridad", priorityFilter);
  query.set("pageSize", "100");
  const qs = query.toString();
  const url = qs ? `/api/proyectos?${qs}` : "/api/proyectos";

  const { data: apiData, loading, error, refetch } = useFetch<any>(url, { refreshKey });
  const proyectos = Array.isArray(apiData) ? apiData : [];

  const overview = useMemo(() => {
    const enProgreso = proyectos.filter((p: any) => p.estado === "en_progreso").length;
    const revision = proyectos.filter((p: any) => p.estado === "revision").length;
    const completado = proyectos.filter((p: any) => p.estado === "completado").length;
    const hoy = new Date();
    const vencidos = proyectos.filter((p: any) => {
      if (!p.fechaFin || p.estado === "completado") return false;
      return new Date(p.fechaFin) < hoy;
    }).length;
    return [
      { label: "In progress", value: String(enProgreso), sub: "Active", icon: Briefcase, color: "text-[#3B82F6]" },
      { label: "In review", value: String(revision), sub: "Need attention", icon: AlertTriangle, color: "text-[#F59E0B]" },
      { label: "Overdue", value: String(vencidos), sub: "Past due date", icon: Clock, color: "text-[#EF4444]" },
      { label: "Completed", value: String(completado), sub: "Finished", icon: CheckCircle2, color: "text-[#22C55E]" },
    ];
  }, [proyectos]);

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Flow</p>
              <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Projects</h1>
            </div>
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto"
            >
              <Plus size={14} strokeWidth={2} />
              New project
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {overview.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <Icon size={16} className={cn("mb-3", color)} strokeWidth={1.75} />
                <p className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#64748B]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects or clients..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setStatusOpen(!statusOpen); setPriorityOpen(false); }}
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
                onClick={() => { setPriorityOpen(!priorityOpen); setStatusOpen(false); }}
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between"
              >
                <span>{PRIORIDAD_OPTIONS.find((o) => o.value === priorityFilter)?.label ?? "Priority"}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", priorityOpen && "rotate-180")} />
              </button>
              {priorityOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                  {PRIORIDAD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      onClick={() => { setPriorityFilter(opt.value); setPriorityOpen(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm transition-colors", priorityFilter === opt.value ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Projects List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">All projects</h2>
              <span className="text-xs text-[#94A3B8]">{proyectos.length} project{proyectos.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#94A3B8]" />
              </div>
            ) : error ? (
              <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444] mb-3" />
                <p className="text-sm font-medium text-[#991B1B]">{error}</p>
                <p className="text-xs text-[#B91C1C] mt-1">Projects could not be loaded</p>
              </div>
            ) : proyectos.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
                <FolderKanban className="mx-auto h-12 w-12 text-[#CBD5E1] mb-4" />
                <p className="text-sm font-medium text-[#334155]">No projects yet</p>
                <p className="text-xs text-[#64748B] mt-1">
                  {search || statusFilter || priorityFilter ? "No results for the selected filters." : "Create your first project to get started."}
                </p>
                {!search && !statusFilter && !priorityFilter && (
                  <button
                    onClick={() => setFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors"
                  >
                    <Plus size={14} />
                    New project
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    <span className="col-span-4 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Project</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Progress</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Due date</span>
                    <span className="col-span-1" />
                  </div>
                  {proyectos.map((p: any, i: number) => (
                    <div key={p.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < proyectos.length - 1 && "border-b border-[#F1F5F9]")}>
                      <div className="col-span-4 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{p.nombre}</p>
                        <p className="text-[10px] text-[#64748B]">{p.tags || displayLabel(p.prioridad, prioridadLabel)}</p>
                      </div>
                      <span className="col-span-2 text-sm text-[#64748B] truncate">{p.cliente?.nombre ?? "—"}</span>
                      <div className="col-span-2"><StatusBadge estado={p.estado} /></div>
                      <div className="col-span-2 pr-4">
                        <ProgressBar value={p.progreso ?? 0} />
                        <p className="text-[10px] text-[#94A3B8] mt-1">{p.progreso ?? 0}%</p>
                      </div>
                      <span className="col-span-1 text-xs text-[#64748B] whitespace-nowrap">{formatDate(p.fechaFin)}</span>
                      <div className="col-span-1 flex justify-end">
                        <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
                          Ver <ArrowUpRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {proyectos.map((p: any) => (
                    <div key={p.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">{p.nombre}</p>
                          <p className="text-xs text-[#64748B]">{p.cliente?.nombre ?? "—"} · {displayLabel(p.prioridad, prioridadLabel)}</p>
                        </div>
                        <StatusBadge estado={p.estado} />
                      </div>
                      <div className="mb-3">
                        <ProgressBar value={p.progreso ?? 0} />
                        <p className="text-[10px] text-[#94A3B8] mt-1">{p.progreso ?? 0}% · Vence {formatDate(p.fechaFin)}</p>
                      </div>
                      <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
                        Ver proyecto <ArrowUpRight size={11} />
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <CopilotPanel defaultContext="Projects" />

      <ProyectoForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} />
    </div>
  );
}
