"use client"

import { useEffect } from "react"
import { useKeyboardShortcutsRegistry } from "@/components/keyboard-shortcuts-provider"
import { type KeyboardShortcutDefinition, type ShortcutScope } from "@/lib/shortcuts"

interface UseKeyboardShortcutsOptions {
  scope: ShortcutScope
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutDefinition[],
  { scope }: UseKeyboardShortcutsOptions,
) {
  const { registerShortcuts } = useKeyboardShortcutsRegistry()

  useEffect(() => {
    return registerShortcuts(shortcuts, scope)
  }, [registerShortcuts, shortcuts, scope])
}
