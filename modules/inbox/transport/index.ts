/**
 * Transport registration entry point (INBOX-TRANSPORT-05A). Importing this
 * module guarantees the built-in transports are registered exactly once.
 * Future adapters (WhatsApp/Meta, Twilio SMS, …) register here — and ONLY
 * once their integration is real: registering a transport is what makes a
 * channel actually able to send (no fake integrations).
 */

import { registerChannelTransport } from "./registry"
import { createEmailTransports } from "./email-transport"

let registered = false

export function ensureBuiltInTransportsRegistered(): void {
  if (registered) return
  registered = true
  for (const transport of createEmailTransports()) {
    registerChannelTransport(transport)
  }
}

ensureBuiltInTransportsRegistered()

export * from "./contracts"
export { resolveChannelTransport, listRegisteredChannelTransports } from "./registry"
