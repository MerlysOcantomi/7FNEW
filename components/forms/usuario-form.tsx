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

const rolOptions = [
  { value: "admin", label: "Admin" },
  { value: "gerente", label: "Gerente" },
  { value: "miembro", label: "Miembro" },
]

const estadoOptions = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
]

export function UsuarioForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [rol, setRol] = useState("miembro")
  const [departamento, setDepartamento] = useState("")
  const [estado, setEstado] = useState("activo")

  useEffect(() => {
    if (open) {
      setNombre(data?.nombre ?? "")
      setEmail(data?.email ?? "")
      setRol(data?.rol ?? "miembro")
      setDepartamento(data?.departamento ?? "")
      setEstado(data?.estado ?? "activo")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error("El nombre es requerido")
    if (!email.trim()) return toast.error("El email es requerido")
    setSaving(true)
    try {
      const body = {
        nombre: nombre.trim(),
        email: email.trim(),
        rol,
        departamento: departamento || null,
        estado,
      }
      if (isEditing) {
        await apiPatch(`/api/usuarios/${data.id}`, body)
        toast.success("Usuario actualizado")
      } else {
        await apiPost("/api/usuarios", body)
        toast.success("Usuario creado")
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
          {isEditing ? "Editar usuario" : "Nuevo usuario"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" className="sm:col-span-2">
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" className="input-field" autoFocus />
            </Field>
            <Field label="Email *" className="sm:col-span-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" className="input-field" />
            </Field>
            <Field label="Rol">
              <select value={rol} onChange={(e) => setRol(e.target.value)} className="input-field">
                {rolOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
                {estadoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Departamento" className="sm:col-span-2">
              <input type="text" value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="ej: Diseño, Desarrollo, Estrategia" className="input-field" />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear usuario"}
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
