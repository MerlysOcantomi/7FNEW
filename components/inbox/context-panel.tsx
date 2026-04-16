"use client"

import { useState } from "react"
import { InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users, ChevronDown, ChevronUp, Loader2,
  Mail, Phone, Building2, Globe, ArrowRight,
  User, FolderKanban, CheckSquare, Archive, MessageSquare,
  Paperclip, PhoneCall,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActionItem } from "@/components/inbox/actions-card"

interface ContextPanelProps {
  selected: {
    id: string
    summary: string | null
    status: string
    urgency?: string | null
    assignedTo?: string | null
    sentiment?: string | null
    classification?: {
      summary?: string | null
      intent?: string | null
      nextBestAction?: Record<string, unknown> | null
    } | null
    handoff?: {
      status: string
      summary?: string | null
      nextRecommendedAction?: string | null
      confidence?: number | null
    } | null
    actions?: ActionItem[]
    contact: {
      nombre?: string | null
      email: string | null
      empresa: string | null
      telefono?: string | null
      tipo?: string
    }
    cliente?: { id: string; nombre: string; email?: string | null; empresa?: string | null } | null
    proyecto?: { id: string; nombre: string; estado?: string | null } | null
    channel: string
    leadScore: number | null
    detectedLanguage: string | null
  }
  updateHandoff: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>
  handoffState: string | null
  handleSuggestedAction: (action: ActionItem, operation: "approve" | "dismiss" | "execute" | "approve_and_execute") => Promise<void>
  pendingActionId: string | null
  actionTypeLabel: (type: string) => string
  actionStatusBadge: (status: string) => string
  actionStatusLabel: (status: string) => string
  handleConvert: (action: "cliente" | "proyecto" | "tarea" | "todo") => Promise<void>
  actionState: string | null
  channelLabel: (channel: string) => string
  members: Array<{ userId: string; nombre: string | null; email: string }>
  assignSaving: boolean
  onAssign: (value: string) => void
}

export function ContextPanel({
  selected,
  updateHandoff,
  handoffState,
  handleSuggestedAction,
  pendingActionId,
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
  const [contactExpanded, setContactExpanded] = useState(false)
  const [actionsExpanded, setActionsExpanded] = useState(false)

  const contactName = selected.contact.nombre || selected.cliente?.nombre || "Unknown contact"
  const contactType = selected.contact.tipo || "contact"
  const contactEmail = selected.contact.email || selected.cliente?.email || null
  const contactPhone = selected.contact.telefono || null
  const contactCompany = selected.contact.empresa || selected.cliente?.empresa || null

  const summary =
    selected.handoff?.summary ||
    selected.classification?.summary ||
    selected.summary ||
    null

  const nextRecommendedAction =
    selected.handoff?.nextRecommendedAction ||
    getStringValue(selected.classification?.nextBestAction, ["description", "label", "title", "action"]) ||
    null

  const moodValue = mapSentimentToMood(selected.sentiment)
  const urgencyValue = mapUrgency(selected.urgency)

  const suggestedActions = (selected.actions ?? []).filter((a) => a.status === "suggested" || a.status === "approved")

  return (
    <div className="space-y-3 bg-[var(--inbox-intelligence-background)] p-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--inbox-intelligence-border)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--inbox-intelligence-accent)] to-[var(--inbox-intelligence-accent)]/80 shadow-sm">
          <Users className="h-4.5 w-4.5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight text-[var(--inbox-intelligence-text)]">Intelligence Hub</h2>
          <p className="text-xs text-[var(--inbox-intelligence-text-secondary)]">AI-powered insights</p>
        </div>
      </div>

      {/* ── 1. Contact ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--inbox-accent-soft)] text-[var(--inbox-accent)]">
            <span className="text-sm font-bold">{contactName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--inbox-intelligence-text)]">{contactName}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--inbox-intelligence-text-secondary)]">
                {formatContactType(contactType)}
              </span>
              {selected.detectedLanguage && (
                <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">
                  {selected.detectedLanguage.toUpperCase()}
                </span>
              )}
              <span className="text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                {channelLabel(selected.channel)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setContactExpanded((v) => !v)}
            className="shrink-0 rounded-md p-1 text-[var(--inbox-intelligence-text-secondary)] hover:bg-white/8"
          >
            {contactExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {contactExpanded && (
          <div className="mt-3 space-y-2 border-t border-[var(--inbox-intelligence-border)] pt-3">
            {contactEmail && (
              <div className="flex items-center gap-2 text-xs">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
                <span className="truncate text-[var(--inbox-intelligence-text)]">{contactEmail}</span>
              </div>
            )}
            {contactPhone && (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
                <span className="text-[var(--inbox-intelligence-text)]">{contactPhone}</span>
              </div>
            )}
            {contactCompany && (
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-intelligence-text-secondary)]" />
                <span className="text-[var(--inbox-intelligence-text)]">{contactCompany}</span>
              </div>
            )}
            {selected.cliente && (
              <div className="flex items-center gap-2 text-xs">
                <User className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
                <a href={`/clientes/${selected.cliente.id}`} className="font-medium text-[var(--inbox-accent)] hover:underline">
                  {selected.cliente.nombre}
                </a>
              </div>
            )}
            {selected.proyecto && (
              <div className="flex items-center gap-2 text-xs">
                <FolderKanban className="h-3.5 w-3.5 shrink-0 text-[var(--inbox-accent)]" />
                <a href={`/proyectos/${selected.proyecto.id}`} className="font-medium text-[var(--inbox-accent)] hover:underline">
                  {selected.proyecto.nombre}
                </a>
                {selected.proyecto.estado && (
                  <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-[var(--inbox-intelligence-text-secondary)]">
                    {selected.proyecto.estado}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 2. Summary ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Summary</p>
        {summary ? (
          <InlineTextarea
            value={summary}
            placeholder="Add summary..."
            className="mt-1.5 rounded-lg bg-transparent text-xs leading-relaxed text-[var(--inbox-intelligence-text)]"
            rows={2}
            onSave={(value) => updateHandoff({ summary: value })}
          />
        ) : (
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
            No summary available yet.
          </p>
        )}
        {handoffState && <p className="mt-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{handoffState}</p>}
      </section>

      {/* ── 3. Mood & Urgency ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Mood</span>
              <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">{moodValue.label}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn("h-full rounded-full transition-all duration-500", moodValue.barClass)}
                style={{ width: `${moodValue.percent}%` }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Urgency</span>
              <span className="text-[10px] font-medium text-[var(--inbox-intelligence-text-secondary)]">{urgencyValue.label}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn("h-full rounded-full transition-all duration-500", urgencyValue.barClass)}
                style={{ width: `${urgencyValue.percent}%` }}
              />
            </div>
          </div>
          {typeof selected.leadScore === "number" && (
            <div className="flex items-center justify-between pt-1 border-t border-[var(--inbox-intelligence-border)]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Lead score</span>
              <span className="text-xs font-semibold text-[var(--inbox-accent)]">{selected.leadScore}</span>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Recommended next move ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Recommended next move</p>
        {nextRecommendedAction ? (
          <div className="mt-2">
            <p className="text-sm font-medium leading-relaxed text-[var(--inbox-intelligence-text)]">{nextRecommendedAction}</p>
            <InlineTextarea
              value={nextRecommendedAction}
              placeholder="Edit recommendation..."
              className="mt-2 rounded-lg bg-white/6 text-xs text-[var(--inbox-intelligence-text)]"
              rows={2}
              onSave={(value) => updateHandoff({ nextRecommendedAction: value })}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-[var(--inbox-intelligence-text-secondary)]">
            No recommendation available yet.
          </p>
        )}

        {suggestedActions.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-[var(--inbox-intelligence-border)] pt-3">
            {suggestedActions.slice(0, 3).map((action) => {
              const title = typeof action.data?.title === "string" && action.data.title.trim()
                ? action.data.title
                : actionTypeLabel(action.type)
              const isPending = pendingActionId === action.id
              return (
                <div key={action.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ArrowRight className="h-3 w-3 shrink-0 text-[var(--inbox-accent)]" />
                    <span className="truncate text-xs font-medium text-[var(--inbox-intelligence-text)]">{title}</span>
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium", actionStatusBadge(action.status))}>
                      {actionStatusLabel(action.status)}
                    </span>
                  </div>
                  {action.status === "suggested" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSuggestedAction(action, "approve_and_execute")}
                      disabled={isPending}
                      className="h-6 shrink-0 rounded-md px-2 text-[10px]"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Run"}
                    </Button>
                  )}
                  {action.status === "approved" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSuggestedAction(action, "execute")}
                      disabled={isPending}
                      className="h-6 shrink-0 rounded-md px-2 text-[10px]"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Execute"}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {actionState && <p className="mt-2 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">{actionState}</p>}
      </section>

      {/* ── 5. Actions ── */}
      <section className="rounded-xl border border-[var(--inbox-intelligence-border)] bg-[var(--inbox-intelligence-surface)]">
        <button
          type="button"
          onClick={() => setActionsExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Actions</span>
          {actionsExpanded ? <ChevronUp className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--inbox-intelligence-text-secondary)]" />}
        </button>

        {actionsExpanded && (
          <div className="space-y-3 border-t border-[var(--inbox-intelligence-border)] px-4 py-3">
            {/* Business */}
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Business</p>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton label="Create client" icon={User} onClick={() => handleConvert("cliente")} />
                <ActionButton label="Create project" icon={FolderKanban} onClick={() => handleConvert("proyecto")} />
                <ActionButton label="Create task" icon={CheckSquare} onClick={() => handleConvert("tarea")} />
              </div>
            </div>

            {/* Communication */}
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Communication</p>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton label="Internal note" icon={MessageSquare} />
                <ActionButton label="Attach file" icon={Paperclip} />
                {(selected.channel === "whatsapp" || selected.contact.telefono) && (
                  <ActionButton label="Call" icon={PhoneCall} />
                )}
              </div>
            </div>

            {/* Workflow */}
            <div className="space-y-1">
              <p className="text-[9px] font-medium uppercase tracking-widest text-[var(--inbox-intelligence-text-secondary)]">Workflow</p>
              <div className="flex flex-wrap gap-1.5">
                <ActionButton label="Archive" icon={Archive} />
                {(selected.channel === "web_chat" || selected.channel === "portal") && members.length > 0 && (
                  <div className="w-full mt-1">
                    <Select
                      value={selected.assignedTo || "unassigned"}
                      onValueChange={(value) => onAssign(value === "unassigned" ? "" : value)}
                      disabled={assignSaving}
                    >
                      <SelectTrigger className="h-7 w-full text-xs">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={m.userId}>
                            {m.nombre || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assignSaving && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--inbox-intelligence-text-secondary)]">
                        <Loader2 className="h-3 w-3 animate-spin" /> Updating...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function ActionButton({ label, icon: Icon, onClick }: { label: string; icon: React.ElementType; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[var(--inbox-intelligence-border)] px-2.5 py-1.5 text-[11px] font-medium transition-colors",
        onClick
          ? "text-[var(--inbox-intelligence-text)] hover:bg-white/8 hover:text-[var(--inbox-accent)]"
          : "text-[var(--inbox-intelligence-text-secondary)]/50 cursor-default",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function formatContactType(tipo: string) {
  const map: Record<string, string> = {
    lead: "Lead",
    cliente: "Client",
    proveedor: "Supplier",
    colega: "Colleague",
    visitante: "Visitor",
    contact: "Contact",
  }
  return map[tipo] || tipo.replace(/_/g, " ")
}

function getStringValue(value: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!value) return null
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === "string" && candidate.trim()) return candidate
  }
  return null
}

function mapSentimentToMood(sentiment?: string | null) {
  switch (sentiment?.toLowerCase()) {
    case "positive":
    case "positivo":
      return { label: "Positive", percent: 85, barClass: "bg-emerald-500" }
    case "negative":
    case "negativo":
      return { label: "Negative", percent: 30, barClass: "bg-rose-500" }
    case "neutral":
      return { label: "Neutral", percent: 55, barClass: "bg-sky-400" }
    default:
      return { label: "Unknown", percent: 50, barClass: "bg-[var(--inbox-intelligence-text-secondary)]/40" }
  }
}

function mapUrgency(urgency?: string | null) {
  switch (urgency) {
    case "critica":
      return { label: "Critical", percent: 100, barClass: "bg-rose-500" }
    case "alta":
      return { label: "High", percent: 75, barClass: "bg-amber-500" }
    case "media":
      return { label: "Medium", percent: 50, barClass: "bg-sky-400" }
    case "baja":
      return { label: "Low", percent: 25, barClass: "bg-emerald-500" }
    default:
      return { label: "Normal", percent: 35, barClass: "bg-[var(--inbox-intelligence-text-secondary)]/40" }
  }
}
