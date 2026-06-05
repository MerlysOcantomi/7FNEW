"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Mail, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Single-recipient, contact-aware picker for the Inbox "New Email" dialog.
 *
 * Design notes:
 *  - The input text IS the value (a single email string). Typing propagates to
 *    `onChange` so manual addresses keep working exactly like the old raw input;
 *    selecting a suggestion overwrites the text with the contact's email.
 *  - Suggestions come from the central workspace Contact model via
 *    `GET /api/contacts/search` (read-only). No Inbox-specific contact book.
 *  - Deliberately NOT a Radix Popover: an inline absolutely-positioned panel
 *    keeps focus in the input so the user can keep typing inside the Dialog.
 *  - No AI, no multi-recipient, and the first suggestion is never auto-selected
 *    (activeIndex starts at -1).
 */

interface ContactSuggestion {
  id: string
  nombre: string | null
  email: string
  empresa: string | null
  tipo: string | null
}

interface ComposeRecipientPickerProps {
  value: string
  onChange: (email: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

/** How many recent contacts to surface in the empty/focused state. */
const MAX_RECENT = 4

/**
 * Presentation-only mapping for `Contact.tipo`. The DB stores internal Spanish
 * values; we never mutate them — this only relabels them in the picker so the
 * operator doesn't see raw "visitante"/"cliente". Unknown values are title-cased.
 */
const TYPE_LABELS: Record<string, string> = {
  cliente: "Client",
  visitante: "Visitor",
  lead: "Lead",
  proveedor: "Vendor",
  prospecto: "Prospect",
}

function formatType(tipo: string | null): string | null {
  if (!tipo) return null
  const key = tipo.trim().toLowerCase()
  if (!key) return null
  return TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

export function ComposeRecipientPicker({
  value,
  onChange,
  disabled,
  autoFocus,
}: ComposeRecipientPickerProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ContactSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  /** Skip the debounced fetch on the render immediately after a selection. */
  const skipNextFetchRef = useRef(false)
  const listboxId = useId()

  useEffect(() => {
    if (!open) return
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query.trim())}`)
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: ContactSuggestion[] }
          | null
        setResults(json?.success && Array.isArray(json.data) ? json.data : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query, open])

  const trimmed = query.trim()
  const looksLikeEmail = EMAIL_RE.test(trimmed)
  const hasExactMatch = useMemo(
    () => results.some((c) => c.email.toLowerCase() === trimmed.toLowerCase()),
    [results, trimmed],
  )
  const showNewEmail = looksLikeEmail && !hasExactMatch

  /**
   * In the empty/focused state we only surface a few recent contacts so the
   * dropdown stays small; a typed query shows the full result set (capped by the
   * endpoint) with scroll.
   */
  const visibleResults = trimmed.length < 2 ? results.slice(0, MAX_RECENT) : results

  /** Flat option list = visible contacts then (optionally) the "use new email" row. */
  const optionCount = visibleResults.length + (showNewEmail ? 1 : 0)

  function commit(email: string) {
    const next = email.trim()
    skipNextFetchRef.current = true
    setQuery(next)
    onChange(next)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleInputChange(next: string) {
    setQuery(next)
    onChange(next)
    setOpen(true)
    setActiveIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (!open) {
        setOpen(true)
        return
      }
      if (optionCount === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % optionCount)
    } else if (e.key === "ArrowUp") {
      if (optionCount === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? optionCount - 1 : i - 1))
    } else if (e.key === "Enter") {
      if (!open || activeIndex < 0) return
      e.preventDefault()
      if (activeIndex < visibleResults.length) {
        commit(visibleResults[activeIndex].email)
      } else if (showNewEmail) {
        commit(trimmed)
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
    }
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search name, company, or email..."
        type="text"
        inputMode="email"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so an option's onMouseDown/click can register before close.
          window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
      />

      {open && (loading || optionCount > 0) ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-[var(--surface-overlay-border)] bg-[var(--surface-overlay)] text-[var(--surface-overlay-foreground)] shadow-lg"
        >
          <div className="max-h-[184px] overflow-y-auto p-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--surface-overlay-border)] [&::-webkit-scrollbar-track]:bg-transparent">
            {loading && visibleResults.length === 0 ? (
              <div className="px-2 py-2 text-xs text-[var(--surface-overlay-muted)]">Searching…</div>
            ) : null}

            {visibleResults.map((c, idx) => {
              const active = idx === activeIndex
              const display = c.nombre?.trim() || c.email
              const typeLabel = formatType(c.tipo)
              const secondary = [c.empresa?.trim() || null, typeLabel].filter(Boolean).join(" · ")
              const showEmail = display !== c.email
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  // Prevent input blur before the click selects the option.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(c.email)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--surface-overlay-muted)]" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                    <span className="truncate font-medium">{display}</span>
                    {showEmail ? (
                      <span className="truncate text-xs text-[var(--surface-overlay-muted)]">{c.email}</span>
                    ) : null}
                  </span>
                  {secondary ? (
                    <span className="max-w-[42%] shrink-0 truncate text-[11px] text-[var(--surface-overlay-muted)]">
                      {secondary}
                    </span>
                  ) : null}
                </button>
              )
            })}

            {showNewEmail ? (
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === visibleResults.length}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(visibleResults.length)}
                onClick={() => commit(trimmed)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  activeIndex === visibleResults.length
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0 text-[var(--surface-overlay-muted)]" aria-hidden="true" />
                <span className="truncate text-[var(--surface-overlay-muted)]">
                  Use new email: <span className="font-medium text-[var(--surface-overlay-foreground)]">{trimmed}</span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
