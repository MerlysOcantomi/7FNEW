"use client"

import { ActionsCard } from "@/components/inbox/actions-card"
import { BusinessContextCard } from "@/components/inbox/business-context-card"
import { MessageIntelligenceCard } from "@/components/inbox/message-intelligence-card"

interface HandoffData {
  status: string
  headline?: string | null
  summary?: string | null
  facts?: string[] | null
  decisions?: string[] | null
  pendingItems?: string[] | null
  risks?: string[] | null
  nextRecommendedAction?: string | null
  confidence?: number | null
  reviewedBy?: string | null
  reviewedAt?: string | null
}

interface ActionData {
  id: string
  type: string
  status: string
  source?: string | null
  confidence?: number | null
  sourceMessageId?: string | null
  data?: Record<string, unknown> | null
  resultModule?: string | null
  resultId?: string | null
  executionNotes?: string | null
  errorMessage?: string | null
  approvedAt?: string | null
  dismissedAt?: string | null
  createdAt: string
}

interface ContextPanelProps {
  selected: {
    summary: string | null
    status: string
    urgency?: string | null
    assignedTo?: string | null
    sentiment?: string | null
    classification?: {
      summary?: string | null
      intent?: string | null
      risks?: string[] | null
      pendingItems?: string[] | null
      nextBestAction?: Record<string, unknown> | null
      briefData?: Record<string, unknown> | null
      suggestedTags?: string[] | null
    } | null
    handoff?: HandoffData | null
    actions?: ActionData[]
    contact: {
      nombre?: string | null
      email: string | null
      empresa: string | null
      telefono?: string | null
      tipo?: string | null
    }
    messageCount: number
    cliente?: { id: string; nombre: string; email?: string | null; empresa?: string | null } | null
    proyecto?: { id: string; nombre: string; estado?: string | null } | null
    channel: string
    leadScore: number | null
    detectedLanguage: string | null
  }
  handoffExpanded: boolean
  setHandoffExpanded: (value: boolean) => void
  actionsExpanded: boolean
  setActionsExpanded: (value: boolean) => void
  businessContextExpanded: boolean
  setBusinessContextExpanded: (value: boolean) => void
  conversationStatusLabel: string
  conversationStatusClassName: string
  updateHandoff: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>
  handoffState: string | null
  linesToText: (value?: string[] | null) => string
  textToLines: (value: string) => string[]
  confidenceLabel: (value?: number | null) => string | null
  formatDateTime: (value?: string | null) => string | null
  pendingActionId: string | null
  handleSuggestedAction: (action: ActionData, operation: "approve" | "dismiss" | "execute") => Promise<void>
  actionTypeLabel: (type: string) => string
  actionStatusBadge: (status: string) => string
  actionStatusLabel: (status: string) => string
  handleConvert: (action: "cliente" | "proyecto" | "tarea" | "todo") => Promise<void>
  actionState: string | null
  channelLabel: (channel: string) => string
}

export function ContextPanel({
  selected,
  handoffExpanded,
  setHandoffExpanded,
  actionsExpanded,
  setActionsExpanded,
  businessContextExpanded,
  setBusinessContextExpanded,
  conversationStatusLabel,
  conversationStatusClassName,
  updateHandoff,
  handoffState,
  linesToText,
  textToLines,
  confidenceLabel,
  formatDateTime,
  pendingActionId,
  handleSuggestedAction,
  actionTypeLabel,
  actionStatusBadge,
  actionStatusLabel,
  handleConvert,
  actionState,
  channelLabel,
}: ContextPanelProps) {
  const urgencyConfig = getUrgencyPresentation(selected.urgency)
  const intelligenceTitle = "Message intelligence"
  const intelligenceSummary =
    selected.handoff?.summary ||
    selected.classification?.summary ||
    selected.summary ||
    "This conversation does not have message intelligence yet."
  const nextRecommendedAction =
    selected.handoff?.nextRecommendedAction ||
    getStringValue(selected.classification?.nextBestAction, ["label", "title", "action"]) ||
    null
  const assignedLabel = selected.assignedTo ? `Assigned · ${selected.assignedTo}` : null

  const briefDataEntries = normalizeBriefData(selected.classification?.briefData)
  const risks = selected.handoff?.risks?.length ? selected.handoff.risks : selected.classification?.risks || []
  const pendingItems = selected.handoff?.pendingItems?.length
    ? selected.handoff.pendingItems
    : selected.classification?.pendingItems || []

  const businessContextSummary = [
    selected.cliente ? "Client linked" : selected.contact.nombre ? "Lead contact" : "Conversation contact",
    selected.proyecto ? "Project linked" : "No project linked",
  ].join(" · ")

  const businessContextMeta = [
    channelLabel(selected.channel),
    selected.detectedLanguage?.toUpperCase() || "No language",
    typeof selected.leadScore === "number" ? `Lead ${selected.leadScore}` : "No lead score",
  ]

  const coreSections = [
    {
      title: "Cliente",
      summary: selected.cliente ? "CRM and relationship data available." : "Conversation-level contact information.",
      items: [
        { label: "Name", value: selected.contact.nombre || selected.cliente?.nombre || null },
        { label: "Email", value: selected.contact.email || selected.cliente?.email || null },
        { label: "Company", value: selected.contact.empresa || selected.cliente?.empresa || null },
        { label: "Phone", value: selected.contact.telefono || null },
        { label: "Contact type", value: selected.contact.tipo || null },
        { label: "Linked client", value: selected.cliente?.nombre || null, href: selected.cliente ? `/clientes/${selected.cliente.id}` : undefined, tone: "accent" as const },
      ],
      emptyLabel: "No client context available for this conversation.",
    },
    {
      title: "Proyecto",
      summary: briefDataEntries.length > 0 ? "Structured project signals inferred from the conversation." : "No project brief available yet.",
      items: [
        { label: "Linked project", value: selected.proyecto?.nombre || null, href: selected.proyecto ? `/proyectos/${selected.proyecto.id}` : undefined, tone: "accent" as const },
        { label: "Project status", value: selected.proyecto?.estado || null },
        ...briefDataEntries,
      ],
      emptyLabel: "No linked project or project brief found.",
    },
    {
      title: "Conversation meta",
      items: [
        { label: "Channel", value: channelLabel(selected.channel) },
        { label: "Language", value: selected.detectedLanguage?.toUpperCase() || null },
        { label: "Lead score", value: selected.leadScore ?? null },
        { label: "Sentiment", value: selected.sentiment || null },
        { label: "Urgency", value: selected.urgency || null, tone: selected.urgency === "critica" || selected.urgency === "alta" ? "warning" : "default" },
        { label: "Messages", value: selected.messageCount },
      ],
    },
    {
      title: "Operational signals",
      summary: nextRecommendedAction ? "Signals currently available from classification and handoff." : undefined,
      items: [
        { label: "Intent", value: selected.classification?.intent || null },
        { label: "Risks", value: risks.length > 0 ? `${risks.length} signal${risks.length === 1 ? "" : "s"}` : null, tone: risks.length > 0 ? "warning" : "default" },
        { label: "Pending items", value: pendingItems.length > 0 ? `${pendingItems.length} item${pendingItems.length === 1 ? "" : "s"}` : null },
        { label: "Next best action", value: nextRecommendedAction || null, tone: nextRecommendedAction ? "accent" : "default" },
      ],
      emptyLabel: "No operational signals available yet.",
    },
  ]

  return (
    <div className="space-y-4">
      <MessageIntelligenceCard
        title={intelligenceTitle}
        summary={intelligenceSummary}
        conversationStatusLabel={conversationStatusLabel}
        conversationStatusClassName={conversationStatusClassName}
        urgencyLabel={urgencyConfig?.label}
        urgencyClassName={urgencyConfig?.className}
        intent={selected.classification?.intent || null}
        sentiment={selected.sentiment || null}
        confidenceLabel={confidenceLabel(selected.handoff?.confidence)}
        nextRecommendedAction={nextRecommendedAction}
        pendingItemsCount={pendingItems.length}
        risksCount={risks.length}
        expanded={handoffExpanded}
        onExpandedChange={setHandoffExpanded}
        onMarkReviewed={selected.handoff ? () => updateHandoff({ status: "reviewed" }, "Handoff marked as reviewed") : undefined}
        canMarkReviewed={Boolean(selected.handoff && selected.handoff.status !== "reviewed")}
        translationHint={
          selected.detectedLanguage && selected.detectedLanguage.toLowerCase() !== "en"
            ? `Detected language: ${selected.detectedLanguage.toUpperCase()}. Translation tools can plug into this section later.`
            : "Detected language is already aligned with the current workspace language."
        }
        detailSummary={selected.handoff?.summary || intelligenceSummary}
        onSaveSummary={(value) => updateHandoff({ summary: value })}
        detailNextRecommendedAction={nextRecommendedAction}
        onSaveNextRecommendedAction={(value) => updateHandoff({ nextRecommendedAction: value })}
        stateMessage={handoffState}
      />

      <ActionsCard
        actions={selected.actions ?? []}
        expanded={actionsExpanded}
        onExpandedChange={setActionsExpanded}
        pendingActionId={pendingActionId}
        actionTypeLabel={actionTypeLabel}
        actionStatusLabel={actionStatusLabel}
        actionStatusBadge={actionStatusBadge}
        onAction={handleSuggestedAction}
        onConvert={(action) => handleConvert(action)}
        actionState={actionState}
      />

      <BusinessContextCard
        expanded={businessContextExpanded}
        onExpandedChange={setBusinessContextExpanded}
        summaryLabel={businessContextSummary}
        summaryMeta={businessContextMeta}
        core={coreSections}
      />
    </div>
  )
}

function getStringValue(
  value: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!value) return null
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === "string" && candidate.trim()) return candidate
  }
  return null
}

function normalizeBriefData(briefData?: Record<string, unknown> | null) {
  if (!briefData) return []

  return Object.entries(briefData)
    .filter(([, value]) => value !== null && value !== undefined && `${value}`.trim() !== "")
    .slice(0, 4)
    .map(([key, value]) => ({
      label: formatBriefLabel(key),
      value: typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value),
    }))
}

function formatBriefLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getUrgencyPresentation(urgency?: string | null) {
  switch (urgency) {
    case "critica":
      return { label: "Critical", className: "bg-[#FEF2F2] text-[#991B1B]" }
    case "alta":
      return { label: "High", className: "bg-[#FFF7ED] text-[#9A3412]" }
    case "media":
      return { label: "Medium", className: "bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]" }
    case "baja":
      return { label: "Low", className: "bg-[#F3F4F6] text-[#4B5563]" }
    default:
      return null
  }
}
