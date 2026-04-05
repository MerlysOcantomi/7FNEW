"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"
import {
  getScopePriority,
  isEditableElement,
  matchesShortcut,
  parseShortcutCombo,
  type KeyboardShortcutDefinition,
  type RegisteredKeyboardShortcut,
  type ShortcutScope,
} from "@/lib/shortcuts"

interface KeyboardShortcutsContextValue {
  registerShortcuts: (shortcuts: KeyboardShortcutDefinition[], scope: ShortcutScope) => () => void
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const shortcutsRef = useRef<RegisteredKeyboardShortcut[]>([])
  const nextOrderRef = useRef(0)

  const registerShortcuts = useCallback((shortcuts: KeyboardShortcutDefinition[], scope: ShortcutScope) => {
    const registrations = shortcuts
      .map((shortcut) => {
        const parsedCombo = parseShortcutCombo(shortcut.combo)
        if (!parsedCombo) return null

        nextOrderRef.current += 1

        return {
          ...shortcut,
          scope,
          order: nextOrderRef.current,
          parsedCombo,
        } satisfies RegisteredKeyboardShortcut
      })
      .filter((shortcut): shortcut is RegisteredKeyboardShortcut => shortcut !== null)

    if (registrations.length === 0) {
      return () => {}
    }

    shortcutsRef.current = [...shortcutsRef.current, ...registrations]

    return () => {
      const registeredIds = new Set(registrations.map((shortcut) => shortcut.order))
      shortcutsRef.current = shortcutsRef.current.filter((shortcut) => !registeredIds.has(shortcut.order))
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return

      const targetIsEditable = isEditableElement(event.target)
      const shortcut = [...shortcutsRef.current]
        .filter((candidate) => {
          if (candidate.enabled === false) return false
          if (targetIsEditable && !candidate.allowInEditable) return false

          return matchesShortcut(event, candidate.parsedCombo)
        })
        .sort((left, right) => {
          const scopePriority = getScopePriority(right.scope) - getScopePriority(left.scope)
          if (scopePriority !== 0) return scopePriority

          return right.order - left.order
        })[0]

      if (!shortcut) return

      if (shortcut.preventDefault) {
        event.preventDefault()
      }

      shortcut.handler(event)
    }

    // All keyboard shortcuts flow through this single global listener.
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const value = useMemo<KeyboardShortcutsContextValue>(
    () => ({ registerShortcuts }),
    [registerShortcuts],
  )

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

export function useKeyboardShortcutsRegistry() {
  const context = useContext(KeyboardShortcutsContext)

  if (!context) {
    throw new Error("useKeyboardShortcutsRegistry must be used within KeyboardShortcutsProvider.")
  }

  return context
}
