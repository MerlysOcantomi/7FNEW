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
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Mail,
  FolderKanban,
} from "lucide-react";

// ── Types & Data ──────────────────────────────────────────────────────────────

type ClientStatus = "Active" | "At Risk" | "Inactive";

interface Client {
  id: string;
  name: string;
  industry: string;
  status: ClientStatus;
  activeProjects: number;
  totalRevenue: string;
  lastActivity: string;
  lead: string;
  tags: string[];
}

const CLIENTS: Client[] = [
  {
    id: "c1",
    name: "Acme Corp",
    industry: "Manufacturing",
    status: "Active",
    activeProjects: 2,
    totalRevenue: "$580K",
    lastActivity: "Today",
    lead: "M. Torres",
    tags: ["Enterprise", "Q2 Priority"],
  },
  {
    id: "c2",
    name: "Nexus Holdings",
    industry: "Finance",
    status: "At Risk",
    activeProjects: 2,
    totalRevenue: "$690K",
    lastActivity: "Yesterday",
    lead: "A. Chen",
    tags: ["Enterprise", "Renewal Window"],
  },
  {
    id: "c3",
    name: "Vertex Capital",
    industry: "Investment",
    status: "Active",
    activeProjects: 1,
    totalRevenue: "$1.1M",
    lastActivity: "Feb 25, 2025",
    lead: "S. Patel",
    tags: ["Strategic"],
  },
  {
    id: "c4",
    name: "Blue Arc Group",
    industry: "Technology",
    status: "Active",
    activeProjects: 2,
    totalRevenue: "$820K",
    lastActivity: "Feb 27, 2025",
    lead: "R. Kim",
    tags: ["Enterprise", "Scope Change"],
  },
  {
    id: "c5",
    name: "Meridian Partners",
    industry: "Consulting",
    status: "Inactive",
    activeProjects: 0,
    totalRevenue: "$215K",
    lastActivity: "Jan 10, 2025",
    lead: "E. Davis",
    tags: [],
  },
];

const OVERVIEW = [
  { label: "Total Clients", value: "5", sub: "All accounts", icon: Users, color: "text-[#3B82F6]" },
  { label: "Active", value: "3", sub: "Currently engaged", icon: CheckCircle2, color: "text-[#22C55E]" },
  { label: "At Risk", value: "1", sub: "Requires attention", icon: AlertTriangle, color: "text-[#F59E0B]" },
  { label: "Inactive", value: "1", sub: "No active projects", icon: Clock, color: "text-[#94A3B8]" },
];

const STATUS_MAP: Record<ClientStatus, { bg: string; text: string }> = {
  Active:   { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  "At Risk":{ bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  Inactive: { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
};

// ── Row Actions Dropdown ──────────────────────────────────────────────────────

function RowActions({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#334155] transition-colors"
        aria-label="Client actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[170px]">
            {[
              { label: "View Client", icon: ArrowUpRight, href: `/clientes/${clientId}` },
              { label: "New Project", icon: FolderKanban, href: "/proyectos" },
              { label: "Draft Message", icon: Mail, href: "#" },
            ].map(({ label, icon: Icon, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors"
              >
                <Icon size={13} strokeWidth={1.75} className="text-[#94A3B8]" />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [statusOpen, setStatusOpen] = useState(false);

  const filtered = CLIENTS.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Flow</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Clients</h1>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto">
              <Plus size={14} strokeWidth={2} />
              New Client
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-7 space-y-8">

          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {OVERVIEW.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <Icon size={16} className={cn("mb-3", color)} strokeWidth={1.75} />
                <p className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#64748B]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients or industries..."
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
                  {["All", "Active", "At Risk", "Inactive"].map((opt) => (
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

          {/* Client List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">All Clients</h2>
              <span className="text-xs text-[#94A3B8]">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Desktop list */}
            <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <span className="col-span-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Industry</span>
                <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Projects</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Revenue</span>
                <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Last Activity</span>
                <span className="col-span-1" />
              </div>
              {filtered.map((c, i) => {
                const s = STATUS_MAP[c.status];
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors",
                      i < filtered.length - 1 && "border-b border-[#F1F5F9]"
                    )}
                  >
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#DBEAFE] flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-[#2563EB]">
                          {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <Link href={`/clientes/${c.id}`} className="text-sm font-medium text-[#0F172A] hover:text-[#3B82F6] transition-colors truncate block">
                          {c.name}
                        </Link>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                          {c.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[9px] font-medium px-1.5 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="col-span-2 text-sm text-[#64748B] truncate">{c.industry}</span>
                    <div className="col-span-1">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", s.bg, s.text)}>{c.status}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <FolderKanban size={13} className="text-[#94A3B8]" strokeWidth={1.75} />
                      <span className="text-sm text-[#334155]">{c.activeProjects} active</span>
                    </div>
                    <span className="col-span-2 text-sm font-medium text-[#0F172A]">{c.totalRevenue}</span>
                    <span className="col-span-1 text-xs text-[#64748B]">{c.lastActivity}</span>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="flex items-center gap-0.5 text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
                      >
                        View <ArrowUpRight size={11} />
                      </Link>
                      <RowActions clientId={c.id} />
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-[#64748B]">No clients match your search.</div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map((c) => {
                const s = STATUS_MAP[c.status];
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#DBEAFE] flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-[#2563EB]">
                            {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">{c.name}</p>
                          <p className="text-xs text-[#64748B]">{c.industry}</p>
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded shrink-0", s.bg, s.text)}>{c.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#F1F5F9]">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-[#64748B]">{c.activeProjects} project{c.activeProjects !== 1 ? "s" : ""}</span>
                        <span className="text-xs font-medium text-[#0F172A]">{c.totalRevenue}</span>
                        <span className="text-[10px] text-[#94A3B8]">Active {c.lastActivity}</span>
                      </div>
                      <Link
                        href={`/clientes/${c.id}`}
                        className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors shrink-0"
                      >
                        View <ArrowUpRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-[#64748B]">No clients match your search.</div>
              )}
            </div>
          </section>

        </div>
      </main>

      <CopilotPanel defaultContext="Clients" />
    </div>
  );
}
