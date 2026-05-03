"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Inbox,
  FolderKanban,
  CheckSquare,
  Users,
  CalendarDays,
  Files,
  Building2,
  FileEdit,
  DollarSign,
  FileText,
  Bot,
  Cpu,
  Bell,
  History,
  BookOpen,
  Settings,
  Menu,
  X,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  LogIn,
  ChevronDown,
  ChevronRight,
  Search,
  Star,
  Clock,
  CheckCircle,
  CheckCircle2,
  Archive,
  Fingerprint,
  Briefcase,
  Trash2,
  ListTodo,
  CalendarClock,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useState, createContext, useContext, useMemo, useEffect } from "react";
import { useGlobalSearch } from "@/components/global-search-provider";
import { useInboxBadge } from "@/hooks/use-inbox-badge";
import type { EntityVocabulary } from "@core/personalization";
import { DEFAULT_VOCABULARY } from "@core/personalization";
import { GlobalNewTriggerMobile } from "@/components/global-new/global-new-trigger";
import { GlobalNewMobileSheet } from "@/components/global-new/global-new-mobile-sheet";
import { SidebarAccountMenu } from "@/components/sidebar-account-menu";

// ── Collapse Context ────────────────────────────────────────────────────────
interface SidebarCollapseContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}
export const SidebarCollapseContext = createContext<SidebarCollapseContextType>({
  collapsed: false,
  setCollapsed: () => {},
});
export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}

// ── Types ────────────────────────────────────────────────────────────────────
type NavItem = { 
  label: string; 
  href: string; 
  icon: React.ElementType; 
  helper?: string; 
  badge?: number;
  subitems?: NavItem[];
  group?: string;
};
type NavSection = {
  section: string;
  subtitle: string;
  items: NavItem[];
  icon?: React.ElementType;
  dividerAbove?: boolean;
};

// ── Navigation Structure ─────────────────────────────────────────────────────
function buildNavSections(v: EntityVocabulary = DEFAULT_VOCABULARY): NavSection[] {
  return [
    {
      section: "Overview",
      subtitle: "",
      items: [{ label: "Overview", href: "/", icon: LayoutDashboard }],
    },
    {
      section: "Main",
      subtitle: "",
      items: [
        {
          /**
           * Smart Inbox parent — operational reorganization. Subitems are grouped by
           * intent (Work / Smart views / Storage) so the sidebar reads as a workflow,
           * not a folder list. URL `?filter=` values are mapped server-side via
           * `mapSidebarFilter` in app/inbox/page.tsx; legacy values (`new`,
           * `in_progress`, `urgent`, `needs_reply`, `leads`) are preserved as aliases
           * so external bookmarks keep working.
           *
           * - "Inbox" subitem (no group) duplicates the parent click target on purpose:
           *   gives operators an explicit "go back to default view" affordance even
           *   when they've drilled into a sub-filter.
           * - To-do is a placeholder for the future action queue. It routes to /inbox
           *   with `?filter=todo` which currently maps to {} (no extra status filter)
           *   so the active state highlights while the list shows the default Inbox.
           *   When the To-do engine ships, only mapSidebarFilter needs to change.
           * - Scheduled is similarly placeholder — backed by EventHint detection later.
           * - Storage is intentionally last (terminal/done/discarded states).
           */
          label: "Smart Inbox",
          href: "/inbox",
          icon: Inbox,
          helper: "by Fanny",
          subitems: [
            { label: "Inbox", href: "/inbox", icon: Inbox },
            { label: "To-do", href: "/inbox?filter=todo", icon: ListTodo, group: "Work" },
            { label: "Needs action", href: "/inbox?filter=needs_action", icon: MessageSquarePlus, group: "Work" },
            { label: "Waiting", href: "/inbox?filter=waiting", icon: Clock, group: "Work" },
            { label: "Done", href: "/inbox?filter=done", icon: CheckCircle, group: "Work" },
            { label: "Scheduled", href: "/inbox?filter=scheduled", icon: CalendarClock, group: "Smart views" },
            { label: "Opportunities", href: "/inbox?filter=opportunities", icon: Star, group: "Smart views" },
            { label: "Closed", href: "/inbox?filter=closed", icon: CheckCircle2, group: "Storage" },
            { label: "Archived", href: "/inbox?filter=archived", icon: Archive, group: "Storage" },
            { label: "Trash", href: "/inbox?filter=trash", icon: Trash2, group: "Storage" },
          ]
        },
        { label: v.client.plural, href: "/clientes", icon: Users },
        { label: v.project.plural, href: "/proyectos", icon: FolderKanban },
        { label: v.task.plural, href: "/tareas", icon: CheckSquare },
        { label: v.billing.singular, href: "/facturacion", icon: FileText, helper: "by Felix" },
        { label: v.finance.singular, href: "/finanzas", icon: DollarSign },
        { label: v.marketing.singular, href: "/contenido", icon: FileEdit, helper: "by Fiona" },
      ],
    },
    {
      section: "More",
      subtitle: "",
      icon: BookOpen,
      items: [
        { label: "Manual Intake", href: "/entrada", icon: LogIn },
        { label: "Requests", href: "/requests", icon: MessageSquarePlus },
        { label: v.calendar.singular, href: "/calendario", icon: CalendarDays },
        { label: v.document.plural, href: "/archivos", icon: Files },
        { label: "Notifications", href: "/notificaciones", icon: Bell },
        { label: "History", href: "/historial", icon: History },
        { label: "Tools", href: "/biblioteca", icon: BookOpen },
      ],
      dividerAbove: true,
    },
    {
      section: "Workspace",
      subtitle: "",
      icon: Settings,
      items: [
        { label: "Business Profile", href: "/business-profile", icon: Briefcase },
        { label: "Communication", href: "/comunicacion", icon: MessageSquarePlus },
        { label: "Contact Matching", href: "/identidad", icon: Fingerprint },
        { label: v.member.plural, href: "/usuarios", icon: Users },
        { label: v.department.plural, href: "/departamentos", icon: Building2 },
        { label: "Improvements", href: "/forte/improvements", icon: Bot, helper: "by Mr. Forte" },
        { label: "AI workspace", href: "/motor", icon: Cpu },
      ],
      dividerAbove: true,
    },
  ];
}

const NAV_SECTIONS = buildNavSections();

// ── Inbox-focused mode ───────────────────────────────────────────────────────
/**
 * When the operator is on /inbox we swap the global navigation for an Inbox-only
 * navigation: Inbox + Work + Smart views + Storage. The full 7F app modules
 * (Clients, Projects, Finance, etc.) get out of the way so the sidebar reads as
 * "you are inside Smart Inbox", not "Smart Inbox is one of many sections".
 *
 * This is a sidebar-only change. AppShell, /inbox/page.tsx, top chrome (search,
 * notifications, global new) all stay identical — they're product utilities
 * that work the same in any workspace mode. The "Back to 7F" link in the
 * focused header is the explicit way out.
 *
 * The items are extracted from the existing Smart Inbox subitems in NAV_SECTIONS
 * so the two views never drift: when we add a new Inbox filter to the global
 * sidebar it automatically shows up in the focused mode, and vice versa.
 */
function getInboxFocusedItems(): NavItem[] {
  const main = NAV_SECTIONS.find((s) => s.section === "Main");
  const smartInbox = main?.items.find((i) => i.href === "/inbox");
  return smartInbox?.subitems ?? [];
}

const INBOX_FOCUSED_ITEMS = getInboxFocusedItems();

/** True when the current route is the Inbox workspace (top-level or any subroute). */
function isInboxFocusedPath(pathname: string): boolean {
  return pathname === "/inbox" || pathname.startsWith("/inbox/");
}

// ── Helper: determine which section contains active route ────────────────────
function getActiveSectionFor(pathname: string): string {
  for (const { section, items } of NAV_SECTIONS) {
    for (const { href } of items) {
      if (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")) {
        return section;
      }
    }
  }
  return "Main";
}

// ── Smart Inbox NavLink ──────────────────────────────────────────────────────
function SmartInboxNavLink({
  href,
  icon: Icon,
  label,
  collapsed,
  onClick,
}: NavItem & { collapsed?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const currentParams = useSearchParams();
  const currentFilter = currentParams.get("filter");
  const hrefFilter = href.includes("?filter=") ? new URL(href, "http://x").searchParams.get("filter") : null;
  const isActive = pathname === "/inbox" && currentFilter === hrefFilter;

  const getIconColor = (label: string) => {
    switch (label) {
      /**
       * Inbox + Work group — accent-tinted icons signal "active operational lanes".
       * To-do uses the same accent because it's the future home of the action queue.
       */
      case "Inbox": return "text-[var(--inbox-accent)]";
      case "To-do": return "text-[var(--inbox-accent)]";
      case "Needs action": return "text-[var(--inbox-accent)]";
      case "Waiting": return "text-[var(--inbox-waiting-color)]";
      case "Done": return "text-[var(--inbox-done-color)]";
      /** Smart views — pre-existing semantic colors. */
      case "Scheduled": return "text-[var(--inbox-accent)]";
      case "Opportunities": return "text-[var(--inbox-lead-color)]";
      /** Storage — muted because they're not where daily work happens. */
      case "Closed": return "text-[var(--inbox-done-color)]";
      case "Archived": return "text-[var(--inbox-archive-color)]";
      case "Trash": return "text-[var(--app-sidebar-text-muted)]";
      default: return "text-[var(--app-sidebar-text-muted)]";
    }
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150 relative group",
        collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
        isActive
          ? "text-[var(--app-sidebar-text)] bg-[var(--app-sidebar-surface)] shadow-[0_0_0_1px_var(--app-accent),0_0_8px_0_rgba(99,102,241,0.18)]"
          : "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--app-accent)] rounded-r-full" />
      )}
      <span className="relative shrink-0">
        <Icon
          size={15}
          strokeWidth={1.75}
          className={cn(
            getIconColor(label),
            /** Opportunities (formerly Leads) keeps the filled star for emphasis. */
            label === "Opportunities" && "fill-current",
          )}
        />
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

// ── NavLink with Subitems ─────────────────────────────────────────────────────
function NavLinkWithSubitems({
  href,
  icon: Icon,
  label,
  helper,
  badge,
  subitems,
  collapsed,
  onClick,
}: NavItem & { collapsed?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const currentParams = useSearchParams();
  const currentFilter = currentParams.get("filter");
  const hasActiveSubitem = subitems?.some(subitem => {
    const subFilter = subitem.href.includes("?filter=") ? new URL(subitem.href, "http://x").searchParams.get("filter") : null;
    return pathname === "/inbox" && currentFilter === subFilter;
  });
  const [expanded, setExpanded] = useState(hasActiveSubitem || pathname === href);
  const isActive = href === "/" ? pathname === "/" : (pathname === href && !currentFilter);

  useEffect(() => {
    if (hasActiveSubitem) {
      setExpanded(true);
    }
  }, [hasActiveSubitem]);

  if (!subitems || subitems.length === 0) {
    return <NavLink href={href} icon={Icon} label={label} helper={helper} badge={badge} collapsed={collapsed} onClick={onClick} />;
  }

  return (
    <div>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150 relative group",
          collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
          isActive
            ? "text-white bg-[var(--app-sidebar-surface)] shadow-[0_0_0_1px_var(--app-accent),0_0_8px_0_rgba(99,102,241,0.18)]"
            : "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60"
        )}
        onClick={() => {
          if (!collapsed) setExpanded(true);
          if (onClick) onClick();
        }}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--app-accent)] rounded-r-full" />
        )}
        <span className="relative shrink-0">
          <Icon
            size={15}
            strokeWidth={1.75}
            className={cn(isActive ? "text-[var(--app-accent)]" : "text-[var(--app-sidebar-text-muted)] group-hover:text-[var(--app-sidebar-text)]")}
          />
          {collapsed && typeof badge === "number" && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--app-accent)] text-[8px] font-bold text-white ring-2 ring-[var(--app-sidebar-bg)]">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col items-start">
              <span className="truncate">{label}</span>
              {helper ? (
                <span className="text-[10px] text-[var(--app-sidebar-text-muted)] opacity-75">{helper}</span>
              ) : null}
            </span>
            {typeof badge === "number" && badge > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-[9px] font-bold text-white">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="shrink-0 p-0.5 rounded hover:bg-white/10"
            >
              <ChevronRight
                size={12}
                className={cn(
                  "text-[var(--app-sidebar-text-muted)] transition-transform duration-200",
                  expanded ? "rotate-90" : "rotate-0"
                )}
              />
            </button>
          </>
        )}
      </Link>
      {!collapsed && expanded && subitems && (
        <div className="ml-4 mt-1 border-l border-[var(--app-sidebar-border)] pl-3">
          {renderGroupedSubitems(subitems, onClick)}
        </div>
      )}
    </div>
  );
}

function renderGroupedSubitems(subitems: NavItem[], onClick?: () => void) {
  let lastGroup: string | undefined;
  const elements: React.ReactNode[] = [];

  for (const subitem of subitems) {
    if (subitem.group && subitem.group !== lastGroup) {
      elements.push(
        <p
          key={`group-${subitem.group}`}
          className={cn(
            "text-[9px] font-semibold uppercase tracking-widest text-[var(--app-sidebar-text-muted)]/60 px-3 pb-0.5",
            lastGroup !== undefined ? "pt-2.5 mt-1 border-t border-[var(--app-sidebar-border)]" : "pt-1",
          )}
        >
          {subitem.group}
        </p>
      );
      lastGroup = subitem.group;
    }
    elements.push(
      <SmartInboxNavLink key={subitem.href} {...subitem} collapsed={false} onClick={onClick} />
    );
  }

  return elements;
}

// ── NavLink ──────────────────────────────────────────────────────────────────
function NavLink({
  href,
  icon: Icon,
  label,
  helper,
  badge,
  collapsed,
  onClick,
}: NavItem & { collapsed?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive =
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150 relative group",
        collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
        isActive
          ? "text-[var(--app-sidebar-text)] bg-[var(--app-sidebar-surface)] shadow-[0_0_0_1px_var(--app-accent),0_0_8px_0_rgba(99,102,241,0.18)]"
          : "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--app-accent)] rounded-r-full" />
      )}
      <span className="relative shrink-0">
        <Icon
          size={15}
          strokeWidth={1.75}
            className={cn(isActive ? "text-[var(--app-accent)]" : "text-[var(--app-sidebar-text-muted)] group-hover:text-[var(--app-sidebar-text)]")}
        />
        {collapsed && typeof badge === "number" && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--app-accent)] text-[8px] font-bold text-white ring-2 ring-[var(--app-sidebar-bg)]">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex min-w-0 flex-1 flex-col items-start">
            <span className="truncate">{label}</span>
            {helper ? (
              <span className="text-[10px] font-normal text-[var(--app-sidebar-text-muted)] group-hover:text-[var(--app-sidebar-text)]">
                {helper}
              </span>
            ) : null}
          </span>
          {typeof badge === "number" && badge > 0 && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] px-1 text-[10px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// ── Accordion Section ────────────────────────────────────────────────────────
function AccordionSection({
  section,
  subtitle,
  items,
  icon: SectionIcon,
  dividerAbove,
  collapsed,
  isOpen,
  onToggle,
  onNavClick,
}: NavSection & {
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}) {
  const isDashboard = section === "Overview";
  const isDirectGroup = section === "Main";

  if (isDashboard || isDirectGroup) {
    return (
      <div className={cn(dividerAbove && "pt-3 border-t border-[var(--app-sidebar-border)]")}>
        {items.map((item) => (
          <NavLinkWithSubitems key={item.href} {...item} collapsed={collapsed} onClick={onNavClick} />
        ))}
      </div>
    );
  }

  if (collapsed) {
    // Icon-only: just render links without accordion
    return (
      <div className={cn("space-y-0.5", dividerAbove && "pt-3 border-t border-[var(--app-sidebar-border)]")}>
        {items.map((item) => (
          <NavLinkWithSubitems key={item.href} {...item} collapsed={true} onClick={onNavClick} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(dividerAbove && "pt-3 border-t border-[var(--app-sidebar-border)]")}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between rounded-[10px] px-3 py-2 mb-1 border border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-surface)]/70 hover:bg-[var(--app-sidebar-border)] transition-colors group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {SectionIcon ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-surface)] text-[var(--app-sidebar-text-muted)] shrink-0">
              <SectionIcon size={13} strokeWidth={1.9} />
            </span>
          ) : null}
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[11px] font-semibold text-[var(--app-sidebar-text)] group-hover:text-white transition-colors tracking-wide">
              {section}
            </span>
            {subtitle && (
              <span className="text-[9px] text-[var(--app-sidebar-text-muted)] mt-0.5 tracking-wide">{subtitle}</span>
            )}
          </div>
        </div>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={cn(
            "text-[var(--app-sidebar-text-muted)] group-hover:text-[var(--app-sidebar-text)] transition-all duration-200 shrink-0",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {isOpen && (
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavLinkWithSubitems key={item.href} {...item} collapsed={false} onClick={onNavClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inbox-focused sidebar body ───────────────────────────────────────────────
/**
 * Renders the Inbox-only navigation: focus header (Smart Inbox · by Fanny) at the
 * top, "Back to 7F" link to escape, then the grouped filters (Work / Smart views
 * / Storage). Active state is delegated to `SmartInboxNavLink` which already
 * compares `?filter=` against the current URL.
 *
 * Used by both desktop and mobile. The desktop layout shows the focus header
 * inline with the rest of the sidebar; mobile renders the same content inside
 * the bottom sheet.
 *
 * `collapsed` only applies to the desktop sidebar. When collapsed we hide the
 * header text and "Back" label but keep the icon-only links so the operator
 * can still navigate without expanding.
 */
function InboxFocusedNav({
  collapsed = false,
  onNavClick,
}: {
  collapsed?: boolean;
  onNavClick?: () => void;
}) {
  /**
   * When expanded we show Work / Smart views / Storage group separators (matching the
   * global sidebar's submenu). When collapsed, the separators don't fit the icon-only
   * width so we just render the links as a flat icon column — same pattern the global
   * sidebar uses for its accordion sections in collapsed mode.
   */
  const body = useMemo(() => {
    if (collapsed) {
      return INBOX_FOCUSED_ITEMS.map((item) => (
        <SmartInboxNavLink key={item.href} {...item} collapsed onClick={onNavClick} />
      ));
    }
    return renderGroupedSubitems(INBOX_FOCUSED_ITEMS, onNavClick);
  }, [collapsed, onNavClick]);

  return (
    /**
     * Compact gap between header / back-link / list. The previous `space-y-2` (8px)
     * felt airy next to the new narrower aside; `space-y-1.5` (6px) keeps a clear
     * separation while reclaiming a few pixels per row.
     */
    <div className="space-y-1.5">
      {/**
       * Focus header — visually distinct from the global sidebar so the operator
       * immediately knows they're in Inbox mode. Card surface + accent ring + a
       * small "by Fanny" helper, matching the existing Smart Inbox brand chip in
       * the global nav. When collapsed, the header collapses to just the icon.
       *
       * Compact pass: shrunk the icon chip (h-6 w-6 → h-5 w-5), trimmed padding
       * (px-3 py-2 → px-2.5 py-1.5), and reduced the header gap. The label sizes
       * stayed (11px / 9px) — both are already at the readable floor.
       */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-[10px] border border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-surface)]/70",
          collapsed ? "justify-center px-2 py-1.5" : "px-2.5 py-1.5",
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--inbox-accent)]/15 text-[var(--inbox-accent)] shrink-0">
          <Inbox size={12} strokeWidth={2} />
        </span>
        {!collapsed ? (
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[11px] font-semibold text-[var(--app-sidebar-text)] tracking-wide">
              Smart Inbox
            </span>
            <span className="text-[9px] text-[var(--app-sidebar-text-muted)] tracking-wide flex items-center gap-1">
              <Sparkles size={9} className="shrink-0" />
              by Fanny
            </span>
          </div>
        ) : null}
      </div>

      {/**
       * "Back to 7F" — the only explicit way out of focused mode. Routes to "/"
       * which restores the default global sidebar via the `pathname` check at
       * the top of `SidebarNav`. We use a muted style so it doesn't compete
       * with the active inbox filter for visual weight.
       *
       * Compact pass: vertical padding `py-1.5` → `py-1` (saves 4px) and slimmer
       * horizontal padding to align with the new tighter nav gutters.
       */}
      <Link
        href="/"
        onClick={onNavClick}
        title={collapsed ? "Back to 7F" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-[8px] text-[11px] font-medium transition-colors",
          collapsed ? "justify-center px-2 py-1" : "px-2.5 py-1",
          "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60",
        )}
      >
        <ArrowLeft size={13} strokeWidth={2} className="shrink-0" />
        {!collapsed && <span>Back to 7F</span>}
      </Link>

      {/** Inbox + Work / Smart views / Storage filters. Shared with the global sidebar's submenu. */}
      <div className="space-y-0.5">{body}</div>
    </div>
  );
}

function useSectionsWithBadges(): NavSection[] {
  const inboxBadge = useInboxBadge();
  return useMemo(() => {
    if (inboxBadge === 0) return NAV_SECTIONS;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.href === "/inbox" ? { ...item, badge: inboxBadge } : item
      ),
    }));
  }, [inboxBadge]);
}

// ── Desktop Sidebar ──────────────────────────────────────────────────────────
export function SidebarNav() {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarCollapse();
  const { openSearch } = useGlobalSearch();
  const sections = useSectionsWithBadges();
  const [openSection, setOpenSection] = useState<string>(
    pathname === "/" ? "Overview" : getActiveSectionFor(pathname)
  );

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? "" : section));
  };

  /**
   * Inbox-focused mode — when the operator is on /inbox we replace the global nav
   * (Overview, Main, More, Workspace) with the InboxFocusedNav (Inbox + Work +
   * Smart views + Storage). Logo, Search, footer, and collapse toggle stay so the
   * shell still feels like 7F. Navigating away (e.g. clicking the 7F logo or
   * "Back to 7F" link) puts the user on "/", which falls through this branch
   * and restores the full sidebar.
   */
  const focused = isInboxFocusedPath(pathname);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-screen sticky top-0 bg-[var(--app-sidebar-bg)] text-[var(--app-sidebar-text)] overflow-y-auto overflow-x-hidden transition-all duration-300 border-r border-[var(--app-sidebar-border)]",
        /**
         * Width matrix:
         *  - collapsed (any route)        → w-14 (56px, icon-only column, unchanged)
         *  - focused expanded (/inbox)    → w-48 (192px) — a noticeably narrower
         *    column than the global default so the three-column Inbox grid claims
         *    those 32px back. Verified that every focused label still fits at this
         *    width: the longest are "Needs attention" (14ch), "Opportunities"
         *    (13ch) and "Archived" (8ch). 192px leaves ≥130px for the label inside
         *    a row, well above the longest one. If a future label needs more space
         *    bump this to `w-52` (208px) — the next safe step before the chrome
         *    starts cropping.
         *  - global expanded (other routes) → w-56 (224px, unchanged)
         */
        collapsed
          ? "w-14"
          : focused
            ? "w-48"
            : "w-56"
      )}
    >
      {/* Logo + Collapse Toggle */}
      <div
        className={cn(
          "flex items-center shrink-0",
          collapsed
            ? "justify-center px-3 pt-5 pb-4"
            : focused
              /**
               * Compact chrome — only when /inbox + expanded. Vertical padding shrunk
               * (~6px saved) and horizontal padding pulled in 4px so the header sits
               * tighter against the narrower aside without feeling cropped.
               */
              ? "justify-between px-4 pt-3.5 pb-2.5"
              : "justify-between px-5 pt-5 pb-4",
        )}
      >
        {/**
         * Logo is now a link to "/" so it doubles as the canonical "back to home"
         * affordance. Inside the inbox-focused mode this is reinforced by the
         * dedicated "Back to 7F" CTA at the top of the nav body. Outside inbox
         * the logo just goes to the dashboard like before.
         */}
        {!collapsed && (
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
            title={focused ? "Back to 7F" : "7F"}
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--app-accent)] flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-white text-sm font-bold tracking-tight">7F</span>
            </div>
            <span className="text-[var(--app-sidebar-text)] font-semibold text-base tracking-wide">7F</span>
          </Link>
        )}
        {collapsed && (
          <Link
            href="/"
            className="w-8 h-8 rounded-xl bg-[var(--app-accent)] flex items-center justify-center shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
            title={focused ? "Back to 7F" : "7F"}
          >
            <span className="text-white text-sm font-bold tracking-tight">7F</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] transition-colors p-1 rounded",
            collapsed && "mt-1"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Search trigger */}
      <div
        className={cn(
          "shrink-0",
          collapsed
            ? "px-1.5 pb-3"
            : focused
              /** Compact: 1px less below + 0.5 less horizontal to ride the narrower column. */
              ? "px-2.5 pb-2"
              : "px-3 pb-3",
        )}
      >
        <button
          onClick={openSearch}
          className={cn(
            "w-full flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150",
            collapsed
              ? "px-2 py-2 justify-center"
              : focused
                ? "px-2.5 py-1.5"
                : "px-3 py-2",
            "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60",
          )}
          title="Search (Ctrl+K)"
        >
          <Search size={15} strokeWidth={1.75} />
          {!collapsed && <span>Search</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1",
          collapsed
            ? "px-1.5 pb-4 space-y-1"
            : focused
              /** Tighter inner gutters and bottom space for inbox mode. */
              ? "px-2.5 pb-3 space-y-0.5"
              : "px-3 pb-4 space-y-1",
        )}
      >
        {focused ? (
          <InboxFocusedNav collapsed={collapsed} />
        ) : (
          sections.map(({ section, subtitle, items, dividerAbove }) => (
            <AccordionSection
              key={section}
              section={section}
              subtitle={subtitle}
              items={items}
              dividerAbove={dividerAbove}
              collapsed={collapsed}
              isOpen={openSection === section}
              onToggle={() => toggleSection(section)}
            />
          ))
        )}
      </nav>

      {/**
       * Footer — real authenticated identity + active workspace + sign-out.
       * The previous static "Executive Admin / admin@7fcopilot.com / EA" placeholder
       * has been replaced by `SidebarAccountMenu`, which reads from `useUser()` and
       * `useActiveWorkspace()` and exposes a Sign-out action via dropdown. The footer
       * keeps the same visual footprint (avatar + name/email stack, with a collapsed
       * variant) so this is a data-only swap, not a layout redesign.
       */}
      <SidebarAccountMenu collapsed={collapsed} focused={focused} />
    </aside>
  );
}

// ── Mobile Sidebar (Sheet-based) ──────────────────────────────────────────────
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export function MobileSidebarNav() {
  const pathname = usePathname();
  const { openSearch } = useGlobalSearch();
  const sections = useSectionsWithBadges();
  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string>(
    pathname === "/" ? "Overview" : getActiveSectionFor(pathname)
  );

  /** Same focused-mode rule as desktop: when on /inbox we render InboxFocusedNav inside the sheet. */
  const focused = isInboxFocusedPath(pathname);

  return (
    <>
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[var(--app-sidebar-bg)] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--app-accent)] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">7F</span>
          </div>
          <span className="text-white font-semibold text-sm">7F</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={openSearch}
            className="text-[var(--app-sidebar-text-muted)] hover:text-white p-1"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <GlobalNewTriggerMobile />
          <button
            onClick={() => setOpen(true)}
            className="text-[var(--app-sidebar-text-muted)] hover:text-white p-1"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 bg-[var(--app-sidebar-bg)] border-r-0 [&>button]:hidden flex flex-col"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[var(--app-accent)] flex items-center justify-center">
                <span className="text-white text-xs font-bold">7F</span>
              </div>
              <span className="text-white font-semibold text-sm">7F</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-[#94A3B8] hover:text-white"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="px-3 pb-3 flex-1 space-y-1 overflow-y-auto">
            {focused ? (
              <InboxFocusedNav onNavClick={() => setOpen(false)} />
            ) : (
              sections.map(({ section, subtitle, items, dividerAbove }) => (
                <AccordionSection
                  key={section}
                  section={section}
                  subtitle={subtitle}
                  items={items}
                  dividerAbove={dividerAbove}
                  collapsed={false}
                  isOpen={openSection === section}
                  onToggle={() => setOpenSection((prev) => (prev === section ? "" : section))}
                  onNavClick={() => setOpen(false)}
                />
              ))
            )}
          </nav>

          {/**
           * Mobile users had no footer or visible logout before this change. Showing the
           * account menu inside the sheet keeps mobile in parity with desktop without
           * adding a separate top-bar avatar (which would compete with the search and
           * notification icons in the mobile header chrome).
           */}
          <SidebarAccountMenu collapsed={false} />
        </SheetContent>
      </Sheet>
      <GlobalNewMobileSheet />
    </>
  );
}
