"use client"

import { TalkToFanny } from "@/components/inbox/talk-to-fanny"
import { useAskFanny } from "@/components/assistant/ask-fanny-provider"

/**
 * Renders the controlled Ask Fanny panel for the global action row. Driven by
 * `AskFannyProvider`: open state from the top trigger, conversation/message
 * scope published by the Inbox page. Reuses the existing `TalkToFanny` panel
 * (and its /ask API) verbatim — this chrome only owns mounting + wiring.
 *
 * Inbox-only, so `AppShell` mounts this exclusively on `/inbox`. The
 * `available` guard keeps it inert if it ever renders outside a provider.
 *
 * Desktop (`xl`+) Inbox renders Ask Fanny INLINE in the right Intelligence
 * panel (see `app/inbox/page.tsx`), so this overlay is hidden there (`xl:hidden`).
 * Below `xl` the right column is collapsed behind a sheet, so we keep the
 * controlled top-right overlay as the single Ask Fanny surface — no floating FAB.
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
      className="xl:hidden"
    />
  )
}
