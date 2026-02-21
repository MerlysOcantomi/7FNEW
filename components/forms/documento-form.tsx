"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import { toast } from "sonner"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

const tipoOptions = [
  "PDF",
  "Imagen",
  "Hoja de calculo",
  "Documento",
  "Video",
  "Presentacion",
  "Otro",
]

export function DocumentoForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState("PDF")
  const [url, setUrl] = useState("")
  const [tamano, setTamano] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [proyectoId, setProyectoId] = useState("")

  const { data: clientes } = useFetch<any[]>(open ? "/api/clientes" : null)
  const { data: proyectos } = useFetch<any[]>(open ? "/api/proyectos" : null)
  const clientesList: any[] = Array.isArray(clientes) ? clientes : []
  const proyectosList: any[] = Array.isArray(proyectos) ? proyectos : []

  useEffect(() => {
    if (open) {
      setNombre(data?.nombre ?? "")
      setTipo(data?.tipo ?? "PDF")
      setUrl(data?.url ?? "")
      setTamano(data?.tamano != null ? String(data.tamano) : "")
      setClienteId(data?.clienteId ?? "")
      setProyectoId(data?.proyectoId ?? "")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error("El nombre es requerido")
    if (!url.trim()) return toast.error("La URL es requerida")
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        tipo,
        url: url.trim(),
        tamano: tamano ? Number(tamano) : null,
        clienteId: clienteId || null,
        proyectoId: proyectoId || null,
      }
      if (isEditing) {
        await apiPatch(`/api/documentos/${data.id}`, body)
        toast.success("Documento actualizado")
      } else {
        await apiPost("/api/documentos", body)
        toast.success("Documento registrado")
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cerrar">
          <X className="h-3.5 w-3.5" />
        </button>

        <h2 className="text-lg font-semibold text-foreground mb-6">
          {isEditing ? "Editar documento" : "Nuevo documento"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" className="sm:col-span-2">
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del archivo" className="input-field" autoFocus />
            </Field>
            <Field label="URL *" className="sm:col-span-2">
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="input-field" />
            </Field>
            <Field label="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-field">
                {tipoOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Tamaño (bytes)">
              <input type="number" value={tamano} onChange={(e) => setTamano(e.target.value)} placeholder="ej: 1048576" min="0" className="input-field" />
            </Field>
            <Field label="Cliente">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input-field">
                <option value="">Sin cliente</option>
                {clientesList.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Proyecto">
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className="input-field">
                <option value="">Sin proyecto</option>
                {proyectosList.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? "Guardando..." : isEditing ? "Actualizar" : "Registrar"}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background-color: var(--card);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: var(--ring);
          box-shadow: 0 0 0 1px var(--ring);
        }
        .input-field::placeholder {
          color: var(--muted-foreground);
        }
      `}</style>
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
