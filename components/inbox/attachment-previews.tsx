"use client"

import { useState } from "react"
import { Download, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MessageAttachment } from "@/components/inbox/message-bubble"

/**
 * Shared attachment renderer for the Smart Inbox message views (chat bubble + single-email
 * reader). Splits attachments into two groups:
 *
 *  - **Images** (`contentType` starts with `image/` and a usable `url`): rendered as inline
 *    clickable thumbnails so operators can see screenshots/photos without downloading first.
 *    If the image fails to load (expired blob, wrong content-type, network), the item falls
 *    back to the same file chip used for non-images — never a broken `<img>`.
 *  - **Everything else** (PDF, docs, zips, and images with no URL): the existing compact file
 *    chip with filename + size + download affordance.
 *
 * Storage note: inbox attachments live in Vercel Blob with `access: "public"`, so the `url`
 * is a plain public HTTPS link that works directly in `<img src>` and `<a href>`. No signing
 * round-trip is required and no tenant data is exposed beyond the already-public blob.
 *
 * This component is presentational only — it never fetches, mutates, or triggers automation.
 */

interface AttachmentPreviewsProps {
  attachments: MessageAttachment[]
  /** Bubble tone drives the chip text colour so it reads on both light and dark surfaces. */
  tone: "inbound" | "outbound" | "internal" | "system"
  /** Layout variant: `bubble` (chat pile) keeps a tighter chip; `email` (reader) is roomier. */
  variant: "bubble" | "email"
}

function isImageAttachment(att: MessageAttachment): boolean {
  return Boolean(att.url) && (att.contentType?.toLowerCase().startsWith("image/") ?? false)
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${Math.round(size / 1024)} KB`
  return `${(size / 1048576).toFixed(1)} MB`
}

function FileChip({
  att,
  tone,
  variant,
}: {
  att: MessageAttachment
  tone: AttachmentPreviewsProps["tone"]
  variant: AttachmentPreviewsProps["variant"]
}) {
  const isEmail = variant === "email"
  return (
    <a
      href={att.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
        isEmail &&
          "border border-[var(--inbox-border)]/50 bg-white/[0.03] text-[var(--inbox-text)] hover:border-[var(--inbox-accent)]/40 hover:bg-white/[0.06] hover:text-[var(--inbox-accent)]",
        !isEmail && (att.url ? "cursor-pointer hover:bg-current/10" : "cursor-default opacity-60"),
        !isEmail && (tone === "outbound" ? "text-white/90" : "text-[var(--inbox-text)]/80"),
        !att.url && "cursor-default opacity-60",
      )}
      onClick={att.url ? undefined : (e) => e.preventDefault()}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className={cn("truncate font-medium", isEmail ? "max-w-[220px]" : "max-w-[180px]")}>
        {att.filename}
      </span>
      {att.size != null ? <span className="text-[10px] opacity-70">{formatSize(att.size)}</span> : null}
      {att.url ? <Download className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" /> : null}
    </a>
  )
}

function ImageThumbnail({
  att,
  tone,
  variant,
  onError,
}: {
  att: MessageAttachment
  tone: AttachmentPreviewsProps["tone"]
  variant: AttachmentPreviewsProps["variant"]
  onError: () => void
}) {
  return (
    <a
      href={att.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      title={att.filename}
      className={cn(
        "group relative block overflow-hidden rounded-lg border transition-colors",
        "border-[var(--inbox-border)]/50 hover:border-[var(--inbox-accent)]/50",
        tone === "outbound" ? "bg-white/10" : "bg-white/[0.04]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs are arbitrary public hosts; next/image remotePatterns would have to allowlist every blob domain. */}
      <img
        src={att.url}
        alt={att.filename}
        loading="lazy"
        onError={onError}
        className={cn(
          "block h-auto w-auto object-contain",
          variant === "email" ? "max-h-64 max-w-[280px]" : "max-h-48 max-w-[220px]",
        )}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {att.filename}
      </span>
    </a>
  )
}

function AttachmentEntry({
  att,
  tone,
  variant,
}: {
  att: MessageAttachment
  tone: AttachmentPreviewsProps["tone"]
  variant: AttachmentPreviewsProps["variant"]
}) {
  const [imageFailed, setImageFailed] = useState(false)
  if (isImageAttachment(att) && !imageFailed) {
    return (
      <ImageThumbnail att={att} tone={tone} variant={variant} onError={() => setImageFailed(true)} />
    )
  }
  return <FileChip att={att} tone={tone} variant={variant} />
}

export function AttachmentPreviews({ attachments, tone, variant }: AttachmentPreviewsProps) {
  if (!attachments || attachments.length === 0) return null
  return (
    <div className={cn("flex flex-wrap items-start gap-2", variant === "bubble" && "flex-col")}>
      {attachments.map((att) => (
        <AttachmentEntry key={att.url || att.filename} att={att} tone={tone} variant={variant} />
      ))}
    </div>
  )
}
