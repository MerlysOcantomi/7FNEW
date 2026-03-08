"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { cn } from "@/lib/utils";
import {
  Building2,
  Mail,
  FolderKanban,
  FileText,
  MessageSquare,
  Phone,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  Pencil,
  StickyNote,
  Clock,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { ClienteForm } from "@/components/forms/cliente-form";
import { displayLabel, estadoLabel } from "@/lib/api-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  activo: { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  inactivo: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
  prospecto: { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planificacion: "bg-[#EFF6FF] text-[#1D4ED8]",
  en_progreso: "bg-[#DCFCE7] text-[#166534]",
  revision: "bg-[#FEF9C3] text-[#854D0E]",
  completado: "bg-[#F0FDF4] text-[#166534]",
  cancelado: "bg-[#F1F5F9] text-[#64748B]",
};

const FACTURA_ESTADO_STYLE: Record<string, string> = {
  borrador: "bg-[#F1F5F9] text-[#64748B]",
  enviada: "bg-[#EFF6FF] text-[#1D4ED8]",
  pagada: "bg-[#DCFCE7] text-[#166534]",
  vencida: "bg-[#FEE2E2] text-[#991B1B]",
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">{children}</h3>;
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function TabResumen({ client }: { client: any }) {
  const proyectos = client.proyectos ?? [];
  const facturas = client.facturas ?? [];
  const totalFacturado = facturas.reduce((sum: number, f: any) => sum + (f.total ?? 0), 0);
  const facturasPendientes = facturas.filter((f: any) => f.estado === "enviada" || f.estado === "vencida").length;
  const totalPendiente = facturas
    .filter((f: any) => f.estado === "enviada" || f.estado === "vencida")
    .reduce((sum: number, f: any) => sum + (f.total ?? 0), 0);
  const clienteDesde = client.createdAt ? new Date(client.createdAt).getFullYear() : null;

  const snapshot = [
    { label: "Proyectos activos", value: String(proyectos.filter((p: any) => p.estado !== "completado" && p.estado !== "cancelado").length) },
    { label: "Ingresos facturados", value: formatCurrency(totalFacturado) },
    { label: "Facturas pendientes", value: `${facturasPendientes} (${formatCurrency(totalPendiente)})` },
    { label: "Cliente desde", value: clienteDesde ? String(clienteDesde) : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {snapshot.map(({ label, value }) => (
            <div key={label} className="bg-[#EFF6FF] rounded-xl p-4">
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#DBEAFE] rounded-xl p-5 flex flex-col justify-between">
          <div className="mb-4">
            <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest mb-2">Perfil del cliente</p>
            <p className="text-sm font-semibold text-[#0F172A] mb-1">{client.nombre}</p>
            <p className="text-xs text-[#334155] leading-relaxed">{client.notas || "Sin notas."}</p>
          </div>
          {client.empresa && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B]">Empresa:</span>
              <span className="text-xs font-medium text-[#0F172A]">{client.empresa}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabProyectos({ client }: { client: any }) {
  const proyectos = client.proyectos ?? [];

  if (proyectos.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>Proyectos del cliente</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#64748B]">No hay proyectos para este cliente</p>
          <p className="text-xs text-[#94A3B8] mt-1">Los proyectos vinculados al cliente aparecerán aquí</p>
          <Link href="/proyectos" className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
            <Plus size={12} strokeWidth={2.5} />
            Nuevo proyecto
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Proyectos del cliente</SectionLabel>
        <Link href="/proyectos" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
          <Plus size={12} strokeWidth={2.5} />
          Nuevo proyecto
        </Link>
      </div>
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {proyectos.map((p: any, i: number) => {
          const ps = PROJECT_STATUS_STYLE[p.estado] ?? "bg-[#F1F5F9] text-[#64748B]";
          return (
            <div key={p.id} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < proyectos.length - 1 && "border-b border-[#F1F5F9]")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <Link href={`/proyectos/${p.id}`} className="text-sm font-medium text-[#0F172A] hover:text-[#3B82F6] transition-colors truncate">
                    {p.nombre}
                  </Link>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", ps)}>{displayLabel(p.estado, estadoLabel)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 max-w-[200px]">
                    <ProgressBar value={p.progreso ?? 0} />
                  </div>
                  <span className="text-xs text-[#94A3B8] shrink-0">{p.progreso ?? 0}%</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[#94A3B8]">Vence</p>
                <p className="text-xs text-[#334155] font-medium">{formatDate(p.fechaFin)}</p>
              </div>
              <Link href={`/proyectos/${p.id}`} className="shrink-0 flex items-center gap-0.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
                Ver <ArrowUpRight size={11} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabFacturacion({ client }: { client: any }) {
  const facturas = client.facturas ?? [];

  if (facturas.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>Facturación del cliente</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#64748B]">No hay facturas para este cliente</p>
          <p className="text-xs text-[#94A3B8] mt-1">Las facturas vinculadas al cliente aparecerán aquí</p>
          <Link href="/facturacion" className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB]">
            Ver en Funds <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Facturación del cliente</SectionLabel>
        <Link href="/facturacion" className="text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors flex items-center gap-1">
          Ver en Funds <ArrowUpRight size={11} />
        </Link>
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <span className="col-span-4 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Factura</span>
          <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Importe</span>
          <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Vencimiento</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Estado</span>
        </div>
        {facturas.map((f: any, i: number) => {
          const s = FACTURA_ESTADO_STYLE[f.estado] ?? "bg-[#F1F5F9] text-[#64748B]";
          return (
            <Link
              key={f.id}
              href={`/facturacion/${f.id}`}
              className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < facturas.length - 1 && "border-b border-[#F1F5F9]")}
            >
              <span className="col-span-4 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors">#{f.numero}</span>
              <span className="col-span-3 text-sm font-medium text-[#0F172A]">{formatCurrency(f.total)}</span>
              <span className="col-span-3 text-sm text-[#64748B]">{formatDate(f.fechaVencimiento)}</span>
              <span className={cn("col-span-2 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s)}>{displayLabel(f.estado, estadoLabel)}</span>
            </Link>
          );
        })}
      </div>

      <div className="sm:hidden space-y-3">
        {facturas.map((f: any) => {
          const s = FACTURA_ESTADO_STYLE[f.estado] ?? "bg-[#F1F5F9] text-[#64748B]";
          return (
            <Link key={f.id} href={`/facturacion/${f.id}`} className="block bg-white rounded-xl border border-[#E2E8F0] p-4 hover:bg-[#F8FAFC]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-[#3B82F6]">#{f.numero}</span>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s)}>{displayLabel(f.estado, estadoLabel)}</span>
              </div>
              <p className="text-sm font-medium text-[#0F172A]">{formatCurrency(f.total)}</p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Vence {formatDate(f.fechaVencimiento)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TabActividad({ client, activities }: { client: any; activities: any[] }) {
  const notas = client.notasProfesionales ?? [];

  const hasNotes = notas.length > 0;
  const hasActivity = activities.length > 0;

  if (!hasNotes && !hasActivity) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <SectionLabel>Notas</SectionLabel>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <StickyNote className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#64748B]">No hay notas</p>
            <p className="text-xs text-[#94A3B8] mt-1">Las notas vinculadas al cliente aparecerán aquí</p>
          </div>
        </div>
        <div className="space-y-3">
          <SectionLabel>Actividad reciente</SectionLabel>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#64748B]">No hay actividad registrada</p>
            <p className="text-xs text-[#94A3B8] mt-1">Los cambios en el cliente se mostrarán aquí</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <SectionLabel>Notas</SectionLabel>
        {notas.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
            <p className="text-sm text-[#64748B]">No hay notas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notas.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold text-[#334155]">{n.titulo || "Nota"}</p>
                  <span className="text-[10px] text-[#94A3B8]">{formatDate(n.createdAt)}</span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">{n.contenido || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionLabel>Actividad reciente</SectionLabel>
        {activities.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
            <p className="text-sm text-[#64748B]">No hay actividad registrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-2 divide-y divide-[#F1F5F9]">
            {activities.map((a: any, i: number) => {
              const label = a.data?.label ?? a.data?.comment ?? (a.type === "created" ? "Creado" : a.type === "updated" ? "Actualizado" : a.type);
              return (
                <div key={a.id || i} className="flex items-start gap-3 py-4">
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-[#64748B]" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#334155] leading-snug">{label}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                      {a.userName || a.userEmail || "Sistema"} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "proyectos", label: "Proyectos" },
  { key: "facturacion", label: "Facturación" },
  { key: "actividad", label: "Actividad" },
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: client, loading, error, refetch } = useFetch<any>(id ? `/api/clientes/${id}` : null, { refreshKey });
  const { data: activitiesData } = useFetch<any>(
    id ? `/api/activity?module=clientes&recordId=${id}&limit=20` : null,
    { refreshKey }
  );
  const activities = Array.isArray(activitiesData) ? activitiesData : [];

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
  }

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-[#64748B]">ID de cliente no válido</p>
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

  if (error || !client || client.error) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC]">
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
          <AlertTriangle className="h-12 w-12 text-[#EF4444] mb-4" />
          <p className="text-sm font-medium text-[#991B1B]">{error || "Cliente no encontrado"}</p>
          <Link href="/clientes" className="mt-4 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium">
            Volver a clientes
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[client.estado] ?? { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" };

  return (
    <>
      <ContextShell
        breadcrumbs={[
          { label: "Flow", href: "/" },
          { label: "Clientes", href: "/clientes" },
          { label: client.nombre },
        ]}
        heading={
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[#2563EB]">{getInitials(client.nombre)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">{client.nombre}</h1>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
                  {displayLabel(client.estado, estadoLabel)}
                </span>
              </div>
            </div>
          </div>
        }
        meta={
          <div className="flex items-center gap-4 flex-wrap mt-1 ml-[60px]">
            {client.empresa && (
              <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                <Building2 size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
                {client.empresa}
              </span>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#3B82F6] transition-colors">
                <Mail size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
                {client.email}
              </a>
            )}
            {client.telefono && (
              <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
                <Phone size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
                {client.telefono}
              </span>
            )}
          </div>
        }
        actions={
          <>
            <button
              onClick={() => setFormOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] text-xs font-medium hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Editar
            </button>
            <Link
              href="/facturacion"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors"
            >
              <TrendingUp size={13} strokeWidth={1.75} />
              Ver facturación
            </Link>
          </>
        }
        tabs={TABS}
        defaultTab="resumen"
        copilotContext="Flow"
      >
        {(activeTab) => {
          if (activeTab === "resumen") return <TabResumen client={client} />;
          if (activeTab === "proyectos") return <TabProyectos client={client} />;
          if (activeTab === "facturacion") return <TabFacturacion client={client} />;
          if (activeTab === "actividad") return <TabActividad client={client} activities={activities} />;
          return null;
        }}
      </ContextShell>

      <ClienteForm open={formOpen} onClose={() => setFormOpen(false)} onSuccess={handleFormSuccess} data={client} />
    </>
  );
}