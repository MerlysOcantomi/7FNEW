"use client";

import { useState } from "react";
import { SidebarNav, MobileSidebarNav } from "@/components/sidebar-nav";
import { CopilotPanel } from "@/components/copilot-panel";
import {
  Search,
  CheckSquare,
  FolderKanban,
  Sparkles,
  Reply,
  Tag,
  MoreHorizontal,
  Paperclip,
  Mail,
  MessageSquare,
  Bell,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type InboxSource = "Email" | "System" | "Client" | "Internal";
type InboxClass = "Action Required" | "FYI" | "Risk" | "Opportunity" | "Update";

interface InboxEntry {
  id: string;
  source: InboxSource;
  subject: string;
  preview: string;
  from: string;
  time: string;
  group: "Today" | "This Week" | "Older";
  classification: InboxClass;
  unread: boolean;
  hasAttachment?: boolean;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const ENTRIES: InboxEntry[] = [
  {
    id: "i1",
    source: "Client",
    subject: "Phase 3 Sign-Off — Alpha Expansion",
    preview: "Acme Corp has reviewed the Phase 3 deliverables and is requesting a call before formal sign-off. Two clarifications pending on infrastructure scope.",
    from: "J. Mitchell — Acme Corp",
    time: "09:42",
    group: "Today",
    classification: "Action Required",
    unread: true,
  },
  {
    id: "i2",
    source: "System",
    subject: "Risk Alert: Beta Relaunch — Vendor Delay",
    preview: "Two tier-2 vendors have not confirmed milestone commitments. Estimated impact: 8–12 day delay on Phase 2 delivery.",
    from: "7F Risk Monitor",
    time: "08:15",
    group: "Today",
    classification: "Risk",
    unread: true,
  },
  {
    id: "i3",
    source: "Internal",
    subject: "Q2 Budget Review — Funds Module",
    preview: "Finance team has uploaded the Q2 budget variance report. Growth Fund III shows a 3.2% deviation. Review recommended before Thursday.",
    from: "E. Davis — Finance",
    time: "Yesterday",
    group: "Today",
    classification: "Action Required",
    unread: false,
    hasAttachment: true,
  },
  {
    id: "i4",
    source: "Email",
    subject: "Enterprise Outreach — Partner Summit Proposal",
    preview: "Blue Arc Group has submitted a partnership summit proposal for Q2. Estimated revenue opportunity of $180K if accepted by March 15.",
    from: "K. Walsh — Blue Arc Group",
    time: "Mon",
    group: "This Week",
    classification: "Opportunity",
    unread: true,
  },
  {
    id: "i5",
    source: "Client",
    subject: "Omega Platform — Scope Change Request",
    preview: "Blue Arc's CTO is requesting a formal scope extension for the reporting module. Change order documentation attached for review.",
    from: "T. Brooks — Blue Arc Group",
    time: "Mon",
    group: "This Week",
    classification: "Action Required",
    unread: false,
    hasAttachment: true,
  },
  {
    id: "i6",
    source: "System",
    subject: "Weekly Portfolio Summary — Week 8",
    preview: "Your weekly intelligence summary is ready. 12 active projects, 3 risks flagged, 2 renewal opportunities, 1 fund deviation tracked.",
    from: "7F Intelligence Engine",
    time: "Sun",
    group: "This Week",
    classification: "FYI",
    unread: false,
  },
  {
    id: "i7",
    source: "Internal",
    subject: "Delta Infrastructure — Phase 1 Completion Report",
    preview: "Phase 1 milestone completed on schedule. Documentation package submitted by S. Patel. Client has been notified.",
    from: "S. Patel — Operations",
    time: "Feb 21",
    group: "This Week",
    classification: "Update",
    unread: false,
  },
  {
    id: "i8",
    source: "Email",
    subject: "Renewal Notice — Nexus Holdings (ARR $240K)",
    preview: "Nexus Holdings contract enters the 30-day renewal window. Decision point by March 28. Account history and usage data attached.",
    from: "CRM System",
    time: "Feb 19",
    group: "Older",
    classification: "Action Required",
    unread: false,
    hasAttachment: true,
  },
  {
    id: "i9",
    source: "System",
    subject: "Gamma Analytics — Final Delivery Confirmed",
    preview: "Client sign-off received. Project closed successfully. All deliverables archived in the Files module.",
    from: "7F Project Engine",
    time: "Feb 18",
    group: "Older",
    classification: "FYI",
    unread: false,
  },
];

// ── Classification badge config ───────────────────────────────────────────────

const CLASS_MAP: Record<InboxClass, { bg: string; text: string }> = {
  "Action Required": { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  "Risk":            { bg: "bg-[#FEF9C3]", text: "text-[#854D0E]" },
  "Opportunity":     { bg: "bg-[#DCFCE7]", text: "text-[#166534]" },
  "FYI":             { bg: "bg-[#F1F5F9]", text: "text-[#64748B]" },
  "Update":          { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]" },
};

const SOURCE_ICON: Record<InboxSource, React.ElementType> = {
  Email: Mail,
  System: Bell,
  Client: MessageSquare,
  Internal: MessageSquare,
};

const SOURCE_COLOR: Record<InboxSource, string> = {
  Email:    "text-[#3B82F6]",
  System:   "text-[#F59E0B]",
  Client:   "text-[#10B981]",
  Internal: "text-[#94A3B8]",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ClassBadge({ cls }: { cls: InboxClass }) {
  const { bg, text } = CLASS_MAP[cls];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap", bg, text)}>
      {cls}
    </span>
  );
}

function QuickActions({ entry, onAction }: { entry: InboxEntry; onAction: (label: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[
        { label: "Convert to Task", icon: CheckSquare },
        { label: "Attach to Project", icon: FolderKanban },
        { label: "Summarize", icon: Sparkles },
        { label: "Reply Draft", icon: Reply },
      ].map(({ label, icon: Icon }) => (
        <button
          key={label}
          onClick={(e) => { e.stopPropagation(); onAction(label); }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0F172A] text-white text-[10px] font-medium hover:bg-[#1E293B] transition-colors"
        >
          <Icon size={10} strokeWidth={2} />
          {label}
        </button>
      ))}
    </div>
  );
}

// Desktop row
function EntryRow({
  entry,
  selected,
  onSelect,
  onAction,
}: {
  entry: InboxEntry;
  selected: boolean;
  onSelect: () => void;
  onAction: (label: string) => void;
}) {
  const SourceIcon = SOURCE_ICON[entry.source];
  return (
    <div
      onClick={onSelect}
      className={cn(
        "px-5 py-4 flex items-start gap-4 cursor-pointer border-b border-[#F1F5F9] transition-colors group",
        selected
          ? "bg-[#EFF6FF] shadow-[inset_0_0_0_1px_#BFDBFE]"
          : entry.unread
          ? "bg-white hover:bg-[#F8FAFC]"
          : "bg-[#FAFBFC] hover:bg-[#F8FAFC]"
      )}
    >
      {/* Source icon */}
      <div className="mt-0.5 shrink-0">
        <SourceIcon size={15} strokeWidth={1.75} className={SOURCE_COLOR[entry.source]} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {entry.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0" />}
              <p className={cn("text-sm truncate", entry.unread ? "font-semibold text-[#0F172A]" : "font-medium text-[#334155]")}>
                {entry.subject}
              </p>
            </div>
            <p className="text-xs text-[#64748B]">{entry.from}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {entry.hasAttachment && <Paperclip size={11} className="text-[#94A3B8]" />}
            <ClassBadge cls={entry.classification} />
            <span className="text-[10px] text-[#94A3B8]">{entry.time}</span>
          </div>
        </div>
        <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2">{entry.preview}</p>

        {/* Quick actions on expand/select */}
        {selected && (
          <div className="mt-3">
            <QuickActions entry={entry} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  );
}

// Mobile card
function EntryCard({
  entry,
  selected,
  onSelect,
  onAction,
}: {
  entry: InboxEntry;
  selected: boolean;
  onSelect: () => void;
  onAction: (label: string) => void;
}) {
  const SourceIcon = SOURCE_ICON[entry.source];
  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-xl p-4 border transition-colors cursor-pointer",
        selected
          ? "bg-[#EFF6FF] border-[#BFDBFE]"
          : "bg-white border-[#E2E8F0] hover:border-[#BFDBFE]"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {entry.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] shrink-0" />}
          <SourceIcon size={13} strokeWidth={1.75} className={cn("shrink-0", SOURCE_COLOR[entry.source])} />
          <p className={cn("text-sm truncate", entry.unread ? "font-semibold text-[#0F172A]" : "font-medium text-[#334155]")}>
            {entry.subject}
          </p>
        </div>
        <span className="text-[10px] text-[#94A3B8] shrink-0">{entry.time}</span>
      </div>
      <p className="text-xs text-[#64748B] mb-2">{entry.from}</p>
      <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2 mb-3">{entry.preview}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ClassBadge cls={entry.classification} />
        {entry.hasAttachment && <Paperclip size={11} className="text-[#94A3B8]" />}
      </div>
      {selected && (
        <div className="mt-3 pt-3 border-t border-[#DBEAFE]">
          <QuickActions entry={entry} onAction={onAction} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const GROUPS = ["Today", "This Week", "Older"] as const;

export default function InboxPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>("All");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = ENTRIES.filter((e) => {
    const matchSearch =
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.from.toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === "All" || e.classification === classFilter;
    return matchSearch && matchClass;
  });

  const unreadCount = ENTRIES.filter((e) => e.unread).length;

  const handleAction = (label: string) => {
    // placeholder: action acknowledged
  };

  const handleSelect = (id: string) => {
    setSelected((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
      <SidebarNav />
      <MobileSidebarNav />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 md:px-8 pt-7 pb-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">Flow</p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight">Inbox</h1>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-[10px] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 space-y-6">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inbox..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#334155] hover:border-[#3B82F6] transition-colors min-w-[140px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <Filter size={13} className="text-[#94A3B8]" />
                  <span>{classFilter === "All" ? "Classification" : classFilter}</span>
                </div>
              </button>
              {filterOpen && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#E2E8F0] rounded-lg shadow-lg overflow-hidden min-w-[180px]">
                  {["All", "Action Required", "Risk", "Opportunity", "FYI", "Update"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setClassFilter(opt); setFilterOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm transition-colors",
                        classFilter === opt ? "bg-[#EFF6FF] text-[#2563EB] font-medium" : "text-[#334155] hover:bg-[#F8FAFC]"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grouped entries */}
          <div className="space-y-8">
            {GROUPS.map((group) => {
              const groupEntries = filtered.filter((e) => e.group === group);
              if (groupEntries.length === 0) return null;
              return (
                <section key={group}>
                  <h2 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-3">{group}</h2>

                  {/* Desktop list */}
                  <div className="hidden sm:block bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    {groupEntries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        selected={selected === entry.id}
                        onSelect={() => handleSelect(entry.id)}
                        onAction={handleAction}
                      />
                    ))}
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-3">
                    {groupEntries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        selected={selected === entry.id}
                        onSelect={() => handleSelect(entry.id)}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-[#64748B]">No inbox items match your search.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <CopilotPanel defaultContext="Clients" />
    </div>
  );
}
