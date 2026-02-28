"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TabItem {
  key: string;
  label: string;
}

export interface ContextShellProps {
  // Navigation
  breadcrumbs: BreadcrumbItem[];
  // Entity header
  heading: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  // Tabs
  tabs: TabItem[];
  defaultTab?: string;
  // Content renderer: receives the active tab key
  children: (activeTab: string) => React.ReactNode;
  // Copilot
  copilotContext?: string;
}

// ── ContextShell ──────────────────────────────────────────────────────────────

export function ContextShell({
  breadcrumbs,
  heading,
  meta,
  actions,
  tabs,
  defaultTab,
  children,
  copilotContext,
}: ContextShellProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? "");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        <div className="flex flex-col md:flex-row min-h-screen bg-[#F8FAFC] font-sans overflow-x-hidden">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">

            {/* ── Sticky Shell Header ── */}
            <div className="sticky top-0 z-20 bg-[#F8FAFC]/95 backdrop-blur-sm border-b border-[#E2E8F0]">

              {/* Breadcrumb + entity header */}
              <div className="px-5 md:px-8 pt-5 pb-4">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 mb-4 flex-wrap" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight size={11} className="text-[#CBD5E1] shrink-0" />}
                      {crumb.href ? (
                        <Link
                          href={crumb.href}
                          className="text-xs text-[#64748B] hover:text-[#0F172A] transition-colors font-medium"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-xs text-[#0F172A] font-semibold truncate max-w-[180px]">
                          {crumb.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>

                {/* Heading + actions */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {heading}
                    {meta && <div className="mt-1.5">{meta}</div>}
                  </div>
                  {actions && (
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {actions}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs — scrollable on mobile */}
              <div className="px-5 md:px-8 overflow-x-auto scrollbar-none">
                <div className="flex items-end gap-0 min-w-max border-b-0">
                  {tabs.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          "relative px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
                          isActive
                            ? "text-[#2563EB] border-[#3B82F6]"
                            : "text-[#94A3B8] border-transparent hover:text-[#334155] hover:border-[#CBD5E1]"
                        )}
                        style={
                          isActive
                            ? { boxShadow: "0 1px 0 0 #3B82F6" }
                            : {}
                        }
                        aria-current={isActive ? "page" : undefined}
                      >
                        {tab.label}
                        {isActive && (
                          <span
                            className="absolute bottom-0 left-0 right-0 h-px bg-[#3B82F6] rounded-t"
                            style={{ boxShadow: "0 0 6px 0 rgba(59,130,246,0.35)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 px-4 sm:px-5 md:px-8 py-6 sm:py-7">
              {children(activeTab)}
            </div>
          </main>

          <CopilotPanel defaultContext={copilotContext} />
        </div>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
