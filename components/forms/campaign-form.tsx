"use client"

import { useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface CampaignFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

const ESTADOS = [
  { value: "idea", label: "Idea" },
  { value: "planificacion", label: "Planificacion" },
  { value: "activa", label: "Activa" },
  { value: "pausada", label: "Pausada" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" },
]

const MARCAS = [
  { value: "skina", label: "Skina" },
  { value: "7f", label: "7F" },
  { value: "cliente", label: "Cliente" },
  { value: "general", label: "General" },
]

export function CampaignForm({ open, onClose, onSuccess, data }: CampaignFormProps) {
  const isEdit = !!data
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: data?.nombre ?? "",
    descripcion: data?.descripcion ?? "",
    estado: data?.estado ?? "idea",
    marca: data?.marca ?? "general",
    fechaInicio: data?.fechaInicio ? new Date(data.fechaInicio).toISOString().slice(0, 10) : "",
    fechaFin: data?.fechaFin ? new Date(data.fechaFin).toISOString().slice(0, 10) : "",
    objetivos: data?.objetivos ?? "",
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return toast.error("El nombre es requerido")
    setSaving(true)
    try {
      const body: any = {
        ...form,
        fechaInicio: form.fechaInicio ? new Date(form.fechaInicio).toISOString() : null,
        fechaFin: form.fechaFin ? new Date(form.fechaFin).toISOString() : null,
      }
      const url = isEdit ? `/api/campanas/${data.id}` : "/api/campanas"
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al guardar")
      toast.success(isEdit ? "Campana actualizada" : "Campana creada")
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{isEdit ? "Editar campana" : "Nueva campana"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Nombre de la campana *" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          <textarea value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} placeholder="Descripcion" rows={2} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.estado} onChange={(e) => update("estado", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none">
              {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <select value={form.marca} onChange={(e) => update("marca", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none">
              {MARCAS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Fecha inicio</label>
              <input type="date" value={form.fechaInicio} onChange={(e) => update("fechaInicio", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Fecha fin</label>
              <input type="date" value={form.fechaFin} onChange={(e) => update("fechaFin", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <textarea value={form.objetivos} onChange={(e) => update("objetivos", e.target.value)} placeholder="Objetivos de la campana" rows={2} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none resize-none" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className={cn("rounded-lg px-4 py-2 text-sm font-medium transition-opacity", saving ? "bg-muted text-muted-foreground" : "bg-foreground text-background hover:opacity-80")}>
              {saving ? "Guardando..." : isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
