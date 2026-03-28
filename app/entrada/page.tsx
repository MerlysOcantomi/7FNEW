"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  PenLine,
  Sparkles,
  Mic,
  Send,
  User,
  FolderKanban,
  CheckCircle2,
  FileText,
  MessageSquare,
  Clock,
  ArrowRight,
  Lightbulb,
  RefreshCw,
} from "lucide-react"

const recentEntries = [
  {
    id: "ent-1",
    text: "A client called to say she liked logo version 3, but wants the icon to be darker.",
    time: "20 min ago",
    aiResult: {
      client: "Active client",
      project: "Visual identity update",
      actions: ["Create task: Adjust icon color in logo v3", "Notify Ana Rodriguez (designer)"],
      type: "Change request",
      confidence: 94,
    },
    status: "applied",
  },
  {
    id: "ent-2",
    text: "New lead: Fernando Reyes needs a corporate website with a blog. Phone 55 9876 5432.",
    time: "1h ago",
    aiResult: {
      client: "New lead",
      project: null,
      actions: ["Create client record", "Create contact: Fernando Reyes", "Create prospect project"],
      type: "New prospect",
      confidence: 87,
    },
    status: "pending",
  },
  {
    id: "ent-3",
    text: "Roberto confirmed phase 2 of an active project and said the PO will arrive tomorrow.",
    time: "3h ago",
    aiResult: {
      client: "Active client",
      project: "Client portal",
      actions: ["Move project to Phase 2", "Schedule reminder: client PO tomorrow"],
      type: "Phase approval",
      confidence: 91,
    },
    status: "applied",
  },
  {
    id: "ent-4",
    text: "Sofia sent the final catalog photos. 45 high-resolution images.",
    time: "5h ago",
    aiResult: {
      client: "Active client",
      project: "Client catalog",
      actions: ["Register delivery of photo assets", "Notify the design team"],
      type: "Asset delivery",
      confidence: 85,
    },
    status: "ignored",
  },
]

const statusStyles: Record<string, string> = {
  applied: "bg-[var(--tab-phases)] text-foreground/70",
  pending: "bg-[var(--tab-tasks)] text-foreground/70",
  ignored: "bg-muted text-muted-foreground",
}

export default function EntradaPage() {
  const [inputText, setInputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = () => {
    if (!inputText.trim()) return
    setIsProcessing(true)
    setTimeout(() => setIsProcessing(false), 1500)
  }

  return (
    <AppShell currentSection="entrada" breadcrumbs={[{ label: "7F" }, { label: "Manual Intake" }]}>
      <SectionPage title="Manual Intake" description="Write what the client said in natural language. AI will classify it, route it, and create the relevant actions.">

        {/* Main input area */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tab-ai)]">
              <PenLine className="h-4 w-4 text-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">What happened?</p>
              <p className="text-xs text-muted-foreground">Write what the client said, a call note, or any new information.</p>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ex: 'The client called to say she liked version 3 but wants color changes...'"
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                <Mic className="h-3.5 w-3.5" /> Dictate
              </button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Write naturally, the AI will interpret the context</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim()}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                inputText.trim()
                  ? "bg-foreground text-background hover:opacity-80"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><Send className="h-4 w-4" /> Process with AI</>
              )}
            </button>
          </div>
        </div>

        {/* AI processing preview placeholder */}
        <div className="rounded-xl border border-dashed border-[var(--tab-ai)]/50 bg-[var(--tab-ai)]/5 p-6 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">The processing result will appear here</p>
          <p className="text-xs text-muted-foreground/60 mt-1">AI will identify the client, project, action type, and create tasks automatically</p>
        </div>

        {/* Recent entries */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent entries</h3>
            <p className="text-xs text-muted-foreground">{recentEntries.length} entries</p>
          </div>

          <div className="flex flex-col gap-3">
            {recentEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Entry text */}
                <div className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed text-foreground">{entry.text}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {entry.time}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0", statusStyles[entry.status])}>
                      {entry.status}
                    </span>
                  </div>
                </div>

                {/* AI interpretation */}
                <div className="px-5 py-4 bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI interpretation</p>
                    <span className="ml-auto text-[10px] text-muted-foreground">Confidence: {entry.aiResult.confidence}%</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Client:</span>
                      <span className="font-medium text-foreground">{entry.aiResult.client}</span>
                    </div>
                    {entry.aiResult.project && (
                      <div className="flex items-center gap-2 text-xs">
                        <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">Project:</span>
                        <span className="font-medium text-foreground">{entry.aiResult.project}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium text-foreground">{entry.aiResult.type}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Suggested actions:</p>
                    <div className="flex flex-col gap-1">
                      {entry.aiResult.actions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground/80">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {entry.status === "pending" && (
                    <div className="flex items-center gap-2 mt-3">
                      <button className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80">
                        <CheckCircle2 className="h-3 w-3" /> Apply
                      </button>
                      <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        Edit
                      </button>
                      <button className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                        Ignore
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}
