"use client";

import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
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
          className="flex-1 bg-primary rounded-t-sm"
          style={{ height: `${(inflow / maxVal) * 80}px` }}
          title={`Inflow: $${inflow}K`}
        />
        <div
          className="flex-1 bg-primary/30 rounded-t-sm"
          style={{ height: `${(outflow / maxVal) * 80}px` }}
          title={`Outflow: $${outflow}K`}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{month}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const maxVal = Math.max(...CASHFLOW.map((c) => Math.max(c.inflow, c.outflow)));
  const totalAR = 32500 + 75000; // pending + overdue
  const overdueCount = RECENT_INVOICES.filter((i) => i.status === "Overdue").length;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <PageHeader
          eyebrow="Revenue"
          title="Finance Overview"
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
              <div key={label} className="bg-accent rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Icon size={16} className="text-primary" strokeWidth={1.75} />
                  <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", trend === "up" ? "text-[var(--status-success-text)]" : "text-destructive")}>
                    {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {delta}
                  </span>
                </div>
                <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Cashflow Snapshot ── */}
          <section>
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Cashflow — Last 6 Months</h2>
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {CASHFLOW.map((c) => (
                  <CashflowBar key={c.month} {...c} maxVal={maxVal} />
                ))}
              </div>
              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-muted">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                  <span className="text-xs text-muted-foreground">Inflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-primary/30" />
                  <span className="text-xs text-muted-foreground">Outflow</span>
                </div>
                <span className="ml-auto text-[10px] text-muted-foreground">Values in $K</span>
              </div>
            </div>
          </section>

          {/* ── Fund Status ── */}
          <section>
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Fund Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FUNDS.map((fund) => (
                <div key={fund.name} className={cn("rounded-xl p-5 shadow-sm", fund.status === "warning" ? "bg-primary/15" : "bg-accent")}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-foreground">{fund.name}</p>
                    {fund.status === "warning" && (
                      <AlertTriangle size={14} className="text-[var(--status-warning-text)] shrink-0 mt-0.5" strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-xl font-bold text-foreground tracking-tight">{fund.balance}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">Target: {fund.target}</span>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent Invoices</h2>
              <Link href="/facturacion" className="text-xs text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>

            {/* Desktop */}
            <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-2.5 border-b border-muted bg-background">
                <span className="col-span-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice</span>
                <span className="col-span-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</span>
                <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</span>
                <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Due</span>
                <span className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
              </div>
              {RECENT_INVOICES.map((inv, i) => {
                const s = INV_STATUS[inv.status];
                return (
                  <div key={inv.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-background transition-colors", i < RECENT_INVOICES.length - 1 && "border-b border-muted")}>
                    <Link href={`/facturacion/${inv.id}`} className="col-span-3 text-sm font-medium text-primary hover:text-primary/80 transition-colors">{inv.id}</Link>
                    <span className="col-span-3 text-sm text-foreground">{inv.client}</span>
                    <span className="col-span-2 text-sm font-medium text-foreground">{inv.amount}</span>
                    <span className="col-span-2 text-sm text-muted-foreground">{inv.due.split(",")[0]}</span>
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
                  <div key={inv.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <Link href={`/facturacion/${inv.id}`} className="text-sm font-semibold text-primary">{inv.id}</Link>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>{inv.status}</span>
                    </div>
                    <p className="text-sm text-foreground">{inv.client}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{inv.amount} · Due {inv.due}</p>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </main>

      <CopilotPanel defaultContext="Finance" />
    </div>
  );
}
