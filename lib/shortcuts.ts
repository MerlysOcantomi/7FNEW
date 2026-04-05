"use client"

export type ShortcutScope = "global" | "page" | "overlay"

export interface KeyboardShortcutDefinition {
  id: string
  combo: string
  description?: string
  enabled?: boolean
  allowInEditable?: boolean
  preventDefault?: boolean
  handler: (event: KeyboardEvent) => void
}

export interface ParsedShortcutCombo {
  key: string | null
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

export interface RegisteredKeyboardShortcut extends KeyboardShortcutDefinition {
  scope: ShortcutScope
  order: number
  parsedCombo: ParsedShortcutCombo
}

const KEY_ALIASES: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  up: "ArrowUp",
  arrowup: "ArrowUp",
  down: "ArrowDown",
  arrowdown: "ArrowDown",
  left: "ArrowLeft",
  arrowleft: "ArrowLeft",
  right: "ArrowRight",
  arrowright: "ArrowRight",
  space: " ",
}

export const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  global: 0,
  page: 1,
  overlay: 2,
}

export function getScopePriority(scope: ShortcutScope) {
  return SCOPE_PRIORITY[scope]
}

export function normalizeKey(key: string) {
  if (key.length === 1) return key.toLowerCase()

  return KEY_ALIASES[key.toLowerCase()] ?? key
}

export function parseShortcutCombo(combo: string): ParsedShortcutCombo | null {
  const parts = combo
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return null

  const parsed: ParsedShortcutCombo = {
    key: null,
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  }

  for (const part of parts) {
    const token = part.toLowerCase()

    if (token === "mod") {
      parsed.mod = true
      continue
    }

    if (token === "ctrl" || token === "control") {
      parsed.ctrl = true
      continue
    }

    if (token === "meta" || token === "cmd" || token === "command") {
      parsed.meta = true
      continue
    }

    if (token === "alt" || token === "option") {
      parsed.alt = true
      continue
    }

    if (token === "shift") {
      parsed.shift = true
      continue
    }

    parsed.key = normalizeKey(part)
  }

  return parsed.key ? parsed : null
}

export function matchesShortcut(event: KeyboardEvent, combo: ParsedShortcutCombo) {
  if (normalizeKey(event.key) !== combo.key) return false

  if (combo.mod) {
    if (!event.ctrlKey && !event.metaKey) return false
  } else if (event.ctrlKey || event.metaKey) {
    return false
  }

  if (!combo.mod) {
    if (event.ctrlKey !== combo.ctrl) return false
    if (event.metaKey !== combo.meta) return false
  }

  if (event.altKey !== combo.alt) return false
  if (event.shiftKey !== combo.shift) return false

  return true
}

export function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  if (target.isContentEditable) return true

  return Boolean(target.closest('[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'))
}
