"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { INPUT_CLASS } from "@/lib/form-classes"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"
import { useClientsNouns } from "@/hooks/use-clients-nouns"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  data?: any
}

/** Persisted option VALUES only — visible labels come from the clients catalog. */
const ESTADO_VALUES = ["activo", "inactivo", "prospecto"] as const
const PAYMENT_VALUES = ["cash", "bank_transfer", "card"] as const
const currencyOptions = ["USD", "EUR", "MXN"]

export function ClienteForm({ open, onClose, onSuccess, data }: Props) {
  const { t } = useI18n()
  const nouns = useClientsNouns()
  const F = t.clients.form
  const noun = { client: nouns.client }
  const estadoLabels: Record<string, string> = {
    activo: t.clients.status.active,
    inactivo: t.clients.status.inactive,
    prospecto: t.clients.status.prospect,
  }
  const paymentLabels: Record<string, string> = {
    cash: F.payment.cash,
    bank_transfer: F.payment.transfer,
    card: F.payment.card,
  }
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
    if (!nombre.trim()) return toast.error(F.nameRequired)
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
        toast.success(F.toastUpdated(noun))
      } else {
        await apiPost("/api/clientes", body)
        toast.success(F.toastCreated(noun))
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : F.toastSaveError(noun))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="absolute right-4 top-4 h-6 w-6" aria-label={t.common.close}>
          <X className="h-3.5 w-3.5" />
        </Button>

        <h2 className="text-lg font-semibold text-foreground mb-6">
          {isEditing ? F.titleEdit(noun) : F.titleNew(noun)}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormSection
            title={F.identityTitle(noun)}
            description={F.identityDesc(noun)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={F.fields.id(noun)}>
                <input
                  type="text"
                  value={customId || F.fields.idAuto}
                  className={cn(INPUT_CLASS, "bg-muted/40 text-muted-foreground")}
                  readOnly
                />
              </Field>
              <Field label={`${F.fields.name} *`}>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={F.fields.namePlaceholder(noun)}
                  className={INPUT_CLASS}
                  autoFocus
                />
              </Field>
              <Field label={F.fields.company}>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder={F.fields.companyPlaceholder}
                  className={INPUT_CLASS}
                />
              </Field>
              {isEditing ? (
                <Field label={F.fields.status}>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className={INPUT_CLASS}>
                    {ESTADO_VALUES.map((value) => <option key={value} value={value}>{estadoLabels[value]}</option>)}
                  </select>
                </Field>
              ) : null}
            </div>
          </FormSection>

          <FormSection
            title={F.contactTitle}
            description={F.contactDesc(noun)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={F.fields.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={F.fields.emailPlaceholder}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label={F.fields.phone}>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder={F.fields.phonePlaceholder}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title={F.billingTitle}
            description={F.billingDesc(noun)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={F.fields.paymentMethod}>
                <select
                  value={preferredPaymentMethod}
                  onChange={(e) => setPreferredPaymentMethod(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {PAYMENT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {paymentLabels[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={F.fields.currency}>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={INPUT_CLASS}
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
            title={F.notesTitle}
            description={F.notesDesc}
          >
            <Field label={F.notesTitle}>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder={F.fields.notesPlaceholder(noun)}
                rows={4}
                className={cn(INPUT_CLASS, "resize-none")}
              />
            </Field>
          </FormSection>

          <div className="flex items-center justify-end gap-3 mt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? F.saving : isEditing ? F.update(noun) : F.create(noun)}
            </Button>
          </div>
        </form>
      </div>
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
