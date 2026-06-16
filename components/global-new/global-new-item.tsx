"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { GlobalNewActionDef } from "@/lib/global-new-config"

export type GlobalNewTone = "canvas" | "light"

export function GlobalNewItem({
  action,
  variant,
  tone,
  onNavigate,
  onSelect,
}: {
  action: GlobalNewActionDef
  variant: "desktop" | "mobile"
  tone: GlobalNewTone
  onNavigate: () => void
  /**
   * Optional handler that takes over the click instead of navigating to `href`.
   * Used to open in-app surfaces (e.g. the Manual Intake sheet) from Global New
   * without leaving the page. When provided, the item renders as a button and the
   * `href` is ignored; when absent, behavior is unchanged (href link or button).
   */
  onSelect?: () => void
}) {
  const Icon = action.icon

  const titleClass =
    tone === "canvas"
      ? "text-[var(--app-sidebar-text)]"
      : "text-[#0F172A]"
  const descClass =
    tone === "canvas"
      ? "text-[var(--text-secondary-light)]"
      : "text-[#64748B]"
  const iconWrap =
    tone === "canvas"
      ? "border-[var(--border-dark)] bg-white/[0.06]"
      : "border-[#E2E8F0] bg-white shadow-sm"

  const inner = (
    <>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
          iconWrap,
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 stroke-[1.75]",
            tone === "canvas" ? "text-[var(--accent-primary)]" : "text-[#2563EB]",
          )}
        />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("block text-sm font-medium leading-snug", titleClass)}>
          {action.label}
        </span>
        <span className={cn("mt-0.5 block text-[11px] leading-snug", descClass)}>
          {action.description}
        </span>
      </span>
    </>
  )

  const baseClass = cn(
    "flex w-full items-start gap-3 rounded-lg px-2 text-left transition-colors",
    variant === "desktop" ? "py-2" : "py-2.5",
    tone === "canvas"
      ? "hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
      : "hover:bg-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35",
  )

  if (onSelect) {
    return (
      <button
        type="button"
        className={baseClass}
        onClick={() => {
          onSelect()
          onNavigate()
        }}
      >
        {inner}
      </button>
    )
  }

  if (action.href) {
    return (
      <Link href={action.href} className={baseClass} onClick={onNavigate}>
        {inner}
      </Link>
    )
  }

  return (
    <button type="button" className={baseClass} onClick={onNavigate}>
      {inner}
    </button>
  )
}
