"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
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
import { displayLabel, estadoLabel, prioridadLabel } from "@/lib/api-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  planificacion: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  en_progreso: { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  revision: { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  completado: { bg: "bg-[#F0FDF4]", text: "text-[#166534]" },
  cancelado: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
};

const TAREA_ESTADO_STYLE: Record<string, string> = {
  pendiente: "bg-[#F1F5F9] text-[#64748B]",
  en_progreso: "bg-[#EFF6FF] text-[#1D4ED8]",
  revision: "bg-[#FEF9C3] text-[#854D0E]",
  completada: "bg-[#DCFCE7] text-[#166534]",
  cancelada: "bg-[#F1F5F9] text-[#94A3B8]",
};

const FACTURA_ESTADO_STYLE: Record<string, string> = {
  borrador: "bg-[#F1F5F9] text-[#64748B]",
  enviada: "bg-[#EFF6FF] text-[#1D4ED8]",
  pagada: "bg-[#DCFCE7] text-[#166534]",
  vencida: "bg-[#FEE2E2] text-[#991B1B]",
};

const FIN_VARIANT: Record<"neutral" | "positive" | "warning", string> = {
  neutral: "text-[#334155]",
  positive: "text-[#166534]",
  warning: "text-[#854D0E]",
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
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">{children}</h3>;
}

// ── Tab content panels ────────────────────────────────────────────────────────

function TabResumen({ project }: { project: any }) {
  const statusStyle = STATUS_STYLE[project.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };
  const tareas = project.tareas ?? [];
  const completadas = tareas.filter((t: any) => t.estado === "completada").length;
  const totalTareas = tareas.length;
  const diasRestantes = project.fechaFin
    ? Math.ceil((new Date(project.fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const keyMetrics = [
    { label: "Tareas completadas", value: `${completadas} / ${totalTareas}` },
    { label: "Progreso", value: `${project.progreso ?? 0}%` },
    { label: "Presupuesto", value: project.presupuesto != null ? formatCurrency(project.presupuesto) : "—" },
    { label: "Días restantes", value: diasRestantes != null ? (diasRestantes > 0 ? String(diasRestantes) : "Vencido") : "—" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {keyMetrics.map(({ label, value }) => (
          <div key={label} className="bg-[#EFF6FF] rounded-xl p-4">
            <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-5">
          <SectionLabel>Descripción del proyecto</SectionLabel>
          <p className="text-sm text-[#334155] leading-relaxed">{project.descripcion || "Sin descripción."}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Responsable", value: project.assignedTo || "—" },
              { label: "Inicio", value: formatDate(project.fechaInicio) },
              { label: "Vencimiento", value: formatDate(project.fechaFin) },
              { label: "Prioridad", value: displayLabel(project.prioridad, prioridadLabel) },
              { label: "Estado", value: displayLabel(project.estado, estadoLabel) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-[#94A3B8] mb-0.5">{label}</p>
                <p className="text-xs font-medium text-[#334155]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-[#DBEAFE] rounded-xl p-4">
            <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest mb-2">Progreso general</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold text-[#0F172A]">{project.progreso ?? 0}%</span>
            </div>
            <ProgressBar value={project.progreso ?? 0} />
          </div>
          <div className={cn("rounded-xl p-4", statusStyle.bg)}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Estado</p>
            <span className={cn("text-sm font-semibold", statusStyle.text)}>{displayLabel(project.estado, estadoLabel)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabTareas({ project }: { project: any }) {
  const tareas = project.tareas ?? [];

  if (tareas.length === 0) {
    return (
      <div className="space-y-5">
        <SectionLabel>Tareas del proyecto</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#64748B]">No hay tareas en este proyecto</p>
          <p className="text-xs text-[#94A3B8] mt-1">Las tareas vinculadas a este proyecto aparecerán aquí</p>
          <Link href="/tareas" className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB]">
            Ir a Tareas <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Tareas del proyecto</SectionLabel>
        <Link href="/tareas" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
          <Plus size={12} strokeWidth={2.5} />
          Nueva tarea
        </Link>
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <span className="col-span-5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Tarea</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Responsable</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Vencimiento</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Prioridad</span>
          <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Estado</span>
        </div>
        {tareas.map((t: any, i: number) => (
          <Link
            key={t.id}
            href={`/tareas/${t.id}`}
            className={cn("grid grid-cols-12 items-center px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors", i < tareas.length - 1 && "border-b border-[#F1F5F9]")}
          >
            <span className="col-span-5 text-sm text-[#334155] pr-3 truncate">{t.titulo}</span>
            <span className="col-span-2 text-xs text-[#64748B]">{t.usuario?.nombre ?? "—"}</span>
            <span className="col-span-2 text-xs text-[#64748B]">{formatDate(t.fechaLimite)}</span>
            <span className="col-span-2 text-xs text-[#64748B]">{displayLabel(t.prioridad, prioridadLabel)}</span>
            <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", TAREA_ESTADO_STYLE[t.estado] ?? "bg-[#F1F5F9] text-[#64748B]")}>
              {displayLabel(t.estado, estadoLabel)}
            </span>
          </Link>
        ))}
      </div>

      <div className="sm:hidden space-y-3">
        {tareas.map((t: any) => (
          <Link key={t.id} href={`/tareas/${t.id}`} className="block bg-white rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC]">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-[#334155] leading-snug">{t.titulo}</p>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", TAREA_ESTADO_STYLE[t.estado] ?? "bg-[#F1F5F9] text-[#64748B]")}>
                {displayLabel(t.estado, estadoLabel)}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[10px] text-[#94A3B8]">
              <span>{t.usuario?.nombre ?? "—"}</span>
              <span>·</span>
              <span>Vence {formatDate(t.fechaLimite)}</span>
              <span>·</span>
              <span>{displayLabel(t.prioridad, prioridadLabel)}</span>
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
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
        <Clock className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
        <p className="text-sm font-medium text-[#64748B]">Los hitos no están disponibles aún</p>
        <p className="text-xs text-[#94A3B8] mt-1">Esta funcionalidad se implementará en una futura versión</p>
      </div>
    </div>
  );
}

function TabArchivos({ project }: { project: any }) {
  const documentos = project.documentos ?? [];
  const typeColors: Record<string, string> = {
    pdf: "bg-[#FEE2E2] text-[#991B1B]",
    PDF: "bg-[#FEE2E2] text-[#991B1B]",
    xlsx: "bg-[#DCFCE7] text-[#166534]",
    doc: "bg-[#F1F5F9] text-[#64748B]",
    image: "bg-[#EFF6FF] text-[#1D4ED8]",
  };

  if (documentos.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>Archivos del proyecto</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <Paperclip className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#64748B]">No hay archivos en este proyecto</p>
          <p className="text-xs text-[#94A3B8] mt-1">Los documentos vinculados al proyecto aparecerán aquí</p>
          <Link href="/archivos" className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB]">
            Ir a Archivos <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Archivos del proyecto</SectionLabel>
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {documentos.map((d: any, i: number) => (
          <div
            key={d.id}
            className={cn("flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < documentos.length - 1 && "border-b border-[#F1F5F9]")}
          >
            <Paperclip size={14} className="text-[#94A3B8] shrink-0" strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#334155] truncate">{d.nombre}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">{d.tipo} · {(d.tamano ? d.tamano / 1024 : 0).toFixed(1)} KB</p>
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", typeColors[d.tipo] ?? "bg-[#F1F5F9] text-[#64748B]")}>
              {d.tipo}
            </span>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#3B82F6] hover:border-[#BFDBFE] transition-colors"
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
  const facturas = project.facturas ?? [];
  const transacciones = project.transacciones ?? [];
  const presupuesto = project.presupuesto;
  const totalFacturado = facturas.reduce((sum: number, f: any) => sum + (f.total ?? 0), 0);
  const totalTransacciones = transacciones.reduce((sum: number, t: any) => sum + (t.monto ?? 0) * (t.tipo === "ingreso" ? 1 : -1), 0);

  const hasData = facturas.length > 0 || transacciones.length > 0 || presupuesto != null;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <SectionLabel>Finanzas del proyecto</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <DollarSign className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#64748B]">No hay datos financieros</p>
          <p className="text-xs text-[#94A3B8] mt-1">Las facturas y transacciones vinculadas aparecerán aquí</p>
          <Link href="/finanzas" className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB]">
            Ver en Funds <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  const financialItems = [
    presupuesto != null && { label: "Presupuesto", value: formatCurrency(presupuesto), variant: "neutral" as const },
    facturas.length > 0 && { label: "Total facturado", value: formatCurrency(totalFacturado), variant: "neutral" as const },
    transacciones.length > 0 && { label: "Transacciones", value: formatCurrency(totalTransacciones), variant: totalTransacciones >= 0 ? "positive" as const : "warning" as const },
  ].filter(Boolean) as { label: string; value: string; variant: "neutral" | "positive" | "warning" }[];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {financialItems.map(({ label, value, variant }) => (
          <div key={label} className={cn("rounded-xl p-4", variant === "warning" ? "bg-[#FEF9C3]" : variant === "positive" ? "bg-[#DCFCE7]" : "bg-[#EFF6FF]")}>
            <p className={cn("text-base font-bold tracking-tight", FIN_VARIANT[variant])}>{value}</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {facturas.length > 0 && (
        <div>
          <SectionLabel>Facturas</SectionLabel>
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            {facturas.slice(0, 5).map((f: any) => (
              <Link
                key={f.id}
                href={`/facturacion/${f.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8FAFC] border-b border-[#F1F5F9] last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-[#334155]">#{f.numero}</p>
                  <p className="text-xs text-[#64748B]">{formatDate(f.fechaEmision)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(f.total)}</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", FACTURA_ESTADO_STYLE[f.estado] ?? "bg-[#F1F5F9] text-[#64748B]")}>
                    {displayLabel(f.estado, estadoLabel)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Link href="/finanzas" className="flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
          Ver en Funds <ArrowUpRight size={12} />
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
        <SectionLabel>Notas del proyecto</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <StickyNote className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#64748B]">No hay notas</p>
          <p className="text-xs text-[#94A3B8] mt-1">Las notas vinculadas al proyecto aparecerán aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Notas del proyecto</SectionLabel>
      <div className="space-y-3">
        {notas.map((n: any) => (
          <div key={n.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <p className="text-xs font-semibold text-[#334155] mb-1">{n.titulo}</p>
            <p className="text-sm text-[#64748B] leading-relaxed">{n.contenido || "—"}</p>
            <p className="text-[10px] text-[#94A3B8] mt-2">{formatDate(n.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "tareas", label: "Tareas" },
  { key: "hitos", label: "Hitos" },
  { key: "archivos", label: "Archivos" },
  { key: "finanzas", label: "Finanzas" },
  { key: "notas", label: "Notas" },
  { key: "actividad", label: "Actividad" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
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
        <p className="text-sm text-[#64748B]">ID de proyecto no válido</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC]">
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#94A3B8]" />
        </div>
      </div>
    );
  }

  if (error || !project || project.error) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC]">
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
          <AlertTriangle className="h-12 w-12 text-[#EF4444] mb-4" />
          <p className="text-sm font-medium text-[#991B1B]">{error || "Proyecto no encontrado"}</p>
          <Link href="/proyectos" className="mt-4 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium">
            Volver a proyectos
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[project.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };

  return (
    <>
      <ContextShell
        breadcrumbs={[
          { label: "Flow", href: "/" },
          { label: "Proyectos", href: "/proyectos" },
          { label: project.nombre },
        ]}
        heading={
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight text-balance">{project.nombre}</h1>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
              {displayLabel(project.estado, estadoLabel)}
            </span>
            <span className="text-xs text-[#94A3B8] font-medium">{displayLabel(project.prioridad, prioridadLabel)}</span>
          </div>
        }
        meta={
          <div className="flex items-center gap-4 flex-wrap">
            {project.clienteId && (
              <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                <Building2 size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
                <Link href={`/clientes/${project.clienteId}`} className="hover:text-[#3B82F6] transition-colors">
                  {project.cliente?.nombre ?? "Cliente"}
                </Link>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
              <Calendar size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
              Vence {formatDate(project.fechaFin)}
            </span>
            {project.assignedTo && (
              <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                <User size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
                {project.assignedTo}
              </span>
            )}
          </div>
        }
        actions={
          <>
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] text-xs font-medium hover:bg-[#F8FAFC] transition-colors"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Actualizar
            </button>
            <Link
              href="/finanzas"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors"
            >
              <FileBarChart size={13} strokeWidth={1.75} />
              Ver finanzas
            </Link>
          </>
        }
        tabs={TABS}
        defaultTab="resumen"
        copilotContext="Flow"
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
