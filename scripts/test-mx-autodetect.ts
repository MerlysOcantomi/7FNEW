/**
 * Smoke test for MX-based autodetect. Run with:
 *   node --import tsx scripts/test-mx-autodetect.ts
 *
 * Validates that custom domains hosted on shared providers (Hostinger, Titan, Google
 * Workspace, Office365) are correctly mapped to the right IMAP/SMTP defaults via DNS MX
 * lookup, even when the bare domain isn't in `KNOWN_PROVIDERS`.
 *
 * No DB / no network beyond DNS. Safe to run anywhere with public DNS access.
 */

import { autodetectSettingsAsync } from "../modules/inbox/connection-validator"

async function main() {
  const cases = [
    "inbox@skina.digital",
    "support@hostinger.com",
    "hello@gmail.com",
    "hello@unknown-domain-12345.example",
  ]
  for (const email of cases) {
    const result = await autodetectSettingsAsync(email)
    console.log(`${email} → via=${result.via} imap=${result.defaults.imapHost}:${result.defaults.imapPort} smtp=${result.defaults.smtpHost}:${result.defaults.smtpPort} secure=${result.defaults.secure}`)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
