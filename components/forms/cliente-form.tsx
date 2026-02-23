"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { toast } from "sonner"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

const tipoOptions = [
  { value: "empresa", label: "Empresa" },
  { value: "freelancer", label: "Freelancer" },
  { value: "startup", label: "Startup" },
]

const estadoOptions = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "prospecto", label: "Prospecto" },
]

export function ClienteForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState("")
  const [customId, setCustomId] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [tipo, setTipo] = useState("empresa")
  const [estado, setEstado] = useState("activo")
  const [notas, setNotas] = useState("")

  useEffect(() => {
    if (open) {
      setNombre(data?.nombre ?? "")
      setCustomId(data?.customId ?? "")
      setEmail(data?.email ?? "")
      setTelefono(data?.telefono ?? "")
      setEmpresa(data?.empresa ?? "")
      setTipo(data?.tipo ?? "empresa")
      setEstado(data?.estado ?? "activo")
      setNotas(data?.notas ?? "")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error("El nombre es requerido")
    setSaving(true)
    try {
      const body = { nombre: nombre.trim(), customId: customId.trim() || null, email: email || null, telefono: telefono || null, empresa: empresa || null, tipo, estado, notas: notas || null }
      if (isEditing) {
        await apiPatch(`/api/clientes/${data.id}`, body)
        toast.success("Cliente actualizado")
      } else {
        await apiPost("/api/clientes", body)
        toast.success("Cliente creado")
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
          {isEditing ? "Editar cliente" : "Nuevo cliente"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *">
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" className="input-field" autoFocus />
            </Field>
            <Field label="ID / Codigo cliente">
              <input type="text" value={customId} onChange={(e) => setCustomId(e.target.value)} placeholder="CL-001, SKN-042..." className="input-field" />
            </Field>
            <Field label="Empresa">
              <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa o razon social" className="input-field" />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="input-field" />
            </Field>
            <Field label="Teléfono">
              <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+52 55 1234 5678" className="input-field" />
            </Field>
            <Field label="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-field">
                {tipoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
                {estadoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notas">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas sobre el cliente..." rows={3} className="input-field resize-none" />
          </Field>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear cliente"}
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
