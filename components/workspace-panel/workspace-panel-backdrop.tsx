"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

/**
 * Soft scrim behind a workspace panel.
 *
 * Built on top of `DialogPrimitive.Overlay` so it inherits Radix's
 * portal mounting, `data-state` open/close animation hooks, and a11y
 * wiring. We render it as a Radix sub-component (NOT a free-standing
 * `<div>`) so it stays inside the same Dialog tree as the surface —
 * Radix relies on this proximity for focus + scroll-lock management.
 *
 * The scrim deliberately reads "soft, calming" rather than the heavy
 * `bg-black/50` of the default dialog overlay; the panel below it is
 * meant to feel integrated into the workspace, not a true blocking
 * modal. The scrim is ALWAYS clickable to close — per the PR's design
 * choice — and Radix turns the click into an `onOpenChange(false)`
 * call on the parent `Dialog.Root`.
 *
 * Future PRs (Stack / Side-by-side / Coordinator) will lift this into
 * a "single shared backdrop per layer" model where opening N panels
 * still mounts only ONE backdrop. Today, with a single panel, one
 * Overlay per Dialog is the simplest correct shape.
 */
export function WorkspacePanelBackdrop({
  className,
}: {
  className?: string
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="workspace-panel-backdrop"
      className={cn(
        /**
         * Stacked under the surface (z-40 < z-50). Animated via Radix
         * data-state hooks; the keyframes come from `tw-animate-css`
         * which is already in the project deps.
         */
        "fixed inset-0 z-40",
        "bg-black/40 backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
    />
  )
}
