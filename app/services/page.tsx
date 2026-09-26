"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { CheckCircle2, Loader2, Plus, Save, Trash2, Users } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { ServiceCatalogItem } from "@core/services/catalog"

interface WorkspaceProfessional {
  userId: string
  nombre: string | null
  email: string
  avatar: string | null
  role: string
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export default function ServicesPage() {
  const { t } = useI18n()
  const S = t.services
  const [items, setItems] = useState<ServiceCatalogItem[]>([])
  const [professionals, setProfessionals] = useState<WorkspaceProfessional[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<"load" | "save" | null>(null)
  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState("")

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [servicesRes, membersRes] = await Promise.all([
        fetch("/api/workspace/services"),
        fetch("/api/inbox/workspace-members"),
      ])
      if (!servicesRes.ok) throw new Error("Failed to load catalog")
      const servicesData = await servicesRes.json()
      setItems(Array.isArray(servicesData.serviceCatalog) ? servicesData.serviceCatalog : [])

      if (membersRes.ok) {
        const membersJson = await membersRes.json()
        const members = Array.isArray(membersJson?.data) ? membersJson.data : []
        setProfessionals(members)
      }
    } catch {
      setError("load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCatalog()
  }, [fetchCatalog])

  const activeCount = useMemo(() => items.filter((item) => item.active).length, [items])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/workspace/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCatalog: items }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      if (Array.isArray(data.serviceCatalog)) setItems(data.serviceCatalog)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    } catch {
      setError("save")
    } finally {
      setSaving(false)
    }
  }

  const addService = () => {
    const name = newName.trim()
    if (!name) return
    const category = newCategory.trim()
    const provisionalId = `new-${items.length}-${name.toLowerCase().replace(/\s+/g, "-")}`
    setItems((prev) => [
      ...prev,
      {
        id: provisionalId,
        name,
        ...(category ? { category } : {}),
        durationMinutes: 60,
        active: true,
      },
    ])
    setNewName("")
    setNewCategory("")
  }

  const updateItem = (id: string, patch: Partial<ServiceCatalogItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const toggleProfessional = (item: ServiceCatalogItem, userId: string) => {
    const selected = new Set(item.staffUserIds ?? [])
    if (selected.has(userId)) selected.delete(userId)
    else selected.add(userId)
    updateItem(item.id, { staffUserIds: selected.size > 0 ? [...selected] : undefined })
  }

  if (loading) {
    return (
      <AppShell>
        <SectionPage title={S.title} description={S.loading.description}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{S.loading.body}</span>
          </div>
        </SectionPage>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <SectionPage title={S.title} description={S.description}>
        <div className="flex max-w-4xl flex-col gap-6">
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">{S.add.heading}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addService()
                  }
                }}
                placeholder={S.add.namePlaceholder}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={S.add.categoryOptionalPlaceholder}
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-48"
              />
              <button
                type="button"
                onClick={addService}
                disabled={!newName.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> {S.add.button}
              </button>
            </div>
          </section>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{S.list.empty}</p>
          ) : (
            <section className="flex flex-col gap-3">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {S.list.counts(items.length, activeCount)}
              </p>

              {items.map((item) => (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4",
                    !item.active && "opacity-65",
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-foreground focus:border-border focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        value={item.category ?? ""}
                        onChange={(e) => updateItem(item.id, { category: e.target.value || undefined })}
                        placeholder={S.list.categoryPlaceholder}
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-muted-foreground focus:border-border focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring sm:w-44"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { active: !item.active })}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                            item.active
                              ? "bg-[color-mix(in_srgb,var(--status-success-text)_12%,transparent)] text-[var(--status-success-text)]"
                              : "bg-muted text-muted-foreground",
                          )}
                          aria-pressed={item.active}
                        >
                          {item.active ? S.list.active : S.list.inactive}
                        </button>
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--status-danger-text)]"
                          aria-label={S.list.removeAria(item.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={item.description ?? ""}
                      onChange={(e) => updateItem(item.id, { description: e.target.value || undefined })}
                      placeholder={S.editor.descriptionPlaceholder}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <Field label={S.editor.duration}>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={item.durationMinutes ?? ""}
                          onChange={(e) =>
                            updateItem(item.id, { durationMinutes: numberOrUndefined(e.target.value) })
                          }
                          className="field-input"
                        />
                      </Field>
                      <Field label={S.editor.price}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.price ?? ""}
                          onChange={(e) => updateItem(item.id, { price: numberOrUndefined(e.target.value) })}
                          className="field-input"
                        />
                      </Field>
                      <Field label={S.editor.currency}>
                        <input
                          value={item.currency ?? "EUR"}
                          maxLength={3}
                          onChange={(e) =>
                            updateItem(item.id, { currency: e.target.value.toUpperCase() || undefined })
                          }
                          className="field-input uppercase"
                        />
                      </Field>
                      <Field label={S.editor.bufferBefore}>
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={item.bufferBeforeMinutes ?? ""}
                          onChange={(e) =>
                            updateItem(item.id, { bufferBeforeMinutes: numberOrUndefined(e.target.value) })
                          }
                          className="field-input"
                        />
                      </Field>
                      <Field label={S.editor.bufferAfter}>
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={item.bufferAfterMinutes ?? ""}
                          onChange={(e) =>
                            updateItem(item.id, { bufferAfterMinutes: numberOrUndefined(e.target.value) })
                          }
                          className="field-input"
                        />
                      </Field>
                    </div>

                    <div className="rounded-lg border border-border bg-[var(--app-surface-subtle)] p-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">{S.editor.professionals}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{S.editor.professionalsHint}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {professionals.length === 0 ? (
                          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                            {S.editor.allProfessionals}
                          </span>
                        ) : (
                          professionals.map((member) => {
                            const selected = (item.staffUserIds ?? []).includes(member.userId)
                            return (
                              <button
                                key={member.userId}
                                type="button"
                                onClick={() => toggleProfessional(item, member.userId)}
                                aria-pressed={selected}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                  selected
                                    ? "border-[var(--accent-muted-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                                    : "border-border bg-background text-muted-foreground hover:bg-accent",
                                )}
                              >
                                {member.nombre || member.email}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                saving
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-foreground text-background hover:opacity-90",
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? S.save.saving : S.save.button}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-[var(--status-success-text)]">
                <CheckCircle2 className="h-4 w-4" /> {S.save.saved}
              </span>
            )}
            {error && (
              <span className="text-sm text-[var(--status-danger-text)]">
                {error === "load" ? S.errors.load : S.errors.save}
              </span>
            )}
          </div>
        </div>

        <style jsx>{`
          :global(.field-input) {
            width: 100%;
            border-radius: 0.5rem;
            border: 1px solid var(--border);
            background: var(--background);
            padding: 0.5rem 0.625rem;
            font-size: 0.875rem;
            color: var(--foreground);
            outline: none;
          }
          :global(.field-input:focus) {
            box-shadow: 0 0 0 1px var(--ring);
          }
        `}</style>
      </SectionPage>
    </AppShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
