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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
