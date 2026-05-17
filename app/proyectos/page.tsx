"use client";

import { useState, useMemo } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
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
  planificacion: { bg: "bg-[var(--status-info-bg)]", text: "text-[var(--status-info-text)]" },
  en_progreso: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  revision: { bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning-text)]" },
  completado: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  cancelado: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <div className="h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const s = STATUS_STYLE[estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
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
      { label: "In progress", value: String(enProgreso), sub: "Active", icon: Briefcase, iconClass: "text-primary" },
      { label: "In review", value: String(revision), sub: "Need attention", icon: AlertTriangle, iconClass: "text-[var(--status-warning-text)]" },
      { label: "Overdue", value: String(vencidos), sub: "Past due date", icon: Clock, iconClass: "text-destructive" },
      { label: "Completed", value: String(completado), sub: "Finished", icon: CheckCircle2, iconClass: "text-[var(--status-success-text)]" },
    ];
  }, [proyectos]);

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--app-shell-bg)] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader
          eyebrow="Core"
          title="Projects"
          tone="canvas"
          actions={
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} strokeWidth={2} />
              New project
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

          {/* Search + Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary-light)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects or clients..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] focus:outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
              />
            </div>
            <div className="relative w-full lg:w-auto">
              <button
                onClick={() => { setStatusOpen(!statusOpen); setPriorityOpen(false); }}
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-sm text-[var(--text-primary-light)] hover:border-[var(--accent-primary)]/45 transition-colors min-w-[130px] justify-between"
              >
                <span>{ESTADO_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "Status"}</span>
                <ChevronDown size={14} className={cn("text-[var(--text-secondary-light)] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-lg overflow-hidden min-w-[130px]">
                  {ESTADO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      onClick={() => { setStatusFilter(opt.value); setStatusOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm transition-colors",
                        statusFilter === opt.value
                          ? "bg-white/[0.08] font-medium text-[var(--accent-primary)]"
                          : "text-[var(--text-primary-light)] hover:bg-white/[0.06]",
                      )}
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
                className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-sm text-[var(--text-primary-light)] hover:border-[var(--accent-primary)]/45 transition-colors min-w-[130px] justify-between"
              >
                <span>{PRIORIDAD_OPTIONS.find((o) => o.value === priorityFilter)?.label ?? "Priority"}</span>
                <ChevronDown size={14} className={cn("text-[var(--text-secondary-light)] transition-transform", priorityOpen && "rotate-180")} />
              </button>
              {priorityOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-lg overflow-hidden min-w-[130px]">
                  {PRIORIDAD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value || "all"}
                      onClick={() => { setPriorityFilter(opt.value); setPriorityOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm transition-colors",
                        priorityFilter === opt.value
                          ? "bg-white/[0.08] font-medium text-[var(--accent-primary)]"
                          : "text-[var(--text-primary-light)] hover:bg-white/[0.06]",
                      )}
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-widest">All projects</h2>
              <span className="text-xs text-[var(--text-secondary-light)]">{proyectos.length} project{proyectos.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
              </div>
            ) : error ? (
              <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-destructive/80 mt-1">Projects could not be loaded</p>
              </div>
            ) : proyectos.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-16 text-center">
                <FolderKanban className="mx-auto h-12 w-12 text-[var(--text-secondary-light)] mb-4" />
                <p className="text-sm font-medium text-[var(--text-primary-light)]">No projects yet</p>
                <p className="text-xs text-[var(--text-secondary-light)] mt-1">
                  {search || statusFilter || priorityFilter ? "No results for the selected filters." : "Create your first project to get started."}
                </p>
                {!search && !statusFilter && !priorityFilter && (
                  <Button onClick={() => setFormOpen(true)} className="mt-4">
                    <Plus size={14} />
                    New project
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block overflow-hidden rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] ring-1 ring-white/[0.04] shadow-[0_4px_24px_-12px_rgba(0,0,0,0.45)]">
                  <div className="grid grid-cols-12 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-5 py-2.5">
                    <span className="col-span-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Project</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Client</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Status</span>
                    <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Progress</span>
                    <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Due date</span>
                    <span className="col-span-1" />
                  </div>
                  {proyectos.map((p: any, i: number) => (
                    <div key={p.id} className={cn("grid grid-cols-12 items-center px-5 py-4 transition-colors hover:bg-white/[0.04]", i < proyectos.length - 1 && "border-b border-[var(--border-dark)]")}>
                      <div className="col-span-4 min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary-light)]">{p.nombre}</p>
                        <p className="text-[10px] text-[var(--text-secondary-light)]">{p.tags || displayLabel(p.prioridad, prioridadLabel)}</p>
                      </div>
                      <span className="col-span-2 truncate text-sm text-[var(--text-secondary-light)]">{p.cliente?.nombre ?? "—"}</span>
                      <div className="col-span-2"><StatusBadge estado={p.estado} /></div>
                      <div className="col-span-2 pr-4">
                        <ProgressBar value={p.progreso ?? 0} />
                        <p className="mt-1 text-[10px] text-[var(--text-secondary-light)]">{p.progreso ?? 0}%</p>
                      </div>
                      <span className="col-span-1 whitespace-nowrap text-xs text-[var(--text-secondary-light)]">{formatDate(p.fechaFin)}</span>
                      <div className="col-span-1 flex justify-end">
                        <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85">
                          View <ArrowUpRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {proyectos.map((p: any) => (
                    <div key={p.id} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 ring-1 ring-white/[0.04]">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary-light)]">{p.nombre}</p>
                          <p className="text-xs text-[var(--text-secondary-light)]">{p.cliente?.nombre ?? "—"} · {displayLabel(p.prioridad, prioridadLabel)}</p>
                        </div>
                        <StatusBadge estado={p.estado} />
                      </div>
                      <div className="mb-3">
                        <ProgressBar value={p.progreso ?? 0} />
                        <p className="mt-1 text-[10px] text-[var(--text-secondary-light)]">{p.progreso ?? 0}% · Due {formatDate(p.fechaFin)}</p>
                      </div>
                      <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85">
                        View project <ArrowUpRight size={11} />
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

      <LegacyTodayChrome />

      <ProyectoForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} />
    </div>
  );
}
