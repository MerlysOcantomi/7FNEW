/**
 * Minimal, inline-styled email templates for the 7F platform.
 * All styles are inlined for maximum email-client compatibility.
 */

import { getTranslations, resolveLocaleFromConfig, type SupportedLocale } from "@core/i18n"

const FONT_STACK = "system-ui, -apple-system, sans-serif"

export interface BaseEmailOptions {
  /** Main body HTML (already escaped / formatted by the caller). */
  body: string
  /** Optional footer line. Defaults to "Sent via 7F". */
  footer?: string
  /** HTML lang attribute. Defaults to "en". */
  locale?: string
}

/**
 * Wraps arbitrary body HTML in a consistent 7F-branded email shell.
 * Keeps things dead-simple: single column, readable, mobile-friendly.
 */
export function wrapEmailHtml({ body, footer = "Sent via 7F", locale = "en" }: BaseEmailOptions): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
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

function getAckDefaults(locale: SupportedLocale): Required<AckEmailConfig> {
  const t = getTranslations(locale)
  return {
    enabled: true,
    senderName: "",
    subject: "",
    heading: t.email.ack.heading,
    body: t.email.ack.body,
    footer: "",
  }
}

/**
 * Extracts and merges ack email config from the raw workspace config JSON.
 * Returns full config with safe defaults for every field.
 * Locale is resolved from the same config JSON (root-level `locale` key).
 */
export function resolveAckEmailConfig(
  workspaceConfigJson: string | null | undefined,
): Required<AckEmailConfig> & { locale: SupportedLocale } {
  /**
   * CONTENT locale: the locale of the translation set actually rendered.
   * For official locales without a legacy set yet (fr/it) this is "en" —
   * so <html lang> always matches the body text instead of claiming a
   * language whose catalog is still pending.
   */
  const locale = getTranslations(resolveLocaleFromConfig(workspaceConfigJson)).locale
  const defaults = getAckDefaults(locale)

  if (!workspaceConfigJson) return { ...defaults, locale }
  try {
    const parsed = JSON.parse(workspaceConfigJson)
    const ack = parsed?.email?.ack
    if (!ack || typeof ack !== "object") return { ...defaults, locale }
    return {
      enabled: typeof ack.enabled === "boolean" ? ack.enabled : defaults.enabled,
      senderName: typeof ack.senderName === "string" ? ack.senderName : defaults.senderName,
      subject: typeof ack.subject === "string" ? ack.subject : defaults.subject,
      heading: typeof ack.heading === "string" ? ack.heading : defaults.heading,
      body: typeof ack.body === "string" ? ack.body : defaults.body,
      footer: typeof ack.footer === "string" ? ack.footer : defaults.footer,
      locale,
    }
  } catch {
    return { ...defaults, locale }
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
