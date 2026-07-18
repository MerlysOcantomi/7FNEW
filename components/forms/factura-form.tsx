"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { INPUT_CLASS } from "@/lib/form-classes"
import { useI18n } from "@/components/i18n-provider"
import { resolveStatusLabel } from "@core/i18n/ui"
import { formatCurrency } from "@core/i18n/format"
import { toast } from "sonner"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

interface LineItem {
  descripcion: string
  cantidad: number
  precioUnitario: number
  total: number
}

// Persisted estado VALUES — labels resolve via the shared `statuses` catalog.
const ESTADO_VALUES = ["borrador", "enviada", "pagada", "vencida", "cancelada"] as const

// Invoices don't persist a currency of their own yet — the workspace default.
const INVOICE_CURRENCY = "CHF"

const emptyItem = (): LineItem => ({ descripcion: "", cantidad: 1, precioUnitario: 0, total: 0 })

export function FacturaForm({ open, onClose, onSuccess, data }: Props) {
  const { t, locale } = useI18n()
  const F = t.billing.form
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [numero, setNumero] = useState("")
  const [estado, setEstado] = useState("borrador")
  const [clienteId, setClienteId] = useState("")
  const [proyectoId, setProyectoId] = useState("")
  const [fechaEmision, setFechaEmision] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [impuestoPct, setImpuestoPct] = useState(16)
  const [items, setItems] = useState<LineItem[]>([emptyItem()])

  const { data: clientes } = useFetch<any[]>(open ? "/api/clientes" : null)
  const { data: proyectos } = useFetch<any[]>(open ? "/api/proyectos" : null)
  const clientesList: any[] = Array.isArray(clientes) ? clientes : []
  const proyectosList: any[] = Array.isArray(proyectos) ? proyectos : []

  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const impuesto = Math.round(subtotal * (impuestoPct / 100) * 100) / 100
  const total = subtotal + impuesto

  const money = (value: number) => formatCurrency(value, { locale, currency: INVOICE_CURRENCY })

  useEffect(() => {
    if (open) {
      setNumero(data?.numero ?? "")
      setEstado(data?.estado ?? "borrador")
      setClienteId(data?.clienteId ?? "")
      setProyectoId(data?.proyectoId ?? "")
      setFechaEmision(data?.fechaEmision ? data.fechaEmision.slice(0, 10) : new Date().toISOString().slice(0, 10))
      setFechaVencimiento(data?.fechaVencimiento ? data.fechaVencimiento.slice(0, 10) : "")
      const dataItems = Array.isArray(data?.items) ? data.items : []
      setItems(dataItems.length > 0 ? dataItems.map((i: any) => ({
        descripcion: i.descripcion ?? "",
        cantidad: Number(i.cantidad) || 1,
        precioUnitario: Number(i.precioUnitario) || 0,
        total: Number(i.total) || 0,
      })) : [emptyItem()])
      if (data?.subtotal && data?.impuesto != null) {
        const sub = Number(data.subtotal) || 0
        const imp = Number(data.impuesto) || 0
        setImpuestoPct(sub > 0 ? Math.round((imp / sub) * 100) : 16)
      } else {
        setImpuestoPct(16)
      }
    }
  }, [open, data])

  const updateItem = useCallback((index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev]
      const item = { ...next[index] }
      if (field === "descripcion") item.descripcion = value as string
      else if (field === "cantidad") item.cantidad = Number(value) || 0
      else if (field === "precioUnitario") item.precioUnitario = Number(value) || 0
      item.total = Math.round(item.cantidad * item.precioUnitario * 100) / 100
      next[index] = item
      return next
    })
  }, [])

  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (index: number) => setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numero.trim()) return toast.error(F.errors.numberRequired)
    if (items.every((i) => !i.descripcion.trim())) return toast.error(F.errors.lineRequired)
    setSaving(true)
    try {
      const validItems = items.filter((i) => i.descripcion.trim())
      const body: Record<string, unknown> = {
        numero: numero.trim(),
        estado,
        clienteId: clienteId || null,
        proyectoId: proyectoId || null,
        fechaEmision: fechaEmision ? new Date(fechaEmision).toISOString() : undefined,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento).toISOString() : null,
        items: validItems,
        subtotal: validItems.reduce((s, i) => s + i.total, 0),
        impuesto,
        total: validItems.reduce((s, i) => s + i.total, 0) + impuesto,
      }
      if (isEditing) {
        await apiPatch(`/api/facturacion/${data.id}`, body)
        toast.success(F.toasts.updated)
      } else {
        await apiPost("/api/facturacion", body)
        toast.success(F.toasts.created)
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : F.toasts.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="absolute right-4 top-4 h-6 w-6" aria-label={t.common.close}>
          <X className="h-3.5 w-3.5" />
        </Button>

        <h2 className="text-lg font-semibold text-foreground mb-6">
          {isEditing ? F.titleEdit : F.titleNew}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={F.fields.number}>
              <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={F.numberPlaceholder} className={INPUT_CLASS} autoFocus />
            </Field>
            <Field label={F.fields.status}>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className={INPUT_CLASS}>
                {ESTADO_VALUES.map((value) => <option key={value} value={value}>{resolveStatusLabel(t.statuses, value)}</option>)}
              </select>
            </Field>
            <Field label={F.fields.taxPct}>
              <input type="number" value={impuestoPct} onChange={(e) => setImpuestoPct(Number(e.target.value) || 0)} min="0" max="100" className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={F.fields.client}>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={INPUT_CLASS}>
                <option value="">{F.noClient}</option>
                {clientesList.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label={F.fields.project}>
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={INPUT_CLASS}>
                <option value="">{F.noProject}</option>
                {proyectosList.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label={F.fields.issueDate}>
              <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label={F.fields.dueDate}>
              <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-medium text-muted-foreground">{F.lineItems}</label>
              <Button variant="ghost" size="sm" type="button" onClick={addItem} className="h-auto px-2 py-1 text-xs">
                <Plus className="h-3 w-3" /> {F.addItem}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, i) => (
                <div key={i} className="grid gap-2 items-end" style={{ gridTemplateColumns: "1fr 5rem 7rem 5.5rem 2rem" }}>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => updateItem(i, "descripcion", e.target.value)}
                    placeholder={F.descriptionPlaceholder}
                    className={INPUT_CLASS}
                  />
                  <input
                    type="number"
                    value={item.cantidad || ""}
                    onChange={(e) => updateItem(i, "cantidad", e.target.value)}
                    placeholder={F.qtyPlaceholder}
                    min="0"
                    className={cn(INPUT_CLASS, "text-center")}
                  />
                  <input
                    type="number"
                    value={item.precioUnitario || ""}
                    onChange={(e) => updateItem(i, "precioUnitario", e.target.value)}
                    placeholder={F.pricePlaceholder}
                    min="0"
                    step="0.01"
                    className={cn(INPUT_CLASS, "text-right")}
                  />
                  <div className={cn(INPUT_CLASS, "bg-muted/30 text-right font-medium text-xs flex items-center justify-end")}>
                    {money(item.total)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="flex h-[38px] w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={F.removeItemAria}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
            <div className="flex items-center gap-6">
              <span className="text-muted-foreground">{F.subtotal}</span>
              <span className="font-medium text-foreground w-28 text-right">{money(subtotal)}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-muted-foreground">{F.taxWithPct(impuestoPct)}</span>
              <span className="font-medium text-foreground w-28 text-right">{money(impuesto)}</span>
            </div>
            <div className="flex items-center gap-6 text-base font-semibold mt-1">
              <span className="text-foreground">{F.total}</span>
              <span className="text-foreground w-28 text-right">{money(total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? F.saving : isEditing ? F.update : F.create}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  )
}
