"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Check, X, Loader2 } from "lucide-react"

/* ─── InlineText ─── */

interface InlineTextProps {
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  className?: string
  inputClassName?: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
}

export function InlineText({
  value, onSave, placeholder = "Escribe aquí...", className, inputClassName, as: Tag = "span",
}: InlineTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const save = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === value) { setEditing(false); return }
    if (!trimmed) { setDraft(value); setEditing(false); return }
    setSaving(true)
    try {
      await onSave(trimmed)
      setEditing(false)
    } catch {
      setDraft(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draft, value, onSave])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save() }
          if (e.key === "Escape") { setDraft(value); setEditing(false) }
        }}
        disabled={saving}
        className={cn(
          "bg-transparent outline-none border-b-2 border-foreground/20 focus:border-foreground/50 transition-colors w-full",
          saving && "opacity-50",
          inputClassName ?? className,
        )}
      />
    )
  }

  return (
    <Tag
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-pointer rounded-md px-1.5 py-0.5 -mx-1.5 transition-all hover:bg-muted/60 focus-visible:bg-muted/60",
        saving && "opacity-50",
        !value && "text-muted-foreground italic",
        className,
      )}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true) }}
    >
      {value || placeholder}
      {saving && <Loader2 className="inline-block h-3 w-3 ml-1 animate-spin" />}
    </Tag>
  )
}

/* ─── InlineSelect ─── */

interface SelectOption {
  value: string
  label: string
}

interface InlineSelectProps {
  value: string
  options: SelectOption[]
  onSave: (value: string) => Promise<void>
  className?: string
  badgeClassName?: string | ((value: string) => string)
}

export function InlineSelect({ value, options, onSave, className, badgeClassName }: InlineSelectProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    if (editing) {
      selectRef.current?.focus()
    }
  }, [editing])

  const handleChange = useCallback(async (newValue: string) => {
    if (newValue === value) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(newValue)
    } catch { /* toast handled by parent */ }
    finally {
      setSaving(false)
      setEditing(false)
    }
  }, [value, onSave])

  const display = options.find((o) => o.value === value)?.label ?? value

  const badgeCls = typeof badgeClassName === "function" ? badgeClassName(value) : badgeClassName

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        disabled={saving}
        className={cn(
          "rounded-lg border border-border bg-card px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring",
          saving && "opacity-50",
          className,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "rounded-full px-3 py-0.5 text-xs font-medium transition-all hover:opacity-80 cursor-pointer",
        badgeCls ?? "bg-muted text-muted-foreground",
        saving && "opacity-50",
        className,
      )}
    >
      {display}
      {saving && <Loader2 className="inline-block h-3 w-3 ml-1 animate-spin" />}
    </button>
  )
}

/* ─── InlineTextarea ─── */

interface InlineTextareaProps {
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  className?: string
  rows?: number
}

export function InlineTextarea({ value, onSave, placeholder = "Agregar notas...", className, rows = 3 }: InlineTextareaProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const save = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === (value ?? "").trim()) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(trimmed || "")
      setEditing(false)
    } catch {
      setDraft(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [draft, value, onSave])

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={rows}
          disabled={saving}
          className={cn(
            "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none",
            saving && "opacity-50",
            className,
          )}
        />
        <div className="flex items-center gap-1 mt-1.5">
          <button
            onClick={save}
            className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-80 transition-opacity"
          >
            <Check className="h-3 w-3" /> Guardar
          </button>
          <button
            onClick={() => { setDraft(value); setEditing(false) }}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-pointer rounded-lg px-3 py-2 text-sm leading-relaxed transition-all hover:bg-muted/60 min-h-[3rem]",
        value ? "text-foreground/80" : "text-muted-foreground italic",
        saving && "opacity-50",
        className,
      )}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true) }}
    >
      {value || placeholder}
    </div>
  )
}

/* ─── InlineDate ─── */

interface InlineDateProps {
  value: string | null | undefined
  onSave: (value: string | null) => Promise<void>
  placeholder?: string
  className?: string
}

export function InlineDate({ value, onSave, placeholder = "Sin fecha", className }: InlineDateProps) {
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const dateStr = value ? value.slice(0, 10) : ""
  const display = value
    ? new Date(value).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
    : placeholder

  const handleChange = useCallback(async (newVal: string) => {
    const iso = newVal ? new Date(newVal).toISOString() : null
    if (iso === value || (!iso && !value)) return
    setSaving(true)
    try {
      await onSave(iso)
    } catch { /* handled by parent */ }
    finally { setSaving(false) }
  }, [value, onSave])

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <span
        onClick={() => inputRef.current?.showPicker()}
        className={cn(
          "cursor-pointer text-sm rounded-md px-1.5 py-0.5 -mx-1.5 transition-all hover:bg-muted/60",
          !value && "text-muted-foreground italic",
          saving && "opacity-50",
        )}
      >
        {display}
        {saving && <Loader2 className="inline-block h-3 w-3 ml-1 animate-spin" />}
      </span>
      <input
        ref={inputRef}
        type="date"
        value={dateStr}
        onChange={(e) => handleChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  )
}

/* ─── InlineNumber (slider) ─── */

interface InlineNumberProps {
  value: number
  onSave: (value: number) => Promise<void>
  min?: number
  max?: number
  suffix?: string
  className?: string
}

export function InlineNumber({ value, onSave, min = 0, max = 100, suffix = "%", className }: InlineNumberProps) {
  const [draft, setDraft] = useState(value)
  const [changing, setChanging] = useState(false)
  const [saving, setSaving] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>(undefined)

  useEffect(() => { setDraft(value) }, [value])

  const handleChange = useCallback((n: number) => {
    setDraft(n)
    setChanging(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      if (n === value) { setChanging(false); return }
      setSaving(true)
      try { await onSave(n) } catch { setDraft(value) }
      finally { setSaving(false); setChanging(false) }
    }, 600)
  }, [value, onSave])

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        type="range"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="flex-1 accent-foreground cursor-pointer"
        disabled={saving}
      />
      <span className={cn(
        "text-sm font-semibold text-foreground w-12 text-right tabular-nums",
        (saving || changing) && "opacity-50",
      )}>
        {draft}{suffix}
      </span>
    </div>
  )
}
