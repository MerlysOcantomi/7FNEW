"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ContextShell } from "@/components/context-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Download, Send, CheckCircle2, AlertTriangle, Clock,
  FileText, Building2, Calendar, Hash, Paperclip,
  ArrowUpRight, CreditCard, Upload, StickyNote,
  Loader2, Pencil,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { apiPatch } from "@/lib/api-client";
import { FacturaForm } from "@/components/forms/factura-form";
import { useI18n } from "@/components/i18n-provider";
import { resolveStatusLabel } from "@core/i18n/ui";
import { formatCurrency as formatCurrencyIntl, formatDate as formatDateIntl } from "@core/i18n/format";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

interface FacturaData {
  id: string;
  numero: string;
  estado: string;
  subtotal: number;
  impuesto: number;
  total: number;
  items: LineItem[];
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  paidAt: string | null;
  clienteId: string | null;
  proyectoId: string | null;
  cliente?: { id: string; nombre: string } | null;
  proyecto?: { id: string; nombre: string } | null;
}

interface AttachmentData {
  id: string;
  nombre: string;
  tamano: number;
  url: string;
}

interface ActivityData {
  id: string;
  type: string;
  userName: string | null;
  createdAt: string;
  data: { comment?: string; label?: string; field?: string; oldValue?: unknown; newValue?: unknown } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Persisted estado VALUES → styling + icon only; visible labels resolve via
// the shared `statuses` catalog (`resolveStatusLabel`).
const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  pagada:    { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]", icon: CheckCircle2 },
  enviada:   { bg: "bg-[var(--status-info-bg)]",    text: "text-[var(--status-info-text)]",    icon: Clock },
  vencida:   { bg: "bg-[var(--status-danger-bg)]",   text: "text-[var(--status-danger-text)]",  icon: AlertTriangle },
  borrador:  { bg: "bg-[var(--status-neutral-bg)]",  text: "text-[var(--status-neutral-text)]", icon: FileText },
  cancelada: { bg: "bg-[var(--status-neutral-bg)]",  text: "text-[var(--status-neutral-text)]", icon: FileText },
};

// Activity `type` VALUES → styling only; visible labels come from the catalog.
const ACTIVITY_TYPE_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  created:       { bg: "bg-[var(--status-info-bg)]",    text: "text-[var(--status-info-text)]",    dot: "bg-primary" },
  comment:       { bg: "bg-[var(--status-neutral-bg)]",  text: "text-[var(--status-neutral-text)]", dot: "bg-muted-foreground" },
  updated:       { bg: "bg-[var(--status-warning-bg)]",  text: "text-[var(--status-warning-text)]", dot: "bg-[var(--status-warning-text)]" },
  deleted:       { bg: "bg-[var(--status-danger-bg)]",   text: "text-[var(--status-danger-text)]",  dot: "bg-destructive" },
  status_change: { bg: "bg-[var(--status-success-bg)]",  text: "text-[var(--status-success-text)]", dot: "bg-[var(--status-success-text)]" },
};

// Invoices don't persist a currency of their own yet — the workspace default.
const INVOICE_CURRENCY = "CHF";

function formatDate(value: string | Date | null | undefined, locale: string): string {
  if (!value) return "—";
  const formatted = formatDateIntl(value instanceof Date ? value : String(value), { locale });
  return formatted || "—";
}

function formatCurrency(value: number | null | undefined, locale: string): string {
  if (value == null) return "—";
  return formatCurrencyIntl(value, { locale, currency: INVOICE_CURRENCY }) || "—";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

// ── TAB: Resumen ──────────────────────────────────────────────────────────────

function TabResumen({ factura }: { factura: FacturaData }) {
  const { t, locale } = useI18n();
  const D = t.billing.detail;
  const paidRaw = factura.estado === "pagada" ? factura.total : 0;
  const paidPercent = factura.total > 0 ? Math.round((paidRaw / factura.total) * 100) : 0;
  const statusCfg = STATUS_CONFIG[factura.estado] ?? STATUS_CONFIG.borrador;

  return (
    <div className="space-y-6">
      {factura.estado === "vencida" && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-semibold text-destructive">{D.overdueAlert.title}</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              {D.overdueAlert.body({
                date: formatDate(factura.fechaVencimiento, locale),
                client: factura.cliente?.nombre ?? D.overdueAlert.clientFallback,
              })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-5">
          <SectionLabel>{D.summary.breakdown}</SectionLabel>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-accent rounded-xl p-4">
              <p className="text-xl font-bold text-foreground tracking-tight">{formatCurrency(factura.subtotal, locale)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{D.summary.subtotal}</p>
            </div>
            <div className="bg-accent rounded-xl p-4">
              <p className="text-xl font-bold text-foreground tracking-tight">{formatCurrency(factura.impuesto, locale)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{D.summary.taxes}</p>
            </div>
            <div className="bg-primary/15 rounded-xl p-4">
              <p className="text-xl font-bold text-primary tracking-tight">{formatCurrency(factura.total, locale)}</p>
              <p className="text-[10px] text-primary mt-0.5">{D.summary.total}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{D.summary.collectionStatus}</span>
              <span className="text-xs font-semibold text-foreground">{D.summary.collectedPct(paidPercent)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  paidPercent === 100 ? "bg-[var(--status-success-text)]" : paidPercent > 0 ? "bg-primary" : "bg-muted"
                )}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{D.summary.outstanding(paidRaw > 0 ? formatCurrency(factura.total - paidRaw, locale) : formatCurrency(factura.total, locale))}</span>
              {paidRaw > 0 && <span className="text-[var(--status-success-text)] font-medium">{D.summary.paid(formatCurrency(paidRaw, locale))}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-muted">
            <span className="text-xs text-muted-foreground">{D.summary.status}</span>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
              statusCfg.bg,
              statusCfg.text
            )}>
              {resolveStatusLabel(t.statuses, factura.estado)}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <SectionLabel>{D.summary.client}</SectionLabel>
            {factura.clienteId ? (
              <Link
                href={`/clientes/${factura.clienteId}`}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Building2 size={13} strokeWidth={1.75} />
                {factura.cliente?.nombre ?? "—"}
                <ArrowUpRight size={11} />
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>

          <div>
            <SectionLabel>{D.summary.project}</SectionLabel>
            {factura.proyectoId ? (
              <Link
                href={`/proyectos/${factura.proyectoId}`}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Hash size={13} strokeWidth={1.75} />
                {factura.proyecto?.nombre ?? "—"}
                <ArrowUpRight size={11} />
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>

          <div className="space-y-2 pt-1 border-t border-muted">
            {[
              { label: D.summary.issueDate, value: formatDate(factura.fechaEmision, locale), icon: Calendar },
              { label: D.summary.dueDate, value: formatDate(factura.fechaVencimiento, locale), icon: Calendar },
              ...(factura.paidAt ? [{ label: D.summary.paymentDate, value: formatDate(factura.paidAt, locale), icon: CreditCard }] : []),
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Icon size={11} strokeWidth={1.75} />
                  {label}
                </span>
                <span className="text-xs font-medium text-foreground text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Líneas ───────────────────────────────────────────────────────────────

function TabLineas({ factura }: { factura: FacturaData }) {
  const { t, locale } = useI18n();
  const D = t.billing.detail;
  const items = Array.isArray(factura.items) ? factura.items : [];

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <FileText size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">{D.lines.emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{D.lines.emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionLabel>{D.lines.heading}</SectionLabel>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-muted bg-background">
          <span className="col-span-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{D.lines.columns.concept}</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">{D.lines.columns.quantity}</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">{D.lines.columns.unitPrice}</span>
          <span className="col-span-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">{D.lines.columns.total}</span>
        </div>

        {items.map((item, i) => (
          <div
            key={i}
            className={cn(i < items.length - 1 && "border-b border-muted")}
          >
            <div className="hidden md:grid grid-cols-12 items-center px-5 py-4">
              <span className="col-span-5 text-sm text-foreground pr-4 leading-snug">{item.descripcion || "—"}</span>
              <span className="col-span-2 text-sm text-muted-foreground text-right">{item.cantidad}</span>
              <span className="col-span-2 text-sm text-muted-foreground text-right">{formatCurrency(item.precioUnitario, locale)}</span>
              <span className="col-span-3 text-sm font-semibold text-foreground text-right">{formatCurrency(item.total, locale)}</span>
            </div>

            <div className="md:hidden px-4 py-4 space-y-2">
              <p className="text-sm text-foreground leading-snug">{item.descripcion || "—"}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{item.cantidad} × {formatCurrency(item.precioUnitario, locale)}</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(item.total, locale)}</span>
              </div>
            </div>
          </div>
        ))}

        <div className="border-t border-border bg-background px-5 py-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{D.summary.subtotal}</span>
            <span className="text-sm text-foreground">{formatCurrency(factura.subtotal, locale)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{D.summary.taxes}</span>
            <span className="text-sm text-foreground">{formatCurrency(factura.impuesto, locale)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-semibold text-foreground">{D.lines.totalDue}</span>
            <span className="text-base font-bold text-foreground">{formatCurrency(factura.total, locale)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Pagos ────────────────────────────────────────────────────────────────

function TabPagos({ factura }: { factura: FacturaData }) {
  const { t, locale } = useI18n();
  const D = t.billing.detail;
  const paidRaw = factura.estado === "pagada" ? factura.total : 0;
  const paidPercent = factura.total > 0 ? Math.round((paidRaw / factura.total) * 100) : 0;
  const statusCfg = STATUS_CONFIG[factura.estado] ?? STATUS_CONFIG.borrador;

  const payments = factura.estado === "pagada" && factura.paidAt
    ? [{ date: formatDate(factura.paidAt, locale), amount: formatCurrency(factura.total, locale), method: D.payments.fullPayment }]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <SectionLabel>{D.payments.heading}</SectionLabel>

        {payments.length === 0 ? (
          <div className="bg-card rounded-xl border border-border px-5 py-10 text-center">
            <CreditCard size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">{D.payments.emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {factura.estado === "vencida" ? D.payments.emptyOverdueBody : D.payments.emptyPendingBody}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-muted bg-background">
              <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{D.payments.columns.date}</span>
              <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{D.payments.columns.method}</span>
              <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">{D.payments.columns.amount}</span>
            </div>
            {payments.map((p, i) => (
              <div key={i} className="grid grid-cols-12 items-center px-5 py-4 border-b border-muted last:border-0">
                <span className="col-span-4 text-sm text-foreground">{p.date}</span>
                <span className="col-span-4 text-sm text-muted-foreground">{p.method}</span>
                <span className="col-span-4 text-sm font-semibold text-[var(--status-success-text)] text-right">{p.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <SectionLabel>{D.payments.summaryHeading}</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-accent rounded-xl p-3.5">
              <p className="text-base font-bold text-foreground">{formatCurrency(factura.total, locale)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{D.payments.totalIssued}</p>
            </div>
            <div className={cn("rounded-xl p-3.5", paidRaw > 0 ? "bg-[var(--status-success-bg)]" : "bg-[var(--status-neutral-bg)]")}>
              <p className={cn("text-base font-bold", paidRaw > 0 ? "text-[var(--status-success-text)]" : "text-muted-foreground")}>
                {formatCurrency(paidRaw, locale)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{D.payments.totalCollected}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full", paidPercent === 100 ? "bg-[var(--status-success-text)]" : "bg-primary")}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{D.summary.collectedPct(paidPercent)}</p>
          </div>
          <div className="pt-1 border-t border-muted space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground">{D.summary.dueDate}</span>
              <span className="text-xs font-medium text-foreground text-right">{formatDate(factura.fechaVencimiento, locale)}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground">{D.summary.status}</span>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", statusCfg.bg, statusCfg.text)}>
                {resolveStatusLabel(t.statuses, factura.estado)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Archivos ─────────────────────────────────────────────────────────────

function TabArchivos({
  facturaId,
  attachments,
  loading,
  onRefresh,
}: {
  facturaId: string;
  attachments: AttachmentData[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const F = t.billing.detail.files;
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("module", "facturacion");
      formData.set("recordId", facturaId);
      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "");
      toast.success(F.toasts.uploaded);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : F.toasts.uploadError);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <SectionLabel>{F.heading}</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Paperclip size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">{F.emptyTitle}</p>
          <p className="text-xs text-muted-foreground mt-1">{F.emptyBody}</p>
        </div>
        <label className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-background transition-colors justify-center cursor-pointer">
          <Upload size={14} strokeWidth={1.75} />
          {uploading ? F.uploading : F.upload}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <SectionLabel>{F.heading}</SectionLabel>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {attachments.map((file, i) => (
          <div
            key={file.id}
            className={cn(
              "flex items-center gap-4 px-5 py-4 hover:bg-background transition-colors",
              i < attachments.length - 1 && "border-b border-muted"
            )}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-accent">
              <FileText size={15} className="text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.nombre}</p>
              <span className="text-[10px] text-muted-foreground">{formatFileSize(file.tamano)}</span>
            </div>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
            >
              <Download size={12} strokeWidth={1.75} />
              {F.download}
            </a>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-background transition-colors justify-center cursor-pointer">
        <Upload size={14} strokeWidth={1.75} />
        {uploading ? F.uploading : F.upload}
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}

// ── TAB: Notas (Activity comments) ───────────────────────────────────────────

function TabNotas({
  facturaId,
  activities,
  loading,
  onRefresh,
}: {
  facturaId: string;
  activities: ActivityData[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t, locale } = useI18n();
  const N = t.billing.detail.notes;
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const comments = activities.filter((a) => a.type === "comment");

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "facturacion",
          recordId: facturaId,
          comment: comment.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "");
      toast.success(N.toasts.added);
      setComment("");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : N.toasts.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <SectionLabel>{N.heading}</SectionLabel>
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-start gap-3">
          <StickyNote size={14} className="text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
          <p className="text-xs text-muted-foreground leading-relaxed">{N.visibilityNote}</p>
        </div>

        <form onSubmit={handleAddComment} className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors leading-relaxed"
            rows={4}
            placeholder={N.placeholder}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving || !comment.trim()}>
              {saving ? N.saving : N.save}
            </Button>
          </div>
        </form>

        {comments.length > 0 && (
          <div className="pt-4 border-t border-muted space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{N.previous}</p>
            <div className="space-y-2">
              {comments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2">
                  <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{a.data?.comment ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.userName ?? N.userFallback} · {formatDate(a.createdAt, locale)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">{N.empty}</p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Historial (Activity timeline) ────────────────────────────────────────

function TabHistorial({ activities, loading }: { activities: ActivityData[]; loading: boolean }) {
  const { t, locale } = useI18n();
  const A = t.billing.detail.activity;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Clock size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">{A.emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{A.emptyBody}</p>
      </div>
    );
  }

  const nonComments = activities.filter((a) => a.type !== "comment");

  if (nonComments.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Clock size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">{A.onlyCommentsTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{A.onlyCommentsBody}</p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    created: A.types.created,
    comment: A.types.comment,
    updated: A.types.updated,
    deleted: A.types.deleted,
    status_change: A.types.statusChange,
  };

  return (
    <div className="space-y-4">
      <SectionLabel>{A.heading}</SectionLabel>
      <div className="bg-card rounded-xl border border-border px-5 py-2 divide-y divide-muted">
        {nonComments.map((event) => {
          const cfg = ACTIVITY_TYPE_CONFIG[event.type] ?? ACTIVITY_TYPE_CONFIG.updated;
          const label = event.data?.label ?? event.type;
          const changes = (event.data as any)?.changes;
          const desc = event.type === "updated" && Array.isArray(changes) && changes.length > 0
            ? changes.map((c: any) => `${c.field}: ${c.oldValue} → ${c.newValue}`).join("; ")
            : event.type === "updated" && event.data?.field
            ? `${event.data.field}: ${event.data.oldValue} → ${event.data.newValue}`
            : event.type === "created"
            ? A.createdDesc(String(label))
            : event.type === "deleted"
            ? A.deletedDesc
            : event.type === "status_change"
            ? A.statusChangeDesc(String(event.data?.oldValue), String(event.data?.newValue))
            : String(label);
          return (
            <div key={event.id} className="flex items-start gap-3 py-4">
              <span className={cn("mt-1.5 shrink-0 w-2 h-2 rounded-full", cfg.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{desc}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(event.createdAt, locale)} · {event.userName ?? A.systemFallback}</p>
              </div>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", cfg.bg, cfg.text)}>
                {typeLabels[event.type] ?? A.types.updated}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { t, locale } = useI18n();
  const B = t.billing;
  const D = B.detail;
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const facturaUrl = id ? `/api/facturacion/${id}` : null;
  const attachmentsUrl = id ? `/api/attachments?module=facturacion&recordId=${id}` : null;
  const activityUrl = id ? `/api/activity?module=facturacion&recordId=${id}` : null;

  const { data: factura, loading, error, refetch } = useFetch<FacturaData>(facturaUrl, { refreshKey });
  const { data: attachmentsData, loading: attachmentsLoading, refetch: refetchAttachments } = useFetch<AttachmentData[]>(attachmentsUrl, { refreshKey });
  const { data: activityData, loading: activityLoading, refetch: refetchActivity } = useFetch<ActivityData[]>(activityUrl, { refreshKey });

  const attachments = Array.isArray(attachmentsData) ? attachmentsData : [];
  const activities = Array.isArray(activityData) ? activityData : [];

  const statusCfg = factura ? (STATUS_CONFIG[factura.estado] ?? STATUS_CONFIG.borrador) : STATUS_CONFIG.borrador;
  const StatusIcon = statusCfg.icon;

  const tabs = [
    { key: "resumen",  label: D.tabs.summary },
    { key: "lineas",   label: D.tabs.lines },
    { key: "pagos",    label: D.tabs.payments },
    { key: "archivos", label: D.tabs.files },
    { key: "notas",    label: D.tabs.notes },
    { key: "historial", label: D.tabs.activity },
  ];

  function handleFormSuccess() {
    setRefreshKey((k) => k + 1);
    refetch();
    setEditOpen(false);
  }

  async function handleMarkAsPaid() {
    if (!id || !factura) return;
    try {
      await apiPatch(`/api/facturacion/${id}`, {
        estado: "pagada",
        paidAt: new Date().toISOString(),
      });
      toast.success(D.toasts.markedPaid);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : D.toasts.updateError);
    }
  }

  if (loading && !factura) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !factura) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <p className="text-sm font-medium text-destructive">{error ?? D.errors.notFound}</p>
            <p className="text-xs text-muted-foreground mt-2">{D.errors.notFoundBody}</p>
            <Link
              href="/facturacion"
              className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80"
            >
              {D.errors.backToBilling}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <ContextShell
      breadcrumbs={[
        { label: B.eyebrow, href: "/" },
        { label: B.invoices, href: "/facturacion" },
        { label: factura.numero },
      ]}
      heading={
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {D.invoiceTitle(factura.numero)}
          </h1>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
            statusCfg.bg, statusCfg.text
          )}>
            <StatusIcon size={12} strokeWidth={2} />
            {resolveStatusLabel(t.statuses, factura.estado)}
          </span>
        </div>
      }
      meta={
        <div className="flex items-center gap-4 flex-wrap">
          {factura.clienteId && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 size={13} strokeWidth={1.75} className="text-muted-foreground" />
              <Link href={`/clientes/${factura.clienteId}`} className="hover:text-primary transition-colors">
                {factura.cliente?.nombre ?? "—"}
              </Link>
            </span>
          )}
          {factura.proyectoId && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Hash size={13} strokeWidth={1.75} className="text-muted-foreground" />
              <Link href={`/proyectos/${factura.proyectoId}`} className="hover:text-primary transition-colors">
                {factura.proyecto?.nombre ?? "—"}
              </Link>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar size={13} strokeWidth={1.75} className="text-muted-foreground" />
            {B.list.issuedOn(formatDate(factura.fechaEmision, locale))}
          </span>
          {factura.fechaVencimiento && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar size={13} strokeWidth={1.75} className="text-muted-foreground" />
              {B.list.dueOn(formatDate(factura.fechaVencimiento, locale))}
            </span>
          )}
          <span className="text-sm font-bold text-foreground">{formatCurrency(factura.total, locale)}</span>
        </div>
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={13} strokeWidth={1.75} />
            {t.common.edit}
          </Button>
          <Button variant="outline" size="sm">
            <Download size={13} strokeWidth={1.75} />
            {D.downloadPdf}
          </Button>
          <Button variant="outline" size="sm">
            <Send size={13} strokeWidth={1.75} />
            {D.sendByEmail}
          </Button>
          {(factura.estado === "enviada" || factura.estado === "vencida") && (
            <Button size="sm" onClick={handleMarkAsPaid}>
              <CheckCircle2 size={13} strokeWidth={1.75} />
              {D.markAsPaid}
            </Button>
          )}
        </>
      }
      tabs={tabs}
      defaultTab="resumen"
      copilotContext="Billing"
    >
      {(activeTab) => {
        if (activeTab === "resumen")  return <TabResumen factura={factura} />;
        if (activeTab === "lineas")   return <TabLineas factura={factura} />;
        if (activeTab === "pagos")    return <TabPagos factura={factura} />;
        if (activeTab === "archivos") return (
          <TabArchivos
            facturaId={factura.id}
            attachments={attachments}
            loading={attachmentsLoading}
            onRefresh={() => { setRefreshKey((k) => k + 1); refetchAttachments(); }}
          />
        );
        if (activeTab === "notas") return (
          <TabNotas
            facturaId={factura.id}
            activities={activities}
            loading={activityLoading}
            onRefresh={() => { setRefreshKey((k) => k + 1); refetchActivity(); }}
          />
        );
        if (activeTab === "historial") return (
          <TabHistorial activities={activities} loading={activityLoading} />
        );
        return null;
      }}
    </ContextShell>
    <FacturaForm open={editOpen} onClose={() => setEditOpen(false)} onSuccess={handleFormSuccess} data={factura} />
    </>
  );
}
