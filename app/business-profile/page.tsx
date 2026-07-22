"use client"

import { useState, useEffect, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { BusinessProfileTabs } from "@/components/business-profile/business-profile-tabs"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import { Save, Plus, X, Loader2, CheckCircle2 } from "lucide-react"
import { PRESENCE_SOCIAL_PLATFORMS } from "@engines/presence/social"

interface ProfileData {
  businessName: string
  businessDescription: string
  services: string[]
  tone: string
  languages: string[]
  region: string
  workingHours: string
  attentionRules: string[]
  social: Record<string, string>
}

const EMPTY_PROFILE: ProfileData = {
  businessName: "",
  businessDescription: "",
  services: [],
  tone: "",
  languages: [],
  region: "",
  workingHours: "",
  attentionRules: [],
  social: {},
}

const MAX_SERVICES = 20

export default function BusinessProfilePage() {
  /**
   * ALL system copy (chrome, labels, hints, placeholders, buttons, notices,
   * remove-chip aria labels) resolves from the i18n catalog, so the page
   * follows the viewer's effective locale like the settings entry that opens
   * it. User-entered values (services, languages, rules…) are data — rendered
   * verbatim, never translated.
   */
  const { t } = useI18n()
  const pageCopy = t.settings.businessProfilePage
  const fieldCopy = pageCopy.fields
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newService, setNewService] = useState("")
  const [newLanguage, setNewLanguage] = useState("")
  const [newAttentionRule, setNewAttentionRule] = useState("")

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/business-profile")
      if (!res.ok) throw new Error("Failed to load profile")
      const data = await res.json()
      setProfile({
        businessName: data.businessName ?? "",
        businessDescription: data.businessDescription ?? "",
        services: data.services ?? [],
        tone: data.tone ?? "",
        languages: data.languages ?? [],
        region: data.region ?? "",
        workingHours: data.workingHours ?? "",
        attentionRules: data.attentionRules ?? [],
        social: data.social ?? {},
      })
    } catch {
      setError(pageCopy.loadError)
    } finally {
      setLoading(false)
    }
  }, [pageCopy.loadError])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/workspace/business-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error("Failed to save")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError(pageCopy.saveError)
    } finally {
      setSaving(false)
    }
  }

  const addService = () => {
    const trimmed = newService.trim()
    if (trimmed && !profile.services.includes(trimmed)) {
      setProfile((p) => ({ ...p, services: [...p.services, trimmed] }))
      setNewService("")
    }
  }

  const removeService = (idx: number) => {
    setProfile((p) => ({ ...p, services: p.services.filter((_, i) => i !== idx) }))
  }

  const addLanguage = () => {
    const trimmed = newLanguage.trim()
    if (trimmed && !profile.languages.includes(trimmed)) {
      setProfile((p) => ({ ...p, languages: [...p.languages, trimmed] }))
      setNewLanguage("")
    }
  }

  const removeLanguage = (idx: number) => {
    setProfile((p) => ({ ...p, languages: p.languages.filter((_, i) => i !== idx) }))
  }

  const MAX_ATTENTION_RULES = 20

  const addAttentionRule = () => {
    const trimmed = newAttentionRule.trim()
    if (trimmed && !profile.attentionRules.includes(trimmed) && profile.attentionRules.length < MAX_ATTENTION_RULES) {
      setProfile((p) => ({ ...p, attentionRules: [...p.attentionRules, trimmed] }))
      setNewAttentionRule("")
    }
  }

  const removeAttentionRule = (idx: number) => {
    setProfile((p) => ({ ...p, attentionRules: p.attentionRules.filter((_, i) => i !== idx) }))
  }

  if (loading) {
    return (
      <AppShell>
        <SectionPage title={pageCopy.title} description={pageCopy.loading}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{pageCopy.loading}</span>
          </div>
        </SectionPage>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <SectionPage
        title={pageCopy.title}
        description={pageCopy.description}
      >
        <BusinessProfileTabs />
        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Business Name */}
          <Field label={fieldCopy.businessName.label} hint={fieldCopy.businessName.hint}>
            <input
              type="text"
              value={profile.businessName}
              onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
              placeholder={fieldCopy.businessName.placeholder}
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          {/* Description */}
          <Field label={fieldCopy.businessDescription.label} hint={fieldCopy.businessDescription.hint}>
            <textarea
              value={profile.businessDescription}
              onChange={(e) => setProfile((p) => ({ ...p, businessDescription: e.target.value }))}
              placeholder={fieldCopy.businessDescription.placeholder}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </Field>

          {/* Services */}
          <Field label={fieldCopy.services.label} hint={fieldCopy.services.hint(MAX_SERVICES)}>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile.services.map((svc, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {svc}
                  <button
                    onClick={() => removeService(i)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={fieldCopy.services.removeAria(svc)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {profile.services.length < MAX_SERVICES && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addService() } }}
                  placeholder={fieldCopy.services.placeholder}
                  className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={addService}
                  disabled={!newService.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3.5 w-3.5" /> {pageCopy.add}
                </button>
              </div>
            )}
          </Field>

          {/* Tone */}
          <Field label={fieldCopy.tone.label} hint={fieldCopy.tone.hint}>
            <input
              type="text"
              value={profile.tone}
              onChange={(e) => setProfile((p) => ({ ...p, tone: e.target.value }))}
              placeholder={fieldCopy.tone.placeholder}
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          {/* Languages */}
          <Field label={fieldCopy.languages.label} hint={fieldCopy.languages.hint}>
            <div className="flex flex-wrap gap-2 mb-2">
              {profile.languages.map((lang, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {lang}
                  <button
                    type="button"
                    onClick={() => removeLanguage(i)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={fieldCopy.languages.removeAria(lang)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLanguage() } }}
                placeholder={fieldCopy.languages.placeholder}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={addLanguage}
                disabled={!newLanguage.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" /> {pageCopy.add}
              </button>
            </div>
          </Field>

          {/* Social networks (public links shown on the Presence website) */}
          <div className="border-t border-border pt-6 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{fieldCopy.social.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{fieldCopy.social.hint}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PRESENCE_SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform.key} className="flex flex-col gap-1.5">
                  <label htmlFor={`social-${platform.key}`} className="text-sm font-medium text-foreground">
                    {platform.label}
                  </label>
                  <input
                    id={`social-${platform.key}`}
                    type="text"
                    value={profile.social[platform.key] ?? ""}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, social: { ...p.social, [platform.key]: e.target.value } }))
                    }
                    placeholder={fieldCopy.social.placeholder}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{pageCopy.operatingContext.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {pageCopy.operatingContext.description}
              </p>
            </div>

            <Field label={fieldCopy.region.label} hint={fieldCopy.region.hint}>
              <input
                type="text"
                value={profile.region}
                onChange={(e) => setProfile((p) => ({ ...p, region: e.target.value }))}
                placeholder={fieldCopy.region.placeholder}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            <Field label={fieldCopy.workingHours.label} hint={fieldCopy.workingHours.hint}>
              <input
                type="text"
                value={profile.workingHours}
                onChange={(e) => setProfile((p) => ({ ...p, workingHours: e.target.value }))}
                placeholder={fieldCopy.workingHours.placeholder}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>

            <Field
              label={fieldCopy.attentionRules.label}
              hint={fieldCopy.attentionRules.hint(MAX_ATTENTION_RULES)}
            >
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.attentionRules.map((rule, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground max-w-full"
                  >
                    <span className="truncate">{rule}</span>
                    <button
                      type="button"
                      onClick={() => removeAttentionRule(i)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={fieldCopy.attentionRules.removeAria(rule.slice(0, 80))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {profile.attentionRules.length < MAX_ATTENTION_RULES && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAttentionRule}
                    onChange={(e) => setNewAttentionRule(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addAttentionRule()
                      }
                    }}
                    placeholder={fieldCopy.attentionRules.placeholder}
                    className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={addAttentionRule}
                    disabled={!newAttentionRule.trim()}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" /> {pageCopy.add}
                  </button>
                </div>
              )}
            </Field>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
                saving
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-foreground text-background hover:opacity-90"
              )}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? pageCopy.saving : pageCopy.save}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> {pageCopy.saved}
              </span>
            )}
            {error && (
              <span className="text-sm text-red-500">{error}</span>
            )}
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  )
}
