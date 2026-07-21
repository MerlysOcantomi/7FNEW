"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Building2,
  User,
  DollarSign,
  CheckCircle2,
  Clock,
  FileBarChart,
  Plus,
  Pencil,
  ArrowUpRight,
  Paperclip,
  Download,
  Loader2,
  AlertTriangle,
  StickyNote,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { ProyectoForm } from "@/components/forms/proyecto-form";
import { ActivityTimeline } from "@/components/activity-timeline";
import { useI18n } from "@/components/i18n-provider";
import { useClientsNouns, capNoun } from "@/hooks/use-clients-nouns";
import { resolveStatusLabel } from "@core/i18n/ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  planificacion: { bg: "bg-[var(--status-info-bg)]", text: "text-[var(--status-info-text)]" },
  en_progreso: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  revision: { bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning-text)]" },
  completado: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  cancelado: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
};

const TAREA_ESTADO_STYLE: Record<string, string> = {
  pendiente: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  en_progreso: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  revision: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  completada: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  cancelada: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
};

const FACTURA_ESTADO_STYLE: Record<string, string> = {
  borrador: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  enviada: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  pagada: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  vencida: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

const FIN_VARIANT: Record<"neutral" | "positive" | "warning", string> = {
  neutral: "text-foreground",
  positive: "text-[var(--status-success-text)]",
  warning: "text-[var(--status-warning-text)]",
};

const FIN_BG: Record<"neutral" | "positive" | "warning", string> = {
  neutral: "bg-accent",
  positive: "bg-[var(--status-success-bg)]",
  warning: "bg-[var(--status-warning-bg)]",
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es", { style: "currency", currency: "CHF" }).format(value);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{children}</h3>;
}

// ── Tab content panels ────────────────────────────────────────────────────────

function TabResumen({ project }: { project: any }) {
  const { t } = useI18n();
  const statusStyle = STATUS_STYLE[project.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };
  const tareas = project.tareas ?? [];
  const completadas = tareas.filter((t: any) => t.estado === "completada").length;
  const totalTareas = tareas.length;
  const diasRestantes = project.fechaFin
    ? Math.ceil((new Date(project.fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const keyMetrics = [
    { label: "Completed tasks", value: `${completadas} / ${totalTareas}` },
    { label: "Progreso", value: `${project.progreso ?? 0}%` },
    { label: "Presupuesto", value: project.presupuesto != null ? formatCurrency(project.presupuesto) : "—" },
    { label: "Days remaining", value: diasRestantes != null ? (diasRestantes > 0 ? String(diasRestantes) : "Overdue") : "—" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {keyMetrics.map(({ label, value }) => (
          <div key={label} className="bg-accent rounded-xl p-4">
            <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <SectionLabel>Project description</SectionLabel>
          <p className="text-sm text-foreground leading-relaxed">{project.descripcion || "No description."}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Responsable", value: project.assignedTo || "—" },
              { label: "Inicio", value: formatDate(project.fechaInicio) },
              { label: "Vencimiento", value: formatDate(project.fechaFin) },
              { label: "Prioridad", value: resolveStatusLabel(t.statuses, project.prioridad) },
              { label: "Estado", value: resolveStatusLabel(t.statuses, project.estado) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                <p className="text-xs font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-primary/15 rounded-xl p-4">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Progreso general</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-foreground">{project.progreso ?? 0}%</span>
            </div>
            <ProgressBar value={project.progreso ?? 0} />
          </div>
          <div className={cn("rounded-xl p-4", statusStyle.bg)}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Estado</p>
            <span className={cn("text-sm font-semibold", statusStyle.text)}>{resolveStatusLabel(t.statuses, project.estado)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabTareas({ project }: { project: any }) {
  const { t: ui } = useI18n();
  const tareas = project.tareas ?? [];

  if (tareas.length === 0) {
    return (
      <div className="space-y-5">
        <SectionLabel>Project tasks</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No tasks in this project</p>
          <p className="text-xs text-muted-foreground mt-1">Las tareas vinculadas a este proyecto aparecerán aquí</p>
          <Link href="/tareas" className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80">
            Go to tasks <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Project tasks</SectionLabel>
        <Button asChild size="sm">
          <Link href="/tareas">
            <Plus size={12} strokeWidth={2.5} />
            Nueva tarea
          </Link>
        </Button>
      </div>

      <div className="hidden sm:block bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-muted bg-background">
          <span className="col-span-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tarea</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vencimiento</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prioridad</span>
          <span className="col-span-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</span>
        </div>
        {tareas.map((t: any, i: number) => (
          <Link
            key={t.id}
            href={`/tareas/${t.id}`}
            className={cn("grid grid-cols-12 items-center px-5 py-3.5 hover:bg-background transition-colors", i < tareas.length - 1 && "border-b border-muted")}
          >
            <span className="col-span-5 text-sm text-foreground pr-3 truncate">{t.titulo}</span>
            <span className="col-span-2 text-xs text-muted-foreground">{t.usuario?.nombre ?? "—"}</span>
            <span className="col-span-2 text-xs text-muted-foreground">{formatDate(t.fechaLimite)}</span>
            <span className="col-span-2 text-xs text-muted-foreground">{resolveStatusLabel(ui.statuses, t.prioridad)}</span>
            <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", TAREA_ESTADO_STYLE[t.estado] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]")}>
              {resolveStatusLabel(ui.statuses, t.estado)}
            </span>
          </Link>
        ))}
      </div>

      <div className="sm:hidden space-y-3">
        {tareas.map((t: any) => (
          <Link key={t.id} href={`/tareas/${t.id}`} className="block bg-card rounded-xl border border-border p-4 hover:bg-background">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-foreground leading-snug">{t.titulo}</p>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", TAREA_ESTADO_STYLE[t.estado] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]")}>
                {resolveStatusLabel(ui.statuses, t.estado)}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
              <span>{t.usuario?.nombre ?? "—"}</span>
              <span>·</span>
              <span>Vence {formatDate(t.fechaLimite)}</span>
              <span>·</span>
              <span>{resolveStatusLabel(ui.statuses, t.prioridad)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TabHitos({ project }: { project: any }) {
  return (
    <div className="space-y-3">
      <SectionLabel>Cronograma de hitos</SectionLabel>
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Los hitos no están disponibles aún</p>
        <p className="text-xs text-muted-foreground mt-1">Esta funcionalidad se implementará en una futura versión</p>
      </div>
    </div>
  );
}

function TabArchivos({ project }: { project: any }) {
  const documentos = project.documentos ?? [];
  const typeColors: Record<string, string> = {
    pdf: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
    PDF: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
    xlsx: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
    doc: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
    image: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  };

  if (documentos.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>Project files</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Paperclip className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No files in this project</p>
          <p className="text-xs text-muted-foreground mt-1">Los documentos vinculados al proyecto aparecerán aquí</p>
          <Link href="/archivos" className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80">
            Go to files <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Project files</SectionLabel>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {documentos.map((d: any, i: number) => (
          <div
            key={d.id}
            className={cn("flex items-center gap-4 px-5 py-4 hover:bg-background transition-colors", i < documentos.length - 1 && "border-b border-muted")}
          >
            <Paperclip size={14} className="text-muted-foreground shrink-0" strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{d.nombre}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{d.tipo} · {(d.tamano ? d.tamano / 1024 : 0).toFixed(1)} KB</p>
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", typeColors[d.tipo] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]")}>
              {d.tipo}
            </span>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              aria-label="Descargar"
            >
              <Download size={13} strokeWidth={1.75} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabFinanzas({ project }: { project: any }) {
  const { t } = useI18n();
  const facturas = project.facturas ?? [];
  const transacciones = project.transacciones ?? [];
  const presupuesto = project.presupuesto;
  const totalFacturado = facturas.reduce((sum: number, f: any) => sum + (f.total ?? 0), 0);
  const totalTransacciones = transacciones.reduce((sum: number, t: any) => sum + (t.monto ?? 0) * (t.tipo === "ingreso" ? 1 : -1), 0);

  const hasData = facturas.length > 0 || transacciones.length > 0 || presupuesto != null;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <SectionLabel>Project finance</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No financial data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Las facturas y transacciones vinculadas aparecerán aquí</p>
          <Link href="/finanzas" className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80">
            Open finance <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  const financialItems = [
    presupuesto != null && { label: "Presupuesto", value: formatCurrency(presupuesto), variant: "neutral" as const },
    facturas.length > 0 && { label: "Total billed", value: formatCurrency(totalFacturado), variant: "neutral" as const },
    transacciones.length > 0 && { label: "Transacciones", value: formatCurrency(totalTransacciones), variant: totalTransacciones >= 0 ? "positive" as const : "warning" as const },
  ].filter(Boolean) as { label: string; value: string; variant: "neutral" | "positive" | "warning" }[];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {financialItems.map(({ label, value, variant }) => (
          <div key={label} className={cn("rounded-xl p-4", FIN_BG[variant])}>
            <p className={cn("text-base font-bold tracking-tight", FIN_VARIANT[variant])}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {facturas.length > 0 && (
        <div>
          <SectionLabel>Facturas</SectionLabel>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {facturas.slice(0, 5).map((f: any) => (
              <Link
                key={f.id}
                href={`/facturacion/${f.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-background border-b border-muted last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">#{f.numero}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(f.fechaEmision)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(f.total)}</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", FACTURA_ESTADO_STYLE[f.estado] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]")}>
                    {resolveStatusLabel(t.statuses, f.estado)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Link href="/finanzas" className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors">
          Open finance <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function TabNotas({ project }: { project: any }) {
  const notas = project.notas ?? [];

  if (notas.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>Project notes</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <StickyNote className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No notes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Las notas vinculadas al proyecto aparecerán aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Project notes</SectionLabel>
      <div className="space-y-3">
        {notas.map((n: any) => (
          <div key={n.id} className="bg-card rounded-xl border border-border p-5">
            <p className="text-xs font-semibold text-foreground mb-1">{n.titulo}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{n.contenido || "—"}</p>
            <p className="text-[10px] text-muted-foreground mt-2">{formatDate(n.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen", label: "Summary" },
  { key: "tareas", label: "Tasks" },
  { key: "hitos", label: "Milestones" },
  { key: "archivos", label: "Files" },
  { key: "finanzas", label: "Finance" },
  { key: "notas", label: "Notes" },
  { key: "actividad", label: "Activity" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const nouns = useClientsNouns();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: project, loading, error, refetch } = useFetch<any>(id ? `/api/proyectos/${id}` : null, { refreshKey });

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
  }

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">Invalid project ID</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !project || project.error) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-sm font-medium text-destructive">{error || "Project not found"}</p>
          <Link href="/proyectos" className="mt-4 text-sm text-primary hover:text-primary/80 font-medium">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[project.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };

  return (
    <>
      <ContextShell
        breadcrumbs={[
          { label: t.clients.detail.breadcrumbRoot, href: "/" },
          { label: capNoun(nouns.projects), href: "/proyectos" },
          { label: project.nombre },
        ]}
        heading={
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground tracking-tight text-balance">{project.nombre}</h1>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
              {resolveStatusLabel(t.statuses, project.estado)}
            </span>
            <span className="text-xs text-muted-foreground font-medium">{resolveStatusLabel(t.statuses, project.prioridad)}</span>
          </div>
        }
        meta={
          <div className="flex items-center gap-4 flex-wrap">
            {project.clienteId && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 size={13} strokeWidth={1.75} className="text-muted-foreground" />
                <Link href={`/clientes/${project.clienteId}`} className="hover:text-primary transition-colors">
                  {project.cliente?.nombre ?? "Client"}
                </Link>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar size={13} strokeWidth={1.75} className="text-muted-foreground" />
              Vence {formatDate(project.fechaFin)}
            </span>
            {project.assignedTo && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User size={13} strokeWidth={1.75} className="text-muted-foreground" />
                {project.assignedTo}
              </span>
            )}
          </div>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={13} strokeWidth={1.75} />
              Actualizar
            </Button>
            <Button asChild size="sm">
              <Link href="/finanzas">
                <FileBarChart size={13} strokeWidth={1.75} />
                Ver finanzas
              </Link>
            </Button>
          </>
        }
        tabs={TABS}
        defaultTab="resumen"
        copilotContext="Projects"
      >
        {(activeTab) => {
          if (activeTab === "resumen") return <TabResumen project={project} />;
          if (activeTab === "tareas") return <TabTareas project={project} />;
          if (activeTab === "hitos") return <TabHitos project={project} />;
          if (activeTab === "archivos") return <TabArchivos project={project} />;
          if (activeTab === "finanzas") return <TabFinanzas project={project} />;
          if (activeTab === "notas") return <TabNotas project={project} />;
          if (activeTab === "actividad") return <ActivityTimeline module="proyectos" recordId={id!} />;
          return null;
        }}
      </ContextShell>

      <ProyectoForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} data={project} />
    </>
  );
}
