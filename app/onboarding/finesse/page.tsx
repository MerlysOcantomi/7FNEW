"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Globe2,
  Instagram,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Scissors,
  Sparkles,
} from "lucide-react"

type Step = "welcome" | "profile" | "presence" | "preview" | "google" | "assistant" | "channels"
type ActivationChoice = "ready" | "later" | "existing" | "pending"

interface Profile {
  businessName: string
  businessDescription: string
  region: string
  workingHours: string
  services: string[]
}

interface Activation {
  presence: ActivationChoice
  google: ActivationChoice
  assistant: ActivationChoice
  channels: ActivationChoice
}

const STEPS: Step[] = ["welcome", "profile", "presence", "preview", "google", "assistant", "channels"]

const EMPTY_PROFILE: Profile = {
  businessName: "",
  businessDescription: "",
  region: "",
  workingHours: "",
  services: [],
}

const EMPTY_ACTIVATION: Activation = {
  presence: "pending",
  google: "pending",
  assistant: "pending",
  channels: "pending",
}

function safeStep(value: unknown): Step {
  return STEPS.includes(value as Step) ? (value as Step) : "welcome"
}

export default function FinesseOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("welcome")
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [activation, setActivation] = useState<Activation>(EMPTY_ACTIVATION)
  const [serviceDraft, setServiceDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch("/api/onboarding/finesse", { cache: "no-store" })
        if (!response.ok) throw new Error("load_failed")
        const data = (await response.json()) as {
          status?: string
          currentStep?: string
          profile?: Partial<Profile>
          activation?: Partial<Activation>
        }
        if (cancelled) return
        if (data.status === "completed") {
          router.replace("/today")
          return
        }
        setProfile({ ...EMPTY_PROFILE, ...data.profile })
        setActivation({ ...EMPTY_ACTIVATION, ...data.activation })
        setStep(safeStep(data.currentStep))
      } catch {
        if (!cancelled) setError("No pudimos cargar tu espacio de Finesse.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [router])

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  const save = useCallback(
    async (nextStep: Step, overrides?: Partial<Activation>) => {
      setSaving(true)
      setError("")
      const nextActivation = { ...activation, ...overrides }
      try {
        const response = await fetch("/api/onboarding/finesse", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentStep: nextStep,
            ...profile,
            ...nextActivation,
          }),
        })
        if (!response.ok) throw new Error("save_failed")
        setActivation(nextActivation)
        setStep(nextStep)
      } catch {
        setError("No pudimos guardar los cambios. Inténtalo otra vez.")
      } finally {
        setSaving(false)
      }
    },
    [activation, profile],
  )

  const next = useCallback(() => {
    const nextStep = STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]
    void save(nextStep)
  }, [save, stepIndex])

  const back = useCallback(() => {
    if (stepIndex <= 0) return
    setStep(STEPS[stepIndex - 1])
  }, [stepIndex])

  const complete = useCallback(
    async (channels: ActivationChoice = activation.channels) => {
      if (!profile.businessName.trim()) {
        setStep("profile")
        setError("Pon el nombre de tu negocio para terminar.")
        return
      }
      setSaving(true)
      setError("")
      try {
        const response = await fetch("/api/onboarding/finesse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentStep: "channels",
            ...profile,
            ...activation,
            channels,
          }),
        })
        const data = (await response.json()) as { redirectTo?: string }
        if (!response.ok) throw new Error("complete_failed")
        router.replace(data.redirectTo ?? "/today")
        router.refresh()
      } catch {
        setError("No pudimos terminar la configuración. Inténtalo otra vez.")
      } finally {
        setSaving(false)
      }
    },
    [activation, profile, router],
  )

  const addService = useCallback(() => {
    const value = serviceDraft.trim()
    if (!value || profile.services.includes(value) || profile.services.length >= 20) return
    setProfile((current) => ({ ...current, services: [...current.services, value] }))
    setServiceDraft("")
  }, [profile.services, serviceDraft])

  if (loading) {
    return (
      <main data-theme="petrol-pearl" className="grid min-h-screen place-items-center bg-[var(--app-canvas)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-dark-strong)] border-t-[var(--accent-primary)]" />
      </main>
    )
  }

  return (
    <main
      data-theme="petrol-pearl"
      className="relative min-h-screen overflow-hidden bg-[var(--app-canvas)] text-[var(--text-primary-light)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--accent-primary)_15%,transparent),transparent_44%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={back}
            disabled={stepIndex === 0 || saving}
            aria-label="Volver"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark)] transition hover:bg-[var(--app-surface-hover)] disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="text-center">
            <p className="text-lg font-semibold tracking-[0.08em]">FINESSE</p>
            <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--text-tertiary-light)]">by sevenef</p>
          </div>

          <span className="w-11 text-right text-xs text-[var(--text-tertiary-light)]">
            {stepIndex + 1}/{STEPS.length}
          </span>
        </header>

        <div className="mx-auto mt-5 h-1 w-full max-w-xl overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-4xl">
            {step === "welcome" ? <Welcome onContinue={next} saving={saving} /> : null}
            {step === "profile" ? (
              <ProfileStep
                profile={profile}
                setProfile={setProfile}
                serviceDraft={serviceDraft}
                setServiceDraft={setServiceDraft}
                addService={addService}
                onContinue={next}
                saving={saving}
              />
            ) : null}
            {step === "presence" ? (
              <PresenceStep
                onCreate={() => void save("preview", { presence: "ready" })}
                onLater={() => void save("preview", { presence: "later" })}
                saving={saving}
              />
            ) : null}
            {step === "preview" ? <PreviewStep profile={profile} onContinue={next} saving={saving} /> : null}
            {step === "google" ? (
              <ChoiceStep
                icon={<MapPin className="h-6 w-6" />}
                eyebrow="Google & Maps"
                title="Haz que te encuentren"
                description="Dinos en qué punto estás. Finesse guardará esta elección para continuar la configuración desde tu perfil de negocio."
                choices={[
                  ["Ya tengo un perfil", "existing"],
                  ["Todavía no tengo", "ready"],
                  ["Lo haré después", "later"],
                ]}
                onChoose={(choice) => void save("assistant", { google: choice })}
                saving={saving}
              />
            ) : null}
            {step === "assistant" ? (
              <AssistantStep
                onConfigure={() => void save("channels", { assistant: "ready" })}
                onLater={() => void save("channels", { assistant: "later" })}
                saving={saving}
              />
            ) : null}
            {step === "channels" ? (
              <ChannelsStep
                onConfigured={() => void complete("ready")}
                onLater={() => void complete("later")}
                saving={saving}
              />
            ) : null}

            {error ? (
              <p role="alert" className="mx-auto mt-5 max-w-xl text-center text-sm text-red-300">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function Welcome({ onContinue, saving }: { onContinue: () => void; saving: boolean }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] shadow-[var(--app-shadow-subtle)]">
        <Sparkles className="h-7 w-7 text-[var(--accent-primary)]" />
      </div>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">Bienvenida a Finesse</p>
      <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Tu talento. Nuestro soporte.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary-light)] sm:text-lg">
        Empecemos preparando la presencia digital de tu negocio. Lo que configures aquí quedará en tu Business Profile y podrás editarlo después.
      </p>
      <PrimaryButton onClick={onContinue} disabled={saving}>Empezar</PrimaryButton>
    </div>
  )
}

function ProfileStep({
  profile,
  setProfile,
  serviceDraft,
  setServiceDraft,
  addService,
  onContinue,
  saving,
}: {
  profile: Profile
  setProfile: React.Dispatch<React.SetStateAction<Profile>>
  serviceDraft: string
  setServiceDraft: (value: string) => void
  addService: () => void
  onContinue: () => void
  saving: boolean
}) {
  const canContinue = profile.businessName.trim().length > 0
  return (
    <div className="mx-auto max-w-3xl">
      <StepHeading
        eyebrow="Tu información"
        title="Cuéntanos lo esencial de tu negocio"
        description="Usaremos estos datos como fuente para Finesse, Presence y el contexto de tu asistente."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio" className="sm:col-span-2">
          <input
            autoFocus
            value={profile.businessName}
            maxLength={120}
            onChange={(event) => setProfile((p) => ({ ...p, businessName: event.target.value }))}
            placeholder="Ej. Studio Eli"
            className={inputClass}
          />
        </Field>
        <Field label="Zona o ubicación">
          <input
            value={profile.region}
            onChange={(event) => setProfile((p) => ({ ...p, region: event.target.value }))}
            placeholder="Murcia, España"
            className={inputClass}
          />
        </Field>
        <Field label="Horario">
          <input
            value={profile.workingHours}
            onChange={(event) => setProfile((p) => ({ ...p, workingHours: event.target.value }))}
            placeholder="Lun–Vie 9:00–18:00"
            className={inputClass}
          />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea
            value={profile.businessDescription}
            onChange={(event) => setProfile((p) => ({ ...p, businessDescription: event.target.value }))}
            placeholder="Qué haces y qué hace especial tu negocio"
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </Field>
        <Field label="Servicios" className="sm:col-span-2">
          <div className="flex gap-2">
            <input
              value={serviceDraft}
              onChange={(event) => setServiceDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  addService()
                }
              }}
              placeholder="Ej. Manicura semipermanente"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addService}
              className="min-h-12 rounded-2xl border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] px-4 text-sm font-semibold"
            >
              Añadir
            </button>
          </div>
          {profile.services.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.services.map((service) => (
                <button
                  type="button"
                  key={service}
                  onClick={() =>
                    setProfile((p) => ({ ...p, services: p.services.filter((item) => item !== service) }))
                  }
                  className="rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-1.5 text-xs"
                  title="Quitar servicio"
                >
                  {service} ×
                </button>
              ))}
            </div>
          ) : null}
        </Field>
      </div>
      <PrimaryButton onClick={onContinue} disabled={!canContinue || saving}>Continuar</PrimaryButton>
    </div>
  )
}

function PresenceStep({
  onCreate,
  onLater,
  saving,
}: {
  onCreate: () => void
  onLater: () => void
  saving: boolean
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]">
        <Globe2 className="h-7 w-7 text-[var(--accent-primary)]" />
      </div>
      <StepHeading
        eyebrow="Presence"
        title="Haz que tu negocio esté presente"
        description="Tu información puede alimentar tu web, tu visibilidad local y los puntos desde los que tus clientes llegan a Finesse."
      />
      <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        {[
          [MonitorSmartphone, "Tu web", "Una presencia coherente con tu negocio."],
          [MapPin, "Google & Maps", "Prepara la información que te ayuda a ser encontrada."],
          [MessageCircle, "Tus canales", "Reúne los puntos de contacto con tus clientes."],
        ].map(([Icon, title, copy]) => {
          const CardIcon = Icon as typeof Globe2
          return (
            <div key={String(title)} className={cardClass}>
              <CardIcon className="h-5 w-5 text-[var(--accent-primary)]" />
              <p className="mt-4 font-semibold">{String(title)}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary-light)]">{String(copy)}</p>
            </div>
          )
        })}
      </div>
      <PrimaryButton onClick={onCreate} disabled={saving}>Crear mi Presence</PrimaryButton>
      <QuietButton onClick={onLater} disabled={saving}>Ahora no</QuietButton>
    </div>
  )
}

function PreviewStep({ profile, onContinue, saving }: { profile: Profile; onContinue: () => void; saving: boolean }) {
  return (
    <div className="mx-auto max-w-4xl">
      <StepHeading
        eyebrow="Vista previa"
        title="Así empieza a verse tu negocio"
        description="Esta vista usa los datos reales que acabas de introducir. Presence seguirá leyendo el Business Profile; no crea una segunda copia."
      />
      <div className="mx-auto mt-8 overflow-hidden rounded-[30px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-[var(--shadow-strong)]">
        <div className="grid min-h-[330px] md:grid-cols-[1.2fr_.8fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">Finesse Presence</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">{profile.businessName || "Tu negocio"}</h2>
            <p className="mt-4 max-w-lg leading-7 text-[var(--text-secondary-light)]">
              {profile.businessDescription || "Tu descripción aparecerá aquí cuando la añadas."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {profile.services.slice(0, 5).map((service) => (
                <span key={service} className="rounded-full border border-[var(--border-dark)] px-3 py-1.5 text-xs">{service}</span>
              ))}
            </div>
          </div>
          <div className="relative min-h-56 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--accent-primary)_36%,transparent),transparent_55%),linear-gradient(145deg,var(--app-surface-dark-elevated),var(--app-canvas))]">
            <div className="absolute inset-x-8 bottom-8 rounded-2xl border border-white/10 bg-black/15 p-4 backdrop-blur-md">
              <p className="text-sm font-medium">{profile.region || "Tu ubicación"}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary-light)]">{profile.workingHours || "Tu horario"}</p>
            </div>
          </div>
        </div>
      </div>
      <PrimaryButton onClick={onContinue} disabled={saving}>Continuar</PrimaryButton>
    </div>
  )
}

function ChoiceStep({
  icon,
  eyebrow,
  title,
  description,
  choices,
  onChoose,
  saving,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  description: string
  choices: Array<[string, ActivationChoice]>
  onChoose: (choice: ActivationChoice) => void
  saving: boolean
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] text-[var(--accent-primary)]">{icon}</div>
      <StepHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="mx-auto mt-8 grid max-w-lg gap-3">
        {choices.map(([label, choice]) => (
          <button
            key={choice}
            type="button"
            disabled={saving}
            onClick={() => onChoose(choice)}
            className="flex min-h-14 items-center justify-between rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-5 text-left text-sm font-semibold transition hover:border-[var(--accent-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
          >
            {label}
            <ArrowRight className="h-4 w-4 text-[var(--text-tertiary-light)]" />
          </button>
        ))}
      </div>
    </div>
  )
}

function AssistantStep({
  onConfigure,
  onLater,
  saving,
}: {
  onConfigure: () => void
  onLater: () => void
  saving: boolean
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]">
        <Bot className="h-7 w-7 text-[var(--accent-primary)]" />
      </div>
      <StepHeading
        eyebrow="Asistente"
        title="Fanny puede ayudarte a atender"
        description="Aquí solo preparamos la activación. Las acciones reales seguirán las reglas y confirmaciones de tu workspace."
      />
      <div className="mx-auto mt-8 max-w-xl rounded-[26px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5 text-left">
        <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-[var(--app-surface-dark-elevated)] p-4 text-sm leading-6">
          Hola, ¿tienes cita disponible el viernes por la tarde?
        </div>
        <div className="ml-auto mt-3 max-w-[86%] rounded-2xl rounded-br-md border border-[var(--accent-primary)]/30 bg-[color-mix(in_srgb,var(--accent-primary)_13%,var(--app-surface-dark))] p-4 text-sm leading-6">
          Puedo revisar la agenda y preparar una respuesta. Tú decides qué acciones pueden hacerse automáticamente.
        </div>
      </div>
      <PrimaryButton onClick={onConfigure} disabled={saving}>Preparar mi asistente</PrimaryButton>
      <QuietButton onClick={onLater} disabled={saving}>Configurar después</QuietButton>
    </div>
  )
}

function ChannelsStep({
  onConfigured,
  onLater,
  saving,
}: {
  onConfigured: () => void
  onLater: () => void
  saving: boolean
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <StepHeading
        eyebrow="Canales"
        title="Tus conversaciones, en un solo lugar"
        description="WhatsApp e Instagram forman parte de la experiencia de Finesse. La conexión real se administra desde Business Profile → Canales."
      />
      <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
        <ChannelCard icon={<MessageCircle className="h-5 w-5" />} name="WhatsApp" copy="Preparado para conectar" />
        <ChannelCard icon={<Instagram className="h-5 w-5" />} name="Instagram" copy="Preparado para conectar" />
        <ChannelCard icon={<MessageCircle className="h-5 w-5" />} name="Messenger" copy="Próximamente" muted />
        <ChannelCard icon={<Scissors className="h-5 w-5" />} name="Web chat" copy="Ligado a tu Presence" />
      </div>
      <PrimaryButton onClick={onConfigured} disabled={saving}>
        <Check className="h-4 w-4" /> Terminar y entrar en Finesse
      </PrimaryButton>
      <QuietButton onClick={onLater} disabled={saving}>Conectar canales después</QuietButton>
    </div>
  )
}

function ChannelCard({ icon, name, copy, muted = false }: { icon: React.ReactNode; name: string; copy: string; muted?: boolean }) {
  return (
    <div className={`${cardClass} text-left ${muted ? "opacity-55" : ""}`}>
      <div className="text-[var(--accent-primary)]">{icon}</div>
      <p className="mt-4 font-semibold">{name}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary-light)]">{copy}</p>
    </div>
  )
}

function StepHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">{eyebrow}</p>
      <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary-light)] sm:text-base">{description}</p>
    </div>
  )
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="mx-auto mt-8 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] px-7 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--app-shadow-subtle)] transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function QuietButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="mx-auto mt-3 block min-h-10 px-4 text-sm font-medium text-[var(--text-secondary-light)] transition hover:text-[var(--text-primary-light)] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

const inputClass =
  "min-h-12 w-full rounded-2xl border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] px-4 py-3 text-sm outline-none placeholder:text-[var(--text-tertiary-light)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15"

const cardClass =
  "rounded-[24px] border border-[var(--border-dark)] bg-[color-mix(in_srgb,var(--app-surface-dark)_88%,transparent)] p-5 shadow-[var(--app-shadow-subtle)]"
