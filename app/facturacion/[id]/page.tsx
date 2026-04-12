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
import { displayLabel, estadoLabel } from "@/lib/api-client";
import { FacturaForm } from "@/components/forms/factura-form";
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

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  pagada:    { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]", icon: CheckCircle2, label: "Paid" },
  enviada:   { bg: "bg-[var(--status-info-bg)]",    text: "text-[var(--status-info-text)]",    icon: Clock,        label: "Pending" },
  vencida:   { bg: "bg-[var(--status-danger-bg)]",   text: "text-[var(--status-danger-text)]",  icon: AlertTriangle, label: "Overdue" },
  borrador:  { bg: "bg-[var(--status-neutral-bg)]",  text: "text-[var(--status-neutral-text)]", icon: FileText,     label: "Draft" },
  cancelada: { bg: "bg-[var(--status-neutral-bg)]",  text: "text-[var(--status-neutral-text)]", icon: FileText,     label: "Canceled" },
};

const ACTIVITY_TYPE_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  created:       { bg: "bg-[var(--status-info-bg)]",    text: "text-[var(--status-info-text)]",    dot: "bg-primary",                        label: "Creada" },
  comment:       { bg: "bg-[var(--status-neutral-bg)]",  text: "text-[var(--status-neutral-text)]", dot: "bg-muted-foreground",               label: "Comentario" },
  updated:       { bg: "bg-[var(--status-warning-bg)]",  text: "text-[var(--status-warning-text)]", dot: "bg-[var(--status-warning-text)]",   label: "Actualizada" },
  deleted:       { bg: "bg-[var(--status-danger-bg)]",   text: "text-[var(--status-danger-text)]",  dot: "bg-destructive",                    label: "Eliminada" },
  status_change: { bg: "bg-[var(--status-success-bg)]",  text: "text-[var(--status-success-text)]", dot: "bg-[var(--status-success-text)]",   label: "Estado" },
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
  const paidRaw = factura.estado === "pagada" ? factura.total : 0;
  const paidPercent = factura.total > 0 ? Math.round((paidRaw / factura.total) * 100) : 0;
  const statusCfg = STATUS_CONFIG[factura.estado] ?? STATUS_CONFIG.borrador;

  return (
    <div className="space-y-6">
      {factura.estado === "vencida" && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl p-4">
          <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-semibold text-destructive">Overdue payment — immediate action required</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              Esta factura venció el {formatDate(factura.fechaVencimiento)}. Contacta al equipo de cuentas a pagar de{" "}
              {factura.cliente?.nombre ?? "el cliente"}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-5">
          <SectionLabel>Desglose del importe</SectionLabel>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-accent rounded-xl p-4">
              <p className="text-xl font-bold text-foreground tracking-tight">{formatCurrency(factura.subtotal)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Subtotal</p>
            </div>
            <div className="bg-accent rounded-xl p-4">
              <p className="text-xl font-bold text-foreground tracking-tight">{formatCurrency(factura.impuesto)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Impuestos</p>
            </div>
            <div className="bg-primary/15 rounded-xl p-4">
              <p className="text-xl font-bold text-primary tracking-tight">{formatCurrency(factura.total)}</p>
              <p className="text-[10px] text-primary mt-0.5">Total</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Estado de cobro</span>
              <span className="text-xs font-semibold text-foreground">{paidPercent}% cobrado</span>
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
              <span>Outstanding: {paidRaw > 0 ? formatCurrency(factura.total - paidRaw) : formatCurrency(factura.total)}</span>
              {paidRaw > 0 && <span className="text-[var(--status-success-text)] font-medium">Paid: {formatCurrency(paidRaw)}</span>}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-muted">
            <span className="text-xs text-muted-foreground">Estado</span>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
              statusCfg.bg,
              statusCfg.text
            )}>
              {displayLabel(factura.estado, estadoLabel)}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <SectionLabel>Cliente</SectionLabel>
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
            <SectionLabel>Proyecto</SectionLabel>
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
              { label: "Issue date", value: formatDate(factura.fechaEmision), icon: Calendar },
              { label: "Due date", value: formatDate(factura.fechaVencimiento), icon: Calendar },
              ...(factura.paidAt ? [{ label: "Payment date", value: formatDate(factura.paidAt), icon: CreditCard }] : []),
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
  const items = Array.isArray(factura.items) ? factura.items : [];

  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <FileText size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">No invoice lines</p>
        <p className="text-xs text-muted-foreground mt-1">Esta factura no tiene conceptos registrados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Invoice lines</SectionLabel>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-muted bg-background">
          <span className="col-span-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Concepto</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Cantidad</span>
          <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">P. unitario</span>
          <span className="col-span-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Total</span>
        </div>

        {items.map((item, i) => (
          <div
            key={i}
            className={cn(i < items.length - 1 && "border-b border-muted")}
          >
            <div className="hidden md:grid grid-cols-12 items-center px-5 py-4">
              <span className="col-span-5 text-sm text-foreground pr-4 leading-snug">{item.descripcion || "—"}</span>
              <span className="col-span-2 text-sm text-muted-foreground text-right">{item.cantidad}</span>
              <span className="col-span-2 text-sm text-muted-foreground text-right">{formatCurrency(item.precioUnitario)}</span>
              <span className="col-span-3 text-sm font-semibold text-foreground text-right">{formatCurrency(item.total)}</span>
            </div>

            <div className="md:hidden px-4 py-4 space-y-2">
              <p className="text-sm text-foreground leading-snug">{item.descripcion || "—"}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{item.cantidad} × {formatCurrency(item.precioUnitario)}</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(item.total)}</span>
              </div>
            </div>
          </div>
        ))}

        <div className="border-t border-border bg-background px-5 py-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Subtotal</span>
            <span className="text-sm text-foreground">{formatCurrency(factura.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Impuestos</span>
            <span className="text-sm text-foreground">{formatCurrency(factura.impuesto)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-semibold text-foreground">Total a pagar</span>
            <span className="text-base font-bold text-foreground">{formatCurrency(factura.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Pagos ────────────────────────────────────────────────────────────────

function TabPagos({ factura }: { factura: FacturaData }) {
  const paidRaw = factura.estado === "pagada" ? factura.total : 0;
  const paidPercent = factura.total > 0 ? Math.round((paidRaw / factura.total) * 100) : 0;
  const statusCfg = STATUS_CONFIG[factura.estado] ?? STATUS_CONFIG.borrador;

  const payments = factura.estado === "pagada" && factura.paidAt
    ? [{ date: formatDate(factura.paidAt), amount: formatCurrency(factura.total), method: "Pago completo" }]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <SectionLabel>Recorded payments</SectionLabel>

        {payments.length === 0 ? (
          <div className="bg-card rounded-xl border border-border px-5 py-10 text-center">
            <CreditCard size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">No payments recorded</p>
            <p className="text-xs text-muted-foreground mt-1">
              {factura.estado === "vencida"
                ? "Esta factura está vencida. Marca como pagada cuando se reciba el pago."
                : "El pago aparecerá aquí cuando se confirme la recepción."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-muted bg-background">
              <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fecha</span>
              <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Método</span>
              <span className="col-span-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Importe</span>
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
        <SectionLabel>Collection summary</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-accent rounded-xl p-3.5">
              <p className="text-base font-bold text-foreground">{formatCurrency(factura.total)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total emitido</p>
            </div>
            <div className={cn("rounded-xl p-3.5", paidRaw > 0 ? "bg-[var(--status-success-bg)]" : "bg-[var(--status-neutral-bg)]")}>
              <p className={cn("text-base font-bold", paidRaw > 0 ? "text-[var(--status-success-text)]" : "text-muted-foreground")}>
                {paidRaw > 0 ? formatCurrency(paidRaw) : "$0"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total cobrado</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full", paidPercent === 100 ? "bg-[var(--status-success-text)]" : "bg-primary")}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{paidPercent}% cobrado</p>
          </div>
          <div className="pt-1 border-t border-muted space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground">Fecha vencimiento</span>
              <span className="text-xs font-medium text-foreground text-right">{formatDate(factura.fechaVencimiento)}</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-muted-foreground">Estado</span>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", statusCfg.bg, statusCfg.text)}>
                {displayLabel(factura.estado, estadoLabel)}
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
      if (!json.success) throw new Error(json.error?.message || "Error al subir");
      toast.success("Archivo subido");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir archivo");
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
        <SectionLabel>Attached files</SectionLabel>
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Paperclip size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">No attached files</p>
          <p className="text-xs text-muted-foreground mt-1">Sube documentos relacionados con esta factura.</p>
        </div>
        <label className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-background transition-colors justify-center cursor-pointer">
          <Upload size={14} strokeWidth={1.75} />
          {uploading ? "Subiendo…" : "Subir archivo adjunto"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <SectionLabel>Attached files</SectionLabel>

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
              Descargar
            </a>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-background transition-colors justify-center cursor-pointer">
        <Upload size={14} strokeWidth={1.75} />
        {uploading ? "Subiendo…" : "Subir archivo adjunto"}
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
      if (!json.success) throw new Error(json.error?.message || "Error al guardar");
      toast.success("Nota agregada");
      setComment("");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar nota");
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
      <SectionLabel>Internal notes</SectionLabel>
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-start gap-3">
          <StickyNote size={14} className="text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Las notas internas son visibles únicamente para el equipo. No se incluyen en la factura enviada al cliente.
          </p>
        </div>

        <form onSubmit={handleAddComment} className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors leading-relaxed"
            rows={4}
            placeholder="Agrega una nota interna sobre esta factura..."
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving || !comment.trim()}>
              {saving ? "Saving..." : "Save note"}
            </Button>
          </div>
        </form>

        {comments.length > 0 && (
          <div className="pt-4 border-t border-muted space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Previous notes</p>
            <div className="space-y-2">
              {comments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2">
                  <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{a.data?.comment ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.userName ?? "Usuario"} · {formatDate(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground">No hay notas anteriores.</p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Historial (Activity timeline) ────────────────────────────────────────

function TabHistorial({ activities, loading }: { activities: ActivityData[]; loading: boolean }) {
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
        <p className="text-sm font-medium text-foreground">Sin actividad registrada</p>
        <p className="text-xs text-muted-foreground mt-1">Los cambios y comentarios aparecerán aquí.</p>
      </div>
    );
  }

  const nonComments = activities.filter((a) => a.type !== "comment");

  if (nonComments.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Clock size={28} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground">No change history</p>
        <p className="text-xs text-muted-foreground mt-1">Only comments are available in the Notes tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionLabel>Historial de actividad</SectionLabel>
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
            ? `Factura creada: ${label}`
            : event.type === "deleted"
            ? "Factura eliminada"
            : event.type === "status_change"
            ? `Estado: ${event.data?.oldValue} → ${event.data?.newValue}`
            : String(label);
          return (
            <div key={event.id} className="flex items-start gap-3 py-4">
              <span className={cn("mt-1.5 shrink-0 w-2 h-2 rounded-full", cfg.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{desc}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(event.createdAt)} · {event.userName ?? "Sistema"}</p>
              </div>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", cfg.bg, cfg.text)}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "resumen",  label: "Summary" },
  { key: "lineas",   label: "Lines" },
  { key: "pagos",    label: "Payments" },
  { key: "archivos", label: "Files" },
  { key: "notas",    label: "Notes" },
  { key: "historial", label: "Activity" },
];

export default function InvoiceDetailPage() {
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
      toast.success("Factura marcada como pagada");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
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
            <p className="text-sm font-medium text-destructive">{error ?? "Factura no encontrada"}</p>
            <p className="text-xs text-muted-foreground mt-2">La factura puede no existir o no tener acceso.</p>
            <Link
              href="/facturacion"
              className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary/80"
            >
              Back to billing
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
        { label: "Revenue", href: "/" },
        { label: "Invoices", href: "/facturacion" },
        { label: factura.numero },
      ]}
      heading={
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Factura {factura.numero}
          </h1>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
            statusCfg.bg, statusCfg.text
          )}>
            <StatusIcon size={12} strokeWidth={2} />
            {displayLabel(factura.estado, estadoLabel)}
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
            Emitida {formatDate(factura.fechaEmision)}
          </span>
          {factura.fechaVencimiento && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar size={13} strokeWidth={1.75} className="text-muted-foreground" />
              Vence {formatDate(factura.fechaVencimiento)}
            </span>
          )}
          <span className="text-sm font-bold text-foreground">{formatCurrency(factura.total)}</span>
        </div>
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil size={13} strokeWidth={1.75} />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Download size={13} strokeWidth={1.75} />
            Descargar PDF
          </Button>
          <Button variant="outline" size="sm">
            <Send size={13} strokeWidth={1.75} />
            Send by email
          </Button>
          {(factura.estado === "enviada" || factura.estado === "vencida") && (
            <Button size="sm" onClick={handleMarkAsPaid}>
              <CheckCircle2 size={13} strokeWidth={1.75} />
              Marcar como pagada
            </Button>
          )}
        </>
      }
      tabs={TABS}
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
