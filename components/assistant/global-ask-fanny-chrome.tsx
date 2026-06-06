"use client"

import { TalkToFanny } from "@/components/inbox/talk-to-fanny"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"

/**
 * Renders the controlled Ask Fanny panel for the global action row. Driven by
 * `AskFannyProvider`: open state from the top trigger, conversation/message
 * scope published by the Inbox page. Reuses the existing `TalkToFanny` panel
 * (and its /ask API) verbatim — this chrome only owns mounting + wiring.
 *
 * PR1 is Inbox-only, so `AppShell` mounts this exclusively on `/inbox`. The
 * `available` guard keeps it inert if it ever renders outside a provider.
 */
export function GlobalAskFannyChrome() {
  const { open, setOpen, context, available } = useAskFanny()

  if (!available) return null

  return (
    <TalkToFanny
      open={open}
      onOpenChange={setOpen}
      conversationId={context.conversationId}
      selectedMessageId={context.selectedMessageId}
      actingOnScope={context.actingOnScope}
      latestInboundMessageId={context.latestInboundMessageId}
    />
  )
}
