"use client";

import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
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
  { name: "Growth Fund III", balance: "$640K", target: "$661K", deviation: "-3.2%", status: "warning" as const },
  { name: "Innovation Pool", balance: "$312K", target: "$300K", deviation: "+4.0%", status: "ok" as const },
  { name: "Seed Reserve", balance: "$180K", target: "$180K", deviation: "0%", status: "ok" as const },
  { name: "Liquidity Buffer", balance: "$95K", target: "$100K", deviation: "-5.0%", status: "warning" as const },
];

const RECENT_INVOICES = [
  { id: "INV-0042", client: "Acme Corp", amount: "$48,000", status: "Paid", due: "Feb 15, 2025" },
  { id: "INV-0043", client: "Nexus Holdings", amount: "$32,500", status: "Pending", due: "Mar 10, 2025" },
  { id: "INV-0044", client: "Vertex Capital", amount: "$75,000", status: "Overdue", due: "Feb 28, 2025" },
  { id: "INV-0045", client: "Blue Arc Group", amount: "$21,000", status: "Paid", due: "Mar 1, 2025" },
];

const INV_STATUS: Record<string, { bg: string; text: string }> = {
  Paid:     { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  Pending:  { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  Overdue:  { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
};

// ── Simple bar chart ──────────────────────────────────────────────────────────

function CashflowBar({ month, inflow, outflow, maxVal }: { month: string; inflow: number; outflow: number; maxVal: number }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className="w-full flex items-end justify-center gap-1" style={{ height: "80px" }}>
        <div
          className="flex-1 bg-[#3B82F6] rounded-t-sm"
          style={{ height: `${(inflow / maxVal) * 80}px` }}
          title={`Inflow: $${inflow}K`}
        />
        <div
          className="flex-1 bg-[#BFDBFE] rounded-t-sm"
          style={{ height: `${(outflow / maxVal) * 80}px` }}
          title={`Outflow: $${outflow}K`}
        />
      </div>
      <span className="text-[10px] text-[#94A3B8]">{month}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const maxVal = Math.max(...CASHFLOW.map((c) => Math.max(c.inflow, c.outflow)));
  const totalAR = 32500 + 75000; // pending + overdue
  const overdueCount = RECENT_INVOICES.filter((i) => i.status === "Overdue").length;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Funds</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Finance Overview</h1>
            <Link
              href="/facturacion"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors self-start sm:self-auto"
            >
              <FileText size={13} strokeWidth={1.75} />
              Invoicing
              <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>

        <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8">

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Revenue YTD", value: "$2.48M", delta: "+12% vs last year", trend: "up" as const, icon: DollarSign },
              { label: "AR Outstanding", value: `$${(totalAR / 1000).toFixed(0)}K`, delta: `${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""}`, trend: "down" as const, icon: FileText },
              { label: "Funds Under Mgmt", value: "$1.23M", delta: "4 active pools", trend: "up" as const, icon: BarChart3 },
              { label: "Burn vs Budget", value: "94%", delta: "On track for Q1", trend: "up" as const, icon: TrendingUp },
            ].map(({ label, value, delta, trend, icon: Icon }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Icon size={16} className="text-[#3B82F6]" strokeWidth={1.75} />
                  <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", trend === "up" ? "text-[#16A34A]" : "text-[#DC2626]")}>
                    {trend === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {delta}
                  </span>
                </div>
                <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Cashflow Snapshot ── */}
          <section>
            <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-4">Cashflow — Last 6 Months</h2>
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
              <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {CASHFLOW.map((c) => (
                  <CashflowBar key={c.month} {...c} maxVal={maxVal} />
                ))}
              </div>
              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
                  <span className="text-xs text-[#64748B]">Inflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#BFDBFE]" />
                  <span className="text-xs text-[#64748B]">Outflow</span>
                </div>
                <span className="ml-auto text-[10px] text-[#94A3B8]">Values in $K</span>
              </div>
            </div>
          </section>

          {/* ── Fund Status ── */}
          <section>
            <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-4">Fund Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FUNDS.map((fund) => (
                <div key={fund.name} className={cn("rounded-xl p-5 shadow-sm", fund.status === "warning" ? "bg-[#DBEAFE]" : "bg-[#EFF6FF]")}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-[#0F172A]">{fund.name}</p>
                    {fund.status === "warning" && (
                      <AlertTriangle size={14} className="text-[#F59E0B] shrink-0 mt-0.5" strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-xl font-bold text-[#0F172A] tracking-tight">{fund.balance}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-[#64748B]">Target: {fund.target}</span>
                    <span className={cn("text-xs font-semibold", fund.deviation.startsWith("-") ? "text-[#DC2626]" : "text-[#16A34A]")}>
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
              <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">Recent Invoices</h2>
              <Link href="/facturacion" className="text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors flex items-center gap-1">
                View all <ArrowUpRight size={11} />
              </Link>
            </div>

            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Invoice</span>
                <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Amount</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Due</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
              </div>
              {RECENT_INVOICES.map((inv, i) => {
                const s = INV_STATUS[inv.status];
                return (
                  <div key={inv.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < RECENT_INVOICES.length - 1 && "border-b border-[#F1F5F9]")}>
                    <Link href={`/facturacion/${inv.id}`} className="col-span-3 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors">{inv.id}</Link>
                    <span className="col-span-3 text-sm text-[#334155]">{inv.client}</span>
                    <span className="col-span-2 text-sm font-medium text-[#0F172A]">{inv.amount}</span>
                    <span className="col-span-2 text-sm text-[#64748B]">{inv.due.split(",")[0]}</span>
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
                  <div key={inv.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <Link href={`/facturacion/${inv.id}`} className="text-sm font-semibold text-[#3B82F6]">{inv.id}</Link>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>{inv.status}</span>
                    </div>
                    <p className="text-sm text-[#334155]">{inv.client}</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{inv.amount} · Due {inv.due}</p>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </main>

      <CopilotPanel defaultContext="Funds" />
    </div>
  );
}
