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

const ESTADO_OPTIONS = [
  { value: "", label: "All" },
  { value: "activo", label: "Active" },
  { value: "inactivo", label: "Inactive" },
  { value: "prospecto", label: "Prospect" },
];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  activo: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  inactivo: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
  prospecto: { bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning-text)]" },
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
        className="p-1.5 rounded-md text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary-light)]"
        aria-label="Client actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-lg overflow-hidden min-w-[170px]">
            <Link
              href={`/clientes/${clientId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-primary-light)] hover:bg-white/[0.06] transition-colors"
            >
              <ArrowUpRight size={13} strokeWidth={1.75} className="text-[var(--text-secondary-light)]" />
              View client
            </Link>
            <Link
              href="/proyectos"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-primary-light)] hover:bg-white/[0.06] transition-colors"
            >
              <FolderKanban size={13} strokeWidth={1.75} className="text-[var(--text-secondary-light)]" />
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
      { label: "Total", value: String(clientes.length), sub: "Clients", icon: Users, iconClass: "text-primary" },
      { label: "Active", value: String(activos), sub: "With activity", icon: CheckCircle2, iconClass: "text-[var(--status-success-text)]" },
      { label: "Prospects", value: String(prospectos), sub: "To convert", icon: AlertTriangle, iconClass: "text-[var(--status-warning-text)]" },
      { label: "Inactive", value: String(inactivos), sub: "No activity", icon: Clock, iconClass: "text-muted-foreground" },
    ];
  }, [clientes]);

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
          title="Clients"
          tone="canvas"
          actions={
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={14} strokeWidth={2} />
              New client
            </Button>
          }
        />

        <div className="px-5 md:px-8 py-7 space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary-light)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients, company, or email..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-sm text-[var(--text-primary-light)] placeholder:text-[var(--text-secondary-light)] focus:outline-none focus:border-[var(--accent-primary)]/50 transition-colors"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-sm text-[var(--text-primary-light)] hover:border-[var(--accent-primary)]/45 transition-colors min-w-[130px] justify-between"
              >
                <span>{ESTADO_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "Status"}</span>
                <ChevronDown size={14} className={cn("text-[var(--text-secondary-light)] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 mt-1 z-30 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-lg overflow-hidden min-w-[130px]">
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
          </div>

          {/* Client List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-widest">All clients</h2>
              <span className="text-xs text-[var(--text-secondary-light)]">{clientes.length} client{clientes.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
              </div>
            ) : error ? (
              <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-8 text-center">
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
                <p className="text-sm font-medium text-destructive">{error}</p>
                <p className="text-xs text-destructive/80 mt-1">Clients could not be loaded</p>
              </div>
            ) : clientes.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-16 text-center">
                <UserCircle className="mx-auto h-12 w-12 text-[var(--text-secondary-light)] mb-4" />
                <p className="text-sm font-medium text-[var(--text-primary-light)]">No clients yet</p>
                <p className="text-xs text-[var(--text-secondary-light)] mt-1">
                  {search || statusFilter ? "No results for the selected filters." : "Create your first client to get started."}
                </p>
                {!search && !statusFilter && (
                  <Button onClick={() => setFormOpen(true)} className="mt-4">
                    <Plus size={14} />
                    New client
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop list */}
                <div className="hidden sm:block rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] overflow-hidden ring-1 ring-white/[0.04] shadow-[0_4px_24px_-12px_rgba(0,0,0,0.45)]">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]">
                    <span className="col-span-3 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Client</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Company</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Contact</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Status</span>
                    <span className="col-span-2 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Projects</span>
                    <span className="col-span-1 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Updated</span>
                    <span className="col-span-1" />
                  </div>
                  {clientes.map((c: any, i: number) => {
                    const s = STATUS_STYLE[c.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
                    const count = c._count ?? {};
                    return (
                      <div
                        key={c.id}
                        className={cn(
                          "grid grid-cols-12 items-center px-5 py-4 transition-colors hover:bg-white/[0.04]",
                          i < clientes.length - 1 && "border-b border-[var(--border-dark)]",
                        )}
                      >
                        <div className="col-span-3 flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08]">
                            <span className="text-[11px] font-bold text-[var(--accent-primary)]">{getInitials(c.nombre)}</span>
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/clientes/${c.id}`}
                              className="block truncate text-sm font-medium text-[var(--text-primary-light)] transition-colors hover:text-[var(--accent-primary)]"
                            >
                              {c.nombre}
                            </Link>
                            {c.empresa && (
                              <p className="truncate text-[10px] text-[var(--text-secondary-light)]">{c.empresa}</p>
                            )}
                          </div>
                        </div>
                        <span className="col-span-2 truncate text-sm text-[var(--text-secondary-light)]">{c.empresa || "—"}</span>
                        <div className="col-span-2 truncate text-sm text-[var(--text-secondary-light)]">
                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="block truncate hover:text-[var(--accent-primary)]">{c.email}</a>
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
                          <FolderKanban size={13} className="text-[var(--text-secondary-light)]" strokeWidth={1.75} />
                          <span className="text-sm text-[var(--text-primary-light)]">{count.proyectos ?? 0} {(count.proyectos ?? 0) !== 1 ? "projects" : "project"}</span>
                        </div>
                        <span className="col-span-1 text-xs text-[var(--text-secondary-light)]">{formatDate(c.updatedAt)}</span>
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <Link
                            href={`/clientes/${c.id}`}
                            className="flex items-center gap-0.5 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85"
                          >
                            View <ArrowUpRight size={11} />
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
                    const s = STATUS_STYLE[c.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
                    const count = c._count ?? {};
                    return (
                      <div key={c.id} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 ring-1 ring-white/[0.04]">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.08]">
                              <span className="text-xs font-bold text-[var(--accent-primary)]">{getInitials(c.nombre)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary-light)]">{c.nombre}</p>
                              <p className="text-xs text-[var(--text-secondary-light)]">{c.empresa || c.email || "—"}</p>
                            </div>
                          </div>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", s.bg, s.text)}>
                            {displayLabel(c.estado, estadoLabel)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-dark)] pt-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-[var(--text-secondary-light)]">{count.proyectos ?? 0} {(count.proyectos ?? 0) !== 1 ? "projects" : "project"}</span>
                            <span className="text-[10px] text-[var(--text-secondary-light)]">Updated {formatDate(c.updatedAt)}</span>
                          </div>
                          <Link
                            href={`/clientes/${c.id}`}
                            className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85"
                          >
                            View <ArrowUpRight size={11} />
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

      <LegacyTodayChrome />

      <ClienteForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} />
    </div>
  );
}
