"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { SidebarNav, MobileSidebarNav, SidebarCollapseContext } from "@/components/sidebar-nav";
import { CopilotPanel, CopilotCollapseContext } from "@/components/copilot-panel";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useGlobalSearch } from "@/components/global-search-provider";
import { NotificationsBell } from "@/components/notifications-bell";
import { GlobalNewDesktopChrome } from "@/components/global-new/global-new-desktop-panel";
import { GlobalNewTriggerDesktop } from "@/components/global-new/global-new-trigger";
import { useGlobalNew } from "@/components/global-new/use-global-new";
import { TodayDrawerProvider, useTodayDrawer } from "@/components/today/today-drawer-provider";
import { GlobalTodayChrome } from "@/components/today/global-today-chrome";
import { GlobalTodayTriggerDesktop } from "@/components/today/global-today-trigger";
import { GlobalTodayDesktopChrome } from "@/components/today/global-today-desktop-chrome";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TabItem {
  key: string;
  label: string;
}

export interface ContextShellProps {
  breadcrumbs: BreadcrumbItem[];
  heading: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs: TabItem[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
  copilotContext?: string;
}

/**
 * Top desktop chrome of `ContextShell`.
 *
 * Lives inside `<TodayDrawerProvider>` (mounted by `ContextShell` below)
 * so it can read both `useGlobalNew()` and `useTodayDrawer()` to drive
 * the toolbar bottom-border highlight when EITHER panel is open.
 *
 * Mounts the New + Today desktop panels as siblings inside the same
 * `sticky top-0` container — both grow DOWN from the toolbar. The
 * legacy bottom-chrome mount inside `<main>` has been retired so Today
 * is no longer architecturally inverted from New on desktop.
 */
function ContextShellDesktopToolbar() {
  const { openSearch } = useGlobalSearch();
  const { desktopOpen } = useGlobalNew();
  const { open: todayOpen } = useTodayDrawer();
  const eitherOpen = desktopOpen || todayOpen;
  /**
   * Mirrors AppShell's `hideTodayTrigger`: ContextShell currently never lives
   * under `/today`, but if a future operator routes a Today subview through
   * ContextShell the toolbar trigger automatically disappears there — so we
   * never end up with a "Today" button pointing back at the canonical Today.
   */
  const pathname = usePathname();
  const hideTodayTrigger = pathname === "/today" || pathname.startsWith("/today/");

  return (
    <>
      <GlobalNewDesktopChrome variant="context">
        <div
          className={cn(
            "flex shrink-0 items-center justify-end gap-2 border-b bg-[#F8FAFC] px-5 py-2.5 transition-colors md:px-8",
            eitherOpen ? "border-[#CBD5E1]" : "border-transparent",
          )}
        >
          {/*
            Today first, New second — same global action order as AppShell so
            the operator never has to relearn the toolbar between detail and
            workspace routes.
          */}
          {!hideTodayTrigger && <GlobalTodayTriggerDesktop variant="context" />}
          <GlobalNewTriggerDesktop variant="context" />
          <button
            type="button"
            onClick={openSearch}
            className="hidden cursor-pointer items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#64748B] shadow-sm transition-colors hover:bg-[#F1F5F9] sm:flex"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="w-32 text-left lg:w-48">Search...</span>
            <kbd className="ml-auto rounded border border-[#E2E8F0] px-1 py-0.5 font-mono text-[10px] text-[#94A3B8]">
              Ctrl+K
            </kbd>
          </button>
          <NotificationsBell />
        </div>
      </GlobalNewDesktopChrome>
      {/*
        Today desktop chrome — sibling of `GlobalNewDesktopChrome` inside
        the same sticky-top container. Panel hangs from the toolbar and
        grows DOWN, identical recipe to the New panel. The previous
        sticky-bottom mount inside `<main>` has been retired.
      */}
      <GlobalTodayDesktopChrome variant="context" />
    </>
  );
}

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
  /**
   * Defensive parity with `AppShell`: ContextShell is currently only used by
   * detail routes (`/clientes/[id]`, `/proyectos/[id]`, `/facturacion/[id]`),
   * none of which live under `/today`, so this guard is a no-op today. It
   * exists so a future operator can route `/today/*` through ContextShell
   * without having to remember to hide the Today surfaces.
   */
  const pathname = usePathname();
  const hideTodaySurfaces = pathname === "/today" || pathname.startsWith("/today/");

  return (
    <SidebarCollapseContext.Provider value={{ collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed }}>
      <CopilotCollapseContext.Provider value={{ copilotCollapsed, setCopilotCollapsed }}>
        {/*
          Today drawer state is scoped to THIS shell instance via its own
          provider. AppShell does the same on its side — at runtime only one
          shell renders, so each provider owns its own boolean and no
          duplicate launcher can land in the same tree.
        */}
        <TodayDrawerProvider>
        {/* Viewport-locked shell — same geometry as AppShell (see docs/app-shell-contract.md) */}
        <div className="fixed inset-0 z-0 flex min-h-0 flex-col overflow-hidden bg-[#F8FAFC] font-sans md:flex-row">
          <SidebarNav />
          <MobileSidebarNav />

          <main className="flex max-h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain">
            <div className="sticky top-0 z-30">
              <div className="hidden md:block bg-[#F8FAFC]">
                <ContextShellDesktopToolbar />
              </div>

              <div className="border-b border-[#E2E8F0] bg-[#F8FAFC]/95 backdrop-blur-sm">
              <div className="px-5 pb-4 pt-5 md:px-8">
                <nav className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Breadcrumb">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight size={11} className="shrink-0 text-[#CBD5E1]" />}
                      {crumb.href ? (
                        <Link
                          href={crumb.href}
                          className="text-xs font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="max-w-[180px] truncate text-xs font-semibold text-[#0F172A]">
                          {crumb.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>

                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    {heading}
                    {meta && <div className="mt-1.5">{meta}</div>}
                  </div>
                  {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
                  )}
                </div>
              </div>

              <div className="scrollbar-none overflow-x-auto px-5 md:px-8">
                <div className="flex min-w-max items-end gap-0 border-b-0">
                  {tabs.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          "relative whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-medium transition-colors",
                          isActive
                            ? "border-[#3B82F6] text-[#2563EB]"
                            : "border-transparent text-[#94A3B8] hover:border-[#CBD5E1] hover:text-[#334155]",
                        )}
                        style={isActive ? { boxShadow: "0 1px 0 0 #3B82F6" } : {}}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {tab.label}
                        {isActive && (
                          <span
                            className="absolute bottom-0 left-0 right-0 h-px rounded-t bg-[#3B82F6]"
                            style={{ boxShadow: "0 0 6px 0 rgba(59,130,246,0.35)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-6 sm:px-5 sm:py-7 md:px-8">
              {children(activeTab)}
            </div>
          </main>

          <CopilotPanel defaultContext={copilotContext} />

          {/*
            Single Today mount via `<GlobalTodayChrome>` — only mounts the
            mobile vaul drawer. Desktop Today surface lives inline in the
            top sticky container above (see `ContextShellDesktopToolbar`).
          */}
          <GlobalTodayChrome
            sidebarCollapsed={sidebarCollapsed}
            hidden={hideTodaySurfaces}
          />
        </div>
        </TodayDrawerProvider>
      </CopilotCollapseContext.Provider>
    </SidebarCollapseContext.Provider>
  );
}
