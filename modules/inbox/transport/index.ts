/**
 * Transport registration entry point (INBOX-TRANSPORT-05A). Importing this
 * module guarantees the built-in transports are registered exactly once.
 * Future adapters (WhatsApp/Meta, Twilio SMS, …) register here — and ONLY
 * once their integration is real: registering a transport is what makes a
 * channel actually able to send (no fake integrations).
 */

import { registerChannelTransport } from "./registry"
import { createEmailTransports } from "./email-transport"
import { createWebChatTransport } from "./web-chat-transport"

let registered = false

export function ensureBuiltInTransportsRegistered(): void {
  if (registered) return
  registered = true
  for (const transport of createEmailTransports()) {
    registerChannelTransport(transport)
  }
  // Web chat is a REAL integration: pull-delivery via the public
  // conversation endpoint the first-party widget polls (WEB-CHAT-CONNECTION-01).
  registerChannelTransport(createWebChatTransport())
}

ensureBuiltInTransportsRegistered()

export * from "./contracts"
export { resolveChannelTransport, listRegisteredChannelTransports } from "./registry"
