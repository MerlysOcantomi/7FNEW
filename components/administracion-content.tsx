"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav"
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel"
import { Save, ToggleLeft, ToggleRight, ChevronDown, Bot, X, Check, Loader2, Languages } from "lucide-react"
import type { ForteSettingsHandoff } from "@/agents/forte/runtime/business/settings-handoff"
import type { EntityVocabulary } from "@core/personalization"
import { DEFAULT_VOCABULARY } from "@core/personalization"
import { useI18n } from "@/components/i18n-provider"
import { useToast } from "@/components/toast-provider"
import { LOCALE_DISPLAY_NAMES } from "@core/i18n/locale"
import type { SupportedLocale } from "@core/i18n/types"

// ── Types ─────────────────────────────────────────────────────────────────────
interface CapabilityItem {
  id: string
  label: string
  locked?: boolean
}
interface CapabilityGroup {
  section: string
  items: CapabilityItem[]
}

// ── Settings item → workspace config module key ──────────────────────────────
// Maps UI item IDs to the real keys stored in Workspace.config.modules.
// Items NOT in this map have no config backing and remain locked/always-on.
const ITEM_TO_CONFIG_KEY: Record<string, string> = {
  inbox:            "inbox",
  clientes:         "crm",
  campanas:         "campaigns",
  finanzas:         "finance",
  automatizaciones: "automation",
}

function getConfigKey(itemId: string): string | undefined {
  return ITEM_TO_CONFIG_KEY[itemId]
}

// ── Core Capabilities ─────────────────────────────────────────────────────────
// Items with a config key are configurable. Others are core/always-on.
// Labels are derived from the personalization vocabulary.
function buildCoreCapabilities(v: EntityVocabulary = DEFAULT_VOCABULARY): CapabilityGroup[] {
  return [
    {
      section: "Core",
      items: [
        { id: "inbox", label: v.inbox.singular },
        { id: "entrada", label: "Manual Intake", locked: true },
        { id: "clientes", label: v.client.plural },
        { id: "proyectos", label: v.project.plural, locked: true },
        { id: "tareas", label: v.task.plural, locked: true },
        { id: "calendario", label: v.calendar.singular, locked: true },
        { id: "archivos", label: v.document.plural, locked: true },
      ],
    },
    {
      section: "Growth",
      items: [
        { id: "campanas", label: v.marketing.singular },
      ],
    },
    {
      section: "Revenue",
      items: [
        { id: "finanzas", label: v.finance.singular },
        { id: "facturacion", label: v.billing.singular, locked: true },
      ],
    },
    {
      section: "Advanced",
      items: [
        { id: "agente", label: "Overview insights", locked: true },
        { id: "motor", label: "AI workspace", locked: true },
        { id: "departamentos", label: v.department.plural, locked: true },
      ],
    },
  ]
}

const CORE_CAPABILITIES_DEFAULT = buildCoreCapabilities()

// ── Extension Packs ────────────────────────────────────────────────────────────
type PackKey = "standard" | "construction" | "ecommerce"

const EXTENSION_PACKS: Record<PackKey, { label: string; groups: CapabilityGroup[] }> = {
  standard: {
    label: "Standard workspace",
    groups: [],
  },
  construction: {
    label: "Construction pack",
    groups: [
      {
        section: "Core",
        items: [
          { id: "subcontratistas", label: "Subcontractors" },
          { id: "control_obra", label: "Site control" },
          { id: "certificaciones", label: "Certifications" },
          { id: "avance_fisico", label: "Physical progress" },
        ],
      },
      {
        section: "Revenue",
        items: [
          { id: "pagos_avance", label: "Progress payments" },
          { id: "retenciones", label: "Retentions" },
        ],
      },
    ],
  },
  ecommerce: {
    label: "Ecommerce pack",
    groups: [
      {
        section: "Core",
        items: [
          { id: "pedidos", label: "Orders" },
          { id: "inventario", label: "Inventory" },
          { id: "productos", label: "Products" },
        ],
      },
      {
        section: "Revenue",
        items: [
          { id: "pagos_online", label: "Online payments" },
          { id: "reembolsos", label: "Refunds" },
        ],
      },
    ],
  },
}

// ── Advanced customization items ──────────────────────────────────────────────
const ADVANCED_ITEMS: CapabilityItem[] = [
  { id: "custom_fields", label: "Custom fields" },
  { id: "etiquetas", label: "Internal labels" },
  { id: "automatizaciones", label: "Specific automations" },
]

// ── Section label color map ────────────────────────────────────────────────────
const SECTION_COLOR: Record<string, string> = {
  Core: "text-[#2563EB]",
  Growth: "text-[#0F172A]",
  Revenue: "text-[#1D4ED8]",
  Advanced: "text-[#64748B]",
}

// ── Domain labels for banner ──────────────────────────────────────────────────
const DOMAIN_DISPLAY: Record<string, string> = {
  communication: "communication",
  relationship: "client relationships",
  delivery: "project delivery",
  marketing: "marketing",
  content: "content",
  finance: "finance",
  intelligence: "intelligence",
}

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({
  enabled,
  locked,
  onToggle,
}: {
  enabled: boolean
  locked?: boolean
  onToggle: () => void
}) {
  if (locked) {
    return (
      <div className="flex items-center gap-1.5">
        <ToggleRight size={22} className="text-[#3B82F6]" strokeWidth={1.5} />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
          Always on
        </span>
      </div>
    )
  }
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 group"
      aria-label={enabled ? "Disable" : "Enable"}
    >
      {enabled ? (
        <ToggleRight size={22} className="text-[#3B82F6]" strokeWidth={1.5} />
      ) : (
        <ToggleLeft size={22} className="text-muted-foreground/60 group-hover:text-muted-foreground" strokeWidth={1.5} />
      )}
    </button>
  )
}

// ── Capability Row ─────────────────────────────────────────────────────────────
function CapabilityRow({
  item,
  enabled,
  onToggle,
  highlighted,
}: {
  item: CapabilityItem
  enabled: boolean
  onToggle: () => void
  highlighted?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between py-3 px-4 border-b border-border last:border-0 hover:bg-muted transition-colors ${
        highlighted ? "bg-[#EFF6FF] border-l-[3px] border-l-[#3B82F6]" : ""
      }`}
    >
      <span className={`text-sm ${item.locked ? "text-foreground font-medium" : enabled ? "text-foreground" : "text-muted-foreground"}`}>
        {item.label}
      </span>
      <Toggle enabled={item.locked ? true : enabled} locked={item.locked} onToggle={onToggle} />
    </div>
  )
}

// ── Section Group ──────────────────────────────────────────────────────────────
function CapabilityGroupBlock({
  group,
  enabledMap,
  onToggle,
  bgClass,
  highlightId,
}: {
  group: CapabilityGroup
  enabledMap: Record<string, boolean>
  onToggle: (id: string) => void
  bgClass?: string
  highlightId?: string
}) {
  return (
    <div className={`rounded-xl overflow-hidden border border-border ${bgClass ?? "bg-card"}`}>
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-widest ${SECTION_COLOR[group.section] ?? "text-foreground"}`}>
          {group.section}
        </span>
      </div>
      <div>
        {group.items.map((item) => (
          <CapabilityRow
            key={item.id}
            item={item}
            enabled={item.locked ? true : (enabledMap[item.id] ?? false)}
            onToggle={() => onToggle(item.id)}
            highlighted={item.id === highlightId}
          />
        ))}
      </div>
    </div>
  )
}

// ── Forte Banner ──────────────────────────────────────────────────────────────
function ForteBanner({
  handoff,
  onDismiss,
}: {
  handoff: ForteSettingsHandoff
  onDismiss: () => void
}) {
  const domainLabel = handoff.domain ? DOMAIN_DISPLAY[handoff.domain] : undefined

  let message: string
  if (handoff.reason === "empty-workspace") {
    message = "Forte noticed your workspace needs initial setup. Review the capabilities below to get started."
  } else if (domainLabel) {
    message = `Forte sent you here to review your ${domainLabel} setup.`
  } else {
    message = "Forte recommended reviewing your workspace configuration."
  }

  return (
    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-5 py-4 flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={14} className="text-[#2563EB]" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#1E40AF] font-medium">{message}</p>
        <Link
          href="/forte/improvements"
          className="text-xs text-[#3B82F6] hover:text-[#1D4ED8] hover:underline mt-1 inline-block transition-colors"
        >
          Back to Forte Improvements
        </Link>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-md hover:bg-[#DBEAFE] transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} className="text-[#93C5FD]" strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitialModuleState(moduleConfig: Record<string, boolean>): Record<string, boolean> {
  const state: Record<string, boolean> = {}
  for (const [itemId, configKey] of Object.entries(ITEM_TO_CONFIG_KEY)) {
    state[itemId] = moduleConfig[configKey] ?? true
  }
  return state
}

function getChangedModules(
  current: Record<string, boolean>,
  original: Record<string, boolean>,
): Array<{ moduleKey: string; enabled: boolean }> {
  const changes: Array<{ moduleKey: string; enabled: boolean }> = []
  for (const [itemId, configKey] of Object.entries(ITEM_TO_CONFIG_KEY)) {
    if (current[itemId] !== original[itemId]) {
      changes.push({ moduleKey: configKey, enabled: current[itemId] })
    }
  }
  return changes
}

// ── Content ───────────────────────────────────────────────────────────────────

/**
 * Workspace language control — persists `Workspace.config.locale` through the
 * existing admin-gated `PUT /api/workspaces/[id]/locale` endpoint (the API is
 * the authority; the UI mirror only reflects it). It NEVER touches the
 * viewer's `User.locale`: a member with a personal preference keeps their own
 * UI language, while members without one adopt the new workspace fallback on
 * the `router.refresh()` that follows a successful save. Language ≠ currency /
 * country / timezone — this control changes language only.
 */
function WorkspaceLanguageSection({
  workspaceId,
  isAdmin,
  initialLocale,
}: {
  workspaceId: string
  isAdmin: boolean
  initialLocale: SupportedLocale
}) {
  const router = useRouter()
  const { t, supportedLocales } = useI18n()
  const { addToast } = useToast()
  const [savedLocale, setSavedLocale] = useState<SupportedLocale>(initialLocale)
  const [saving, setSaving] = useState(false)

  const strings = t.settings.language

  const handleSelect = async (next: SupportedLocale) => {
    if (!isAdmin || saving || next === savedLocale || !workspaceId) return
    const previous = savedLocale
    setSavedLocale(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/locale`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      })
      const json: unknown = await res.json().catch(() => null)
      const ok =
        res.ok &&
        Boolean(json && typeof json === "object" && (json as { success?: boolean }).success)
      if (!ok) throw new Error("workspace-locale-update-failed")
      addToast({
        type: "success",
        title: strings.workspaceUpdatedToast,
        description: LOCALE_DISPLAY_NAMES[next],
      })
      // Members whose effective locale follows the workspace pick up the new
      // fallback on this refresh; explicit personal preferences are untouched.
      router.refresh()
    } catch {
      setSavedLocale(previous)
      addToast({
        type: "error",
        title: strings.workspaceUpdateErrorTitle,
        description: strings.updateErrorBody,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {strings.workspaceLabel}
        </h2>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Languages size={15} strokeWidth={1.75} className="text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{strings.workspaceLabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {strings.workspaceDescription}
                {!isAdmin ? ` ${strings.workspaceReadOnly}` : ""}
              </p>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label={strings.workspaceLabel}
            className="flex shrink-0 gap-1 rounded-lg border border-border bg-muted p-1"
          >
            {supportedLocales.map((option) => {
              const isActive = savedLocale === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => handleSelect(option)}
                  disabled={!isAdmin || saving}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground disabled:opacity-60"
                  }`}
                >
                  {saving && isActive ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : isActive ? (
                    <Check size={12} />
                  ) : null}
                  {LOCALE_DISPLAY_NAMES[option]}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

interface AdministracionContentProps {
  handoff: ForteSettingsHandoff | null
  workspaceId: string
  wsRole: string
  moduleConfig: Record<string, boolean>
  workspaceLocale: SupportedLocale
  vocabulary?: EntityVocabulary
}

export function AdministracionContent({
  handoff,
  workspaceId,
  wsRole,
  moduleConfig,
  workspaceLocale,
  vocabulary,
}: AdministracionContentProps) {
  const v = vocabulary ?? DEFAULT_VOCABULARY
  const CORE_CAPABILITIES = vocabulary ? buildCoreCapabilities(v) : CORE_CAPABILITIES_DEFAULT

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [copilotCollapsed, setCopilotCollapsed] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const isAdmin = wsRole === "ADMIN" || wsRole === "OWNER"
  // Governance: module enablement is a PLATFORM-ADMIN control (via /system),
  // plan/billing-gated — never a tenant self-service switch. Modules render
  // read-only here regardless of workspace role; the API enforces the same.
  const canEditModules: boolean = false

  const [originalModuleState] = useState(() => buildInitialModuleState(moduleConfig))
  const [moduleState, setModuleState] = useState(() => buildInitialModuleState(moduleConfig))

  const [selectedPack, setSelectedPack] = useState<PackKey>("construction")
  const [packDropdownOpen, setPackDropdownOpen] = useState(false)

  const [extensionEnabled, setExtensionEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    Object.values(EXTENSION_PACKS).forEach(({ groups }) => {
      groups.forEach(({ items }) => {
        items.forEach(({ id }) => { initial[id] = true })
      })
    })
    return initial
  })

  const [advancedEnabled, setAdvancedEnabled] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {
      custom_fields: true,
      etiquetas: false,
    }
    const autoKey = getConfigKey("automatizaciones")
    state.automatizaciones = autoKey ? (moduleConfig[autoKey] ?? false) : false
    return state
  })

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const toggleModule = useCallback((itemId: string) => {
    if (!canEditModules) return
    setModuleState((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
    setSaveStatus("idle")
  }, [canEditModules])

  const toggleExtension = (id: string) => {
    setExtensionEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const toggleAdvanced = (id: string) => {
    if (id === "automatizaciones" && !canEditModules) return
    setAdvancedEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
    setSaveStatus("idle")
  }

  const allModuleEnabled: Record<string, boolean> = {
    ...moduleState,
    ...advancedEnabled,
  }

  const handleCoreCoreToggle = (itemId: string) => {
    if (getConfigKey(itemId)) {
      toggleModule(itemId)
    }
  }

  const changedModules = getChangedModules(moduleState, originalModuleState)
  const autoChanged = advancedEnabled.automatizaciones !== (moduleConfig["automation"] ?? false)
  const hasChanges = changedModules.length > 0 || autoChanged

  const handleSave = async () => {
    if (!workspaceId || !hasChanges) return
    setSaveStatus("saving")

    try {
      const allChanges = [...changedModules]
      if (autoChanged) {
        allChanges.push({ moduleKey: "automation", enabled: advancedEnabled.automatizaciones })
      }

      for (const change of allChanges) {
        const res = await fetch(`/api/workspaces/${workspaceId}/modules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
        })
        if (!res.ok) throw new Error("Failed to save")
      }

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch {
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 3000)
    }
  }

  const currentPack = EXTENSION_PACKS[selectedPack]
  const showBanner = handoff !== null && !bannerDismissed
  const highlightId = handoff?.settingsItemId ?? undefined

  const saveLabel =
    saveStatus === "saving" ? "Saving..." :
    saveStatus === "saved" ? "Saved" :
    saveStatus === "error" ? "Error — try again" :
    hasChanges ? "Save changes" : "No changes"

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-background font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 overflow-y-auto">

            {/* Header */}
            <div className="px-4 md:px-8 pt-7 pb-5 border-b border-border bg-background flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                  Settings
                </p>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  Workspace settings
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Review core capabilities, optional packs, and advanced upgrades for this workspace.
                </p>
                {!isAdmin && (
                  <p className="text-xs text-[#D97706] mt-1.5">
                    You need admin or owner access to change settings.
                  </p>
                )}
                {isAdmin && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Link href="/administracion/canales" className="font-medium text-[#1D4ED8] hover:underline">
                      Email channels
                    </Link>
                    {" "}
                    — IMAP/SMTP inboxes for this workspace.
                  </p>
                )}
              </div>
              {canEditModules && (
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saveStatus === "saving"}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shrink-0 self-start sm:self-auto ${
                    hasChanges
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {saveStatus === "saving" ? (
                    <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  ) : saveStatus === "saved" ? (
                    <Check size={14} strokeWidth={1.75} />
                  ) : (
                    <Save size={14} strokeWidth={1.75} />
                  )}
                  {saveLabel}
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-4 md:px-8 py-8 space-y-10">

              {/* Forte contextual banner */}
              {showBanner && (
                <ForteBanner
                  handoff={handoff}
                  onDismiss={() => setBannerDismissed(true)}
                />
              )}

              {/* ── Workspace language (business/customer-facing language) ── */}
              <WorkspaceLanguageSection
                workspaceId={workspaceId}
                isAdmin={isAdmin}
                initialLocale={workspaceLocale}
              />

              {/* ── Section 1: Core capabilities ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Core capabilities
                  </h2>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-[#EFF6FF] border-b border-[#DBEAFE]">
                    <p className="text-xs text-[#1D4ED8] font-medium">
                      Los módulos de tu workspace los gestiona 7F según tu plan. Aquí ves lo que está
                      disponible; para activar o preparar un módulo,{" "}
                      <Link href="/forte/improvements" className="underline hover:text-[#1D4ED8]">
                        habla con Mr. Forte
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                    {CORE_CAPABILITIES.map((group) => (
                      <div key={group.section}>
                        <div className="px-5 py-2.5 border-b border-border bg-muted">
                          <span className={`text-[11px] font-bold uppercase tracking-widest ${SECTION_COLOR[group.section] ?? "text-foreground"}`}>
                            {group.section}
                          </span>
                        </div>
                        <div className="divide-y divide-border">
                          {group.items.map((item) => {
                            const configurable = !!getConfigKey(item.id)
                            const isLocked = item.locked || !configurable || !canEditModules
                            const isEnabled = isLocked ? true : (allModuleEnabled[item.id] ?? true)

                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between py-3 px-5 hover:bg-muted transition-colors ${
                                  item.id === highlightId ? "bg-[#EFF6FF] border-l-[3px] border-l-[#3B82F6]" : ""
                                }`}
                              >
                                <span className={`text-sm ${isLocked ? "text-foreground font-medium" : isEnabled ? "text-foreground" : "text-muted-foreground"}`}>
                                  {item.label}
                                </span>
                                {isLocked ? (
                                  <div className="flex items-center gap-1.5">
                                    <ToggleRight size={20} className="text-[#3B82F6]" strokeWidth={1.5} />
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:block">
                                      Always on
                                    </span>
                                  </div>
                                ) : (
                                  <Toggle
                                    enabled={isEnabled}
                                    onToggle={() => handleCoreCoreToggle(item.id)}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Section 2: Optional packs ── */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Optional packs
                  </h2>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Selected pack</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Choose the optional capability pack that best matches this workspace.
                      </p>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        onClick={() => setPackDropdownOpen((v) => !v)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-muted hover:border-[#BFDBFE] text-sm font-medium text-foreground transition-colors min-w-[180px] justify-between"
                      >
                        {currentPack.label}
                        <ChevronDown
                          size={14}
                          strokeWidth={2}
                          className={`text-muted-foreground transition-transform duration-200 ${packDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {packDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setPackDropdownOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                            {(Object.keys(EXTENSION_PACKS) as PackKey[]).map((key) => (
                              <button
                                key={key}
                                onClick={() => {
                                  setSelectedPack(key)
                                  setPackDropdownOpen(false)
                                }}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-[#EFF6FF] transition-colors ${
                                  selectedPack === key
                                    ? "bg-[#EFF6FF] text-[#1D4ED8] font-medium"
                                    : "text-foreground"
                                }`}
                              >
                                {EXTENSION_PACKS[key].label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {currentPack.groups.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        The standard workspace does not include additional optional packs.
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Select a pack to preview extra capabilities.
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 space-y-3">
                      <div className="px-3 py-2 bg-[#FEF9C3] border border-[#FDE68A] rounded-lg">
                        <p className="text-xs text-[#92400E] font-medium">
                          Preview only — pack capabilities are not configurable yet.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentPack.groups.map((group) => (
                          <CapabilityGroupBlock
                            key={group.section}
                            group={{ ...group, items: group.items.map((i) => ({ ...i, locked: true })) }}
                            enabledMap={extensionEnabled}
                            onToggle={() => {}}
                            bgClass="bg-muted"
                            highlightId={highlightId}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Section 3: Advanced options ── */}
              <section>
                <div className="mb-4">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Advanced options
                  </h2>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden max-w-lg">
                  <div className="divide-y divide-border">
                    {ADVANCED_ITEMS.map((item) => {
                      const hasRealConfig = !!getConfigKey(item.id)
                      const isLocked = !hasRealConfig

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between py-3.5 px-5 hover:bg-muted transition-colors ${
                            item.id === highlightId ? "bg-[#EFF6FF] border-l-[3px] border-l-[#3B82F6]" : ""
                          }`}
                        >
                          <span className={`text-sm ${isLocked ? "text-muted-foreground" : advancedEnabled[item.id] ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {item.label}
                          </span>
                          {isLocked ? (
                            <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
                              Coming soon
                            </span>
                          ) : (
                            <Toggle
                              enabled={advancedEnabled[item.id] ?? false}
                              locked={!canEditModules}
                              onToggle={() => toggleAdvanced(item.id)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* ── Bottom save bar (mobile sticky) ── */}
              {hasChanges && isAdmin && (
                <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-card border-t border-border shadow-lg">
                  <button
                    onClick={handleSave}
                    disabled={saveStatus === "saving"}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
                  >
                    {saveStatus === "saving" ? (
                      <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                    ) : (
                      <Save size={14} strokeWidth={1.75} />
                    )}
                    {saveStatus === "saving" ? "Saving..." : "Save changes"}
                  </button>
                </div>
              )}

            </div>
          </main>

          <CopilotPanel defaultContext="Overview" />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  )
}
