"use client"

/**
 * React binding for the pure hold-to-talk gesture machine. Attaches pointer +
 * click handlers to the launcher; real timers and (optional) haptics live
 * here, all decisions live in `modules/assistant/finesse-long-press.ts`.
 */

import { useEffect, useMemo, useRef } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { LongPressGesture } from "@modules/assistant/finesse-long-press"

export interface FinesseLongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClick: () => void
}

export function useFinesseLongPress({
  enabled,
  onLongPress,
  onClick,
}: {
  /** Long press active (voice available + touch device). Click always works. */
  enabled: boolean
  onLongPress: () => void
  onClick: () => void
}): FinesseLongPressHandlers {
  const callbacksRef = useRef({ onLongPress, onClick })
  callbacksRef.current = { onLongPress, onClick }
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const gesture = useMemo(
    () =>
      new LongPressGesture(
        {
          onLongPress: () => {
            // Light, optional haptic — never required, never on unsupported.
            try {
              navigator.vibrate?.(12)
            } catch {
              /* no haptics */
            }
            callbacksRef.current.onLongPress()
          },
          onClick: () => callbacksRef.current.onClick(),
        },
        {
          schedule: (fn, ms) => setTimeout(fn, ms),
          cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        },
      ),
    [],
  )

  useEffect(() => () => gesture.dispose(), [gesture])

  return useMemo<FinesseLongPressHandlers>(
    () => ({
      onPointerDown: (e) => {
        const coarse = enabledRef.current && (e.pointerType === "touch" || e.pointerType === "pen")
        gesture.pointerDown(e.clientX, e.clientY, coarse)
      },
      onPointerMove: (e) => gesture.pointerMove(e.clientX, e.clientY),
      onPointerUp: () => gesture.pointerUp(),
      onPointerCancel: () => gesture.pointerCancel(),
      // Keyboard/AT activation lands here directly (no pointerdown) and runs
      // the normal click path inside the machine.
      onClick: () => {
        gesture.clickIntercepted()
      },
    }),
    [gesture],
  )
}
