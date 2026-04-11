import nodemailer from "nodemailer"

export interface ImapSmtpConfig {
  email: string
  password: string
  imapHost?: string
  imapPort?: number
  imapSecure?: boolean
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
}

export interface ValidationResult {
  ok: boolean
  imap: { ok: boolean; error?: string }
  smtp: { ok: boolean; error?: string }
}

interface ProviderDefaults {
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  secure: boolean
}

const KNOWN_PROVIDERS: Record<string, ProviderDefaults> = {
  "titan.email":     { imapHost: "imap.titan.email",     imapPort: 993, smtpHost: "smtp.titan.email",     smtpPort: 465, secure: true },
  "hostinger.com":   { imapHost: "imap.hostinger.com",   imapPort: 993, smtpHost: "smtp.hostinger.com",   smtpPort: 465, secure: true },
  "gmail.com":       { imapHost: "imap.gmail.com",       imapPort: 993, smtpHost: "smtp.gmail.com",       smtpPort: 465, secure: true },
  "outlook.com":     { imapHost: "outlook.office365.com",imapPort: 993, smtpHost: "smtp.office365.com",   smtpPort: 587, secure: false },
  "hotmail.com":     { imapHost: "outlook.office365.com",imapPort: 993, smtpHost: "smtp.office365.com",   smtpPort: 587, secure: false },
  "yahoo.com":       { imapHost: "imap.mail.yahoo.com",  imapPort: 993, smtpHost: "smtp.mail.yahoo.com",  smtpPort: 465, secure: true },
}

/**
 * Try to detect IMAP/SMTP settings from the email domain.
 * Falls back to generic imap.domain / smtp.domain with standard ports.
 */
export function autodetectSettings(email: string): ProviderDefaults {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""

  for (const [suffix, defaults] of Object.entries(KNOWN_PROVIDERS)) {
    if (domain === suffix || domain.endsWith(`.${suffix}`)) {
      return defaults
    }
  }

  return {
    imapHost: `imap.${domain}`,
    imapPort: 993,
    smtpHost: `smtp.${domain}`,
    smtpPort: 465,
    secure: true,
  }
}

/** Fill missing fields with autodetected values. */
export function resolveConfig(input: ImapSmtpConfig): Required<ImapSmtpConfig> {
  const detected = autodetectSettings(input.email)
  return {
    email: input.email,
    password: input.password,
    imapHost: input.imapHost || detected.imapHost,
    imapPort: input.imapPort || detected.imapPort,
    imapSecure: input.imapSecure ?? detected.secure,
    smtpHost: input.smtpHost || detected.smtpHost,
    smtpPort: input.smtpPort || detected.smtpPort,
    smtpSecure: input.smtpSecure ?? detected.secure,
  }
}

const CONNECT_TIMEOUT_MS = 15_000

/** Test IMAP login using ImapFlow. */
async function testImap(cfg: Required<ImapSmtpConfig>): Promise<{ ok: boolean; error?: string }> {
  try {
    const { ImapFlow } = await import("imapflow")
    const client = new ImapFlow({
      host: cfg.imapHost,
      port: cfg.imapPort,
      secure: cfg.imapSecure,
      auth: { user: cfg.email, pass: cfg.password },
      logger: false,
      emitLogs: false,
      tls: { rejectUnauthorized: false },
    })

    const timeout = setTimeout(() => { try { client.close() } catch {} }, CONNECT_TIMEOUT_MS)
    try {
      await client.connect()
      await client.logout()
      return { ok: true }
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

/** Test SMTP login using nodemailer verify. */
async function testSmtp(cfg: Required<ImapSmtpConfig>): Promise<{ ok: boolean; error?: string }> {
  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: { user: cfg.email, pass: cfg.password },
      connectionTimeout: CONNECT_TIMEOUT_MS,
      greetingTimeout: CONNECT_TIMEOUT_MS,
      tls: { rejectUnauthorized: false },
    })

    await transport.verify()
    transport.close()
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

/** Validate both IMAP and SMTP for a custom email connection. */
export async function validateImapSmtp(input: ImapSmtpConfig): Promise<ValidationResult> {
  const cfg = resolveConfig(input)
  const [imap, smtp] = await Promise.all([testImap(cfg), testSmtp(cfg)])
  return { ok: imap.ok && smtp.ok, imap, smtp }
}
