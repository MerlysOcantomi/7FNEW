"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { cn } from "@/lib/utils";
import {
  Building2, Mail, FolderKanban, FileText, MessageSquare,
  Phone, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  Circle, Plus, Tag, ArrowUpRight,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const CLIENT_DATA: Record<string, {
  id: string;
  name: string;
  industry: string;
  status: "Activo" | "En riesgo" | "Inactivo";
  email: string;
  phone: string;
  lead: string;
  totalRevenue: string;
  tags: string[];
  description: string;
  snapshot: { label: string; value: string }[];
  projects: { id: string; name: string; status: "En marcha" | "En riesgo" | "Retrasado" | "Completado"; progress: number; due: string }[];
  invoices: { id: string; amount: string; status: "Pagada" | "Pendiente" | "Vencida" | "Borrador"; due: string }[];
  notes: { author: string; date: string; content: string }[];
  activity: { date: string; event: string; type: "project" | "invoice" | "note" | "system" }[];
}> = {
  c1: {
    id: "c1",
    name: "Acme Corp",
    industry: "Manufactura",
    status: "Activo",
    email: "contact@acmecorp.com",
    phone: "+1 (555) 010-1234",
    lead: "M. Torres",
    totalRevenue: "$580K",
    tags: ["Enterprise", "Prioridad Q2"],
    description: "Cliente empresarial consolidado en los sectores de manufactura y cadena de suministro. Dos proyectos activos en Fase 3+. Alta implicación y probabilidad de renovación.",
    snapshot: [
      { label: "Proyectos activos", value: "2" },
      { label: "Ingresos totales", value: "$580K" },
      { label: "Facturas abiertas", value: "$52K" },
      { label: "Cliente desde", value: "2021" },
    ],
    projects: [
      { id: "p1", name: "Alpha Expansion", status: "En marcha", progress: 60, due: "30 jun 2025" },
      { id: "p5", name: "Gamma Analytics", status: "Completado", progress: 100, due: "28 feb 2025" },
    ],
    invoices: [
      { id: "INV-0042", amount: "$48.000", status: "Pagada", due: "15 feb 2025" },
      { id: "INV-0046", amount: "$52.000", status: "Pendiente", due: "20 mar 2025" },
    ],
    notes: [
      { author: "M. Torres", date: "27 feb 2025", content: "J. Mitchell solicitó llamada previa al cierre del hito de Fase 3. Programar antes del 8 de marzo." },
      { author: "A. Chen", date: "20 feb 2025", content: "Revisión de entregables de Fase 2 con el cliente — alta satisfacción. No se solicitaron cambios de alcance." },
    ],
    activity: [
      { date: "Hoy, 09:42", event: "Solicitud de aprobación Fase 3 recibida de J. Mitchell", type: "project" },
      { date: "27 feb 2025", event: "INV-0046 emitida — $52.000 pendiente", type: "invoice" },
      { date: "20 feb 2025", event: "Llamada de revisión Fase 2 completada — notas añadidas", type: "note" },
      { date: "1 feb 2025", event: "INV-0042 pagada — $48.000 cobrados", type: "invoice" },
      { date: "15 ene 2025", event: "Alpha Expansion entró en Fase 3", type: "project" },
    ],
  },
  c2: {
    id: "c2",
    name: "Nexus Holdings",
    industry: "Finanzas",
    status: "En riesgo",
    email: "ops@nexusholdings.com",
    phone: "+1 (555) 020-5678",
    lead: "A. Chen",
    totalRevenue: "$690K",
    tags: ["Enterprise", "Ventana de renovación"],
    description: "Cliente de servicios financieros con dos proyectos simultáneos. La ventana de renovación del contrato se abre en 30 días. Alerta de riesgo por retrasos de proveedor en Beta Relaunch.",
    snapshot: [
      { label: "Proyectos activos", value: "2" },
      { label: "Ingresos totales", value: "$690K" },
      { label: "Facturas abiertas", value: "$50,5K" },
      { label: "Cliente desde", value: "2020" },
    ],
    projects: [
      { id: "p2", name: "Beta Relaunch", status: "En riesgo", progress: 45, due: "15 may 2025" },
      { id: "p6", name: "Sigma Compliance", status: "En marcha", progress: 20, due: "30 sep 2025" },
    ],
    invoices: [
      { id: "INV-0043", amount: "$32.500", status: "Pendiente", due: "10 mar 2025" },
      { id: "INV-0047", amount: "$18.000", status: "Borrador", due: "—" },
    ],
    notes: [
      { author: "A. Chen", date: "25 feb 2025", content: "La conversación de renovación debe iniciarse esta semana. El cliente ha indicado apertura a una extensión de 2 años condicionada a la entrega de Beta Relaunch." },
    ],
    activity: [
      { date: "Ayer", event: "Alerta de riesgo activada — retraso de proveedor en Beta Relaunch", type: "system" },
      { date: "25 feb 2025", event: "Nota de renovación añadida por A. Chen", type: "note" },
      { date: "25 feb 2025", event: "INV-0043 emitida — $32.500 pendiente", type: "invoice" },
      { date: "10 feb 2025", event: "Sigma Compliance entró en Fase 1", type: "project" },
    ],
  },
  c3: {
    id: "c3",
    name: "Vertex Capital",
    industry: "Inversión",
    status: "Activo",
    email: "projects@vertexcap.com",
    phone: "+1 (555) 030-9012",
    lead: "S. Patel",
    totalRevenue: "$1,1M",
    tags: ["Estratégico"],
    description: "Cliente estratégico de inversión con un gran programa de modernización de infraestructura. Mayor cuenta por ingresos. Bajo riesgo de abandono.",
    snapshot: [
      { label: "Proyectos activos", value: "1" },
      { label: "Ingresos totales", value: "$1,1M" },
      { label: "Facturas abiertas", value: "$75K" },
      { label: "Cliente desde", value: "2019" },
    ],
    projects: [
      { id: "p3", name: "Delta Infrastructure", status: "En marcha", progress: 33, due: "12 ago 2025" },
    ],
    invoices: [
      { id: "INV-0044", amount: "$75.000", status: "Vencida", due: "28 feb 2025" },
      { id: "INV-0040", amount: "$40.000", status: "Pagada", due: "28 ene 2025" },
    ],
    notes: [
      { author: "S. Patel", date: "26 feb 2025", content: "INV-0044 vencida — contacto AP es T. Larsen. Enviar recordatorio formal y escalar si no hay respuesta antes del 3 de marzo." },
    ],
    activity: [
      { date: "28 feb 2025", event: "INV-0044 vencida — $75.000", type: "invoice" },
      { date: "26 feb 2025", event: "Nota de escalación de vencido añadida por S. Patel", type: "note" },
      { date: "1 feb 2025", event: "Delta Infrastructure Fase 1 evaluación iniciada", type: "project" },
      { date: "28 ene 2025", event: "INV-0040 pagada — $40.000 cobrados", type: "invoice" },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  "Activo":    { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  "En riesgo": { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  "Inactivo":  { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
};

const PROJECT_STATUS_MAP = {
  "En marcha":  { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  "En riesgo":  { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  "Retrasado":  { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  "Completado": { bg: "bg-[#F0FDF4]", text: "text-[#166534]" },
};

const INV_STATUS_MAP = {
  Pagada:    { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  Pendiente: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  Vencida:   { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  Borrador:  { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
};

const ACTIVITY_ICON = {
  project: FolderKanban,
  invoice: FileText,
  note:    MessageSquare,
  system:  AlertTriangle,
};

const ACTIVITY_COLOR = {
  project: "text-[#3B82F6]",
  invoice: "text-[#22C55E]",
  note:    "text-[#64748B]",
  system:  "text-[#F59E0B]",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">{children}</h3>;
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function TabResumen({ client }: { client: typeof CLIENT_DATA["c1"] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {client.snapshot.map(({ label, value }) => (
            <div key={label} className="bg-[#EFF6FF] rounded-xl p-4">
              <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#DBEAFE] rounded-xl p-5 flex flex-col justify-between">
          <div className="mb-4">
            <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-widest mb-2">Perfil del cliente</p>
            <p className="text-sm font-semibold text-[#0F172A] mb-1">{client.name}</p>
            <p className="text-xs text-[#334155] leading-relaxed">{client.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">Responsable:</span>
            <span className="text-xs font-medium text-[#0F172A]">{client.lead}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabProyectos({ client }: { client: typeof CLIENT_DATA["c1"] }) {
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
        {client.projects.map((p, i) => {
          const ps = PROJECT_STATUS_MAP[p.status];
          return (
            <div key={p.id} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < client.projects.length - 1 && "border-b border-[#F1F5F9]")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <Link href={`/proyectos/${p.id}`} className="text-sm font-medium text-[#0F172A] hover:text-[#3B82F6] transition-colors truncate">
                    {p.name}
                  </Link>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", ps.bg, ps.text)}>{p.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 max-w-[200px]">
                    <ProgressBar value={p.progress} />
                  </div>
                  <span className="text-xs text-[#94A3B8] shrink-0">{p.progress}%</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[#94A3B8]">Vence</p>
                <p className="text-xs text-[#334155] font-medium">{p.due.split(" ").slice(0, 2).join(" ")}</p>
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

function TabFacturacion({ client }: { client: typeof CLIENT_DATA["c1"] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Facturación del cliente</SectionLabel>
        <Link href="/facturacion" className="text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors flex items-center gap-1">
          Ver en Funds <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Desktop */}
      <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
          <span className="col-span-4 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Factura</span>
          <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Importe</span>
          <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Vencimiento</span>
          <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Estado</span>
        </div>
        {client.invoices.map((inv, i) => {
          const s = INV_STATUS_MAP[inv.status];
          return (
            <div key={inv.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < client.invoices.length - 1 && "border-b border-[#F1F5F9]")}>
              <Link href={`/facturacion/${inv.id}`} className="col-span-4 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors">{inv.id}</Link>
              <span className="col-span-3 text-sm font-medium text-[#0F172A]">{inv.amount}</span>
              <span className="col-span-3 text-sm text-[#64748B]">{inv.due}</span>
              <span className={cn("col-span-2 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s.bg, s.text)}>{inv.status}</span>
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="sm:hidden space-y-3">
        {client.invoices.map((inv) => {
          const s = INV_STATUS_MAP[inv.status];
          return (
            <div key={inv.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-center justify-between mb-1.5">
                <Link href={`/facturacion/${inv.id}`} className="text-sm font-semibold text-[#3B82F6]">{inv.id}</Link>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>{inv.status}</span>
              </div>
              <p className="text-sm font-medium text-[#0F172A]">{inv.amount}</p>
              {inv.due !== "—" && <p className="text-[10px] text-[#94A3B8] mt-0.5">Vence {inv.due}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabActividad({ client }: { client: typeof CLIENT_DATA["c1"] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Notes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Notas</SectionLabel>
          <button className="flex items-center gap-1.5 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
            <Plus size={11} strokeWidth={2.5} />
            Añadir nota
          </button>
        </div>
        {client.notes.map((note, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#DBEAFE] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-[#2563EB]">{note.author.split(".")[0]}</span>
                </div>
                <span className="text-xs font-semibold text-[#334155]">{note.author}</span>
              </div>
              <span className="text-[10px] text-[#94A3B8]">{note.date}</span>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">{note.content}</p>
          </div>
        ))}
      </div>

      {/* Activity */}
      <div className="space-y-3">
        <SectionLabel>Actividad reciente</SectionLabel>
        <div className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-2 divide-y divide-[#F1F5F9]">
          {client.activity.map((item, i) => {
            const Icon = ACTIVITY_ICON[item.type];
            const color = ACTIVITY_COLOR[item.type];
            return (
              <div key={i} className="flex items-start gap-3 py-4">
                <Icon size={14} className={cn("mt-0.5 shrink-0", color)} strokeWidth={1.75} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#334155] leading-snug">{item.event}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{item.date}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen",      label: "Resumen" },
  { key: "proyectos",    label: "Proyectos" },
  { key: "facturacion",  label: "Facturación" },
  { key: "actividad",    label: "Actividad" },
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = CLIENT_DATA[id as string] ?? CLIENT_DATA["c1"];
  const statusStyle = STATUS_MAP[client.status];

  return (
    <ContextShell
      breadcrumbs={[
        { label: "Flow", href: "/" },
        { label: "Clientes", href: "/clientes" },
        { label: client.name },
      ]}
      heading={
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#DBEAFE] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-[#2563EB]">
              {client.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">{client.name}</h1>
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
                {client.status}
              </span>
            </div>
            {client.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Tag size={11} className="text-[#94A3B8]" strokeWidth={1.75} />
                {client.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-medium px-2 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      }
      meta={
        <div className="flex items-center gap-4 flex-wrap mt-1 ml-[60px]">
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Building2 size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            {client.industry}
          </span>
          <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#3B82F6] transition-colors">
            <Mail size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            {client.email}
          </a>
          <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
            <Phone size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
            {client.phone}
          </span>
        </div>
      }
      actions={
        <>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#334155] text-xs font-medium hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
            <Mail size={13} strokeWidth={1.75} />
            Redactar mensaje
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors">
            <TrendingUp size={13} strokeWidth={1.75} />
            Informe de cliente
          </button>
        </>
      }
      tabs={TABS}
      defaultTab="resumen"
      copilotContext="Flow"
    >
      {(activeTab) => {
        if (activeTab === "resumen")     return <TabResumen client={client} />;
        if (activeTab === "proyectos")   return <TabProyectos client={client} />;
        if (activeTab === "facturacion") return <TabFacturacion client={client} />;
        if (activeTab === "actividad")   return <TabActividad client={client} />;
        return null;
      }}
    </ContextShell>
  );
}
