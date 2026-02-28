"use client";

// Re-export from projects/page.tsx to keep data in one place.
// The /proyectos route is the canonical greenpalms route.

import { useState } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import {
  Search,
  ChevronDown,
  Plus,
  ArrowUpRight,
  X,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Zap,
  FileBarChart,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type StatusType = "On Track" | "At Risk" | "Delayed" | "Completed";
type Priority = "High" | "Medium" | "Low";

interface Project {
  id: string;
  name: string;
  client: string;
  status: StatusType;
  priority: Priority;
  progress: number;
  dueDate: string;
  phase: string;
  budget: string;
  lead: string;
}

const PROJECTS: Project[] = [
  { id: "p1", name: "Alpha Expansion", client: "Acme Corp", status: "On Track", priority: "High", progress: 60, dueDate: "Jun 30, 2025", phase: "Phase 3 / 5", budget: "$820K", lead: "M. Torres" },
  { id: "p2", name: "Beta Relaunch", client: "Nexus Holdings", status: "At Risk", priority: "High", progress: 45, dueDate: "May 15, 2025", phase: "Phase 2 / 4", budget: "$540K", lead: "A. Chen" },
  { id: "p3", name: "Delta Infrastructure", client: "Vertex Capital", status: "On Track", priority: "Medium", progress: 33, dueDate: "Aug 12, 2025", phase: "Phase 1 / 3", budget: "$1.1M", lead: "S. Patel" },
  { id: "p4", name: "Omega Platform", client: "Blue Arc Group", status: "Delayed", priority: "High", progress: 65, dueDate: "Apr 01, 2025", phase: "Phase 4 / 6", budget: "$730K", lead: "R. Kim" },
  { id: "p5", name: "Gamma Analytics", client: "Acme Corp", status: "Completed", priority: "Low", progress: 100, dueDate: "Feb 28, 2025", phase: "Phase 5 / 5", budget: "$310K", lead: "L. Nguyen" },
  { id: "p6", name: "Sigma Compliance", client: "Nexus Holdings", status: "On Track", priority: "Medium", progress: 20, dueDate: "Sep 30, 2025", phase: "Phase 1 / 4", budget: "$460K", lead: "E. Davis" },
];

const OVERVIEW_CARDS = [
  { label: "Active", value: "4", sub: "In progress", icon: Briefcase, color: "text-[#3B82F6]" },
  { label: "At Risk", value: "1", sub: "Needs attention", icon: AlertTriangle, color: "text-[#F59E0B]" },
  { label: "Delayed", value: "1", sub: "Past due date", icon: Clock, color: "text-[#EF4444]" },
  { label: "Completed", value: "1", sub: "This quarter", icon: CheckCircle2, color: "text-[#22C55E]" },
];

const STATUS_MAP: Record<StatusType, { bg: string; text: string }> = {
  "On Track":  { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  "At Risk":   { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  "Delayed":   { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  "Completed": { bg: "bg-[#F0FDF4]", text: "text-[#166534]" },
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: StatusType }) {
  const s = STATUS_MAP[status];
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold", s.bg, s.text)}>{status}</span>;
}

export default function ProyectosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);

  const filtered = PROJECTS.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    const matchPriority = priorityFilter === "All" || p.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Flow</p>
              <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Projects</h1>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto">
              <Plus size={14} strokeWidth={2} />
              New Project
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-5 md:px-8 py-6 sm:py-7 space-y-8">

          {/* Overview Cards */}
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3">
            {OVERVIEW_CARDS.map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                <Icon size={16} className={cn("mb-3", color)} strokeWidth={1.75} />
                <p className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</p>
                <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#64748B]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects or clients..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>
            {/* Status */}
            <div className="relative w-full lg:w-auto">
              <button onClick={() => { setStatusOpen(!statusOpen); setPriorityOpen(false); }} className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between">
                <span>{statusFilter === "All" ? "Status" : statusFilter}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", statusOpen && "rotate-180")} />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                  {["All", "On Track", "At Risk", "Delayed", "Completed"].map((opt) => (
                    <button key={opt} onClick={() => { setStatusFilter(opt); setStatusOpen(false); }} className={cn("w-full text-left px-4 py-2 text-sm transition-colors", statusFilter === opt ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
            {/* Priority */}
            <div className="relative w-full lg:w-auto">
              <button onClick={() => { setPriorityOpen(!priorityOpen); setStatusOpen(false); }} className="flex w-full lg:w-auto items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between">
                <span>{priorityFilter === "All" ? "Priority" : priorityFilter}</span>
                <ChevronDown size={14} className={cn("text-[#94A3B8] transition-transform", priorityOpen && "rotate-180")} />
              </button>
              {priorityOpen && (
                <div className="absolute top-full left-0 right-0 lg:right-auto mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                  {["All", "High", "Medium", "Low"].map((opt) => (
                    <button key={opt} onClick={() => { setPriorityFilter(opt); setPriorityOpen(false); }} className={cn("w-full text-left px-4 py-2 text-sm transition-colors", priorityFilter === opt ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]")}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Projects List */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-widest">All Projects</h2>
              <span className="text-xs text-[#94A3B8]">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Desktop list */}
            <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <span className="col-span-4 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Project</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Client</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</span>
                <span className="col-span-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Progress</span>
                <span className="col-span-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Due</span>
                <span className="col-span-1" />
              </div>
              {filtered.map((p, i) => (
                <div key={p.id} className={cn("grid grid-cols-12 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors", i < filtered.length - 1 && "border-b border-[#F1F5F9]")}>
                  <div className="col-span-4 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#64748B]">{p.phase}</p>
                  </div>
                  <span className="col-span-2 text-sm text-[#64748B] truncate">{p.client}</span>
                  <div className="col-span-2"><StatusBadge status={p.status} /></div>
                  <div className="col-span-2 pr-4">
                    <ProgressBar value={p.progress} />
                    <p className="text-[10px] text-[#94A3B8] mt-1">{p.progress}%</p>
                  </div>
                  <span className="col-span-1 text-xs text-[#64748B] whitespace-nowrap">{p.dueDate.split(",")[0]}</span>
                  <div className="col-span-1 flex justify-end">
                    <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors">
                      View <ArrowUpRight size={11} />
                    </Link>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-[#64748B]">No projects match your filters.</div>
              )}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{p.name}</p>
                      <p className="text-xs text-[#64748B]">{p.client} · {p.phase}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mb-3">
                    <ProgressBar value={p.progress} />
                    <p className="text-[10px] text-[#94A3B8] mt-1">{p.progress}% · Due {p.dueDate}</p>
                  </div>
                  <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1 text-xs text-[#3B82F6] font-medium hover:text-[#2563EB] transition-colors">
                    View Project <ArrowUpRight size={11} />
                  </Link>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-[#64748B]">No projects match your filters.</div>
              )}
            </div>
          </section>

        </div>
      </main>

      <CopilotPanel defaultContext="Projects" />
    </div>
  );
}
