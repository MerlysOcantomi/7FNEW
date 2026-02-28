"use client";

import { useState } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronDown,
  Plus,
  ArrowUpRight,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
} from "lucide-react";

// ── Types & Data ──────────────────────────────────────────────────────────────

type InvoiceStatus = "Paid" | "Pending" | "Overdue" | "Draft";

interface Invoice {
  id: string;
  client: string;
  project: string;
  amount: string;
  amountRaw: number;
  status: InvoiceStatus;
  issued: string;
  due: string;
}

const INVOICES: Invoice[] = [
  { id: "INV-0042", client: "Acme Corp", project: "Alpha Expansion", amount: "$48,000", amountRaw: 48000, status: "Paid", issued: "Feb 1, 2025", due: "Feb 15, 2025" },
  { id: "INV-0043", client: "Nexus Holdings", project: "Beta Relaunch", amount: "$32,500", amountRaw: 32500, status: "Pending", issued: "Feb 25, 2025", due: "Mar 10, 2025" },
  { id: "INV-0044", client: "Vertex Capital", project: "Delta Infrastructure", amount: "$75,000", amountRaw: 75000, status: "Overdue", issued: "Feb 10, 2025", due: "Feb 28, 2025" },
  { id: "INV-0045", client: "Blue Arc Group", project: "Omega Platform", amount: "$21,000", amountRaw: 21000, status: "Paid", issued: "Feb 18, 2025", due: "Mar 1, 2025" },
  { id: "INV-0046", client: "Acme Corp", project: "Alpha Expansion", amount: "$52,000", amountRaw: 52000, status: "Pending", issued: "Feb 27, 2025", due: "Mar 20, 2025" },
  { id: "INV-0047", client: "Nexus Holdings", project: "Sigma Compliance", amount: "$18,000", amountRaw: 18000, status: "Draft", issued: "—", due: "—" },
  { id: "INV-0041", client: "Blue Arc Group", project: "Omega Platform", amount: "$21,000", amountRaw: 21000, status: "Paid", issued: "Jan 15, 2025", due: "Feb 1, 2025" },
  { id: "INV-0040", client: "Vertex Capital", project: "Delta Infrastructure", amount: "$40,000", amountRaw: 40000, status: "Paid", issued: "Jan 10, 2025", due: "Jan 28, 2025" },
];

const STATUS_MAP: Record<InvoiceStatus, { bg: string; text: string }> = {
  Paid:    { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  Pending: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
  Overdue: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  Draft:   { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
};

const OVERVIEW = [
  {
    label: "Total Invoiced",
    value: "$307.5K",
    sub: "Last 90 days",
    icon: DollarSign,
    color: "text-[#3B82F6]",
  },
  {
    label: "Collected",
    value: "$200K",
    sub: "4 invoices paid",
    icon: CheckCircle2,
    color: "text-[#22C55E]",
  },
  {
    label: "Pending",
    value: "$84.5K",
    sub: "2 invoices pending",
    icon: Clock,
    color: "text-[#3B82F6]",
  },
  {
    label: "Overdue",
    value: "$75K",
    sub: "1 invoice — action needed",
    icon: AlertTriangle,
    color: "text-[#EF4444]",
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FacturacionPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [statusOpen, setStatusOpen] = useState(false);

  const filtered = INVOICES.filter((inv) => {
    const matchSearch =
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      inv.client.toLowerCase().includes(search.toLowerCase()) ||
      inv.project.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Funds</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/finanzas" className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors font-medium">Finance</Link>
              <span className="text-[#E2E8F0]">/</span>
              <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Invoicing</h1>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto">
              <Plus size={14} strokeWidth={2} />
              New Invoice
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-7 space-y-8">

          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {OVERVIEW.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <Icon size={16} className={cn("mb-3", color)} strokeWidth={1.75} />
                <p className="text-xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#64748B]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Overdue alert */}
          {INVOICES.some((i) => i.status === "Overdue") && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={15} className="text-[#DC2626] mt-0.5 shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold text-[#991B1B]">Overdue Invoice — Immediate Action Required</p>
                <p className="text-xs text-[#991B1B] mt-0.5">
                  INV-0044 from Vertex Capital ($75,000) was due Feb 28. Follow-up recommended before end of week.
                </p>
              </div>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoices, clients or projects..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between"
              >
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                  {["All", "Paid", "Pending", "Overdue", "Draft"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setStatusFilter(opt); setStatusOpen(false); }}
                      className={cn("w-full text-left px-4 py-2 text-sm transition-colors", statusFilter === opt ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Invoice List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">All Invoices</h2>
              <span className="text-xs text-[#94A3B8]">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Desktop list */}
            <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Invoice</span>
                <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Project</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Amount</span>
                <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Due</span>
                <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
                <span className="col-span-1" />
              </div>
              {filtered.map((inv, i) => {
                const s = STATUS_MAP[inv.status];
                return (
                  <div key={inv.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < filtered.length - 1 && "border-b border-[#F1F5F9]")}>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <FileText size={13} className="text-[#94A3B8]" strokeWidth={1.75} />
                      <Link href={`/facturacion/${inv.id}`} className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors">{inv.id}</Link>
                    </div>
                    <span className="col-span-3 text-sm text-[#334155] truncate">{inv.client}</span>
                    <span className="col-span-2 text-xs text-[#64748B] truncate">{inv.project}</span>
                    <span className="col-span-2 text-sm font-medium text-[#0F172A]">{inv.amount}</span>
                    <span className="col-span-1 text-xs text-[#64748B]">{inv.due === "—" ? "—" : inv.due.split(",")[0]}</span>
                    <span className={cn("col-span-1 text-[10px] font-semibold px-2 py-0.5 rounded w-fit", s.bg, s.text)}>{inv.status}</span>
                    <div className="col-span-1 flex justify-end">
                      <Link href={`/facturacion/${inv.id}`} className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors flex items-center gap-0.5">
                        View <ArrowUpRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-[#64748B]">No invoices match your search.</div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map((inv) => {
                const s = STATUS_MAP[inv.status];
                return (
                  <div key={inv.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <Link href={`/facturacion/${inv.id}`} className="text-sm font-semibold text-[#3B82F6]">{inv.id}</Link>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>{inv.status}</span>
                    </div>
                    <p className="text-sm font-medium text-[#0F172A]">{inv.amount}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{inv.client} · {inv.project}</p>
                    {inv.due !== "—" && <p className="text-[10px] text-[#94A3B8] mt-0.5">Due {inv.due}</p>}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-[#64748B]">No invoices match your search.</div>
              )}
            </div>
          </section>

        </div>
      </main>

      <CopilotPanel defaultContext="Funds" />
    </div>
  );
}
