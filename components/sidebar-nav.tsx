"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Circle,
  Star,
  Mail,
  Clock,
  CheckCircle,
  Archive,
  Shield,
} from "lucide-react";
import { useState, createContext, useContext, useMemo, useEffect } from "react";
import { useGlobalSearch } from "@/components/global-search-provider";
import { useInboxBadge } from "@/hooks/use-inbox-badge";
import type { EntityVocabulary } from "@core/personalization";
import { DEFAULT_VOCABULARY } from "@core/personalization";

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
          label: v.inbox.singular, 
          href: "/inbox", 
          icon: Inbox, 
          helper: "by Fanny",
          subitems: [
            { label: "Urgent", href: "/inbox?filter=urgent", icon: Circle },
            { label: "Leads", href: "/inbox?filter=lead", icon: Star },
            { label: "Unread", href: "/inbox?filter=unread", icon: Mail },
            { label: "Needs Reply", href: "/inbox?filter=reply", icon: MessageSquarePlus },
            { label: "Waiting", href: "/inbox?filter=waiting", icon: Clock },
            { label: "Done", href: "/inbox?filter=done", icon: CheckCircle },
            { label: "Archived", href: "/inbox?filter=archived", icon: Archive },
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
        { label: "Improvements", href: "/forte/improvements", icon: Bot, helper: "by Mr. Forte" },
        { label: "AI workspace", href: "/motor", icon: Cpu },
        { label: v.department.plural, href: "/departamentos", icon: Building2 },
        { label: v.member.plural, href: "/usuarios", icon: Users },
        { label: "Identity", href: "/identidad", icon: Settings },
        { label: "Communication", href: "/comunicacion", icon: MessageSquarePlus },
      ],
      dividerAbove: true,
    },
  ];
}

const NAV_SECTIONS = buildNavSections();

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
  const isActive = pathname === href;

  const getIconColor = (label: string) => {
    switch (label) {
      case "Urgent": return "text-[var(--inbox-urgent-color)]";
      case "Leads": return "text-[var(--inbox-lead-color)]";
      case "Unread": return "text-[var(--inbox-unread-color)]";
      case "Needs Reply": return "text-[var(--inbox-accent)]";
      case "Waiting": return "text-[var(--inbox-waiting-color)]";
      case "Done": return "text-[var(--inbox-done-color)]";
      case "Archived": return "text-[var(--inbox-archive-color)]";
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
            label === "Urgent" && "fill-current",
            label === "Leads" && "fill-current"
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
  const hasActiveSubitem = subitems?.some(subitem => 
    pathname === subitem.href
  );
  const [expanded, setExpanded] = useState(hasActiveSubitem || pathname === href);
  // Solo debe estar activo si es exactamente la URL del item principal
  const isActive = href === "/" ? pathname === "/" : pathname === href;

  // Auto-expand when navigating to subitem
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
      <div
        className={cn(
          "flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150 relative group cursor-pointer",
          collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
          isActive
            ? "text-white bg-[var(--app-sidebar-surface)] shadow-[0_0_0_1px_var(--app-accent),0_0_8px_0_rgba(99,102,241,0.18)]"
            : "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60"
        )}
        onClick={() => {
          if (!collapsed) setExpanded(!expanded);
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
            {!collapsed && typeof badge === "number" && badge > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--app-accent)] text-[9px] font-bold text-white">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
            <ChevronRight
              size={12}
              className={cn(
                "text-[var(--app-sidebar-text-muted)] transition-transform duration-200",
                expanded ? "rotate-90" : "rotate-0"
              )}
            />
          </>
        )}
      </div>
      {!collapsed && expanded && subitems && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-[var(--app-sidebar-border)] pl-3">
          {subitems.map((subitem) => (
            <SmartInboxNavLink 
              key={subitem.href} 
              {...subitem} 
              collapsed={false} 
              onClick={onClick} 
            />
          ))}
        </div>
      )}
    </div>
  );
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

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-screen sticky top-0 bg-[var(--app-sidebar-bg)] text-[var(--app-sidebar-text)] overflow-y-auto overflow-x-hidden transition-all duration-300 border-r border-[var(--app-sidebar-border)]",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo + Collapse Toggle */}
      <div className={cn("flex items-center shrink-0 px-3 pt-5 pb-4", collapsed ? "justify-center" : "justify-between px-5")}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--app-accent)] flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-white text-sm font-bold tracking-tight">7F</span>
            </div>
            <span className="text-[var(--app-sidebar-text)] font-semibold text-base tracking-wide">7F</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-xl bg-[var(--app-accent)] flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold tracking-tight">7F</span>
          </div>
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
      <div className={cn("shrink-0 px-3 pb-3", collapsed && "px-1.5")}>
        <button
          onClick={openSearch}
          className={cn(
            "w-full flex items-center gap-3 rounded-[8px] text-sm font-medium transition-all duration-150",
            collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
            "text-[var(--app-sidebar-text-muted)] hover:text-[var(--app-sidebar-text)] hover:bg-[var(--app-sidebar-surface)]/60"
          )}
          title="Search (Ctrl+K)"
        >
          <Search size={15} strokeWidth={1.75} />
          {!collapsed && <span>Search</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 pb-4 space-y-1", collapsed ? "px-1.5" : "px-3")}>
        {sections.map(({ section, subtitle, items, dividerAbove }) => (
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
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 pb-5 pt-4 border-t border-[var(--app-sidebar-border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--app-sidebar-surface)] flex items-center justify-center text-xs font-medium text-[var(--app-sidebar-text-muted)]">
              EA
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-[var(--app-sidebar-text)] truncate">Executive Admin</span>
              <span className="text-[10px] text-[var(--app-sidebar-text-muted)] truncate">admin@7fcopilot.com</span>
            </div>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="pb-5 pt-4 border-t border-[var(--app-sidebar-border)] shrink-0 flex justify-center">
          <div
            className="w-7 h-7 rounded-full bg-[var(--app-sidebar-surface)] flex items-center justify-center text-xs font-medium text-[var(--app-sidebar-text-muted)]"
            title="Executive Admin"
          >
            EA
          </div>
        </div>
      )}
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

  return (
    <>
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[var(--app-sidebar-bg)] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[var(--app-accent)] flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">7F</span>
          </div>
          <span className="text-white font-semibold text-sm">7F</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openSearch}
            className="text-[var(--app-sidebar-text-muted)] hover:text-white p-1"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
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
          className="w-64 p-0 bg-[var(--app-sidebar-bg)] border-r-0 [&>button]:hidden"
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

          <nav className="px-3 pb-6 flex-1 space-y-1 overflow-y-auto">
            {sections.map(({ section, subtitle, items, dividerAbove }) => (
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
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
