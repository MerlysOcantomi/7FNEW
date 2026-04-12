"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { INPUT_CLASS } from "@/lib/form-classes"
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

const estadoOptions = [
  { value: "borrador", label: "Draft" },
  { value: "enviada", label: "Sent" },
  { value: "pagada", label: "Paid" },
  { value: "vencida", label: "Overdue" },
  { value: "cancelada", label: "Canceled" },
]

const emptyItem = (): LineItem => ({ descripcion: "", cantidad: 1, precioUnitario: 0, total: 0 })

export function FacturaForm({ open, onClose, onSuccess, data }: Props) {
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
    if (!numero.trim()) return toast.error("Invoice number is required")
    if (items.every((i) => !i.descripcion.trim())) return toast.error("Add at least one line item")
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
        toast.success("Invoice updated")
      } else {
        await apiPost("/api/facturacion", body)
        toast.success("Invoice created")
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save invoice")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="absolute right-4 top-4 h-6 w-6" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </Button>

        <h2 className="text-lg font-semibold text-foreground mb-6">
          {isEditing ? "Edit invoice" : "New invoice"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Invoice number *">
              <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FAC-001" className={INPUT_CLASS} autoFocus />
            </Field>
            <Field label="Status">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className={INPUT_CLASS}>
                {estadoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Tax (%)">
              <input type="number" value={impuestoPct} onChange={(e) => setImpuestoPct(Number(e.target.value) || 0)} min="0" max="100" className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={INPUT_CLASS}>
                <option value="">No client</option>
                {clientesList.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Project">
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={INPUT_CLASS}>
                <option value="">No project</option>
                {proyectosList.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Issue date">
              <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Due date">
              <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-medium text-muted-foreground">Line items</label>
              <Button variant="ghost" size="sm" type="button" onClick={addItem} className="h-auto px-2 py-1 text-xs">
                <Plus className="h-3 w-3" /> Add item
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item, i) => (
                <div key={i} className="grid gap-2 items-end" style={{ gridTemplateColumns: "1fr 5rem 7rem 5.5rem 2rem" }}>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => updateItem(i, "descripcion", e.target.value)}
                    placeholder="Description"
                    className={INPUT_CLASS}
                  />
                  <input
                    type="number"
                    value={item.cantidad || ""}
                    onChange={(e) => updateItem(i, "cantidad", e.target.value)}
                    placeholder="Qty."
                    min="0"
                    className={cn(INPUT_CLASS, "text-center")}
                  />
                  <input
                    type="number"
                    value={item.precioUnitario || ""}
                    onChange={(e) => updateItem(i, "precioUnitario", e.target.value)}
                    placeholder="Price"
                    min="0"
                    step="0.01"
                    className={cn(INPUT_CLASS, "text-right")}
                  />
                  <div className={cn(INPUT_CLASS, "bg-muted/30 text-right font-medium text-xs flex items-center justify-end")}>
                    ${item.total.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="flex h-[38px] w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove line item"
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
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground w-28 text-right">${subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-muted-foreground">Tax ({impuestoPct}%)</span>
              <span className="font-medium text-foreground w-28 text-right">${impuesto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-6 text-base font-semibold mt-1">
              <span className="text-foreground">Total</span>
              <span className="text-foreground w-28 text-right">${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update invoice" : "Create invoice"}
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
