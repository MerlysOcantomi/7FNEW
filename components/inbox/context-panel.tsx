"use client"

import { ActionsCard, type ActionItem } from "@/components/inbox/actions-card"
import { BusinessContextCard } from "@/components/inbox/business-context-card"
import { MessageIntelligenceCard } from "@/components/inbox/message-intelligence-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Loader2 } from "lucide-react"

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
    actions?: ActionItem[]
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
  handleSuggestedAction: (action: ActionItem, operation: "approve" | "dismiss" | "execute" | "approve_and_execute") => Promise<void>
  actionTypeLabel: (type: string) => string
  actionStatusBadge: (status: string) => string
  actionStatusLabel: (status: string) => string
  handleConvert: (action: "cliente" | "proyecto" | "tarea" | "todo") => Promise<void>
  actionState: string | null
  channelLabel: (channel: string) => string
  // Assignment management
  members: Array<{ userId: string; nombre: string | null; email: string }>
  assignSaving: boolean
  onAssign: (value: string) => void
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
  members,
  assignSaving,
  onAssign,
}: ContextPanelProps) {
  const urgencyConfig = getUrgencyPresentation(selected.urgency)
  const intelligenceTitle = "Situation"
  const intelligenceSummary =
    selected.handoff?.summary ||
    selected.classification?.summary ||
    selected.summary ||
    "This conversation does not have message intelligence yet."
  const nextRecommendedAction =
    selected.handoff?.nextRecommendedAction ||
    getStringValue(selected.classification?.nextBestAction, ["label", "title", "action"]) ||
    null
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
    ...(selected.detectedLanguage ? [selected.detectedLanguage.toUpperCase()] : []),
    ...(typeof selected.leadScore === "number" ? [`Lead ${selected.leadScore}`] : []),
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
        { label: "Urgency", value: selected.urgency || null, tone: (selected.urgency === "critica" || selected.urgency === "alta" ? "warning" : "default") as "warning" | "default" },
        { label: "Messages", value: selected.messageCount },
      ],
    },
    {
      title: "Operational signals",
      summary: nextRecommendedAction ? "Signals currently available from classification and handoff." : undefined,
      items: [
        { label: "Intent", value: selected.classification?.intent || null },
        { label: "Risks", value: risks.length > 0 ? `${risks.length} signal${risks.length === 1 ? "" : "s"}` : null, tone: (risks.length > 0 ? "warning" : "default") as "warning" | "default" },
        { label: "Pending items", value: pendingItems.length > 0 ? `${pendingItems.length} item${pendingItems.length === 1 ? "" : "s"}` : null },
        { label: "Next best action", value: nextRecommendedAction || null, tone: (nextRecommendedAction ? "accent" : "default") as "accent" | "default" },
      ],
      emptyLabel: "No operational signals available yet.",
    },
  ]

  return (
    <div className="space-y-4 bg-[var(--inbox-intelligence-background)] p-5">
      
      {/* Intelligence Hub Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--inbox-intelligence-border)]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--inbox-intelligence-accent)] to-[var(--inbox-intelligence-accent)]/80 flex items-center justify-center shadow-lg">
          <Users className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--inbox-intelligence-text)] tracking-tight">Intelligence Hub</h2>
          <p className="text-sm text-[var(--inbox-intelligence-text-secondary)] font-medium">AI-powered insights</p>
        </div>
      </div>

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

      {/* Assignment Management - only for shared channels */}
      {(selected.channel === 'web_chat' || selected.channel === 'portal') && (
        <div className="rounded-[var(--inbox-radius-card)] border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-5 shadow-[var(--inbox-shadow-card)]">
          <div className="mb-4">
            <div className="flex items-center gap-2.5 text-base font-semibold text-[var(--inbox-intelligence-text)]">
              <Users className="h-5 w-5 text-[var(--inbox-intelligence-text-secondary)]" />
              Assignment
            </div>
          </div>
          <div>
            <Select 
              value={selected.assignedTo || "unassigned"} 
              onValueChange={(value) => onAssign(value === "unassigned" ? "" : value)} 
              disabled={assignSaving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-[var(--inbox-text-secondary)]">Unassigned</span>
                </SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {member.nombre || member.email}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignSaving && (
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--inbox-text-secondary)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating assignment...
              </div>
            )}
          </div>
        </div>
      )}

      <ActionsCard
        actions={selected.actions ?? []}
        channel={selected.channel}
        channelLabel={channelLabel(selected.channel)}
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
      return { label: "Critical", className: "bg-[var(--inbox-urgency-critical-bg)] text-[var(--inbox-urgency-critical-text)]" }
    case "alta":
      return { label: "High", className: "bg-[var(--inbox-urgency-high-bg)] text-[var(--inbox-urgency-high-text)]" }
    case "media":
      return { label: "Medium", className: "bg-[var(--inbox-urgency-medium-bg)] text-[var(--inbox-urgency-medium-text)]" }
    case "baja":
      return { label: "Low", className: "bg-[var(--inbox-urgency-low-bg)] text-[var(--inbox-urgency-low-text)]" }
    default:
      return null
  }
}
