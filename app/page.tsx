"use client";

import { useState } from "react";
import Link from "next/link";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.round((value / safeMax) * 100));
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${pct}%` }} />
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
      wrapper: "hover:border-[#86EFAC]",
      surface: "bg-[#F0FDF4]",
      icon: "text-[#16A34A]",
    };
  }

  return {
    wrapper: "hover:border-[#FCA5A5]",
    surface: "bg-[#FEF2F2]",
    icon: "text-[#DC2626]",
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
          label: "Clients",
          value: String(modulesSummary.totalClients),
          detail: modulesSummary.totalClients > 0 ? "Active relationships in the workspace" : "No clients added yet",
          icon: Users,
          href: "/clientes",
          accent: "text-[#2563EB]",
          surface: "bg-[#EFF6FF]",
        },
        {
          label: "Projects",
          value: String(modulesSummary.activeProjects),
          detail: modulesSummary.activeProjects > 0 ? "Work currently in motion" : "No active delivery right now",
          icon: FolderKanban,
          href: "/proyectos",
          accent: "text-[#2563EB]",
          surface: "bg-white",
        },
        {
          label: "Tasks",
          value: String(modulesSummary.overdueTasks),
          detail: modulesSummary.overdueTasks > 0 ? "Overdue tasks need follow-up" : "No overdue tasks right now",
          icon: CheckSquare,
          href: "/tareas",
          accent: modulesSummary.overdueTasks > 0 ? "text-[#DC2626]" : "text-[#16A34A]",
          surface: "bg-white",
        },
        {
          label: "Billing",
          value: fmt(modulesSummary.billedThisMonth),
          detail:
            modulesSummary.pendingInvoices > 0
              ? `${modulesSummary.pendingInvoices} invoices still pending`
              : "No pending invoices",
          icon: DollarSign,
          href: "/facturacion",
          accent: "text-[#2563EB]",
          surface: "bg-white",
        },
      ]
    : [];

  const maxBar = finance
    ? Math.max(finance.revenueMonth, finance.expensesMonth, 1)
    : 1;

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="px-4 md:px-8 pt-7 pb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div>
                <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
                  7F Workspace
                </p>
                <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
                  Overview
                </h1>
                <p className="text-xs text-[#64748B] mt-1 text-pretty">
                  {hero?.summary ?? "A practical starting point for daily operations, client work, billing, and recommendations."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={hero?.quickActions[0]?.href ?? "/inbox"}
                  className="flex items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1E293B]"
                >
                  <Inbox size={14} strokeWidth={1.75} />
                  {hero?.quickActions[0]?.label ?? "Open Smart Inbox"}
                </Link>
                <Link
                  href={hero?.quickActions[1]?.href ?? "/agente"}
                  className="flex items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] transition-colors hover:border-[#93C5FD] hover:bg-[#EFF6FF]"
                >
                  <Lightbulb size={14} strokeWidth={1.75} />
                  {hero?.quickActions[1]?.label ?? "View insights"}
                </Link>
              </div>
            </div>

            <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8 sm:space-y-10">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-[#94A3B8]" />
                </div>
              ) : error ? (
                <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-8 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-[#EF4444] mb-3" />
                  <p className="text-sm font-medium text-[#991B1B]">{error}</p>
                  <p className="text-xs text-[#B91C1C] mt-1">Dashboard summary could not be loaded</p>
                </div>
              ) : (
                <>
                  {/* Hero */}
                  <section>
                    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                      <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#2563EB]">
                            Overview
                          </span>
                          <span className="rounded-full border border-[#BFDBFE] bg-white px-2.5 py-1 text-[10px] font-medium text-[#475569]">
                            Structured guidance
                          </span>
                        </div>
                        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#0F172A]">
                          See what needs attention across the workspace.
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#475569]">
                          Use this page to understand current workload, spot the items that need action, and
                          move quickly into the right module.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                          Start here
                        </p>
                        <div className="mt-4 space-y-3">
                          {[
                            "Check the health of core work areas at a glance",
                            "Review urgent items before they become delivery or finance problems",
                            "Open the next module quickly without searching through the product",
                          ].map((item) => (
                            <div key={item} className="flex items-start gap-3">
                              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                              <p className="text-sm text-[#334155]">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Core modules */}
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
                        Core modules
                      </h2>
                      <span className="text-xs text-[#94A3B8]">Key work areas</span>
                    </div>
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
                      {moduleCards.map(({ label, value, detail, icon: Icon, href, accent, surface }) => (
                        <Link
                          key={label}
                          href={href}
                          className={`rounded-xl border border-[#E2E8F0] p-4 shadow-sm transition-all hover:border-[#BFDBFE] hover:shadow-md ${surface}`}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <Icon size={16} className={accent} strokeWidth={1.75} />
                            <ArrowUpRight size={13} className="text-[#94A3B8]" />
                          </div>
                          <p className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                          <p className="mt-1 text-xs font-medium text-[#0F172A]">{label}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{detail}</p>
                        </Link>
                      ))}
                    </div>
                  </section>

                  {/* Needs attention */}
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
                        Priority actions
                      </h2>
                      <span className="text-xs text-[#94A3B8]">
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
                            className={`rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md ${styles.wrapper}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.surface}`}>
                                <Icon size={15} className={styles.icon} strokeWidth={1.75} />
                              </div>
                              <span className="text-2xl font-semibold tracking-tight text-[#0F172A]">{value}</span>
                            </div>
                            <p className="mt-4 text-sm font-semibold text-[#0F172A]">{title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{description}</p>
                          </Link>
                        )})}
                    </div>
                  </section>

                  {/* Main grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Recent activity */}
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                          Recent activity
                        </h2>
                        <Link
                          href="/inbox"
                          className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5"
                        >
                          View all <ChevronRight size={11} />
                        </Link>
                      </div>
                      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                        {activity.length === 0 ? (
                          <div className="px-5 py-12 text-center">
                            <Activity size={24} className="text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-[#334155]">No recent activity</p>
                            <p className="text-xs text-[#94A3B8] mt-1">
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
                                className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[#F8FAFC] transition-colors ${
                                  i < activity.length - 1 ? "border-b border-[#F1F5F9]" : ""
                                }`}
                              >
                                <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                                  <Icon size={12} className="text-[#3B82F6]" strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide leading-none mb-0.5">
                                    {item.label}
                                  </p>
                                  <p className="text-sm text-[#0F172A] leading-snug truncate">{item.detail}</p>
                                  {item.userName && (
                                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{item.userName}</p>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0 mt-0.5">
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
                        <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                          Financial snapshot
                        </h2>
                        <Link
                          href="/finanzas"
                          className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5"
                        >
                          View finance <ChevronRight size={11} />
                        </Link>
                      </div>
                      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                        {finance ? (
                          <>
                            <div className="px-5 py-4 border-b border-[#F1F5F9]">
                              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-3">
                                Revenue vs expenses — this month
                              </p>
                              <div className="space-y-2.5">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-[#334155]">Revenue</span>
                                    <span className="text-xs font-semibold text-[#16A34A]">
                                      {fmt(finance.revenueMonth)}
                                    </span>
                                  </div>
                                  <ProgressBar value={finance.revenueMonth} max={maxBar} />
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-[#334155]">Expenses</span>
                                    <span className="text-xs font-semibold text-[#DC2626]">
                                      {fmt(finance.expensesMonth)}
                                    </span>
                                  </div>
                                  <ProgressBar value={finance.expensesMonth} max={maxBar} />
                                </div>
                              </div>
                            </div>

                            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-md bg-[#FEF9C3] flex items-center justify-center">
                                  <FileText size={13} className="text-[#854D0E]" strokeWidth={1.75} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-[#0F172A]">Pending invoices</p>
                                  <p className="text-[10px] text-[#64748B]">
                                    {finance.pendingInvoicesCount} invoices · {fmt(finance.pendingInvoicesAmount)}
                                  </p>
                                </div>
                              </div>
                              <Link
                                href="/facturacion"
                                className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5 shrink-0"
                              >
                                View <ChevronRight size={11} />
                              </Link>
                            </div>

                            {finance.budgetVariancePct != null ? (
                              <div className="px-5 py-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-0.5">
                                      Budget variance
                                    </p>
                                    <p className="text-xs text-[#334155]">
                                      Actual spend vs approved monthly budget
                                    </p>
                                  </div>
                                  <span
                                    className={`text-lg font-bold ${
                                      finance.budgetVariancePct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                                    }`}
                                  >
                                    {finance.budgetVariancePct >= 0 ? "+" : ""}
                                    {finance.budgetVariancePct}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="px-5 py-4">
                                <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-0.5">
                                      Budget variance
                                </p>
                                <p className="text-xs text-[#94A3B8]">
                                      No budget has been configured to calculate variance
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-5 py-12 text-center">
                            <DollarSign size={24} className="text-[#CBD5E1] mx-auto mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-[#334155]">No financial data</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* Forte Intelligence */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">
                        {forteInsight ? "Forte Intelligence" : "Improvements"}
                      </h2>
                      <Link
                        href="/forte/improvements"
                        className="text-[10px] text-[#3B82F6] font-medium hover:underline flex items-center gap-0.5"
                      >
                        {forteInsight ? "Full analysis" : "Open improvements"} <ArrowUpRight size={11} />
                      </Link>
                    </div>

                    {forteInsight ? (
                      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between border-b border-[#F1F5F9]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF]">
                              <Lightbulb size={15} className="text-[#2563EB]" strokeWidth={1.75} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#0F172A]">
                                Workspace maturity: <span className="capitalize">{forteInsight.maturity}</span>
                              </p>
                              <p className="text-[10px] text-[#94A3B8]">
                                Last analyzed {formatRelativeTime(forteInsight.analyzedAt)}
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/forte/improvements"
                            className="text-xs font-medium text-[#3B82F6] hover:underline flex items-center gap-1 shrink-0"
                          >
                            View details <ArrowUpRight size={11} />
                          </Link>
                        </div>

                        {forteInsight.topPriorities.length > 0 && (
                          <div className="px-5 py-3 border-b border-[#F1F5F9]">
                            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest mb-2">
                              Top priorities
                            </p>
                            <div className="space-y-2">
                              {forteInsight.topPriorities.map((p) => (
                                <Link
                                  key={p.label}
                                  href={p.href}
                                  className="flex items-center justify-between group"
                                >
                                  <span className="text-sm text-[#334155] group-hover:text-[#2563EB] transition-colors">
                                    {p.label}
                                  </span>
                                  <ChevronRight size={12} className="text-[#CBD5E1] group-hover:text-[#3B82F6] transition-colors" />
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {forteInsight.nextMove && (
                          <Link
                            href={forteInsight.nextMove.href}
                            className="flex items-center justify-between px-5 py-3 hover:bg-[#F8FAFC] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                              <span className="text-xs font-medium text-[#0F172A]">
                                Recommended next move
                              </span>
                            </div>
                            <span className="text-xs text-[#3B82F6] font-medium flex items-center gap-1">
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
                              className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:border-[#BFDBFE] hover:shadow-md"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF]">
                                  <Icon size={15} className="text-[#2563EB]" strokeWidth={1.75} />
                                </div>
                                <span className="rounded-full bg-[#F8FAFC] px-2 py-1 text-[10px] font-medium text-[#64748B]">
                                  {helper}
                                </span>
                              </div>
                              <p className="mt-4 text-sm font-semibold text-[#0F172A]">{title}</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{description}</p>
                              <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#2563EB]">
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
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
