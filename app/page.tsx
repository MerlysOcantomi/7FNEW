"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  FolderKanban,
  DollarSign,
  Bell,
  Clock,
  CalendarDays,
  ArrowUpRight,
  FileText,
  Lightbulb,
  ChevronRight,
  Loader2,
  Activity,
  Users,
  CheckSquare,
  Inbox,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import type { DashboardData, DashboardPriorityKind, DashboardRecommendationPreview, ForteInsight } from "@core/dashboard";
import { DEFAULT_VOCABULARY } from "@core/personalization";
import { cn } from "@/lib/utils";

const v = DEFAULT_VOCABULARY;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.round((value / safeMax) * 100));
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US");
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function getPriorityIcon(kind: DashboardPriorityKind) {
  if (kind === "project-risk") return FolderKanban;
  if (kind === "task-overdue") return AlertTriangle;
  if (kind === "invoice-overdue" || kind === "invoice-pending") return Bell;
  return CheckSquare;
}

function getPriorityStyles(kind: DashboardPriorityKind) {
  if (kind === "workspace-stable") {
    return {
      wrapper: "hover:border-[var(--status-success-text)]/40",
      surface: "bg-[var(--status-success-bg)]",
      icon: "text-[var(--status-success-text)]",
    };
  }

  return {
    wrapper: "hover:border-destructive/40",
    surface: "bg-destructive/5",
    icon: "text-destructive",
  };
}

function getActivityIcon(module: string, type: string) {
  if (module === "tareas" || type === "tarea") return Clock;
  if (module === "proyectos" || type === "proyecto") return FolderKanban;
  if (module === "calendario" || module === "eventos") return CalendarDays;
  return Activity;
}

function getRecommendationIcon(recommendationId: DashboardRecommendationPreview["id"]) {
  if (recommendationId === "smart-inbox") return Inbox;
  if (recommendationId === "operations-follow-up") return CheckSquare;
  return Lightbulb;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  const { data: summary, loading, error } = useFetch<DashboardData>("/api/dashboard/summary");

  const modulesSummary = summary?.modulesSummary;
  const activity = summary?.recentActivity ?? [];
  const finance = summary?.financeSummary;
  const priorityActions = summary?.priorityActions ?? [];
  const recommendations = summary?.recommendations ?? [];
  const forteInsight = summary?.forteInsight;
  const hero = summary?.hero;
  const actionablePriorities = priorityActions.filter((item) => item.kind !== "workspace-stable");

  const moduleCards = modulesSummary
    ? [
        {
          label: v.client.plural,
          value: String(modulesSummary.totalClients),
          detail: modulesSummary.totalClients > 0 ? "Active relationships in the workspace" : "No clients added yet",
          icon: Users,
          href: "/clientes",
          accent: "text-primary",
          surface: "bg-accent",
        },
        {
          label: v.project.plural,
          value: String(modulesSummary.activeProjects),
          detail: modulesSummary.activeProjects > 0 ? "Work currently in motion" : "No active delivery right now",
          icon: FolderKanban,
          href: "/proyectos",
          accent: "text-primary",
          surface: "bg-card",
        },
        {
          label: v.task.plural,
          value: String(modulesSummary.overdueTasks),
          detail: modulesSummary.overdueTasks > 0 ? "Overdue tasks need follow-up" : "No overdue tasks right now",
          icon: CheckSquare,
          href: "/tareas",
          accent: modulesSummary.overdueTasks > 0 ? "text-destructive" : "text-[var(--status-success-text)]",
          surface: "bg-card",
        },
        {
          label: v.billing.singular,
          value: fmt(modulesSummary.billedThisMonth),
          detail:
            modulesSummary.pendingInvoices > 0
              ? `${modulesSummary.pendingInvoices} ${v.invoice.plural.toLowerCase()} still pending`
              : `No pending ${v.invoice.plural.toLowerCase()}`,
          icon: DollarSign,
          href: "/facturacion",
          accent: "text-primary",
          surface: "bg-card",
        },
      ]
    : [];

  const maxBar = finance
    ? Math.max(finance.revenueMonth, finance.expensesMonth, 1)
    : 1;

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-background font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 overflow-y-auto">
            <PageHeader
              eyebrow="Workspace"
              title="Overview"
              description={hero?.summary ?? "A practical starting point for daily operations, client work, billing, and recommendations."}
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={hero?.quickActions[0]?.href ?? "/inbox/overview"}>
                      <Inbox size={14} strokeWidth={1.75} />
                      {hero?.quickActions[0]?.label ?? `Open ${v.inbox.singular}`}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={hero?.quickActions[1]?.href ?? "/agente"}>
                      <Lightbulb size={14} strokeWidth={1.75} />
                      {hero?.quickActions[1]?.label ?? "View insights"}
                    </Link>
                  </Button>
                </div>
              }
            />

            <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8 sm:space-y-10">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="bg-destructive/5 rounded-xl border border-destructive/20 p-8 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <p className="text-xs text-destructive/80 mt-1">Dashboard summary could not be loaded</p>
                </div>
              ) : (
                <>
                  {/* Hero */}
                  <section>
                    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                      <div className="rounded-2xl border border-primary/20 bg-accent p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                            Overview
                          </span>
                          <span className="rounded-full border border-primary/30 bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                            Structured guidance
                          </span>
                        </div>
                        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                          See what needs attention across the workspace.
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          Use this page to understand current workload, spot the items that need action, and
                          move quickly into the right module.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-card p-6">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Start here
                        </p>
                        <div className="mt-4 space-y-3">
                          {[
                            "Check the health of core work areas at a glance",
                            "Review urgent items before they become delivery or finance problems",
                            "Open the next module quickly without searching through the product",
                          ].map((item) => (
                            <div key={item} className="flex items-start gap-3">
                              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                              <p className="text-sm text-foreground">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Core modules */}
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Core modules
                      </h2>
                      <span className="text-xs text-muted-foreground">Key work areas</span>
                    </div>
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
                      {moduleCards.map(({ label, value, detail, icon: Icon, href, accent, surface }) => (
                        <Link
                          key={label}
                          href={href}
                          className={cn("rounded-xl border border-border p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md", surface)}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <Icon size={16} className={accent} strokeWidth={1.75} />
                            <ArrowUpRight size={13} className="text-muted-foreground" />
                          </div>
                          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
                          <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
                        </Link>
                      ))}
                    </div>
                  </section>

                  {/* Needs attention */}
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Priority actions
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        {actionablePriorities.length > 0
                          ? `${actionablePriorities.length} active signals`
                          : "All clear"}
                      </span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {priorityActions.map(({ id, title, value, summary: description, href, kind }) => {
                        const Icon = getPriorityIcon(kind)
                        const styles = getPriorityStyles(kind)
                        return (
                          <Link
                            key={id}
                            href={href}
                            className={cn("rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md", styles.wrapper)}
                          >
                            <div className="flex items-center justify-between">
                              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", styles.surface)}>
                                <Icon size={15} className={styles.icon} strokeWidth={1.75} />
                              </div>
                              <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
                            </div>
                            <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
                          </Link>
                        )})}
                    </div>
                  </section>

                  {/* Main grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Recent activity */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                          Recent activity
                        </h2>
                        <Link
                          href="/inbox"
                          className="text-[10px] text-primary font-medium hover:underline flex items-center gap-0.5"
                        >
                          View all <ChevronRight size={11} />
                        </Link>
                      </div>
                      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        {activity.length === 0 ? (
                          <div className="px-5 py-12 text-center">
                            <Activity size={24} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-foreground">No recent activity</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Workspace updates will appear here
                            </p>
                          </div>
                        ) : (
                          activity.map((item, i) => {
                            const Icon = getActivityIcon(item.module, item.type);
                            return (
                              <Link
                                key={item.id}
                                href={item.href}
                                className={cn(
                                  "flex items-start gap-3 px-4 py-3.5 hover:bg-background transition-colors",
                                  i < activity.length - 1 && "border-b border-muted"
                                )}
                              >
                                <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0 mt-0.5">
                                  <Icon size={12} className="text-primary" strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
                                    {item.label}
                                  </p>
                                  <p className="text-sm text-foreground leading-snug truncate">{item.detail}</p>
                                  {item.userName && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.userName}</p>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </section>

                    {/* Financial status */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                          Financial snapshot
                        </h2>
                        <Link
                          href="/finanzas"
                          className="text-[10px] text-primary font-medium hover:underline flex items-center gap-0.5"
                        >
                          View {v.finance.singular.toLowerCase()} <ChevronRight size={11} />
                        </Link>
                      </div>
                      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        {finance ? (
                          <>
                            <div className="px-5 py-4 border-b border-muted">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                Revenue vs expenses — this month
                              </p>
                              <div className="space-y-2.5">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-foreground">Revenue</span>
                                    <span className="text-xs font-semibold text-[var(--status-success-text)]">
                                      {fmt(finance.revenueMonth)}
                                    </span>
                                  </div>
                                  <ProgressBar value={finance.revenueMonth} max={maxBar} />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-foreground">Expenses</span>
                                    <span className="text-xs font-semibold text-destructive">
                                      {fmt(finance.expensesMonth)}
                                    </span>
                                  </div>
                                  <ProgressBar value={finance.expensesMonth} max={maxBar} />
                                </div>
                              </div>
                            </div>

                            <div className="px-5 py-4 border-b border-muted flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-md bg-[var(--status-warning-bg)] flex items-center justify-center">
                                  <FileText size={13} className="text-[var(--status-warning-text)]" strokeWidth={1.75} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-foreground">Pending {v.invoice.plural.toLowerCase()}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {finance.pendingInvoicesCount} {v.invoice.plural.toLowerCase()} · {fmt(finance.pendingInvoicesAmount)}
                                  </p>
                                </div>
                              </div>
                              <Link
                                href="/facturacion"
                                className="text-[10px] text-primary font-medium hover:underline flex items-center gap-0.5 shrink-0"
                              >
                                View <ChevronRight size={11} />
                              </Link>
                            </div>

                            {finance.budgetVariancePct != null ? (
                              <div className="px-5 py-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
                                      Budget variance
                                    </p>
                                    <p className="text-xs text-foreground">
                                      Actual spend vs approved monthly budget
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-lg font-bold",
                                      finance.budgetVariancePct >= 0 ? "text-[var(--status-success-text)]" : "text-destructive"
                                    )}
                                  >
                                    {finance.budgetVariancePct >= 0 ? "+" : ""}
                                    {finance.budgetVariancePct}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-5 py-4">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
                                      Budget variance
                                </p>
                                <p className="text-xs text-muted-foreground">
                                      No budget has been configured to calculate variance
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-5 py-12 text-center">
                            <DollarSign size={24} className="text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-foreground">No financial data</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* Forte Intelligence */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        {forteInsight ? "Forte Intelligence" : "Improvements"}
                      </h2>
                      <Link
                        href="/forte/improvements"
                        className="text-[10px] text-primary font-medium hover:underline flex items-center gap-0.5"
                      >
                        {forteInsight ? "Full analysis" : "Open improvements"} <ArrowUpRight size={11} />
                      </Link>
                    </div>

                    {forteInsight ? (
                      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-muted">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                              <Lightbulb size={15} className="text-primary" strokeWidth={1.75} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Workspace maturity: <span className="capitalize">{forteInsight.maturity}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Last analyzed {formatRelativeTime(forteInsight.analyzedAt)}
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/forte/improvements"
                            className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            View details <ArrowUpRight size={11} />
                          </Link>
                        </div>

                        {forteInsight.topPriorities.length > 0 && (
                          <div className="px-5 py-3 border-b border-muted">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                              Top priorities
                            </p>
                            <div className="space-y-2">
                              {forteInsight.topPriorities.map((p) => (
                                <Link
                                  key={p.label}
                                  href={p.href}
                                  className="flex items-center justify-between group"
                                >
                                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                                    {p.label}
                                  </span>
                                  <ChevronRight size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {forteInsight.nextMove && (
                          <Link
                            href={forteInsight.nextMove.href}
                            className="flex items-center justify-between px-5 py-3 hover:bg-background transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <span className="text-xs font-medium text-foreground">
                                Recommended next move
                              </span>
                            </div>
                            <span className="text-xs text-primary font-medium flex items-center gap-1">
                              {forteInsight.nextMove.label} <ArrowUpRight size={11} />
                            </span>
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                        {recommendations.map(({ id, title, helper, description, href, cta }) => {
                          const Icon = getRecommendationIcon(id)
                          return (
                            <Link
                              key={id}
                              href={href}
                              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                                  <Icon size={15} className="text-primary" strokeWidth={1.75} />
                                </div>
                                <span className="rounded-full bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                  {helper}
                                </span>
                              </div>
                              <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
                              <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                                {cta}
                                <ArrowUpRight size={11} />
                              </div>
                            </Link>
                          )})}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </main>

          <CopilotPanel defaultContext="Overview" />

          <LegacyTodayChrome />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
