"use client"

import { use, useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { InlineText, InlineSelect, InlineDate } from "@/components/inline-edit"
import { DetailSection, DetailMetaRow, DetailEmpty, formatDateES, formatCurrencyMXN } from "@/components/detail-section"
import { apiPatch, apiDelete, displayLabel, estadoLabel } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { CanEdit, CanDelete } from "@/components/role-gate"
import { SmartAction } from "@/components/smart-action"
import { DocumentoForm } from "@/components/forms/documento-form"
import { TransaccionForm } from "@/components/forms/transaccion-form"
import { CommentsSection } from "@/components/comments-section"
import { ActivityTimeline } from "@/components/activity-timeline"
import { UploadArea } from "@/components/upload-area"
import { toast } from "sonner"
import { ConfirmModal } from "@/components/confirm-modal"
import { RelationSelect } from "@/components/relation-select"
import { FacturaSkina } from "@/components/templates/factura-skina"
import { PDFPreviewButton, PDFExportButton } from "@/components/pdf-viewer"
import { QRButton } from "@/components/qr-code-modal"
import { SavedQRCodes } from "@/components/saved-qr-codes"
import {
  ArrowLeft,
  Receipt,
  Trash2,
  Building,
  FolderKanban,
  CreditCard,
  Package,
  Calendar,
  Hash,
  Plus,
  FileText,
  Download,
  Eye,
} from "lucide-react"

const ESTADO_OPTIONS = [
  { value: "borrador", label: "Borrador" },
  { value: "enviada", label: "Enviada" },
  { value: "pagada", label: "Pagada" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
]

const estadoBadge = (v: string) =>
  ({
    borrador: "bg-muted text-muted-foreground",
    enviada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    pagada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    vencida: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    cancelada: "bg-muted text-muted-foreground",
  })[v] ?? "bg-muted text-muted-foreground"

function daysUntilDue(fecha: string | null | undefined): { days: number; overdue: boolean } {
  if (!fecha) return { days: 0, overdue: false }
  const target = new Date(fecha)
  if (Number.isNaN(target.getTime())) return { days: 0, overdue: false }
  const diff = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return { days: Math.abs(diff), overdue: diff < 0 }
}

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
    [id, refetch]
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
      <AppShell currentSection="facturacion" breadcrumbs={[{ label: "7F" }, { label: "Facturacion", href: "/facturacion" }, { label: "..." }]}>
        <div className="flex flex-col gap-6">
          <Link href="/facturacion" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> Facturacion
          </Link>
          <div className="h-40 rounded-xl border border-border bg-card animate-pulse" />
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="h-48 rounded-xl border border-border bg-card animate-pulse lg:col-span-3" />
            <div className="h-64 rounded-xl border border-border bg-card animate-pulse lg:col-span-2" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !factura) {
    return (
      <AppShell currentSection="facturacion" breadcrumbs={[{ label: "7F" }, { label: "Facturacion", href: "/facturacion" }, { label: "Error" }]}>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12">
          <Receipt className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Factura no encontrada</p>
          <p className="text-xs text-muted-foreground">{error ?? "No se encontro esta factura."}</p>
          <Link href="/facturacion" className="text-sm font-medium text-primary hover:underline">
            ← Volver a Facturacion
          </Link>
        </div>
      </AppShell>
    )
  }

  const items = Array.isArray(factura.items) ? factura.items : []
  const cliente = factura.cliente ?? null
  const proyecto = factura.proyecto ?? null
  const dueInfo = daysUntilDue(factura.fechaVencimiento)
  const isPaid = factura.estado === "pagada"

  return (
    <AppShell
      currentSection="facturacion"
      breadcrumbs={[{ label: "7F" }, { label: "Facturacion", href: "/facturacion" }, { label: factura.numero ?? "Factura" }]}
    >
      <div className="flex flex-col gap-6 pb-8">
        <Link href="/facturacion" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> Facturacion
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Receipt className="h-7 w-7 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <CanEdit>
                  <InlineText
                    value={factura.numero ?? ""}
                    onSave={(v) => saveField("numero", v)}
                    placeholder="Numero de factura"
                    as="h1"
                    className="text-2xl font-semibold"
                  />
                </CanEdit>
                {/* Viewer fallback */}
                <span className="text-2xl font-semibold hidden">{factura.numero}</span>
              </div>
              <CanEdit>
                <InlineSelect
                  value={factura.estado ?? "borrador"}
                  options={ESTADO_OPTIONS}
                  onSave={(v) => saveField("estado", v)}
                  badgeClassName={estadoBadge}
                />
              </CanEdit>
              <QRButton
                module="facturacion"
                recordId={id}
                defaultUrl={typeof window !== "undefined" ? `${window.location.origin}/facturacion/${id}` : `/facturacion/${id}`}
                className="ml-auto"
              />
              <CanDelete>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CanDelete>
            </div>

            {/* Total prominente */}
            <div className="flex flex-wrap items-end gap-6 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                <p className="text-3xl font-bold tracking-tight">{formatCurrencyMXN(Number(factura.total ?? 0))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Subtotal</p>
                <p className="text-lg font-medium text-muted-foreground">{formatCurrencyMXN(Number(factura.subtotal ?? 0))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Impuesto</p>
                <p className="text-lg font-medium text-muted-foreground">{formatCurrencyMXN(Number(factura.impuesto ?? 0))}</p>
              </div>
              {!isPaid && factura.fechaVencimiento && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Vencimiento</p>
                  <p className={`text-sm font-medium ${dueInfo.overdue ? "text-destructive" : "text-foreground"}`}>
                    {dueInfo.overdue ? `Vencida hace ${dueInfo.days} dias` : `${dueInfo.days} dias restantes`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Columna principal */}
          <div className="flex flex-col gap-6 lg:col-span-3">
            {/* Items / Conceptos */}
            <DetailSection title="Conceptos" icon={Package} badge={<span className="text-sm text-muted-foreground">({items.length})</span>}>
              {items.length === 0 ? (
                <DetailEmpty message="Sin conceptos registrados." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Descripcion</th>
                        <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">Cant.</th>
                        <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground text-right">Precio</th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, i: number) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4">{item.descripcion ?? item.concepto ?? `Item ${i + 1}`}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{item.cantidad ?? 1}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{formatCurrencyMXN(Number(item.precioUnitario ?? item.precio ?? 0))}</td>
                          <td className="py-3 text-right font-medium tabular-nums">
                            {formatCurrencyMXN(Number(item.cantidad ?? 1) * Number(item.precioUnitario ?? item.precio ?? 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={3} className="pt-3 text-right font-medium text-muted-foreground">Total</td>
                        <td className="pt-3 text-right font-bold">{formatCurrencyMXN(Number(factura.total ?? 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </DetailSection>

            {/* Exportar PDF Skina */}
            <DetailSection title="Exportar" icon={Download}>
              <div className="flex flex-wrap gap-2">
                <PDFPreviewButton
                  document={
                    <FacturaSkina
                      numero={factura.numero ?? ""}
                      estado={factura.estado ?? "borrador"}
                      fechaEmision={factura.fechaEmision}
                      fechaVencimiento={factura.fechaVencimiento}
                      subtotal={Number(factura.subtotal ?? 0)}
                      impuesto={Number(factura.impuesto ?? 0)}
                      total={Number(factura.total ?? 0)}
                      items={items}
                      cliente={cliente}
                      proyecto={proyecto}
                    />
                  }
                  filename={`Factura-${factura.numero ?? "borrador"}.pdf`}
                  title={`Factura ${factura.numero}`}
                  label="Vista previa PDF"
                />
                <PDFExportButton
                  document={
                    <FacturaSkina
                      numero={factura.numero ?? ""}
                      estado={factura.estado ?? "borrador"}
                      fechaEmision={factura.fechaEmision}
                      fechaVencimiento={factura.fechaVencimiento}
                      subtotal={Number(factura.subtotal ?? 0)}
                      impuesto={Number(factura.impuesto ?? 0)}
                      total={Number(factura.total ?? 0)}
                      items={items}
                      cliente={cliente}
                      proyecto={proyecto}
                    />
                  }
                  filename={`Factura-${factura.numero ?? "borrador"}.pdf`}
                  label="Descargar PDF Skina"
                />
              </div>
            </DetailSection>

            {/* Acciones rapidas */}
            <CanEdit>
              <DetailSection title="Acciones" icon={CreditCard}>
                <div className="flex flex-wrap gap-2">
                  {!isPaid && factura.estado !== "cancelada" && (
                    <button
                      onClick={markAsPaid}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                      <CreditCard className="h-4 w-4" />
                      Registrar pago
                    </button>
                  )}
                  {factura.estado === "borrador" && (
                    <button
                      onClick={() => saveField("estado", "enviada")}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Marcar como enviada
                    </button>
                  )}
                  <SmartAction
                    label="Nuevo documento"
                    icon={FileText}
                    FormComponent={DocumentoForm}
                    defaultValues={{ proyectoId: factura.proyectoId ?? undefined, clienteId: factura.clienteId ?? undefined }}
                    onCreated={refetch}
                  />
                  <SmartAction
                    label="Nueva transaccion"
                    icon={Plus}
                    FormComponent={TransaccionForm}
                    defaultValues={{ proyectoId: factura.proyectoId ?? undefined, clienteId: factura.clienteId ?? undefined }}
                    onCreated={refetch}
                  />
                  {isPaid && (
                    <p className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                      <CreditCard className="h-4 w-4" />
                      Pagada el {formatDateES(factura.paidAt)}
                    </p>
                  )}
                </div>
              </DetailSection>
            </CanEdit>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4 lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Detalles</h2>
              <div className="space-y-0">
                <DetailMetaRow label="Estado">
                  <CanEdit>
                    <InlineSelect
                      value={factura.estado ?? "borrador"}
                      options={ESTADO_OPTIONS}
                      onSave={(v) => saveField("estado", v)}
                      badgeClassName={estadoBadge}
                    />
                  </CanEdit>
                </DetailMetaRow>
                <DetailMetaRow label="Emision">
                  <CanEdit>
                    <InlineDate
                      value={factura.fechaEmision ?? null}
                      onSave={(v) => saveField("fechaEmision", v)}
                      placeholder="Sin fecha"
                    />
                  </CanEdit>
                </DetailMetaRow>
                <DetailMetaRow label="Vencimiento">
                  <CanEdit>
                    <InlineDate
                      value={factura.fechaVencimiento ?? null}
                      onSave={(v) => saveField("fechaVencimiento", v)}
                      placeholder="Sin fecha"
                    />
                  </CanEdit>
                </DetailMetaRow>
                <DetailMetaRow label="Cliente">
                  <RelationSelect
                    label="Cliente"
                    icon={Building}
                    value={factura.clienteId ?? null}
                    field="clienteId"
                    targetModule="clientes"
                    sourceModule="facturacion"
                    sourceId={id}
                    displayField="nombre"
                    currentDisplay={cliente?.nombre}
                    onSaved={refetch}
                  />
                </DetailMetaRow>
                <DetailMetaRow label="Proyecto">
                  <RelationSelect
                    label="Proyecto"
                    icon={FolderKanban}
                    value={factura.proyectoId ?? null}
                    field="proyectoId"
                    targetModule="proyectos"
                    sourceModule="facturacion"
                    sourceId={id}
                    displayField="nombre"
                    currentDisplay={proyecto?.nombre}
                    onSaved={refetch}
                  />
                </DetailMetaRow>
                <DetailMetaRow label="Creada" last>
                  <span className="text-sm text-muted-foreground">{formatDateES(factura.createdAt)}</span>
                </DetailMetaRow>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Historial</h2>
              <div className="space-y-3">
                <TimelineItem icon={Calendar} label="Creada" date={factura.createdAt} />
                {factura.fechaEmision && <TimelineItem icon={Receipt} label="Emitida" date={factura.fechaEmision} />}
                {factura.paidAt && <TimelineItem icon={CreditCard} label="Pagada" date={factura.paidAt} color="text-emerald-500" />}
                {factura.fechaVencimiento && !isPaid && (
                  <TimelineItem
                    icon={Calendar}
                    label={dueInfo.overdue ? "Vencida" : "Vence"}
                    date={factura.fechaVencimiento}
                    color={dueInfo.overdue ? "text-destructive" : "text-muted-foreground"}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Archivos adjuntos */}
        <UploadArea module="facturacion" recordId={id} />

        {/* Codigos QR */}
        <SavedQRCodes module="facturacion" recordId={id} />

        {/* Comentarios + Actividad */}
        <CommentsSection module="facturacion" recordId={id} />
        <ActivityTimeline module="facturacion" recordId={id} />
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar factura"
        description="¿Estas seguro? Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </AppShell>
  )
}

function TimelineItem({ icon: Icon, label, date, color }: { icon: any; label: string; date: string; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-4 w-4 flex-shrink-0 ${color ?? "text-muted-foreground"}`} />
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground ml-auto">{formatDateES(date)}</span>
    </div>
  )
}
