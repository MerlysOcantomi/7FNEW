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
  { value: "planificacion", label: "Planificación" },
  { value: "en_progreso", label: "En progreso" },
  { value: "revision", label: "En revisión" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
]

const prioridadOptions = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

export function ProyectoForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [estado, setEstado] = useState("planificacion")
  const [prioridad, setPrioridad] = useState("media")
  const [progreso, setProgreso] = useState(0)
  const [presupuesto, setPresupuesto] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")

  const { data: clientes } = useFetch<any[]>(open ? "/api/clientes" : null)
  const clientesList: any[] = Array.isArray(clientes) ? clientes : []

  useEffect(() => {
    if (open) {
      setNombre(data?.nombre ?? "")
      setDescripcion(data?.descripcion ?? "")
      setClienteId(data?.clienteId ?? "")
      setEstado(data?.estado ?? "planificacion")
      setPrioridad(data?.prioridad ?? "media")
      setProgreso(data?.progreso ?? 0)
      setPresupuesto(data?.presupuesto != null ? String(data.presupuesto) : "")
      setFechaInicio(data?.fechaInicio ? data.fechaInicio.slice(0, 10) : "")
      setFechaFin(data?.fechaFin ? data.fechaFin.slice(0, 10) : "")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error("El nombre es requerido")
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        descripcion: descripcion || null,
        clienteId: clienteId || null,
        estado,
        prioridad,
        progreso,
        presupuesto: presupuesto ? Number(presupuesto) : null,
        fechaInicio: fechaInicio ? new Date(fechaInicio).toISOString() : null,
        fechaFin: fechaFin ? new Date(fechaFin).toISOString() : null,
      }
      if (isEditing) {
        await apiPatch(`/api/proyectos/${data.id}`, body)
        toast.success("Proyecto actualizado")
      } else {
        await apiPost("/api/proyectos", body)
        toast.success("Proyecto creado")
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
          {isEditing ? "Editar proyecto" : "Nuevo proyecto"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" className="sm:col-span-2">
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" className="input-field" autoFocus />
            </Field>
            <Field label="Cliente">
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="input-field">
                <option value="">Sin cliente</option>
                {clientesList.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="input-field">
                {prioridadOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
                {estadoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label={`Progreso (${progreso}%)`}>
              <input type="range" min={0} max={100} value={progreso} onChange={(e) => setProgreso(Number(e.target.value))} className="w-full accent-foreground" />
            </Field>
            <Field label="Presupuesto">
              <input type="number" value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="0.00" min="0" step="0.01" className="input-field" />
            </Field>
            <Field label="Fecha inicio">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="input-field" />
            </Field>
            <Field label="Fecha fin">
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input-field" />
            </Field>
          </div>
          <Field label="Descripción">
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del proyecto..." rows={3} className="input-field resize-none" />
          </Field>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear proyecto"}
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
