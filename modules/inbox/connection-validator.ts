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

/** Fill missing fields with autodetected values. User-provided values always win.
 *
 * Normalization rules (defensive, applied at the validator boundary so every caller —
 * the create route, the test route, the IMAP sync — sees the same canonical config):
 *  - `email` is `.trim().toLowerCase()`. IMAP/SMTP servers (Titan, Gmail, Outlook, Yahoo,
 *    Hostinger) all accept the username case-insensitively but reject leading/trailing
 *    whitespace silently with "535 5.7.8 authentication failed". Trimming + lowercasing
 *    is therefore a no-op for correct input and a recovery path for paste-from-manager
 *    typos. The UI mirrors this normalization but we don't trust it: belt-and-suspenders.
 *  - `password` is NOT trimmed (a legitimate password may genuinely contain edge
 *    whitespace). We do log a warning when we detect it so ops can spot the issue.
 *  - Hosts are `.trim()`ed (already were).
 */
export function resolveConfig(input: ImapSmtpConfig): Required<ImapSmtpConfig> {
  const rawEmail = typeof input.email === "string" ? input.email : ""
  const normalizedEmail = rawEmail.trim().toLowerCase()
  const detected = autodetectSettings(normalizedEmail)

  const userImapHost = input.imapHost?.trim() || ""
  const userSmtpHost = input.smtpHost?.trim() || ""
  const userImapPort = typeof input.imapPort === "number" && input.imapPort > 0 ? input.imapPort : 0
  const userSmtpPort = typeof input.smtpPort === "number" && input.smtpPort > 0 ? input.smtpPort : 0

  const resolved = {
    email: normalizedEmail,
    password: input.password,
    imapHost: userImapHost || detected.imapHost,
    imapPort: userImapPort || detected.imapPort,
    imapSecure: input.imapSecure ?? detected.secure,
    smtpHost: userSmtpHost || detected.smtpHost,
    smtpPort: userSmtpPort || detected.smtpPort,
    smtpSecure: input.smtpSecure ?? detected.secure,
  }

  const usedAutodetect = !userImapHost || !userSmtpHost
  const emailNormalized = rawEmail !== normalizedEmail
  const passwordHasEdgeWs = typeof input.password === "string" && input.password !== input.password.trim()

  console.log(
    `[connection-validator] resolveConfig: email=${normalizedEmail} emailNormalized=${emailNormalized} pwLen=${input.password?.length ?? 0} pwEdgeWs=${passwordHasEdgeWs} userInput=[imap=${userImapHost || "(none)"}:${userImapPort || "(none)"} smtp=${userSmtpHost || "(none)"}:${userSmtpPort || "(none)"}] autodetect=${usedAutodetect ? "yes" : "no"} → final=[imap=${resolved.imapHost}:${resolved.imapPort} secure=${resolved.imapSecure} smtp=${resolved.smtpHost}:${resolved.smtpPort} secure=${resolved.smtpSecure}]`,
  )
  if (passwordHasEdgeWs) {
    console.warn(
      `[connection-validator] password has edge whitespace email=${normalizedEmail} pwLen=${input.password.length} — likely root cause if auth fails`,
    )
  }
  return resolved
}

const CONNECT_TIMEOUT_MS = 15_000

/**
 * Convert raw IMAP/SMTP error strings into operator-friendly messages while preserving
 * the original `host:port secure=… user=…` so the operator can verify the config the
 * server saw. `5.7.8` is the canonical SMTP/IMAP code for "authentication failed";
 * `5.7.0` and "Invalid login" are common Titan / Yahoo wordings; "Command failed" is
 * the generic ImapFlow surface for a rejected `LOGIN` capability.
 */
function describeAuthError(rawMsg: string, kind: "IMAP" | "SMTP", host: string, port: number, secure: boolean, user: string): string {
  const lower = rawMsg.toLowerCase()
  const looksLikeAuth =
    lower.includes("5.7.8") ||
    lower.includes("authentication failed") ||
    lower.includes("invalid login") ||
    lower.includes("invalid credentials") ||
    lower.includes("command failed") ||
    lower.includes("auth ") ||
    lower.includes("authenticationfailed")
  const ctx = `host=${host}:${port} secure=${secure} user=${user}`
  if (looksLikeAuth) {
    return `El servidor ${kind} rechazó la autenticación (${ctx}). Verifica el email y la contraseña — si Titan exige una App Password o IMAP/SMTP está deshabilitado en tu cuenta, actívalo en su panel. Mensaje original: ${rawMsg}`
  }
  if (lower.includes("etimedout") || lower.includes("timeout") || lower.includes("econnrefused") || lower.includes("enotfound")) {
    return `No se pudo conectar al servidor ${kind} (${ctx}). Verifica el host, el puerto y que tu red no bloquee el tráfico. Mensaje original: ${rawMsg}`
  }
  if (lower.includes("certificate") || lower.includes("cert") || lower.includes("ssl") || lower.includes("tls")) {
    return `Error TLS/SSL en ${kind} (${ctx}). Comprueba el flag secure y el puerto. Mensaje original: ${rawMsg}`
  }
  return `${kind} falló (${ctx}). Mensaje original: ${rawMsg}`
}

/** Test IMAP login using ImapFlow. Returns a context-rich error so the operator
 *  doesn't have to guess what was tested when something fails. Does not log the password. */
async function testImap(cfg: Required<ImapSmtpConfig>): Promise<{ ok: boolean; error?: string }> {
  console.log(
    `[connection-validator] IMAP attempt host=${cfg.imapHost}:${cfg.imapPort} secure=${cfg.imapSecure} user=${cfg.email} userIsEmail=${cfg.email === cfg.email.toLowerCase().trim()}`,
  )
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
      console.log(`[connection-validator] IMAP ok host=${cfg.imapHost}:${cfg.imapPort} user=${cfg.email}`)
      return { ok: true }
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const msg = describeAuthError(raw, "IMAP", cfg.imapHost, cfg.imapPort, cfg.imapSecure, cfg.email)
    console.error(`[connection-validator] IMAP error host=${cfg.imapHost}:${cfg.imapPort} user=${cfg.email} raw="${raw}"`)
    return { ok: false, error: msg }
  }
}

/** Test SMTP login using nodemailer verify. Same diagnostic pattern as testImap. */
async function testSmtp(cfg: Required<ImapSmtpConfig>): Promise<{ ok: boolean; error?: string }> {
  console.log(
    `[connection-validator] SMTP attempt host=${cfg.smtpHost}:${cfg.smtpPort} secure=${cfg.smtpSecure} user=${cfg.email}`,
  )
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
    console.log(`[connection-validator] SMTP ok host=${cfg.smtpHost}:${cfg.smtpPort} user=${cfg.email}`)
    return { ok: true }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const msg = describeAuthError(raw, "SMTP", cfg.smtpHost, cfg.smtpPort, cfg.smtpSecure, cfg.email)
    console.error(`[connection-validator] SMTP error host=${cfg.smtpHost}:${cfg.smtpPort} user=${cfg.email} raw="${raw}"`)
    return { ok: false, error: msg }
  }
}

/**
 * Validate both IMAP and SMTP for a custom email connection.
 * Expects a fully-resolved config — call resolveConfig() before this.
 */
export async function validateImapSmtp(cfg: Required<ImapSmtpConfig>): Promise<ValidationResult> {
  console.log(
    `[connection-validator] validateImapSmtp: imap=${cfg.imapHost}:${cfg.imapPort} secure=${cfg.imapSecure} smtp=${cfg.smtpHost}:${cfg.smtpPort} secure=${cfg.smtpSecure} user=${cfg.email}`,
  )
  const [imap, smtp] = await Promise.all([testImap(cfg), testSmtp(cfg)])
  return { ok: imap.ok && smtp.ok, imap, smtp }
}
