/**
 * WebChatTransport (WEB-CHAT-CONNECTION-01) — pull-delivery transport for
 * the first-party web chat widget.
 *
 * Web chat has no push provider: the operator's reply is DELIVERED by being
 * stored on the conversation, because the visitor's widget
 * (`app/widget/chat/page.tsx`) polls the public conversation endpoint
 * (`/api/inbox/public/conversations/[id]/messages`) every few seconds and
 * renders every non-internal message. By the time this transport runs, the
 * outbound Message row is already persisted (`addMessage` in the reply
 * route), so the send step has nothing left to do except report the truth:
 * the message is available to the visitor's session NOW.
 *
 * Why a transport at all: without one, `sendConversationMessage` resolved
 * `transport_not_registered` and stamped the reply `deliveryStatus:
 * "failed"` — a false failure for a channel whose delivery mechanism is
 * pull, not push. Registering the real mechanism makes the delivery
 * projection honest: `sent` (made available to the session), never
 * `delivered`/`read` — the widget sends no receipts, so nothing beyond
 * `sent` may be claimed.
 *
 * No connection, no credentials, no external calls. The recipient address
 * is the visitor's session id (`Contact.source`), resolved by the outbound
 * service — it is only echoed into the neutral input, never logged here.
 */

import type { ChannelSendInput, ChannelSendResult, ChannelTransport } from "./contracts"

/**
 * Virtual provider key for the first-party widget. Web chat conversations
 * carry no ChannelConnection, so the outbound service falls back to this
 * key (see `resolveOutboundProvider` in outbound-service.ts).
 */
export const WEB_CHAT_PROVIDER = "web_chat"

export function createWebChatTransport(): ChannelTransport {
  return {
    channel: "web_chat",
    provider: WEB_CHAT_PROVIDER,
    async send(input: ChannelSendInput): Promise<ChannelSendResult> {
      // Storage IS delivery: the persisted message row is what the widget
      // polls. Nothing to transmit, nothing that can fail here.
      void input
      return {
        accepted: true,
        // No provider-side id exists — the Message row is the source of truth.
        externalMessageId: null,
        provider: WEB_CHAT_PROVIDER,
        initialDeliveryStatus: "sent",
        sentAt: new Date(),
        errorCode: null,
        retryable: false,
      }
    },
  }
}
