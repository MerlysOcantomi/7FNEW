"use client";

import { useState } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { cn } from "@/lib/utils";
import {
  Cpu,
  Sliders,
  Plug,
  Route,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Activity,
} from "lucide-react";

// ── Types & Data ──────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", tier: "Production" },
  { id: "claude-3-5", label: "Claude 3.5 Sonnet", provider: "Anthropic", tier: "Production" },
  { id: "gemini-1-5", label: "Gemini 1.5 Pro", provider: "Google", tier: "Evaluation" },
  { id: "llama-3", label: "Llama 3.1 70B", provider: "Meta / Self-Hosted", tier: "Experimental" },
];

const ROUTER_RULES = [
  { trigger: "Financial queries", model: "GPT-4o", reason: "Higher accuracy on numerical reasoning" },
  { trigger: "Document summarization", model: "Claude 3.5 Sonnet", reason: "Best-in-class summarization" },
  { trigger: "Risk classification", model: "GPT-4o", reason: "Consistent structured output" },
  { trigger: "Default / General", model: "Claude 3.5 Sonnet", reason: "Fallback for unclassified intent" },
];

const TOOLS = [
  { id: "project_lookup", label: "Project Lookup", description: "Fetch active project data from portfolio engine.", enabled: true },
  { id: "fund_analysis", label: "Fund Analysis", description: "Read fund performance and deviation metrics.", enabled: true },
  { id: "client_context", label: "Client Context", description: "Retrieve CRM data for selected client entity.", enabled: true },
  { id: "risk_monitor", label: "Risk Monitor", description: "Pull flagged risks from all active projects.", enabled: true },
  { id: "calendar_sync", label: "Calendar Sync", description: "Read upcoming milestones and deadlines.", enabled: false },
  { id: "email_draft", label: "Email Draft Generator", description: "Generate reply drafts from inbox entries.", enabled: false },
  { id: "report_export", label: "Report Export", description: "Compile and export executive briefs as PDF.", enabled: true },
  { id: "forge_content", label: "Marketing Content Engine", description: "Generate campaign drafts for the marketing workspace.", enabled: false },
];

const SYSTEM_STATUS = [
  { label: "LLM Router", status: "ok" as const, latency: "180ms" },
  { label: "Vector Store", status: "ok" as const, latency: "34ms" },
  { label: "Tool Registry", status: "ok" as const, latency: "—" },
  { label: "Session Memory", status: "warning" as const, latency: "410ms" },
  { label: "Embedding Model", status: "ok" as const, latency: "92ms" },
  { label: "Audit Logger", status: "ok" as const, latency: "—" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-[var(--text-primary-light)] tracking-tight">{title}</h2>
      {description && <p className="text-xs text-[var(--text-secondary-light)] mt-0.5">{description}</p>}
    </div>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[var(--text-secondary-light)] mt-1.5 leading-relaxed">{children}</p>;
}

function OnboardingHint({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 ring-1 ring-white/[0.04]">
      <p className="text-sm font-medium text-[var(--text-primary-light)]">{title}</p>
      <p className="text-xs text-[var(--text-secondary-light)] mt-1 leading-relaxed">{description}</p>
    </div>
  );
}

function StatusDot({ status }: { status: "ok" | "warning" | "error" }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full shrink-0",
      status === "ok" ? "bg-[var(--status-success-text)]" : status === "warning" ? "bg-[var(--status-warning-text)]" : "bg-[var(--status-danger-text)]"
    )} />
  );
}

function ToolToggle({
  tool,
  onToggle,
}: {
  tool: typeof TOOLS[0];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-[var(--border-dark)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary-light)]">{tool.label}</p>
        <p className="text-xs text-[var(--text-secondary-light)] mt-0.5">{tool.description}</p>
        <p className="text-[11px] text-[var(--text-secondary-light)] mt-1">
          {tool.enabled ? "Available to the assistant when needed." : "Hidden from the assistant for now."}
        </p>
      </div>
      <button
        onClick={() => onToggle(tool.id)}
        className="shrink-0 mt-0.5"
        aria-label={tool.enabled ? `Disable ${tool.label}` : `Enable ${tool.label}`}
      >
        {tool.enabled
          ? <ToggleRight size={22} className="text-[var(--accent-primary)]" strokeWidth={1.75} />
          : <ToggleLeft size={22} className="text-[var(--text-secondary-light)]/50" strokeWidth={1.75} />
        }
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = "model" | "router" | "tools" | "status";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "model", label: "Model Config", icon: Cpu },
  { key: "router", label: "Router Rules", icon: Route },
  { key: "tools", label: "Tool Registry", icon: Plug },
  { key: "status", label: "System Status", icon: Activity },
];

const integerFormatter = new Intl.NumberFormat("en-US");

export default function MotorPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("model");
  const [selectedModel, setSelectedModel] = useState("claude-3-5");
  const [modelDropOpen, setModelDropOpen] = useState(false);
  const [tools, setTools] = useState(TOOLS);
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(2048);

  const toggleTool = (id: string) => {
    setTools((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const currentModel = MODEL_OPTIONS.find((m) => m.id === selectedModel)!;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[var(--app-shell-bg)] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark)]">
          <p className="text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-widest mb-1">Advanced · Internal</p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary-light)] tracking-tight">AI workspace</h1>
              <p className="text-sm text-[var(--text-secondary-light)] mt-0.5">Choose how the assistant responds, when it switches behavior, and which helpers it can use.</p>
            </div>
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-sm text-[var(--text-primary-light)] hover:border-[var(--accent-primary)] transition-colors text-xs font-medium ring-1 ring-white/[0.03]">
              <RefreshCw size={13} strokeWidth={1.75} />
              <span className="hidden sm:inline">Save Changes</span>
              <span className="sm:hidden">Save</span>
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-5 md:px-8 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === key
                  ? "border-[var(--accent-primary)] text-[var(--accent-primary)]"
                  : "border-transparent text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)]"
              )}
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 md:px-8 py-7 max-w-3xl">

          {/* ── Model Config ── */}
          {activeTab === "model" && (
            <div className="space-y-7">
              <SectionHeader title="Primary model" description="This is the default style of assistant you want the workspace to use." />
              <OnboardingHint
                title="Start simple"
                description="If you are unsure, keep the current production model. Most teams only need to adjust this when they want faster replies, more detailed answers, or a different writing style."
              />

              {/* Model selector */}
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5 shadow-none ring-1 ring-white/[0.04]">
                <label className="block text-xs font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider mb-2">Active model</label>
                <div className="relative">
                  <button
                    onClick={() => setModelDropOpen(!modelDropOpen)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] text-sm text-[var(--text-primary-light)] hover:border-[var(--accent-primary)] transition-colors"
                  >
                    <div>
                      <span className="font-medium">{currentModel.label}</span>
                      <span className="ml-2 text-[var(--text-secondary-light)] text-xs">— {currentModel.provider}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded",
                        currentModel.tier === "Production" ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" :
                        currentModel.tier === "Evaluation" ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]" :
                        "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]"
                      )}>{currentModel.tier}</span>
                      <ChevronDown size={14} className={cn("text-[var(--text-secondary-light)] transition-transform", modelDropOpen && "rotate-180")} />
                    </div>
                  </button>
                  {modelDropOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] shadow-lg overflow-hidden ring-1 ring-white/[0.06]">
                      {MODEL_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setSelectedModel(m.id); setModelDropOpen(false); }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 text-sm transition-colors",
                            selectedModel === m.id ? "bg-white/[0.08] text-[var(--accent-primary)]" : "text-[var(--text-primary-light)] hover:bg-white/[0.06]"
                          )}
                        >
                          <div>
                            <span className="font-medium">{m.label}</span>
                            <span className="ml-2 text-[var(--text-secondary-light)] text-xs">{m.provider}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded",
                            m.tier === "Production" ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" :
                            m.tier === "Evaluation" ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]" :
                            "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]"
                          )}>{m.tier}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <HelperText>
                  Pick the model that should handle most requests by default. You can change this later without affecting your data.
                </HelperText>
              </div>

              {/* Parameters */}
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5 space-y-5 shadow-none ring-1 ring-white/[0.04]">
                <label className="block text-xs font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Parameters</label>
                <HelperText>
                  These controls change how the assistant answers. Lower values feel more controlled. Higher values feel more open and exploratory.
                </HelperText>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary-light)]">Temperature</span>
                    <span className="text-sm font-mono font-semibold text-[var(--accent-primary)]">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.1} value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary-light)] mt-1">
                    <span>Precise (0.0)</span><span>Creative (1.0)</span>
                  </div>
                  <HelperText>
                    Use lower temperature for stable, consistent answers. Raise it only if you want more variation in wording or ideas.
                  </HelperText>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary-light)]">Max Output Tokens</span>
                    <span className="text-sm font-mono font-semibold text-[var(--accent-primary)]">{integerFormatter.format(maxTokens)}</span>
                  </div>
                  <input
                    type="range" min={512} max={8192} step={512} value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-secondary-light)] mt-1">
                    <span>512</span><span>8,192</span>
                  </div>
                  <HelperText>
                    Higher output limits allow longer answers, summaries, or drafts. Lower limits keep responses shorter and faster.
                  </HelperText>
                </div>
              </div>

              {/* System prompt */}
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5 shadow-none ring-1 ring-white/[0.04]">
                <label className="block text-xs font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider mb-2">System Prompt</label>
                <textarea
                  defaultValue="You are 7F workspace intelligence, an executive assistant for a professional services firm. You have access to project portfolio data, fund performance metrics, client CRM records, and operational risk feeds. Always respond with precision, brevity, and strategic framing. Do not speculate beyond available data."
                  rows={5}
                  className="w-full bg-[var(--app-surface-dark-elevated)] border border-[var(--border-dark)] rounded-lg px-4 py-3 text-xs sm:text-sm text-[var(--text-primary-light)] font-mono leading-relaxed resize-none focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
                <HelperText>
                  This is the internal instruction that sets the assistant's role and tone. Change it carefully, and only if you want to redefine how the workspace behaves overall.
                </HelperText>
              </div>
            </div>
          )}

          {/* ── Router Rules ── */}
          {activeTab === "router" && (
            <div className="space-y-5">
              <SectionHeader title="Request routing" description="These rules decide when the workspace should switch models for different kinds of work." />
              <OnboardingHint
                title="Think of this like traffic direction"
                description="You do not need to configure every case. The router simply helps send each request to the model that fits best."
              />
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-none ring-1 ring-white/[0.04] overflow-hidden">
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]">
                    <span className="col-span-4 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Trigger</span>
                    <span className="col-span-3 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Model</span>
                    <span className="col-span-5 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Reason</span>
                  </div>
                  {ROUTER_RULES.map((rule, i) => (
                    <div key={rule.trigger} className={cn("grid grid-cols-12 items-center px-5 py-4 transition-colors hover:bg-white/[0.04]", i < ROUTER_RULES.length - 1 && "border-b border-[var(--border-dark)]")}>
                      <span className="col-span-4 text-sm font-medium text-[var(--text-primary-light)]">{rule.trigger}</span>
                      <span className="col-span-3 text-xs font-mono text-[var(--accent-primary)] bg-[var(--accent-primary)]/12 px-2 py-0.5 rounded w-fit">{rule.model}</span>
                      <span className="col-span-5 text-xs text-[var(--text-secondary-light)] pl-3">{rule.reason}</span>
                    </div>
                  ))}
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-[var(--border-dark)]">
                  {ROUTER_RULES.map((rule) => (
                    <div key={rule.trigger} className="px-4 py-4 space-y-2">
                      <p className="text-sm font-medium text-[var(--text-primary-light)]">{rule.trigger}</p>
                      <span className="inline-block text-xs font-mono text-[var(--accent-primary)] bg-[var(--accent-primary)]/12 px-2 py-0.5 rounded">{rule.model}</span>
                      <p className="text-xs text-[var(--text-secondary-light)]">{rule.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--status-info-bg)] p-4 ring-1 ring-white/[0.04]">
                <p className="text-xs text-[var(--text-primary-light)] leading-relaxed">
                  <span className="font-semibold text-[var(--accent-primary)]">Helpful tip:</span> The first matching rule wins. Put your most important or most specific rules at the top.
                </p>
              </div>
            </div>
          )}

          {/* ── Tool Registry ── */}
          {activeTab === "tools" && (
            <div className="space-y-5">
              <SectionHeader title="Available tools" description="These are the business helpers the assistant can use while answering." />
              <OnboardingHint
                title="Tools do not answer on their own"
                description="A tool gives the assistant access to useful actions or data, like looking up projects or drafting a reply. Turn on only what you want available."
              />
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-5 shadow-none ring-1 ring-white/[0.04]">
                {tools.map((tool) => (
                  <ToolToggle key={tool.id} tool={tool} onToggle={toggleTool} />
                ))}
              </div>
              <p className="text-xs text-[var(--text-secondary-light)] leading-relaxed">
                Tool changes apply to future sessions. Existing conversations keep their current context.
              </p>
            </div>
          )}

          {/* ── System Status ── */}
          {activeTab === "status" && (
            <div className="space-y-5">
              <SectionHeader title="System Health" description="Real-time status of AI infrastructure components." />
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-none ring-1 ring-white/[0.04] overflow-hidden">
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]">
                    <span className="col-span-5 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Component</span>
                    <span className="col-span-4 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Status</span>
                    <span className="col-span-3 text-[10px] font-semibold text-[var(--text-secondary-light)] uppercase tracking-wider">Latency</span>
                  </div>
                  {SYSTEM_STATUS.map((item, i) => (
                    <div key={item.label} className={cn("grid grid-cols-12 items-center px-5 py-4 transition-colors hover:bg-white/[0.04]", i < SYSTEM_STATUS.length - 1 && "border-b border-[var(--border-dark)]")}>
                      <span className="col-span-5 text-sm font-medium text-[var(--text-primary-light)]">{item.label}</span>
                      <div className="col-span-4 flex items-center gap-2">
                        <StatusDot status={item.status} />
                        <span className={cn(
                          "text-xs font-semibold",
                          item.status === "ok" ? "text-[var(--status-success-text)]" : item.status === "warning" ? "text-[var(--status-warning-text)]" : "text-destructive"
                        )}>
                          {item.status === "ok" ? "Operational" : item.status === "warning" ? "Degraded" : "Error"}
                        </span>
                      </div>
                      <span className="col-span-3 text-xs font-mono text-[var(--text-secondary-light)]">{item.latency}</span>
                    </div>
                  ))}
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-[var(--border-dark)]">
                  {SYSTEM_STATUS.map((item) => (
                    <div key={item.label} className="px-4 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StatusDot status={item.status} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary-light)]">{item.label}</p>
                          <span className={cn(
                            "text-xs font-semibold",
                            item.status === "ok" ? "text-[var(--status-success-text)]" : item.status === "warning" ? "text-[var(--status-warning-text)]" : "text-destructive"
                          )}>
                            {item.status === "ok" ? "Operational" : item.status === "warning" ? "Degraded" : "Error"}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[var(--text-secondary-light)] shrink-0">{item.latency}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--status-warning-bg)] p-4 ring-1 ring-white/[0.04]">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-[var(--status-warning-text)] mt-0.5 shrink-0" strokeWidth={1.75} />
                  <p className="text-xs text-[var(--status-warning-text)] leading-relaxed">
                    <span className="font-semibold">Session Memory latency elevated.</span> Average response times for context retrieval are 2.1x above baseline. Monitoring in progress — no action required at this time.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <LegacyTodayChrome />
    </div>
  );
}
