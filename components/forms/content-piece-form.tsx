"use client"

import { useState } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContentPieceFormProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
  defaultValues?: Record<string, any>
}

const PLATAFORMAS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X/Twitter" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "web", label: "Web" },
  { value: "otro", label: "Otro" },
]

const TIPOS = [
  { value: "post", label: "Post" },
  { value: "reel", label: "Reel" },
  { value: "carrusel", label: "Carrusel" },
  { value: "story", label: "Story" },
  { value: "video", label: "Video" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "guion", label: "Guion" },
  { value: "pieza-creativa", label: "Pieza creativa" },
  { value: "otro", label: "Otro" },
]

const ESTADOS = [
  { value: "idea", label: "Idea" },
  { value: "borrador", label: "Borrador" },
  { value: "en-progreso", label: "En progreso" },
  { value: "revision", label: "Revision" },
  { value: "programado", label: "Programado" },
  { value: "publicado", label: "Publicado" },
  { value: "cancelado", label: "Cancelado" },
]

const PRIORIDADES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

export function ContentPieceForm({ open, onClose, onSuccess, data, defaultValues }: ContentPieceFormProps) {
  const isEdit = !!data
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titulo: data?.titulo ?? defaultValues?.titulo ?? "",
    copy: data?.copy ?? "",
    plataforma: data?.plataforma ?? defaultValues?.plataforma ?? "instagram",
    tipo: data?.tipo ?? defaultValues?.tipo ?? "post",
    estado: data?.estado ?? "idea",
    prioridad: data?.prioridad ?? "media",
    fechaProgramada: data?.fechaProgramada ? new Date(data.fechaProgramada).toISOString().slice(0, 16) : "",
    hashtags: data?.hashtags ?? "",
    enlace: data?.enlace ?? "",
    responsable: data?.responsable ?? "",
    notas: data?.notas ?? "",
    campaignId: data?.campaignId ?? defaultValues?.campaignId ?? "",
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) return toast.error("El titulo es requerido")
    setSaving(true)
    try {
      const body: any = {
        ...form,
        fechaProgramada: form.fechaProgramada ? new Date(form.fechaProgramada).toISOString() : null,
        campaignId: form.campaignId || null,
      }
      const url = isEdit ? `/api/contenido/${data.id}` : "/api/contenido"
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Error al guardar")
      toast.success(isEdit ? "Pieza actualizada" : "Pieza creada")
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
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">{isEdit ? "Editar pieza" : "Nueva pieza de contenido"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input value={form.titulo} onChange={(e) => update("titulo", e.target.value)} placeholder="Titulo *" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
          <textarea value={form.copy} onChange={(e) => update("copy", e.target.value)} placeholder="Copy / Texto" rows={3} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.plataforma} onChange={(e) => update("plataforma", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none">
              {PLATAFORMAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={form.tipo} onChange={(e) => update("tipo", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.estado} onChange={(e) => update("estado", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none">
              {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <select value={form.prioridad} onChange={(e) => update("prioridad", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none">
              {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <input type="datetime-local" value={form.fechaProgramada} onChange={(e) => update("fechaProgramada", e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none" />
          <input value={form.hashtags} onChange={(e) => update("hashtags", e.target.value)} placeholder="Hashtags (separados por espacio)" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none" />
          <input value={form.responsable} onChange={(e) => update("responsable", e.target.value)} placeholder="Responsable" className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none" />
          <textarea value={form.notas} onChange={(e) => update("notas", e.target.value)} placeholder="Notas" rows={2} className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none resize-none" />
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
