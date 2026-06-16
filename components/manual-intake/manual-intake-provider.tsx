"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * Manual Intake — global capture surface for 7F.
 *
 * Mirrors the sibling global-action providers (Today / Agents / Ask Fanny): a
 * low-level `setOpen` plus one-direction helpers, and an `available` flag that is
 * only `true` inside a real provider so triggers in unknown territory stay no-op
 * safe instead of throwing.
 *
 * Manual Intake is a first-class manual channel capture (channel="manual"), NOT a
 * notes app and NOT a second Today. It opens from the inbox toolbar ("Capture")
 * and from Global New, and on confirm writes a real Manual conversation (and an
 * optional linked follow-up task) through existing Inbox write paths.
 */
export interface ManualIntakeContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openManualIntake: () => void
  closeManualIntake: () => void
  available: boolean
}

const noopValue: ManualIntakeContextValue = {
  open: false,
  setOpen: () => {},
  openManualIntake: () => {},
  closeManualIntake: () => {},
  available: false,
}

const ManualIntakeContextObject = createContext<ManualIntakeContextValue>(noopValue)

export function useManualIntake(): ManualIntakeContextValue {
  return useContext(ManualIntakeContextObject)
}

export function ManualIntakeProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openManualIntake = useCallback(() => setOpen(true), [])
  const closeManualIntake = useCallback(() => setOpen(false), [])

  const value = useMemo<ManualIntakeContextValue>(
    () => ({ open, setOpen, openManualIntake, closeManualIntake, available: true }),
    [open, openManualIntake, closeManualIntake],
  )

  return (
    <ManualIntakeContextObject.Provider value={value}>
      {children}
    </ManualIntakeContextObject.Provider>
  )
}
