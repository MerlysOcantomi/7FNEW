"use client"

import { ConversationChannelBadge } from "@/components/inbox/conversation-channel-badge"
import { cn } from "@/lib/utils"

/**
 * Compact, single-line context strip for Focus layout mode.
 *
 * In Focus the heavy right Fanny/context panel is hidden so the message + composer get the
 * room; this strip is the only context surface. It deliberately stays to ONE low line:
 * channel anchor · sender · short intent · at most one critical signal. No long Fanny
 * summary, no task list, no big card — that space belongs to the message.
 *
 * Everything truncates and the wrappers carry `min-w-0` so the strip can never widen or
 * overflow the (now wide) center column.
 */
interface InboxContextStripProps {
  channel: string
  channelLabel: string
  senderLabel: string
  intent?: string | null
  /** At most one critical signal (e.g. high/critical urgency label). `null` hides it. */
  signalLabel?: string | null
  className?: string
}

export function InboxContextStrip({
  channel,
  channelLabel,
  senderLabel,
  intent,
  signalLabel,
  className,
}: InboxContextStripProps) {
  const trimmedIntent = intent?.trim() || null
  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 border-b border-[var(--inbox-divider)] bg-[var(--inbox-surface)]/60 px-4 py-1.5",
        className,
      )}
    >
      <ConversationChannelBadge channel={channel} label={channelLabel} />
      <span
        className="max-w-[40%] shrink-0 truncate text-xs font-semibold text-[var(--inbox-text)]"
        title={senderLabel}
      >
        {senderLabel}
      </span>
      {trimmedIntent ? (
        <>
          <span className="shrink-0 text-[var(--inbox-text-secondary)]/60" aria-hidden="true">
            ·
          </span>
          <span
            className="min-w-0 flex-1 truncate text-xs text-[var(--inbox-text-secondary)]"
            title={trimmedIntent}
          >
            {trimmedIntent}
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden="true" />
      )}
      {signalLabel ? (
        <span
          className="max-w-[7rem] shrink-0 truncate rounded-md border border-[rgba(232,111,116,0.32)] bg-[rgba(232,111,116,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--inbox-destructive)] whitespace-nowrap"
          title={`Urgency: ${signalLabel}`}
        >
          {signalLabel}
        </span>
      ) : null}
    </div>
  )
}
