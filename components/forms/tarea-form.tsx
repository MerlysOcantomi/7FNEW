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

const estadoOptions = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "revision", label: "En revisión" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" },
]

const prioridadOptions = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

export function TareaForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [proyectoId, setProyectoId] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [usuarioId, setUsuarioId] = useState("")
  const [estado, setEstado] = useState("pendiente")
  const [prioridad, setPrioridad] = useState("media")
  const [fechaLimite, setFechaLimite] = useState("")

  const { data: proyectos } = useFetch<any[]>(open ? "/api/proyectos" : null)
  const { data: clientes } = useFetch<any[]>(open ? "/api/clientes" : null)
  const { data: usuarios } = useFetch<any[]>(open ? "/api/usuarios" : null)
  const proyectosList: any[] = Array.isArray(proyectos) ? proyectos : []
  const clientesList: any[] = Array.isArray(clientes) ? clientes : []
  const usuariosList: any[] = Array.isArray(usuarios) ? usuarios : []

  useEffect(() => {
    if (open) {
      setTitulo(data?.titulo ?? "")
      setDescripcion(data?.descripcion ?? "")
      setProyectoId(data?.proyectoId ?? "")
      setClienteId(data?.clienteId ?? "")
      setUsuarioId(data?.usuarioId ?? "")
      setEstado(data?.estado ?? "pendiente")
      setPrioridad(data?.prioridad ?? "media")
      setFechaLimite(data?.fechaLimite ? data.fechaLimite.slice(0, 10) : "")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return toast.error("El título es requerido")
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        proyectoId: proyectoId || null,
        clienteId: clienteId || null,
        usuarioId: usuarioId || null,
        estado,
        prioridad,
        fechaLimite: fechaLimite ? new Date(fechaLimite).toISOString() : null,
      }
      if (isEditing) {
        await apiPatch(`/api/tareas/${data.id}`, body)
        toast.success("Tarea actualizada")
      } else {
        await apiPost("/api/tareas", body)
        toast.success("Tarea creada")
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
          {isEditing ? "Editar tarea" : "Nueva tarea"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título *" className="sm:col-span-2">
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la tarea" className="input-field" autoFocus />
            </Field>
            <Field label="Proyecto">
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className="input-field">
                <option value="">Sin proyecto</option>
                {proyectosList.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Cliente">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input-field">
                <option value="">Sin cliente</option>
                {clientesList.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Responsable">
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="input-field">
                <option value="">Sin asignar</option>
                {usuariosList.map((u: any) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Field>
            <Field label="Fecha límite">
              <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="input-field" />
            </Field>
            <Field label="Estado">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
                {estadoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="input-field">
                {prioridadOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Descripción">
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción de la tarea..." rows={3} className="input-field resize-none" />
          </Field>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear tarea"}
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
