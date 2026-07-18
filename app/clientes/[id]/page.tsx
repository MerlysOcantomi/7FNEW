"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/components/i18n-provider";
import { resolveStatusLabel } from "@core/i18n/ui";
import { formatCurrency } from "@core/i18n/format";
import { useClientsNouns, capNoun } from "@/hooks/use-clients-nouns";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  activo: { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  inactivo: { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" },
  prospecto: { bg: "bg-[var(--status-warning-bg)]", text: "text-[var(--status-warning-text)]" },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planificacion: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  en_progreso: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  revision: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  completado: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  cancelado: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
};

const FACTURA_ESTADO_STYLE: Record<string, string> = {
  borrador: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
  enviada: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  pagada: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
  vencida: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

function formatDate(value: string | Date | null | undefined, locale: string): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatMoney(
  value: number | null | undefined,
  locale: string,
  currency: string | null | undefined,
): string {
  if (value == null) return "—";
  // Currency comes from the client's own record — never inferred from the language.
  return formatCurrency(value, { locale, currency: currency || "USD" }) || "—";
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
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{children}</h3>;
}

// ── Tab panels ────────────────────────────────────────────────────────────────

function TabResumen({ client }: { client: any }) {
  const { t, locale } = useI18n();
  const nouns = useClientsNouns();
  const D = t.clients.detail;
  const proyectos = client.proyectos ?? [];
  const facturas = client.facturas ?? [];
  const totalFacturado = facturas.reduce((sum: number, f: any) => sum + (f.total ?? 0), 0);
  const facturasPendientes = facturas.filter((f: any) => f.estado === "enviada" || f.estado === "vencida").length;
  const totalPendiente = facturas
    .filter((f: any) => f.estado === "enviada" || f.estado === "vencida")
    .reduce((sum: number, f: any) => sum + (f.total ?? 0), 0);
  const clienteDesde = client.createdAt ? new Date(client.createdAt).getFullYear() : null;

  const snapshot = [
    { label: D.snapshot.activeProjects({ projects: nouns.projects }), value: String(proyectos.filter((p: any) => p.estado !== "completado" && p.estado !== "cancelado").length) },
    { label: D.snapshot.billedRevenue, value: formatMoney(totalFacturado, locale, client.currency) },
    { label: D.snapshot.outstandingInvoices({ invoices: nouns.invoices }), value: `${facturasPendientes} (${formatMoney(totalPendiente, locale, client.currency)})` },
    { label: D.snapshot.clientSince({ client: nouns.client }), value: clienteDesde ? String(clienteDesde) : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {snapshot.map(({ label, value }) => (
            <div key={label} className="bg-accent rounded-xl p-4">
              <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="bg-primary/15 rounded-xl p-5 flex flex-col justify-between">
          <div className="mb-4">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">{D.profile({ client: nouns.client })}</p>
            <p className="text-sm font-semibold text-foreground mb-1">{client.nombre}</p>
            <p className="text-xs text-foreground/70 leading-relaxed">{client.notas || D.noNotes}</p>
          </div>
          {client.empresa && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{D.company}:</span>
              <span className="text-xs font-medium text-foreground">{client.empresa}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabProyectos({ client }: { client: any }) {
  const { t, locale } = useI18n();
  const nouns = useClientsNouns();
  const D = t.clients.detail;
  const proyectos = client.proyectos ?? [];

  if (proyectos.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>{D.projectsSection({ client: nouns.client, projects: nouns.projects })}</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{D.projectsEmptyTitle({ client: nouns.client, projects: nouns.projects })}</p>
          <p className="text-xs text-muted-foreground mt-1">{D.projectsEmptyBody({ client: nouns.client, projects: nouns.projects })}</p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/proyectos">
              <Plus size={12} strokeWidth={2.5} />
              {D.newProject({ project: nouns.project })}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{D.projectsSection({ client: nouns.client, projects: nouns.projects })}</SectionLabel>
        <Button asChild size="sm">
          <Link href="/proyectos">
            <Plus size={12} strokeWidth={2.5} />
            {D.newProject({ project: nouns.project })}
          </Link>
        </Button>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {proyectos.map((p: any, i: number) => {
          const ps = PROJECT_STATUS_STYLE[p.estado] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]";
          return (
            <div key={p.id} className={cn("flex items-center gap-4 px-5 py-4 hover:bg-background transition-colors", i < proyectos.length - 1 && "border-b border-muted")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <Link href={`/proyectos/${p.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate">
                    {p.nombre}
                  </Link>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", ps)}>{resolveStatusLabel(t.statuses, p.estado)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 max-w-[200px]">
                    <ProgressBar value={p.progreso ?? 0} />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{p.progreso ?? 0}%</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted-foreground">{D.invoiceColumns.dueDate}</p>
                <p className="text-xs text-foreground font-medium">{formatDate(p.fechaFin, locale)}</p>
              </div>
              <Link href={`/proyectos/${p.id}`} className="shrink-0 flex items-center gap-0.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors">
                {t.clients.list.view} <ArrowUpRight size={11} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabFacturacion({ client }: { client: any }) {
  const { t, locale } = useI18n();
  const nouns = useClientsNouns();
  const D = t.clients.detail;
  const facturas = client.facturas ?? [];

  if (facturas.length === 0) {
    return (
      <div className="space-y-3">
        <SectionLabel>{D.invoicesSection({ client: nouns.client, invoices: nouns.invoices })}</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{D.invoicesEmptyTitle({ client: nouns.client, invoices: nouns.invoices })}</p>
          <p className="text-xs text-muted-foreground mt-1">{D.invoicesEmptyBody({ client: nouns.client })}</p>
          <Link href="/facturacion" className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80">
            {D.openBilling({ invoices: nouns.invoices })} <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{D.invoicesSection({ client: nouns.client, invoices: nouns.invoices })}</SectionLabel>
        <Link href="/facturacion" className="text-xs text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1">
          {D.openBilling({ invoices: nouns.invoices })} <ArrowUpRight size={11} />
        </Link>
      </div>

      <div className="hidden sm:block bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-2.5 border-b border-muted bg-background">
          <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{capNoun(nouns.invoices)}</span>
          <span className="col-span-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{D.invoiceColumns.amount}</span>
          <span className="col-span-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{D.invoiceColumns.dueDate}</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{D.invoiceColumns.status}</span>
        </div>
        {facturas.map((f: any, i: number) => {
          const s = FACTURA_ESTADO_STYLE[f.estado] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]";
          return (
            <Link
              key={f.id}
              href={`/facturacion/${f.id}`}
              className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-background transition-colors", i < facturas.length - 1 && "border-b border-muted")}
            >
              <span className="col-span-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors">#{f.numero}</span>
              <span className="col-span-3 text-sm font-medium text-foreground">{formatMoney(f.total, locale, client.currency)}</span>
              <span className="col-span-3 text-sm text-muted-foreground">{formatDate(f.fechaVencimiento, locale)}</span>
              <span className={cn("col-span-2 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s)}>{resolveStatusLabel(t.statuses, f.estado)}</span>
            </Link>
          );
        })}
      </div>

      <div className="sm:hidden space-y-3">
        {facturas.map((f: any) => {
          const s = FACTURA_ESTADO_STYLE[f.estado] ?? "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]";
          return (
            <Link key={f.id} href={`/facturacion/${f.id}`} className="block bg-card rounded-xl border border-border p-4 hover:bg-background">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-primary">#{f.numero}</span>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s)}>{resolveStatusLabel(t.statuses, f.estado)}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{formatMoney(f.total, locale, client.currency)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{D.due(formatDate(f.fechaVencimiento, locale))}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TabActividad({ client, activities }: { client: any; activities: any[] }) {
  const { t, locale } = useI18n();
  const nouns = useClientsNouns();
  const D = t.clients.detail;
  const notas = client.notasProfesionales ?? [];

  const hasNotes = notas.length > 0;
  const hasActivity = activities.length > 0;

  if (!hasNotes && !hasActivity) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <SectionLabel>{D.notesSection}</SectionLabel>
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <StickyNote className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{D.notesEmptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{D.notesEmptyBody({ client: nouns.client })}</p>
          </div>
        </div>
        <div className="space-y-3">
          <SectionLabel>{D.activitySection}</SectionLabel>
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{D.activityEmptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{D.activityEmptyBody({ client: nouns.client })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <SectionLabel>{D.notesSection}</SectionLabel>
        {notas.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{D.notesEmptyTitle}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notas.map((n: any) => (
              <div key={n.id} className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold text-foreground">{n.titulo || D.activityFallback.note}</p>
                  <span className="text-[10px] text-muted-foreground">{formatDate(n.createdAt, locale)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{n.contenido || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <SectionLabel>{D.activitySection}</SectionLabel>
        {activities.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{D.activityEmptyTitle}</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border px-5 py-2 divide-y divide-muted">
            {activities.map((a: any, i: number) => {
              const label = a.data?.label ?? a.data?.comment ?? (a.type === "created" ? D.activityFallback.created : a.type === "updated" ? D.activityFallback.updated : a.type);
              return (
                <div key={a.id || i} className="flex items-start gap-3 py-4">
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.userName || a.userEmail || D.activityFallback.system} · {formatDate(a.createdAt, locale)}
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const nouns = useClientsNouns();
  const D = t.clients.detail;
  /** Visible label per persisted estado value — raw values never change. */
  const statusBadge: Record<string, string> = {
    activo: t.clients.status.active,
    inactivo: t.clients.status.inactive,
    prospecto: t.clients.status.prospect,
  };
  const tabs = [
    { key: "resumen", label: D.tabs.summary },
    { key: "proyectos", label: capNoun(nouns.projects) },
    { key: "facturacion", label: capNoun(nouns.invoices) },
    { key: "actividad", label: D.tabs.activity },
  ];
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
        <p className="text-sm text-muted-foreground">{D.errors.invalidId({ client: nouns.client })}</p>
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

  if (error || !client || client.error) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-background">
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-sm font-medium text-destructive">{error || D.errors.notFound({ client: nouns.client })}</p>
          <Link href="/clientes" className="mt-4 text-sm text-primary hover:text-primary/80 font-medium">
            {D.errors.backToList({ clients: nouns.clients })}
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[client.estado] ?? { bg: "bg-[var(--status-neutral-bg)]", text: "text-[var(--status-neutral-text)]" };

  return (
    <>
      <ContextShell
        breadcrumbs={[
          { label: D.breadcrumbRoot, href: "/" },
          { label: capNoun(nouns.clients), href: "/clientes" },
          { label: client.nombre },
        ]}
        heading={
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{getInitials(client.nombre)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">{client.nombre}</h1>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
                  {statusBadge[client.estado] ?? client.estado}
                </span>
              </div>
            </div>
          </div>
        }
        meta={
          <div className="flex items-center gap-4 flex-wrap mt-1 ml-[60px]">
            {client.empresa && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 size={13} strokeWidth={1.75} className="text-muted-foreground" />
                {client.empresa}
              </span>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                <Mail size={13} strokeWidth={1.75} className="text-muted-foreground" />
                {client.email}
              </a>
            )}
            {client.telefono && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone size={13} strokeWidth={1.75} className="text-muted-foreground" />
                {client.telefono}
              </span>
            )}
          </div>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
              <Pencil size={13} strokeWidth={1.75} />
              {t.common.edit}
            </Button>
            <Button asChild size="sm">
              <Link href="/facturacion">
                <TrendingUp size={13} strokeWidth={1.75} />
                {D.viewBilling({ invoices: nouns.invoices })}
              </Link>
            </Button>
          </>
        }
        tabs={tabs}
        defaultTab="resumen"
        copilotContext={capNoun(nouns.clients)}
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
