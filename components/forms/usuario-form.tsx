"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { resolveStatusLabel } from "@core/i18n/ui"
import { toast } from "sonner"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

// Persisted enum VALUES — never change; visible labels come from the catalog.
const ROL_VALUES = ["admin", "gerente", "miembro"] as const
const ESTADO_VALUES = ["activo", "inactivo"] as const

export function UsuarioForm({ open, onClose, onSuccess, data }: Props) {
  const { t } = useI18n()
  const F = t.team.form
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
    if (!nombre.trim()) return toast.error(F.errors.nameRequired)
    if (!email.trim()) return toast.error(F.errors.emailRequired)
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
        toast.success(F.toasts.updated)
      } else {
        await apiPost("/api/usuarios", body)
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
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t.common.close}>
          <X className="h-3.5 w-3.5" />
        </button>

        <h2 className="text-lg font-semibold text-foreground mb-6">
          {isEditing ? F.titleEdit : F.titleNew}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={F.fields.name} className="sm:col-span-2">
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={F.namePlaceholder} className="input-field" autoFocus />
            </Field>
            <Field label={F.fields.email} className="sm:col-span-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={F.emailPlaceholder} className="input-field" />
            </Field>
            <Field label={F.fields.role}>
              <select value={rol} onChange={(e) => setRol(e.target.value)} className="input-field">
                {ROL_VALUES.map((value) => <option key={value} value={value}>{t.team.roles[value]}</option>)}
              </select>
            </Field>
            <Field label={F.fields.status}>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
                {ESTADO_VALUES.map((value) => <option key={value} value={value}>{resolveStatusLabel(t.statuses, value)}</option>)}
              </select>
            </Field>
            <Field label={F.fields.department} className="sm:col-span-2">
              <input type="text" value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder={F.departmentPlaceholder} className="input-field" />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              {t.common.cancel}
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? F.saving : isEditing ? F.update : F.create}
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
