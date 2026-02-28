"use client";

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
  Building2,
  TrendingUp,
  Zap,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

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
  description: string;
  keyMetrics: { label: string; value: string }[];
}

// ── Data ───────────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Alpha Expansion",
    client: "Acme Corp",
    status: "On Track",
    priority: "High",
    progress: 60,
    dueDate: "Jun 30, 2025",
    phase: "Phase 3 / 5",
    budget: "$820K",
    lead: "M. Torres",
    description:
      "Full-scale operational expansion into three new regional markets. Includes infrastructure buildout, team onboarding, and client integration milestones.",
    keyMetrics: [
      { label: "Budget Used", value: "62%" },
      { label: "Tasks Complete", value: "34 / 56" },
      { label: "Open Risks", value: "2" },
      { label: "Days Remaining", value: "47" },
    ],
  },
  {
    id: "p2",
    name: "Beta Relaunch",
    client: "Nexus Holdings",
    status: "At Risk",
    priority: "High",
    progress: 45,
    dueDate: "May 15, 2025",
    phase: "Phase 2 / 4",
    budget: "$540K",
    lead: "A. Chen",
    description:
      "Product relaunch initiative targeting enterprise segment re-engagement. Delayed by dependency on vendor confirmation for key deliverables.",
    keyMetrics: [
      { label: "Budget Used", value: "51%" },
      { label: "Tasks Complete", value: "18 / 40" },
      { label: "Open Risks", value: "4" },
      { label: "Days Remaining", value: "19" },
    ],
  },
  {
    id: "p3",
    name: "Delta Infrastructure",
    client: "Vertex Capital",
    status: "On Track",
    priority: "Medium",
    progress: 33,
    dueDate: "Aug 12, 2025",
    phase: "Phase 1 / 3",
    budget: "$1.1M",
    lead: "S. Patel",
    description:
      "Long-form infrastructure modernization program covering data center migration and platform consolidation across four business units.",
    keyMetrics: [
      { label: "Budget Used", value: "29%" },
      { label: "Tasks Complete", value: "12 / 36" },
      { label: "Open Risks", value: "1" },
      { label: "Days Remaining", value: "128" },
    ],
  },
  {
    id: "p4",
    name: "Omega Platform",
    client: "Blue Arc Group",
    status: "Delayed",
    priority: "High",
    progress: 65,
    dueDate: "Apr 01, 2025",
    phase: "Phase 4 / 6",
    budget: "$730K",
    lead: "R. Kim",
    description:
      "SaaS platform delivery for Blue Arc's internal operations suite. Scope changes introduced in Phase 3 have pushed the timeline by 3 weeks.",
    keyMetrics: [
      { label: "Budget Used", value: "78%" },
      { label: "Tasks Complete", value: "39 / 60" },
      { label: "Open Risks", value: "3" },
      { label: "Days Remaining", value: "-8" },
    ],
  },
  {
    id: "p5",
    name: "Gamma Analytics",
    client: "Acme Corp",
    status: "Completed",
    priority: "Low",
    progress: 100,
    dueDate: "Feb 28, 2025",
    phase: "Phase 5 / 5",
    budget: "$310K",
    lead: "L. Nguyen",
    description:
      "Analytics dashboard and reporting pipeline delivered on schedule. All milestones met and client signed off on final deliverable.",
    keyMetrics: [
      { label: "Budget Used", value: "94%" },
      { label: "Tasks Complete", value: "44 / 44" },
      { label: "Open Risks", value: "0" },
      { label: "Days Remaining", value: "—" },
    ],
  },
  {
    id: "p6",
    name: "Sigma Compliance",
    client: "Nexus Holdings",
    status: "On Track",
    priority: "Medium",
    progress: 20,
    dueDate: "Sep 30, 2025",
    phase: "Phase 1 / 4",
    budget: "$460K",
    lead: "E. Davis",
    description:
      "Regulatory compliance overhaul to align with updated industry standards. Early phase assessment and documentation currently underway.",
    keyMetrics: [
      { label: "Budget Used", value: "18%" },
      { label: "Tasks Complete", value: "6 / 32" },
      { label: "Open Risks", value: "0" },
      { label: "Days Remaining", value: "183" },
    ],
  },
];

const OVERVIEW_CARDS = [
  {
    label: "Active Projects",
    value: "4",
    sub: "Currently in progress",
    icon: Briefcase,
    color: "text-[#3B82F6]",
  },
  {
    label: "At Risk",
    value: "1",
    sub: "Needs attention",
    icon: AlertTriangle,
    color: "text-[#F59E0B]",
  },
  {
    label: "Delayed",
    value: "1",
    sub: "Past due date",
    icon: Clock,
    color: "text-[#EF4444]",
  },
  {
    label: "Completed",
    value: "1",
    sub: "This quarter",
    icon: CheckCircle2,
    color: "text-[#22C55E]",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

const STATUS_MAP: Record<StatusType, { bg: string; text: string; label: string }> = {
  "On Track": { bg: "bg-[#DCFCE7]", text: "text-[#166534]", label: "On Track" },
  "At Risk": { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]", label: "At Risk" },
  "Delayed": { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", label: "Delayed" },
  "Completed": { bg: "bg-[#F0FDF4]", text: "text-[#166534]", label: "Completed" },
};

const PRIORITY_MAP: Record<Priority, { text: string }> = {
  High: { text: "text-[#1D4ED8]" },
  Medium: { text: "text-[#64748B]" },
  Low: { text: "text-[#94A3B8]" },
};

function StatusBadge({ status }: { status: StatusType }) {
  const s = STATUS_MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold",
        s.bg,
        s.text
      )}
    >
      {s.label}
    </span>
  );
}

// ── Project Detail Drawer ──────────────────────────────────────────────────

function ProjectDrawer({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  if (!project) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white border-l border-[#E2E8F0] flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
              Project Detail
            </p>
            <h2 className="text-lg font-semibold text-[#0F172A] tracking-tight text-balance">
              {project.name}
            </h2>
            <p className="text-sm text-[#64748B] mt-0.5">{project.client}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] transition-colors mt-0.5 p-1"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status row */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center gap-3 flex-wrap shrink-0">
          <StatusBadge status={project.status} />
          <span
            className={cn(
              "text-xs font-medium",
              PRIORITY_MAP[project.priority].text
            )}
          >
            {project.priority} Priority
          </span>
          <span className="text-xs text-[#64748B]">{project.phase}</span>
          <span className="text-xs text-[#94A3B8] flex items-center gap-1 ml-auto">
            <Calendar size={11} />
            {project.dueDate}
          </span>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#0F172A]">Progress</span>
            <span className="text-xs font-semibold text-[#3B82F6]">
              {project.progress}%
            </span>
          </div>
          <ProgressBar value={project.progress} />
        </div>

        {/* Description */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
            Overview
          </h3>
          <p className="text-sm text-[#334155] leading-relaxed">
            {project.description}
          </p>
        </div>

        {/* Key metrics */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            Key Metrics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {project.keyMetrics.map(({ label, value }) => (
              <div key={label} className="bg-[#EFF6FF] rounded-lg p-3">
                <p className="text-lg font-bold text-[#0F172A] tracking-tight">
                  {value}
                </p>
                <p className="text-[10px] text-[#64748B] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            Details
          </h3>
          <dl className="space-y-2">
            {[
              { label: "Project Lead", value: project.lead },
              { label: "Budget", value: project.budget },
              { label: "Client", value: project.client },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-xs text-[#94A3B8]">{label}</dt>
                <dd className="text-xs font-medium text-[#0F172A]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-4 shrink-0">
          <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Generate Report", icon: FileBarChart },
              { label: "Analyze Risks", icon: TrendingUp },
              { label: "Accelerate", icon: Zap },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-medium hover:bg-[#1E293B] transition-colors"
              >
                <Icon size={12} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<string>("All");
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filtered = PROJECTS.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    const matchPriority = priorityFilter === "All" || p.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Page Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
                Portfolio
              </p>
              <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">
                Projects
              </h1>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-medium hover:bg-[#1E293B] transition-colors shadow-sm self-start sm:self-auto">
              <Plus size={14} strokeWidth={2} />
              New Project
            </button>
          </div>
        </div>

        <div className="px-5 md:px-8 py-7 space-y-8">
          {/* ── Overview Cards ── */}
          <section>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {OVERVIEW_CARDS.map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="bg-[#EFF6FF] rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <Icon size={16} className={color} strokeWidth={1.75} />
                  </div>
                  <p className="text-2xl font-bold text-[#0F172A] tracking-tight">
                    {value}
                  </p>
                  <p className="text-xs font-medium text-[#0F172A] mt-0.5">{label}</p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Search & Filters ── */}
          <section>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects or clients..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setStatusOpen(!statusOpen);
                    setPriorityOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between"
                >
                  <span>
                    {statusFilter === "All" ? "Status" : statusFilter}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-[#94A3B8] transition-transform",
                      statusOpen && "rotate-180"
                    )}
                  />
                </button>
                {statusOpen && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                    {["All", "On Track", "At Risk", "Delayed", "Completed"].map(
                      (opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setStatusFilter(opt);
                            setStatusOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm transition-colors",
                            statusFilter === opt
                              ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                              : "text-[#334155] hover:bg-[#F8FAFC]"
                          )}
                        >
                          {opt}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Priority Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setPriorityOpen(!priorityOpen);
                    setStatusOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[130px] justify-between"
                >
                  <span>
                    {priorityFilter === "All" ? "Priority" : priorityFilter}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-[#94A3B8] transition-transform",
                      priorityOpen && "rotate-180"
                    )}
                  />
                </button>
                {priorityOpen && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                    {["All", "High", "Medium", "Low"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setPriorityFilter(opt);
                          setPriorityOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm transition-colors",
                          priorityFilter === opt
                            ? "bg-[#EFF6FF] text-[#2563EB] font-medium"
                            : "text-[#334155] hover:bg-[#F8FAFC]"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Projects List ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">
                All Projects
              </h2>
              <span className="text-xs text-[#94A3B8]">
                {filtered.length} project{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Desktop / Tablet: structured list */}
            <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              {/* Table head */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Project</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden lg:block w-28">Client</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-20">Status</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden md:block w-28">Progress</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden lg:block w-24">Due Date</span>
                <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-16 text-right">Action</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#F1F5F9]">
                {filtered.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">
                    No projects match your filters.
                  </div>
                ) : (
                  filtered.map((project) => (
                    <div
                      key={project.id}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => setSelectedProject(project)}
                    >
                      {/* Project name + phase */}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">
                          {project.name}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">
                          {project.phase}
                        </p>
                      </div>
                      {/* Client */}
                      <div className="hidden lg:flex items-center gap-1.5 w-28">
                        <Building2 size={11} className="text-[#94A3B8] shrink-0" />
                        <span className="text-xs text-[#64748B] truncate">
                          {project.client}
                        </span>
                      </div>
                      {/* Status */}
                      <div className="w-20">
                        <StatusBadge status={project.status} />
                      </div>
                      {/* Progress */}
                      <div className="hidden md:block w-28">
                        <ProgressBar value={project.progress} />
                        <p className="text-[10px] text-[#94A3B8] mt-1 text-right">
                          {project.progress}%
                        </p>
                      </div>
                      {/* Due date */}
                      <div className="hidden lg:flex items-center gap-1 w-24">
                        <Calendar size={11} className="text-[#94A3B8] shrink-0" />
                        <span className="text-xs text-[#64748B]">
                          {project.dueDate}
                        </span>
                      </div>
                      {/* Action */}
                      <div className="w-16 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(project);
                          }}
                          className="p-1.5 rounded-md text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors"
                          aria-label={`View ${project.name}`}
                        >
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mobile: stacked cards */}
            <div className="sm:hidden space-y-3">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[#94A3B8] py-10">
                  No projects match your filters.
                </p>
              ) : (
                filtered.map((project) => (
                  <div
                    key={project.id}
                    className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {project.name}
                        </p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {project.client}
                        </p>
                      </div>
                      <StatusBadge status={project.status} />
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-[#94A3B8]">
                          {project.phase}
                        </span>
                        <span className="text-[10px] font-medium text-[#3B82F6]">
                          {project.progress}%
                        </span>
                      </div>
                      <ProgressBar value={project.progress} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                        <Calendar size={10} />
                        {project.dueDate}
                      </div>
                      <button
                        onClick={() => setSelectedProject(project)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-[#3B82F6] hover:bg-[#EFF6FF] border border-[#BFDBFE] transition-colors"
                      >
                        View Project
                        <ArrowUpRight size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Copilot Panel */}
      <CopilotPanel defaultContext="Projects" />

      {/* Project Detail Drawer */}
      <ProjectDrawer
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
