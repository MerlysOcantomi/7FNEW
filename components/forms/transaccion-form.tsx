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
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
]

export function TransaccionForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [tipo, setTipo] = useState("ingreso")
  const [monto, setMonto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [categoria, setCategoria] = useState("")
  const [fecha, setFecha] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [proyectoId, setProyectoId] = useState("")

  const { data: clientes } = useFetch<any[]>(open ? "/api/clientes" : null)
  const { data: proyectos } = useFetch<any[]>(open ? "/api/proyectos" : null)
  const clientesList: any[] = Array.isArray(clientes) ? clientes : []
  const proyectosList: any[] = Array.isArray(proyectos) ? proyectos : []

  useEffect(() => {
    if (open) {
      setTipo(data?.tipo ?? "ingreso")
      setMonto(data?.monto != null ? String(data.monto) : "")
      setDescripcion(data?.descripcion ?? "")
      setCategoria(data?.categoria ?? "")
      setFecha(data?.fecha ? data.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10))
      setClienteId(data?.clienteId ?? "")
      setProyectoId(data?.proyectoId ?? "")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) return toast.error("El monto debe ser mayor a 0")
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        tipo,
        monto: Number(monto),
        descripcion: descripcion || null,
        categoria: categoria || null,
        fecha: fecha ? new Date(fecha).toISOString() : undefined,
        clienteId: clienteId || null,
        proyectoId: proyectoId || null,
      }
      if (isEditing) {
        await apiPatch(`/api/finanzas/${data.id}`, body)
        toast.success("Transacción actualizada")
      } else {
        await apiPost("/api/finanzas", body)
        toast.success("Transacción registrada")
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
          {isEditing ? "Editar transacción" : "Nueva transacción"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo *">
              <div className="grid grid-cols-2 gap-2">
                {tipoOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setTipo(o.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      tipo === o.value
                        ? o.value === "ingreso"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Monto *">
              <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" min="0" step="0.01" className="input-field" autoFocus />
            </Field>
            <Field label="Categoría">
              <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="ej: proyectos, nómina, herramientas" className="input-field" />
            </Field>
            <Field label="Fecha">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input-field" />
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
          <Field label="Descripción">
            <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción de la transacción" className="input-field" />
          </Field>

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
