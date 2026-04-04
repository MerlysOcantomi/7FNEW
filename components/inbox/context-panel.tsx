"use client"

import Link from "next/link"
import {
  Briefcase,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  FolderKanban,
  Mail,
  Play,
  ShieldCheck,
  Sparkles,
  User,
  WandSparkles,
  Loader2,
} from "lucide-react"
import { InlineSelect, InlineText, InlineTextarea } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

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

interface DraftData {
  id: string
  status: string
  title?: string | null
  content: string
  tone?: string | null
  createdAt: string
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
    classification?: {
      summary?: string | null
      intent?: string | null
      suggestedTags?: string[] | null
    } | null
    handoff?: HandoffData | null
    drafts?: DraftData[]
    actions?: ActionData[]
    contact: {
      email: string | null
      empresa: string | null
    }
    messageCount: number
    cliente?: { id: string; nombre: string } | null
    proyecto?: { id: string; nombre: string } | null
    channel: string
    leadScore: number | null
    detectedLanguage: string | null
  }
  handoffExpanded: boolean
  setHandoffExpanded: (value: boolean) => void
  draftsExpanded: boolean
  setDraftsExpanded: (value: boolean) => void
  actionsExpanded: boolean
  setActionsExpanded: (value: boolean) => void
  updateHandoff: (payload: Record<string, unknown>, successMessage?: string) => Promise<void>
  handoffStatusBadge: (status: string) => string
  handoffStatusLabel: (status: string) => string
  handoffState: string | null
  linesToText: (value?: string[] | null) => string
  textToLines: (value: string) => string[]
  confidenceLabel: (value?: number | null) => string | null
  formatDateTime: (value?: string | null) => string | null
  editableDraftStatusOptions: (currentStatus: string) => Array<{ value: string; label: string }>
  updateDraft: (draftId: string, payload: Record<string, unknown>, successMessage?: string) => Promise<void>
  draftStatusBadge: (status: string) => string
  draftStatusLabel: (status: string) => string
  formatRelativeDate: (value: string) => string
  setReplyContent: (value: string) => void
  setReplyIsInternal: (value: boolean) => void
  setReplyStatus: (value: string | null) => void
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
  draftsExpanded,
  setDraftsExpanded,
  actionsExpanded,
  setActionsExpanded,
  updateHandoff,
  handoffStatusBadge,
  handoffStatusLabel,
  handoffState,
  linesToText,
  textToLines,
  confidenceLabel,
  formatDateTime,
  editableDraftStatusOptions,
  updateDraft,
  draftStatusBadge,
  draftStatusLabel,
  formatRelativeDate,
  setReplyContent,
  setReplyIsInternal,
  setReplyStatus,
  pendingActionId,
  handleSuggestedAction,
  actionTypeLabel,
  actionStatusBadge,
  actionStatusLabel,
  handleConvert,
  actionState,
  channelLabel,
}: ContextPanelProps) {
  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.07] to-background py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <CardHeader className="px-4 py-4">
          {selected.handoff ? (
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm text-foreground">
                      {selected.handoff.headline || "Smart Handoff"}
                    </CardTitle>
                    {selected.handoff.summary && (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {selected.handoff.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", handoffStatusBadge(selected.handoff.status))}>
                      {handoffStatusLabel(selected.handoff.status)}
                    </span>
                    {selected.handoff.status !== "reviewed" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 rounded-md text-primary"
                        onClick={() => updateHandoff({ status: "reviewed" }, "Handoff marked as reviewed")}
                        title="Mark as reviewed"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 rounded-md text-primary"
                      onClick={() => setHandoffExpanded(!handoffExpanded)}
                    >
                      {handoffExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {!handoffExpanded && selected.handoff.nextRecommendedAction && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/10 bg-background/80 px-3 py-2">
                    <Play className="h-3 w-3 shrink-0 text-primary" />
                    <p className="text-[11px] font-medium text-foreground">
                      {selected.handoff.nextRecommendedAction}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <CardTitle className="text-sm text-foreground">Smart Handoff</CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {selected.classification?.summary ||
                    selected.summary ||
                    "AI has not generated a summary for this conversation yet."}
                </p>
                {(selected.classification?.intent || selected.classification?.suggestedTags?.length) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.classification?.intent && (
                      <span className="rounded-full border border-primary/15 bg-background px-2 py-0.5 text-[10px] font-medium text-primary">
                        {selected.classification.intent}
                      </span>
                    )}
                    {selected.classification?.suggestedTags?.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardHeader>

        {selected.handoff && handoffExpanded && (
        <CardContent className="space-y-4 border-t border-primary/10 px-4 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Headline
              </p>
              <div className="mt-1">
                <InlineText
                  value={selected.handoff.headline || ""}
                  placeholder="Add operational headline..."
                  className="text-sm font-semibold text-foreground"
                  onSave={(value) => updateHandoff({ headline: value })}
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Summary
              </p>
              <InlineTextarea
                value={selected.handoff.summary || ""}
                placeholder="Add operational summary..."
                className="mt-1 rounded-xl bg-background"
                rows={3}
                onSave={(value) => updateHandoff({ summary: value })}
              />
            </div>

            <div className="grid gap-2">
              {([
                { label: "Facts", key: "facts" as const },
                { label: "Decisions", key: "decisions" as const },
                { label: "Pending items", key: "pendingItems" as const },
                { label: "Risks", key: "risks" as const },
              ]).map(({ label, key }) => (
                <div key={key} className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </p>
                  <InlineTextarea
                    value={linesToText(selected.handoff?.[key])}
                    placeholder={`One ${label.toLowerCase().replace(/s$/, "")} per line...`}
                    className="mt-1 px-0 py-0"
                    rows={2}
                    onSave={(value) => updateHandoff({ [key]: textToLines(value) })}
                  />
                </div>
              ))}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Next recommended action
              </p>
              <InlineTextarea
                value={selected.handoff.nextRecommendedAction || ""}
                placeholder="Add recommended next step..."
                className="mt-1 rounded-xl bg-background"
                rows={2}
                onSave={(value) => updateHandoff({ nextRecommendedAction: value })}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {confidenceLabel(selected.handoff.confidence) && (
                <span>Confidence {confidenceLabel(selected.handoff.confidence)}</span>
              )}
              {selected.handoff.reviewedBy && <span>Reviewed by {selected.handoff.reviewedBy}</span>}
              {selected.handoff.reviewedAt && <span>{formatDateTime(selected.handoff.reviewedAt)}</span>}
            </div>
          </CardContent>
        )}

        {handoffState && <div className="px-4 pb-4 text-xs text-muted-foreground">{handoffState}</div>}
      </Card>

      {selected.drafts && selected.drafts.length > 0 && (
        <Card className="gap-0 overflow-hidden py-0 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <Collapsible open={draftsExpanded} onOpenChange={setDraftsExpanded}>
            <CardHeader className="px-4 py-0">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between gap-2 py-4 text-left transition-colors hover:text-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Drafts</CardTitle>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {selected.drafts.length}
                    </span>
                  </div>
                  {draftsExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="space-y-3 border-t border-border px-4 py-4">
                {selected.drafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl border border-border/80 bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <InlineText
                          value={draft.title || ""}
                          placeholder="Draft title..."
                          className="truncate text-sm font-semibold text-foreground"
                          onSave={(value) => updateDraft(draft.id, { title: value })}
                        />
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", draftStatusBadge(draft.status))}>
                          {draftStatusLabel(draft.status)}
                        </span>
                      </div>
                      <InlineSelect
                        value={draft.status}
                        options={editableDraftStatusOptions(draft.status)}
                        onSave={(value) => updateDraft(draft.id, { status: value }, "Draft status updated")}
                        badgeClassName={(value) => draftStatusBadge(value)}
                      />
                    </div>

                    <div className="mt-2">
                      <InlineTextarea
                        value={draft.content || ""}
                        placeholder="Draft content..."
                        className="mt-0 rounded-xl bg-muted/30"
                        rows={4}
                        onSave={(value) => updateDraft(draft.id, { content: value })}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        {draft.tone && <span>Tone: {draft.tone}</span>}
                        <span>{formatRelativeDate(draft.createdAt)}</span>
                      </div>

                      {["draft", "edited", "approved"].includes(draft.status) &&
                        draft.content?.trim() && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setReplyContent(draft.content)
                              setReplyIsInternal(false)
                              setReplyStatus(null)
                            }}
                          >
                            Use as reply
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <Card className="gap-0 overflow-hidden py-0 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <Collapsible open={actionsExpanded} onOpenChange={setActionsExpanded}>
          <CardHeader className="px-4 py-0">
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 py-4 text-left transition-colors hover:text-foreground">
                <div className="flex items-center gap-2">
                  <WandSparkles className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Actions</CardTitle>
                  {selected.actions && selected.actions.filter((action) => action.status === "suggested").length > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {selected.actions.filter((action) => action.status === "suggested").length} suggested
                    </span>
                  )}
                </div>
                {actionsExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-3 border-t border-border px-4 py-4">
              {selected.actions && selected.actions.length > 0 && (
                <div className="space-y-2">
                  {selected.actions.map((action) => {
                    const title =
                      typeof action.data?.title === "string" && action.data.title.trim()
                        ? action.data.title
                        : actionTypeLabel(action.type)
                    const description =
                      typeof action.data?.description === "string" ? action.data.description : null
                    const isPending = pendingActionId === action.id

                    return (
                      <div key={action.id} className="rounded-2xl border border-border/80 bg-background p-3">
                        <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{title}</p>
                            <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", actionStatusBadge(action.status))}>
                              {actionStatusLabel(action.status)}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {action.status === "suggested" && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleSuggestedAction(action, "approve")}
                                  disabled={isPending}
                                >
                                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Approve"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSuggestedAction(action, "dismiss")}
                                  disabled={isPending}
                                >
                                  Dismiss
                                </Button>
                              </>
                            )}

                            {action.status === "approved" && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSuggestedAction(action, "execute")}
                                disabled={isPending}
                              >
                                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Execute"}
                              </Button>
                            )}
                          </div>
                        </div>

                        {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
                        {action.executionNotes && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Notes:</span> {action.executionNotes}
                          </p>
                        )}
                        {action.errorMessage && (
                          <p className="mt-2 text-xs text-destructive">
                            <span className="font-semibold">Error:</span> {action.errorMessage}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Convert
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => handleConvert("cliente")}>
                    <User className="h-3.5 w-3.5" />
                    Client
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleConvert("proyecto")}>
                    <FolderKanban className="h-3.5 w-3.5" />
                    Project
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleConvert("tarea")}>
                    <CheckSquare className="h-3.5 w-3.5" />
                    Task
                  </Button>
                </div>
              </div>

              {actionState && <p className="text-xs text-muted-foreground">{actionState}</p>}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card className="gap-0 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-4 py-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Business context</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 border-t border-border px-4 py-4">
          <div className="grid gap-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{selected.contact.email || "No email"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{selected.contact.empresa || "No company"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              <span>{selected.messageCount} messages</span>
            </div>
            {selected.cliente && (
              <Link href={`/clientes/${selected.cliente.id}`} className="flex items-center gap-3 text-sm text-primary hover:underline">
                <User className="h-4 w-4" />
                Linked client: {selected.cliente.nombre}
              </Link>
            )}
            {selected.proyecto && (
              <Link href={`/proyectos/${selected.proyecto.id}`} className="flex items-center gap-3 text-sm text-primary hover:underline">
                <FolderKanban className="h-4 w-4" />
                Linked project: {selected.proyecto.nombre}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Channel</p>
              <p className="mt-1 text-xs font-medium text-foreground">{channelLabel(selected.channel)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lead</p>
              <p className="mt-1 text-xs font-medium text-foreground">{selected.leadScore ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lang</p>
              <p className="mt-1 text-xs font-medium text-foreground">{selected.detectedLanguage?.toUpperCase() || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
