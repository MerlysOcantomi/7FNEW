"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Ellipsis, LayoutDashboard, Mic, Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { useFinesseAssistant } from "@/components/assistant/finesse-assistant-provider"
import { useFinesseLongPress } from "@/components/assistant/use-finesse-long-press"
import { getFinesseAssistantCopy } from "@modules/assistant/finesse-assistant"
import type { VerticalNavItem, VerticalNavProfile } from "@core/vertical-packs/nav-profile"
import {
  isMobileNavHrefActive,
  isMoreDestinationActive,
  resolveVerticalMobileNav,
} from "@core/vertical-packs/mobile-nav"
import type { NavItem, NavSection } from "@/components/sidebar-nav"
import { SidebarAccountMenu } from "@/components/sidebar-account-menu"
import { TodayDateGlyph } from "./today-date-glyph"
import { useLocalToday } from "./use-day-of-month"

/**
 * Vertical mobile bottom bar (FINESSE-UI-02, Phase 1).
 *
 * Fixed bottom navigation for vertical workspaces whose nav profile declares
 * `mobile.primaryIds` (today: Beauty/Finesse → My salon · Today · [mic] ·
 * Messages · More). Mounted ONCE by `MobileSidebarNav`, the mobile chrome every
 * shell family already renders (AppShell, ContextShell and the legacy manual
 * pages), so every vertical route gets the bar without per-page wiring, and
 * workspaces without a mobile declaration render nothing at all.
 *
 * Reuse, not a second navigation:
 *  - destinations, order and Solo/Team visibility come from the SAME nav
 *    profile as the sidebar (`core/vertical-packs/mobile-nav.ts` is a pure
 *    projection of it) — every href is an existing route;
 *  - labels, icons, helpers and the inbox badge are the sidebar's composed
 *    `NavSection`s (vocabulary + locale), passed in by `MobileSidebarNav`;
 *  - the center mic is the EXISTING Finesse assistant entry point: identical
 *    gesture contract to the floating launcher (tap opens the panel, hold
 *    starts voice when the existing policy allows) — no new voice logic;
 *  - "More" is a vaul bottom sheet listing the remaining destinations.
 *
 * Layout contract: the bar is `fixed` + `z-40` (below overlays/toasts, like the
 * launcher) and pads itself with `env(safe-area-inset-bottom)`. Content
 * clearance is NOT per page: `app/globals.css` reserves the bar height on every
 * shell `<main>` while `[data-vertical-mobile-nav]` is in the document, and
 * hides the floating launcher (the mic replaces it) on the same condition.
 */
export function VerticalMobileNav({
  profile,
  sections,
  includedSeats,
}: {
  profile: VerticalNavProfile | null
  /** The sidebar's composed sections (labels/icons/badges) for the same profile. */
  sections: NavSection[]
  includedSeats: number | null | undefined
}) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [moreOpen, setMoreOpen] = useState(false)

  const nav = useMemo(() => resolveVerticalMobileNav(profile, { includedSeats }), [profile, includedSeats])
  const uiByHref = useMemo(() => {
    const map = new Map<string, NavItem>()
    for (const section of sections) for (const item of section.items) map.set(item.href, item)
    return map
  }, [sections])

  if (!nav) return null

  const moreActive = isMoreDestinationActive(pathname, nav)
  const micIndex = Math.ceil(nav.primary.length / 2)
  const before = nav.primary.slice(0, micIndex)
  const after = nav.primary.slice(micIndex)
  const columns = nav.primary.length + 2 // + mic + more

  return (
    <>
      <nav
        data-vertical-mobile-nav
        aria-label={t.nav.navigationTitle}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] text-[var(--text-secondary-light)] shadow-[var(--app-shadow-subtle)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul
          className="grid h-[var(--app-mobile-nav-height)] items-stretch px-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {before.map((item) => (
            <MobileNavTab key={item.id} item={item} ui={uiByHref.get(item.href)} pathname={pathname} />
          ))}
          <li className="flex items-end justify-center">
            <FinesseMicButton />
          </li>
          {after.map((item) => (
            <MobileNavTab key={item.id} item={item} ui={uiByHref.get(item.href)} pathname={pathname} />
          ))}
          <li className="flex">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={moreActive ? "location" : undefined}
              className={tabClassName(moreActive)}
            >
              <span className={iconPillClassName(moreActive)}>
                <Ellipsis size={22} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="truncate">{t.nav.more}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent
          className="border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] text-[var(--text-primary-light)] data-[vaul-drawer-direction=bottom]:max-h-[85dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[24px]"
          aria-describedby={undefined}
        >
          <DrawerTitle className="px-5 pt-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary-light)]">
            {t.nav.more}
          </DrawerTitle>
          <DrawerDescription className="sr-only">{t.nav.navigationTitle}</DrawerDescription>
          <ul
            className="flex flex-col gap-0.5 overflow-y-auto px-3 pb-4 pt-2"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          >
            {nav.more.map((item) => {
              const ui = uiByHref.get(item.href)
              const Icon = ui?.icon ?? LayoutDashboard
              const active = isMobileNavHrefActive(pathname, item.href)
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors motion-reduce:transition-none",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
                      active
                        ? "bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                        : "text-[var(--text-primary-light)] hover:bg-[var(--app-surface-hover)] active:bg-[var(--app-surface-active)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                        active ? "bg-[var(--accent-soft)] text-[var(--accent-on-dark)]" : "bg-[var(--app-surface-subtle)]",
                      )}
                    >
                      <Icon size={18} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{ui?.label ?? item.label}</span>
                      {ui?.helper && (
                        <span className="truncate text-[12px] font-normal text-[var(--text-secondary-light)]">{ui.helper}</span>
                      )}
                    </span>
                    {ui?.badge ? <MobileNavBadge count={ui.badge} className="ml-auto" /> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
          {/*
            Account / workspace identity — previously reachable only through the
            header hamburger's sheet, which the bottom bar replaces on Finesse
            mobile. Same component as the sheet footer, so nothing is lost.
          */}
          <div
            className="shrink-0 border-t border-[var(--border-dark)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <SidebarAccountMenu collapsed={false} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

/** Icon override for the bar only — the sidebar keeps its own map. Today is dynamic. */
const MOBILE_BAR_ICONS: Record<string, React.ElementType> = {
  "my-salon": Store,
}

function MobileNavTab({ item, ui, pathname }: { item: VerticalNavItem; ui: NavItem | undefined; pathname: string }) {
  const active = isMobileNavHrefActive(pathname, item.href)
  const label = ui?.label ?? item.label
  return (
    <li className="flex">
      <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClassName(active)}>
        <span className={cn(iconPillClassName(active), "relative")}>
          {item.id === "today" ? (
            <TodayGlyphWithDate />
          ) : (
            <MobileBarIcon id={item.id} fallback={ui?.icon} />
          )}
          {ui?.badge ? <MobileNavBadge count={ui.badge} className="absolute -right-2 -top-1.5" /> : null}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </li>
  )
}

function MobileBarIcon({ id, fallback }: { id: string; fallback: React.ElementType | undefined }) {
  const Icon = MOBILE_BAR_ICONS[id] ?? fallback ?? LayoutDashboard
  return <Icon size={22} strokeWidth={2} aria-hidden="true" />
}

/**
 * Today's almanac: the frame renders on the server, the day number after mount
 * (see `useLocalToday`). The screen-reader date keeps the destination
 * understandable when the number cannot be perceived visually.
 */
function TodayGlyphWithDate() {
  const { locale } = useI18n()
  const today = useLocalToday()
  const spoken = useMemo(() => {
    if (!today) return null
    try {
      return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(today)
    } catch {
      return today.toDateString()
    }
  }, [today, locale])
  return (
    <>
      <TodayDateGlyph day={today ? today.getDate() : null} size={22} />
      {spoken && <span className="sr-only">{spoken}</span>}
    </>
  )
}

function MobileNavBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--accent-primary)] px-1 text-[10px] font-bold leading-none text-[var(--primary-foreground)]",
        className,
      )}
      aria-label={String(count)}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

function tabClassName(active: boolean): string {
  return cn(
    "flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 pb-1 pt-1.5 text-[10.5px] font-medium leading-tight transition-colors motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-primary)]",
    active ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary-light)] active:text-[var(--text-primary-light)]",
  )
}

function iconPillClassName(active: boolean): string {
  return cn(
    "grid h-7 w-12 place-items-center rounded-full transition-colors motion-reduce:transition-none",
    active ? "bg-[var(--accent-muted)]" : "bg-transparent",
  )
}

/**
 * Center mic — the Finesse assistant entry point, elevated above the bar.
 * Same gesture contract as the floating launcher (`FinesseLauncher`): a tap
 * opens the panel; on touch devices with working, entitled voice a hold opens
 * it AND starts a session. `data-finesse-launcher="mobile-nav"` lets the
 * assistant overlays restore focus here on close (the floating launcher is
 * hidden while the bar is present). `MobileSidebarNav` wraps the bar in
 * `FinesseAssistantScope`, so a provider is always present (shell-owned or
 * the scope's fallback); the disabled rendering below is a defensive
 * safety net for a tree without any provider, never an expected state.
 */
function FinesseMicButton() {
  const { openAssistant, openAssistantWithVoice, open, voice, available } = useFinesseAssistant()
  const { t, locale } = useI18n()
  const copy = getFinesseAssistantCopy(locale)
  const tv = t.voice

  const canLongPress = available && voice.support.voiceSupported && voice.support.touchCapable && voice.entitled
  const handlers = useFinesseLongPress({
    enabled: canLongPress,
    onLongPress: openAssistantWithVoice,
    onClick: openAssistant,
  })

  const voiceVisual =
    voice.state === "listening" || voice.state === "speaking"
      ? "ring-4 ring-[color-mix(in_srgb,var(--accent-primary)_45%,transparent)] animate-pulse motion-reduce:animate-none"
      : voice.state === "thinking" || voice.state === "connecting"
        ? "ring-2 ring-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)]"
        : ""
  const stateSuffix =
    voice.state === "listening"
      ? ` — ${tv.states.listening}`
      : voice.state === "speaking"
        ? ` — ${tv.states.speaking}`
        : voice.state === "thinking"
          ? ` — ${tv.states.thinking}`
          : ""

  return (
    <div className="flex w-full flex-col items-center gap-0.5 pb-1">
      <button
        type="button"
        data-finesse-launcher="mobile-nav"
        aria-label={`${copy.launcherAria}${stateSuffix}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={available ? undefined : true}
        disabled={!available}
        onPointerDown={available ? handlers.onPointerDown : undefined}
        onPointerMove={available ? handlers.onPointerMove : undefined}
        onPointerUp={available ? handlers.onPointerUp : undefined}
        onPointerCancel={available ? handlers.onPointerCancel : undefined}
        onClick={available ? handlers.onClick : undefined}
        className={cn(
          "-mt-7 grid h-14 w-14 place-items-center rounded-full border-4 border-[var(--app-surface-dark-elevated)] bg-[var(--accent-primary)] text-[var(--primary-foreground)] shadow-[var(--app-shadow-subtle)] transition-transform active:scale-95 motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
          !available && "cursor-not-allowed opacity-50",
          voiceVisual,
        )}
      >
        <Mic size={24} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <span className="text-[10.5px] font-semibold leading-tight text-[var(--text-primary-light)]">Finesse</span>
    </div>
  )
}
