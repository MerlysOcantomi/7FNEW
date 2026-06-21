"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import type {
  PanelAnchor,
  PanelLeftOffset,
  PanelSize,
  PanelTone,
} from "./workspace-panel-types"

/**
 * Floating workspace-panel surface.
 *
 * Anchor-agnostic, primitive-agnostic-from-the-caller's-view, built on
 * `DialogPrimitive.Content`. Radix Dialog gives us, for free:
 *
 *   - Portal mount to <body> (escapes shell flex/fixed geometry).
 *   - Focus trap inside the surface while open.
 *   - Escape key handling routed to `onOpenChange(false)`.
 *   - Body scroll lock while open. (Single-panel only — acceptable for
 *     Today Inlay; the future Coordinator PR will revisit this when
 *     multiple panels can coexist.)
 *   - Return-focus to the trigger on close.
 *   - aria-modal + role="dialog" + automatic labelledby wiring from
 *     `DialogPrimitive.Title`.
 *
 * The surface DOES NOT render a backdrop — pair it with
 * `<WorkspacePanelBackdrop />` inside the same `<Dialog.Root>` for
 * the soft scrim. Splitting backdrop and surface keeps the future
 * Coordinator free to render a single shared backdrop with N
 * surfaces in PR 2 / PR 3.
 *
 * Positioning math:
 *   - Anchor controls which edge(s) the surface sticks to.
 *   - `leftOffset.desktopPx` lets the surface center itself inside the
 *     workspace content area, not the raw viewport. The math
 *     `left: calc(50% + S/2)` + `translate-x(-50%)` lands the
 *     surface's CENTER at workspace-center; this is the same trick
 *     `TodayBottomLauncher` already uses.
 *   - Mobile widths (< md) are intentionally NOT supported by this
 *     component yet — Today Inlay does not render on mobile (the
 *     mobile drawer keeps using vaul). PR 2 will extend this if
 *     mobile side-rails ever land.
 *
 * Implementation note: all dynamic positioning (sidebar-aware) lives
 * in the inline `style` prop because Tailwind's JIT can't see
 * runtime-built class strings. Static safe-area-inset and visual
 * tokens stay in Tailwind classes.
 */
export function WorkspacePanelSurface({
  anchor,
  size,
  tone = "canvas",
  leftOffset,
  className,
  contentClassName,
  labelledBy,
  describedBy,
  children,
  onPointerDownOutside,
  onEscapeKeyDown,
}: {
  anchor: PanelAnchor
  size?: PanelSize
  tone?: PanelTone
  leftOffset?: PanelLeftOffset
  className?: string
  contentClassName?: string
  labelledBy?: string
  describedBy?: string
  children: React.ReactNode
  onPointerDownOutside?: React.ComponentProps<
    typeof DialogPrimitive.Content
  >["onPointerDownOutside"]
  onEscapeKeyDown?: React.ComponentProps<
    typeof DialogPrimitive.Content
  >["onEscapeKeyDown"]
}) {
  const positionStyle = anchorPositionStyle(anchor, leftOffset)
  const sizeStyle = resolveSizeStyle(size)
  const toneClasses = toneSurfaceClasses(tone)

  return (
    <DialogPrimitive.Content
      data-slot="workspace-panel-surface"
      data-anchor={anchor}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onPointerDownOutside={onPointerDownOutside}
      onEscapeKeyDown={onEscapeKeyDown}
      style={{ ...positionStyle, ...sizeStyle }}
      className={cn(
        /**
         * Single coordinated z-band: backdrop sits at z-40, surface at
         * z-50 (matches the project's existing modal layer). The
         * Today launcher is z-40 so it disappears UNDER the backdrop
         * when the inlay opens; chrome will also explicitly hide it.
         */
        "fixed z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl outline-none",
        "mb-[env(safe-area-inset-bottom)]",
        toneClasses,
        /**
         * Subtle scale + fade on open/close via Radix data-state.
         * No slide — `bottom-center` already implies the panel rises
         * from the launcher's region, and a scale effect reads more
         * "integrated" than a translate.
         */
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          contentClassName,
        )}
      >
        {children}
      </div>
    </DialogPrimitive.Content>
  )
}

// ─── Re-export Radix sub-primitives so callers don't have to import
//     @radix-ui/react-dialog directly. Keeps WorkspacePanel a single
//     import surface. ───────────────────────────────────────────────

export const WorkspacePanelTitle = DialogPrimitive.Title
export const WorkspacePanelDescription = DialogPrimitive.Description
export const WorkspacePanelClose = DialogPrimitive.Close

// ─── Internals ───────────────────────────────────────────────────────

function resolveSizeStyle(size?: PanelSize): React.CSSProperties {
  if (!size) return {}
  const toCss = (v?: number | string): string | undefined => {
    if (v === undefined) return undefined
    return typeof v === "number" ? `${v}px` : v
  }
  return {
    minWidth: toCss(size.minWidth),
    maxWidth: toCss(size.maxWidth),
    minHeight: toCss(size.minHeight),
    maxHeight: toCss(size.maxHeight),
  }
}

function toneSurfaceClasses(tone: PanelTone): string {
  if (tone === "light") {
    return "border-border bg-background text-foreground"
  }
  return "border-[var(--border-dark)] bg-[var(--app-shell-bg)] text-[var(--text-primary-light)]"
}

/**
 * Resolve anchor + optional sidebar offset into a `React.CSSProperties`
 * snapshot. We keep ALL positioning in inline style because the
 * `leftOffset.desktopPx` is dynamic and Tailwind's JIT can't see it
 * at build time. Constants (e.g. the "bottom: 1.5rem" gap, the 1px
 * translate adjustments) could in theory be classes; we keep them in
 * style too for a single source of truth per anchor.
 */
function anchorPositionStyle(
  anchor: PanelAnchor,
  leftOffset?: PanelLeftOffset,
): React.CSSProperties {
  const desktopPx = leftOffset?.desktopPx ?? 0

  switch (anchor) {
    case "bottom-center":
      /**
       * Workspace-area horizontal center. Math:
       *   centerX = sidebarWidth + (viewportWidth - sidebarWidth) / 2
       *           = viewportWidth/2 + sidebarWidth/2
       * Combined with `translateX(-50%)` so the surface's center
       * lands on `centerX`.
       */
      return {
        left: `calc(50% + ${desktopPx / 2}px)`,
        transform: "translateX(-50%)",
        bottom: "1.5rem",
      }
    case "top-center":
      return {
        left: `calc(50% + ${desktopPx / 2}px)`,
        transform: "translateX(-50%)",
        top: "1.5rem",
      }
    case "center":
      return {
        left: `calc(50% + ${desktopPx / 2}px)`,
        top: "50%",
        transform: "translate(-50%, -50%)",
      }
    case "left":
      return {
        left: `${desktopPx + 16}px`,
        top: "1rem",
        bottom: "1rem",
      }
    case "right":
      return {
        right: "1rem",
        top: "1rem",
        bottom: "1rem",
      }
  }
}
