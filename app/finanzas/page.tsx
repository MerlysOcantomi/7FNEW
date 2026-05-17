"use client";

import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import { LegacyTodayChrome } from "@/components/today/legacy-today-chrome";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";

// ── Data ──────────────────────────────────────────────────────────────────────

const CASHFLOW = [
  { month: "Oct", inflow: 310, outflow: 245 },
  { month: "Nov", inflow: 380, outflow: 290 },
  { month: "Dec", inflow: 420, outflow: 310 },
  { month: "Jan", inflow: 360, outflow: 280 },
  { month: "Feb", inflow: 490, outflow: 340 },
  { month: "Mar", inflow: 520, outflow: 365 },
];

const FUNDS = [
  { name: "Operating reserve", balance: "$640K", target: "$661K", deviation: "-3.2%", status: "warning" as const },
  { name: "Strategic allocation", balance: "$312K", target: "$300K", deviation: "+4.0%", status: "ok" as const },
  { name: "Project reserve", balance: "$180K", target: "$180K", deviation: "0%", status: "ok" as const },
  { name: "Liquidity Buffer", balance: "$95K", target: "$100K", deviation: "-5.0%", status: "warning" as const },
];

const RECENT_INVOICES = [
  { id: "INV-0042", client: "Client account", amount: "$48,000", status: "Paid", due: "Feb 15, 2025" },
  { id: "INV-0043", client: "Priority client", amount: "$32,500", status: "Pending", due: "Mar 10, 2025" },
  { id: "INV-0044", client: "Key account", amount: "$75,000", status: "Overdue", due: "Feb 28, 2025" },
  { id: "INV-0045", client: "Active client", amount: "$21,000", status: "Paid", due: "Mar 1, 2025" },
];

const INV_STATUS: Record<string, { bg: string; text: string }> = {
  Paid:     { bg: "bg-[var(--status-success-bg)]", text: "text-[var(--status-success-text)]" },
  Pending:  { bg: "bg-[var(--status-info-bg)]", text: "text-[var(--status-info-text)]" },
  Overdue:  { bg: "bg-[var(--status-danger-bg)]", text: "text-[var(--status-danger-text)]" },
};

// ── Simple bar chart ──────────────────────────────────────────────────────────

function CashflowBar({ month, inflow, outflow, maxVal }: { month: string; inflow: number; outflow: number; maxVal: number }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className="w-full flex items-end justify-center gap-1" style={{ height: "80px" }}>
        <div
          className="flex-1 rounded-t-sm bg-[var(--accent-primary)]"
          style={{ height: `${(inflow / maxVal) * 80}px` }}
          title={`Inflow: $${inflow}K`}
        />
        <div
          className="flex-1 rounded-t-sm bg-[var(--accent-primary)]/35"
          style={{ height: `${(outflow / maxVal) * 80}px` }}
          title={`Outflow: $${outflow}K`}
        />
      </div>
      <span className="text-[10px] text-[var(--text-secondary-light)]">{month}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const maxVal = Math.max(...CASHFLOW.map((c) => Math.max(c.inflow, c.outflow)));
  const totalAR = 32500 + 75000; // pending + overdue
  const overdueCount = RECENT_INVOICES.filter((i) => i.status === "Overdue").length;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[var(--app-shell-bg)] font-sans md:flex-row">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader
          eyebrow="Revenue"
          title="Finance Overview"
          tone="canvas"
          actions={
            <Button asChild size="sm">
              <Link href="/facturacion">
                <FileText size={13} strokeWidth={1.75} />
                Invoicing
                <ArrowUpRight size={11} />
              </Link>
            </Button>
          }
        />

        <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8">

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue YTD", value: "$2.48M", delta: "+12% vs last year", trend: "up" as const, icon: DollarSign },
              { label: "AR Outstanding", value: `$${(totalAR / 1000).toFixed(0)}K`, delta: `${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""}`, trend: "down" as const, icon: FileText },
              { label: "Capital Under Management", value: "$1.23M", delta: "4 active pools", trend: "up" as const, icon: BarChart3 },
              { label: "Burn vs Budget", value: "94%", delta: "On track for Q1", trend: "up" as const, icon: TrendingUp },
            ].map(({ label, value, delta, trend, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 shadow-none ring-1 ring-white/[0.04]">
                <div className="mb-3 flex items-center justify-between">
                  <Icon size={16} className="text-[var(--accent-primary)]" strokeWidth={1.75} />
                  <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", trend === "up" ? "text-[var(--status-success-text)]" : "text-destructive")}>
                    {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {delta}
                  </span>
                </div>
                <p className="text-xl font-bold tracking-tight text-[var(--text-primary-light)]">{value}</p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary-light)]">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Cashflow Snapshot ── */}
          <section>
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary-light)]">Cashflow — Last 6 Months</h2>
            <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5 ring-1 ring-white/[0.04]">
              <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {CASHFLOW.map((c) => (
                  <CashflowBar key={c.month} {...c} maxVal={maxVal} />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-5 border-t border-[var(--border-dark)] pt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-[var(--accent-primary)]" />
                  <span className="text-xs text-[var(--text-secondary-light)]">Inflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-[var(--accent-primary)]/35" />
                  <span className="text-xs text-[var(--text-secondary-light)]">Outflow</span>
                </div>
                <span className="ml-auto text-[10px] text-[var(--text-secondary-light)]">Values in $K</span>
              </div>
            </div>
          </section>

          {/* ── Fund Status ── */}
          <section>
            <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary-light)]">Fund Status</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FUNDS.map((fund) => (
                <div
                  key={fund.name}
                  className={cn(
                    "rounded-xl border border-[var(--border-dark)] p-5 shadow-none ring-1 ring-white/[0.04]",
                    fund.status === "warning" ? "bg-[rgba(242,198,109,0.08)]" : "bg-[var(--app-surface-dark)]",
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--text-primary-light)]">{fund.name}</p>
                    {fund.status === "warning" && (
                      <AlertTriangle size={14} className="text-[var(--status-warning-text)] shrink-0 mt-0.5" strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-xl font-bold tracking-tight text-[var(--text-primary-light)]">{fund.balance}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary-light)]">Target: {fund.target}</span>
                    <span className={cn("text-xs font-semibold", fund.deviation.startsWith("-") ? "text-destructive" : "text-[var(--status-success-text)]")}>
                      {fund.deviation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Recent Invoices ── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary-light)]">Recent Invoices</h2>
              <Link href="/facturacion" className="flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>

            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] ring-1 ring-white/[0.04] sm:block">
              <div className="grid grid-cols-12 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-5 py-2.5">
                <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Invoice</span>
                <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Client</span>
                <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Amount</span>
                <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Due</span>
                <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">Status</span>
              </div>
              {RECENT_INVOICES.map((inv, i) => {
                const s = INV_STATUS[inv.status];
                return (
                  <div key={inv.id} className={cn("grid grid-cols-12 items-center px-5 py-4 transition-colors hover:bg-white/[0.04]", i < RECENT_INVOICES.length - 1 && "border-b border-[var(--border-dark)]")}>
                    <Link href={`/facturacion/${inv.id}`} className="col-span-3 text-sm font-medium text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary)]/85">{inv.id}</Link>
                    <span className="col-span-3 text-sm text-[var(--text-primary-light)]">{inv.client}</span>
                    <span className="col-span-2 text-sm font-medium text-[var(--text-primary-light)]">{inv.amount}</span>
                    <span className="col-span-2 text-sm text-[var(--text-secondary-light)]">{inv.due.split(",")[0]}</span>
                    <span className={cn("col-span-2 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s.bg, s.text)}>{inv.status}</span>
                  </div>
                );
              })}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {RECENT_INVOICES.map((inv) => {
                const s = INV_STATUS[inv.status];
                return (
                  <div key={inv.id} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 ring-1 ring-white/[0.04]">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Link href={`/facturacion/${inv.id}`} className="text-sm font-semibold text-[var(--accent-primary)]">{inv.id}</Link>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>{inv.status}</span>
                    </div>
                    <p className="text-sm text-[var(--text-primary-light)]">{inv.client}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary-light)]">{inv.amount} · Due {inv.due}</p>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </main>

      <CopilotPanel defaultContext="Finance" />

      <LegacyTodayChrome />
    </div>
  );
}
