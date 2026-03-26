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

const estadoOptions = [
  { value: "activo", label: "Active" },
  { value: "inactivo", label: "Inactive" },
  { value: "prospecto", label: "Prospect" },
]

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
]

const currencyOptions = ["USD", "EUR", "MXN"]

export function ClienteForm({ open, onClose, onSuccess, data }: Props) {
  const isEditing = !!data?.id
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState("")
  const [customId, setCustomId] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState("bank_transfer")
  const [currency, setCurrency] = useState("USD")
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
      setPreferredPaymentMethod(data?.preferredPaymentMethod ?? "bank_transfer")
      setCurrency(data?.currency ?? "USD")
      setTipo(data?.tipo ?? "empresa")
      setEstado(data?.estado ?? "activo")
      setNotas(data?.notas ?? "")
    }
  }, [open, data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return toast.error("Name is required")
    setSaving(true)
    try {
      const body = {
        nombre: nombre.trim(),
        customId: customId.trim() || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        empresa: empresa.trim() || null,
        preferredPaymentMethod,
        currency,
        tipo,
        estado,
        notas: notas.trim() || null,
      }
      if (isEditing) {
        await apiPatch(`/api/clientes/${data.id}`, body)
        toast.success("Client updated")
      } else {
        await apiPost("/api/clientes", body)
        toast.success("Client created")
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save client")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>

        <h2 className="text-lg font-semibold text-foreground mb-6">
          {isEditing ? "Edit client" : "New client"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormSection
            title="Client identity"
            description="Core information used to identify the client record."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client ID">
                <input
                  type="text"
                  value={customId || "Generated automatically on save"}
                  className="input-field bg-muted/40 text-muted-foreground"
                  readOnly
                />
              </Field>
              <Field label="Name *">
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Client name"
                  className="input-field"
                  autoFocus
                />
              </Field>
              <Field label="Company">
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Company or legal name"
                  className="input-field"
                />
              </Field>
              {isEditing ? (
                <Field label="Status">
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input-field">
                    {estadoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              ) : null}
            </div>
          </FormSection>

          <FormSection
            title="Contact details"
            description="How the client can be reached."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input-field"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="input-field"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Billing preferences"
            description="Basic payment settings for this client."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred payment method">
                <select
                  value={preferredPaymentMethod}
                  onChange={(e) => setPreferredPaymentMethod(e.target.value)}
                  className="input-field"
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input-field"
                >
                  {currencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Notes"
            description="Helpful internal context for the team."
          >
            <Field label="Notes">
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Add relevant notes about this client..."
                rows={4}
                className="input-field resize-none"
              />
            </Field>
          </FormSection>

          <div className="flex items-center justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50">
              {saving ? "Saving..." : isEditing ? "Update client" : "Create client"}
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

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-background/60 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}
