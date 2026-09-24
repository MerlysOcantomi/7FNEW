"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function BonabastoOnboardingPage() {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/onboarding/bonabasto", { cache: "no-store" })
        if (!response.ok) throw new Error("load_failed")
        const data = (await response.json()) as { status?: string; businessName?: string }
        if (cancelled) return
        if (data.status === "completed") {
          router.replace("/today")
          return
        }
        setBusinessName(data.businessName ?? "")
      } catch {
        if (!cancelled) setError("No pudimos cargar tu espacio de Bonabasto.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = businessName.trim()
    if (!name) return

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/onboarding/bonabasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: name }),
      })
      const data = (await response.json()) as { redirectTo?: string; error?: string }
      if (!response.ok) throw new Error(data.error || "save_failed")
      router.replace(data.redirectTo ?? "/today")
      router.refresh()
    } catch {
      setError("No pudimos guardar los cambios. Inténtalo otra vez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main
      data-theme="midnight"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-canvas)] px-5 py-10 text-[var(--text-primary-light)]"
    >
      <section className="relative z-10 w-full max-w-lg">
        <div className="mb-10 text-center">
          <p className="text-3xl font-semibold tracking-tight">Bonabasto</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[var(--text-tertiary-light)]">
            by sevenef
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--border-dark)] bg-[color-mix(in_srgb,var(--app-surface-dark)_86%,transparent)] p-6 shadow-[var(--shadow-strong)] backdrop-blur-xl sm:p-8">
          {loading ? (
            <div className="flex min-h-44 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border-dark-strong)] border-t-[var(--accent-primary)]" />
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-on-dark)]">
                Empecemos
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                ¿Cómo se llama tu negocio?
              </h1>
              <p className="mt-2 text-sm text-[var(--text-secondary-light)]">
                Crearemos tu espacio Food / Hospitality en sevenef.
              </p>

              <input
                autoFocus
                type="text"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                maxLength={120}
                placeholder="Nombre del negocio"
                className="mt-7 w-full rounded-2xl border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] px-4 py-3.5 text-[15px] outline-none placeholder:text-[var(--text-tertiary-light)] focus:border-[var(--accent-primary)]"
              />

              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={saving || !businessName.trim()}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Continuar"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
