/**
 * Minimal, inline-styled email templates for the 7F platform.
 * All styles are inlined for maximum email-client compatibility.
 */

const FONT_STACK = "system-ui, -apple-system, sans-serif"

export interface BaseEmailOptions {
  /** Main body HTML (already escaped / formatted by the caller). */
  body: string
  /** Optional footer line. Defaults to "Sent via 7F". */
  footer?: string
}

/**
 * Wraps arbitrary body HTML in a consistent 7F-branded email shell.
 * Keeps things dead-simple: single column, readable, mobile-friendly.
 */
export function wrapEmailHtml({ body, footer = "Sent via 7F" }: BaseEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:${FONT_STACK}">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9fafb">
    <tr><td align="center" style="padding:32px 16px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:560px;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb">
        <tr><td style="padding:32px;font-size:15px;line-height:1.6;color:#1f2937">
          ${body}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">${escapeHtml(footer)}</p>
    </td></tr>
  </table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Per-workspace acknowledgment config (lives in workspace.config.email.ack)
// ---------------------------------------------------------------------------

export interface AckEmailConfig {
  enabled?: boolean
  senderName?: string
  subject?: string
  heading?: string
  body?: string
  footer?: string
}

const ACK_DEFAULTS: Required<AckEmailConfig> = {
  enabled: true,
  senderName: "",
  subject: "",
  heading: "We received your message and our team will get back to you shortly.",
  body: "No need to reply to this email. We'll follow up directly.",
  footer: "",
}

/**
 * Extracts and merges ack email config from the raw workspace config JSON.
 * Returns full config with safe defaults for every field.
 */
export function resolveAckEmailConfig(
  workspaceConfigJson: string | null | undefined,
): Required<AckEmailConfig> {
  if (!workspaceConfigJson) return { ...ACK_DEFAULTS }
  try {
    const parsed = JSON.parse(workspaceConfigJson)
    const ack = parsed?.email?.ack
    if (!ack || typeof ack !== "object") return { ...ACK_DEFAULTS }
    return {
      enabled: typeof ack.enabled === "boolean" ? ack.enabled : ACK_DEFAULTS.enabled,
      senderName: typeof ack.senderName === "string" ? ack.senderName : ACK_DEFAULTS.senderName,
      subject: typeof ack.subject === "string" ? ack.subject : ACK_DEFAULTS.subject,
      heading: typeof ack.heading === "string" ? ack.heading : ACK_DEFAULTS.heading,
      body: typeof ack.body === "string" ? ack.body : ACK_DEFAULTS.body,
      footer: typeof ack.footer === "string" ? ack.footer : ACK_DEFAULTS.footer,
    }
  } catch {
    return { ...ACK_DEFAULTS }
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
