"use client"

import { use, useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ContextShell } from "@/components/context-shell"
import { AppShell } from "@/components/app-shell"
import { InlineText, InlineSelect, InlineDate } from "@/components/inline-edit"
import { DetailSection, DetailMetaRow, DetailEmpty, formatDateES, formatCurrencyMXN } from "@/components/detail-section"
import { apiPatch, apiDelete } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { CanEdit, CanDelete } from "@/components/role-gate"
import { SmartAction } from "@/components/smart-action"
import { DocumentoForm } from "@/components/forms/documento-form"
import { TransaccionForm } from "@/components/forms/transaccion-form"
import { CommentsSection } from "@/components/comments-section"
import { ActivityTimeline } from "@/components/activity-timeline"
import { UploadArea } from "@/components/upload-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmModal } from "@/components/confirm-modal"
import { RelationSelect } from "@/components/relation-select"
import { FacturaSkina } from "@/components/templates/factura-skina"
import { PDFPreviewButton, PDFExportButton } from "@/components/pdf-viewer"
import { QRButton } from "@/components/qr-code-modal"
import { SavedQRCodes } from "@/components/saved-qr-codes"
import {
  Receipt,
  Trash2,
  Building2,
  FolderKanban,
  CreditCard,
  Package,
  Calendar,
  Hash,
  Plus,
  FileText,
  Download,
  DollarSign,
} from "lucide-react"

const ESTADO_OPTIONS = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "pagada", label: "Pagada" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
]

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  borrador: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
  enviada: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  pagada: { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  vencida: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  cancelada: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
}

const estadoBadge = (v: string) =>
  ({
    borrador: "bg-muted text-muted-foreground",
    enviada: "bg-blue-100 text-blue-700",
    pagada: "bg-emerald-100 text-emerald-700",
    vencida: "bg-red-100 text-red-700",
    cancelada: "bg-muted text-muted-foreground",
  })[v] ?? "bg-muted text-muted-foreground"

function daysUntilDue(fecha: string | null | undefined): { days: number; overdue: boolean } {
  if (!fecha) return { days: 0, overdue: false }
  const target = new Date(fecha)
  if (Number.isNaN(target.getTime())) return { days: 0, overdue: false }
  const diff = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return { days: Math.abs(diff), overdue: diff < 0 }
}

const FACTURA_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "lineas", label: "Lineas" },
  { key: "pagos", label: "Pagos" },
  { key: "archivos", label: "Archivos" },
  { key: "notas", label: "Notas" },
]

export default function FacturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: factura, loading, error, refetch } = useFetch<any>(`/api/facturacion/${id}`)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      await apiPatch(`/api/facturacion/${id}`, { [field]: value })
      toast.success("Guardado")
      refetch()
    },
    [id, refetch],
  )

  const handleDelete = useCallback(async () => {
    await apiDelete(`/api/facturacion/${id}`)
    toast.success("Factura eliminada")
    router.push("/facturacion")
  }, [id, router])

  const markAsPaid = useCallback(async () => {
    await apiPatch(`/api/facturacion/${id}`, { estado: "pagada", paidAt: new Date().toISOString() })
    toast.success("Factura marcada como pagada")
    refetch()
  }, [id, refetch])

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-6 w-48 bg-[#E2E8F0] rounded" />
          <div className="h-40 bg-[#E2E8F0] rounded-xl" />
        </div>
      </AppShell>
    )
  }

  if (error || !factura) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-12">
          <Receipt className="h-12 w-12 text-[#94A3B8]" />
          <p className="text-sm font-semibold text-[#0F172A]">Factura no encontrada</p>
          <Link href="/facturacion" className="text-sm font-medium text-[#2563EB] hover:underline">← Volver a Facturacion</Link>
        </div>
      </AppShell>
    )
  }

  const items = Array.isArray(factura.items) ? factura.items : []
  const cliente = factura.cliente ?? null
  const proyecto = factura.proyecto ?? null
  const dueInfo = daysUntilDue(factura.fechaVencimiento)
  const isPaid = factura.estado === "pagada"
  const statusStyle = STATUS_STYLE[factura.estado] ?? STATUS_STYLE.borrador

  return (
    <ContextShell
      breadcrumbs={[
        { label: "Funds", href: "/facturacion" },
        { label: "Facturacion", href: "/facturacion" },
        { label: factura.numero ?? "Factura" },
      ]}
      heading={
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">{factura.numero ?? "Factura"}</h1>
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
            {factura.estado ?? "borrador"}
          </span>
          <span className="text-lg font-bold text-[#0F172A] tracking-tight">{formatCurrencyMXN(Number(factura.total ?? 0))}</span>
        </div>
      }
      meta={
        <div className="flex items-center gap-4 flex-wrap">
          {cliente && (
            <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
              <Building2 size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
              <Link href={`/clientes/${factura.clienteId}`} className="hover:text-[#3B82F6] transition-colors">{cliente.nombre}</Link>
            </span>
          )}
          {proyecto && (
            <span className="flex items-center gap-1.5 text-sm text-[#64748B]">
              <FolderKanban size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
              <Link href={`/proyectos/${factura.proyectoId}`} className="hover:text-[#3B82F6] transition-colors">{proyecto.nombre}</Link>
            </span>
          )}
          {factura.fechaVencimiento && !isPaid && (
            <span className={cn("flex items-center gap-1.5 text-sm", dueInfo.overdue ? "text-red-600" : "text-[#64748B]")}>
              <Calendar size={13} strokeWidth={1.75} className={dueInfo.overdue ? "text-red-400" : "text-[#94A3B8]"} />
              {dueInfo.overdue ? `Vencida hace ${dueInfo.days} dias` : `Vence en ${dueInfo.days} dias`}
            </span>
          )}
          {isPaid && factura.paidAt && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CreditCard size={13} strokeWidth={1.75} />
              Pagada el {formatDateES(factura.paidAt)}
            </span>
          )}
        </div>
      }
      actions={
        <>
          <QRButton module="facturacion" recordId={id} defaultUrl={typeof window !== "undefined" ? `${window.location.origin}/facturacion/${id}` : `/facturacion/${id}`} />
          <CanDelete>
            <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#94A3B8] text-xs font-medium hover:text-red-600 hover:border-red-200 transition-colors">
              <Trash2 size={13} strokeWidth={1.75} />
              Eliminar
            </button>
          </CanDelete>
        </>
      }
      tabs={FACTURA_TABS}
      defaultTab="resumen"
      copilotContext="Funds"
    >
      {(activeTab) => (
        <>
          {/* ─── RESUMEN ─── */}
          {activeTab === "resumen" && (
            <div className="flex flex-col gap-6">
              {/* Financial summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FinCard label="Total" value={formatCurrencyMXN(Number(factura.total ?? 0))} variant="neutral" />
                <FinCard label="Subtotal" value={formatCurrencyMXN(Number(factura.subtotal ?? 0))} variant="neutral" />
                <FinCard label="Impuesto" value={formatCurrencyMXN(Number(factura.impuesto ?? 0))} variant="neutral" />
                <FinCard label="Estado" value={factura.estado ?? "borrador"} variant={isPaid ? "positive" : dueInfo.overdue ? "warning" : "neutral"} />
              </div>

              {/* Details */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-4">Detalles</p>
                <div className="space-y-0">
                  <DetailMetaRow label="Emision">
                    <CanEdit><InlineDate value={factura.fechaEmision ?? null} onSave={(v) => saveField("fechaEmision", v)} placeholder="Sin fecha" /></CanEdit>
                  </DetailMetaRow>
                  <DetailMetaRow label="Vencimiento">
                    <CanEdit><InlineDate value={factura.fechaVencimiento ?? null} onSave={(v) => saveField("fechaVencimiento", v)} placeholder="Sin fecha" /></CanEdit>
                  </DetailMetaRow>
                  <DetailMetaRow label="Cliente">
                    <RelationSelect label="Cliente" icon={Building2} value={factura.clienteId ?? null} field="clienteId" targetModule="clientes" sourceModule="facturacion" sourceId={id} displayField="nombre" currentDisplay={cliente?.nombre} onSaved={refetch} />
                  </DetailMetaRow>
                  <DetailMetaRow label="Proyecto">
                    <RelationSelect label="Proyecto" icon={FolderKanban} value={factura.proyectoId ?? null} field="proyectoId" targetModule="proyectos" sourceModule="facturacion" sourceId={id} displayField="nombre" currentDisplay={proyecto?.nombre} onSaved={refetch} />
                  </DetailMetaRow>
                  <DetailMetaRow label="Creada" last>
                    <span className="text-sm text-[#94A3B8]">{formatDateES(factura.createdAt)}</span>
                  </DetailMetaRow>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-3">Historial</p>
                <div className="space-y-3">
                  <TimelineItem icon={Calendar} label="Creada" date={factura.createdAt} />
                  {factura.fechaEmision && <TimelineItem icon={Receipt} label="Emitida" date={factura.fechaEmision} />}
                  {factura.paidAt && <TimelineItem icon={CreditCard} label="Pagada" date={factura.paidAt} color="text-emerald-500" />}
                  {factura.fechaVencimiento && !isPaid && <TimelineItem icon={Calendar} label={dueInfo.overdue ? "Vencida" : "Vence"} date={factura.fechaVencimiento} color={dueInfo.overdue ? "text-red-600" : "text-[#94A3B8]"} />}
                </div>
              </div>
            </div>
          )}

          {/* ─── LINEAS ─── */}
          {activeTab === "lineas" && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">Conceptos ({items.length})</p>
              </div>
              {items.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">Sin conceptos registrados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Descripcion</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Cant.</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Precio</th>
                        <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-5 py-3 text-[#334155]">{item.descripcion ?? item.concepto ?? `Item ${i + 1}`}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-[#64748B]">{item.cantidad ?? 1}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-[#64748B]">{formatCurrencyMXN(Number(item.precioUnitario ?? item.precio ?? 0))}</td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums text-[#0F172A]">{formatCurrencyMXN(Number(item.cantidad ?? 1) * Number(item.precioUnitario ?? item.precio ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                        <td colSpan={3} className="px-5 py-3 text-right text-xs font-bold uppercase tracking-widest text-[#94A3B8]">Total</td>
                        <td className="px-5 py-3 text-right font-bold text-[#0F172A]">{formatCurrencyMXN(Number(factura.total ?? 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── PAGOS ─── */}
          {activeTab === "pagos" && (
            <div className="flex flex-col gap-6">
              <CanEdit>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-4">Acciones</p>
                  <div className="flex flex-wrap gap-2">
                    {!isPaid && factura.estado !== "cancelada" && (
                      <button onClick={markAsPaid} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
                        <CreditCard className="h-4 w-4" /> Registrar pago
                      </button>
                    )}
                    {factura.estado === "borrador" && (
                      <button onClick={() => saveField("estado", "enviada")} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[#F8FAFC] transition-colors">
                        Marcar como enviada
                      </button>
                    )}
                    <SmartAction label="Nueva transaccion" icon={Plus} FormComponent={TransaccionForm} defaultValues={{ proyectoId: factura.proyectoId ?? undefined, clienteId: factura.clienteId ?? undefined }} onCreated={refetch} />
                  </div>
                </div>
              </CanEdit>
            </div>
          )}

          {/* ─── ARCHIVOS ─── */}
          {activeTab === "archivos" && (
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-4">Exportar PDF</p>
                <div className="flex flex-wrap gap-2">
                  <PDFPreviewButton document={<FacturaSkina numero={factura.numero ?? ""} estado={factura.estado ?? "borrador"} fechaEmision={factura.fechaEmision} fechaVencimiento={factura.fechaVencimiento} subtotal={Number(factura.subtotal ?? 0)} impuesto={Number(factura.impuesto ?? 0)} total={Number(factura.total ?? 0)} items={items} cliente={cliente} proyecto={proyecto} />} filename={`Factura-${factura.numero ?? "borrador"}.pdf`} title={`Factura ${factura.numero}`} label="Vista previa" />
                  <PDFExportButton document={<FacturaSkina numero={factura.numero ?? ""} estado={factura.estado ?? "borrador"} fechaEmision={factura.fechaEmision} fechaVencimiento={factura.fechaVencimiento} subtotal={Number(factura.subtotal ?? 0)} impuesto={Number(factura.impuesto ?? 0)} total={Number(factura.total ?? 0)} items={items} cliente={cliente} proyecto={proyecto} />} filename={`Factura-${factura.numero ?? "borrador"}.pdf`} label="Descargar PDF" />
                </div>
              </div>
              <UploadArea module="facturacion" recordId={id} />
              <SavedQRCodes module="facturacion" recordId={id} />
            </div>
          )}

          {/* ─── NOTAS ─── */}
          {activeTab === "notas" && (
            <div className="flex flex-col gap-6">
              <CommentsSection module="facturacion" recordId={id} />
              <ActivityTimeline module="facturacion" recordId={id} />
            </div>
          )}

          <ConfirmModal open={deleteOpen} title="Eliminar factura" description="¿Estas seguro? Esta accion no se puede deshacer." confirmLabel="Eliminar" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)} />
        </>
      )}
    </ContextShell>
  )
}

function FinCard({ label, value, variant }: { label: string; value: string; variant: "neutral" | "positive" | "warning" }) {
  const bg = variant === "warning" ? "bg-[#FEF9C3]" : variant === "positive" ? "bg-[#DCFCE7]" : "bg-[#EFF6FF]"
  const text = variant === "warning" ? "text-[#92400E]" : variant === "positive" ? "text-[#166534]" : "text-[#1E40AF]"
  return (
    <div className={cn("rounded-xl p-4", bg)}>
      <p className={cn("text-base font-bold tracking-tight", text)}>{value}</p>
      <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
    </div>
  )
}

function TimelineItem({ icon: Icon, label, date, color }: { icon: any; label: string; date: string; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 flex-shrink-0 ${color ?? "text-[#94A3B8]"}`} />
      <span className="text-sm text-[#0F172A]">{label}</span>
      <span className="text-xs text-[#94A3B8] ml-auto">{formatDateES(date)}</span>
    </div>
  )
}
