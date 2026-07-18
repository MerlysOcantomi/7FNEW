import { DEFAULT_LOCALE, parseLocale, type SupportedLocale } from "@core/i18n"

function resolveLocale(localeRaw?: string | null): SupportedLocale {
  return localeRaw ? parseLocale(localeRaw) : DEFAULT_LOCALE
}

// Partial: official locales without labels yet (fr/it) fall back to en below.
const STATUS: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: {
    new: "New",
    triaged: "Triaged",
    assigned: "Assigned",
    awaiting_response: "Waiting on client",
    lead_detected: "Possible lead",
    resolved: "Resolved",
    converted: "Converted",
    closed: "Closed",
    archived: "Archived",
    trashed: "In Trash",
  },
  es: {
    new: "Nuevo",
    triaged: "Clasificado",
    assigned: "Asignado",
    awaiting_response: "Esperando al cliente",
    lead_detected: "Posible lead",
    resolved: "Resuelto",
    converted: "Convertido",
    closed: "Cerrado",
    archived: "Archivado",
    trashed: "En papelera",
  },
  de: {
    new: "Neu",
    triaged: "Sortiert",
    assigned: "Zugewiesen",
    awaiting_response: "Wartet auf Kunde",
    lead_detected: "Möglicher Lead",
    resolved: "Erledigt",
    converted: "Konvertiert",
    closed: "Geschlossen",
    archived: "Archiviert",
    trashed: "Im Papierkorb",
  },
}

const URGENCY: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: { critica: "Critical", alta: "High", media: "Medium", baja: "Low" },
  es: { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" },
  de: { critica: "Kritisch", alta: "Hoch", media: "Mittel", baja: "Niedrig" },
}

const CHANNEL: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: {
    manual: "Manual",
    web_chat: "Web chat",
    email: "Email",
    portal: "Portal",
    whatsapp: "WhatsApp",
  },
  es: {
    manual: "Manual",
    web_chat: "Chat web",
    email: "Correo",
    portal: "Portal",
    whatsapp: "WhatsApp",
  },
  de: {
    manual: "Manuell",
    web_chat: "Web-Chat",
    email: "E-Mail",
    portal: "Portal",
    whatsapp: "WhatsApp",
  },
}

const REL_NOW: Partial<Record<SupportedLocale, string>> = {
  en: "Now",
  es: "Ahora",
  de: "Jetzt",
}

function intlLocale(locale: SupportedLocale): string {
  if (locale === "de") return "de"
  if (locale === "es") return "es"
  return "en"
}

export function formatRelativeDate(value: string, localeRaw?: string | null) {
  const locale = resolveLocale(localeRaw)
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return REL_NOW[locale] ?? REL_NOW.en!
  if (minutes < 60) {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" })
    return rtf.format(-minutes, "minute")
  }
  if (hours < 24) {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" })
    return rtf.format(-hours, "hour")
  }
  if (days < 7) {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" })
    return rtf.format(-days, "day")
  }
  return date.toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short" })
}

/** Fecha corta tipo `14.02`; si no es el año en curso, `14.02.25`. */
function formatDayMonthDots(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0")
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const y = date.getFullYear()
  const currentYear = new Date().getFullYear()
  if (y !== currentYear) return `${d}.${m}.${String(y).slice(-2)}`
  return `${d}.${m}`
}

/**
 * Etiqueta de tiempo más corta para la lista del Inbox (menos anchura que `formatRelativeDate`).
 * Sugerencia: símbolos universales para lo reciente (`5m`, `3h`, `2d`) y `DD.MM` si es más antiguo.
 */
export function formatRelativeDateCompact(value: string, localeRaw?: string | null): string {
  const locale = resolveLocale(localeRaw)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)

  if (diffMs < 0) {
    return formatDayMonthDots(date)
  }

  if (minutes < 1) return REL_NOW[locale] ?? REL_NOW.en!
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`

  return formatDayMonthDots(date)
}

export function statusBadge(status: string) {
  switch (status) {
    case "lead_detected":
      return "status-lead-detected"
    case "converted":
      return "status-converted"
    case "assigned":
      return "status-assigned"
    case "awaiting_response":
      return "status-awaiting-response"
    /**
     * `resolved` reuses the success palette ("work is done" feel) but its label is distinct
     * from `lead_detected`, so the two won't collide visually in normal flows. Keeping a
     * dedicated variant lets us recolor independently later without churning the badge map.
     */
    case "resolved":
      return "status-resolved"
    case "closed":
    case "archived":
      return "status-closed"
    case "triaged":
      return "status-triaged"
    case "new":
    default:
      return "status-new"
  }
}

export function statusLabel(status: string, localeRaw?: string | null) {
  const locale = resolveLocale(localeRaw)
  return STATUS[locale]?.[status] ?? STATUS.en?.[status] ?? status
}

/** Etiqueta visible del Inbox: `triaged` no se muestra como tal (el flujo ya está clasificado por IA). */
export function statusLabelDisplay(status: string, localeRaw?: string | null): string {
  if (status === "triaged") {
    const locale = resolveLocale(localeRaw)
    if (locale === "es") return "Activo"
    if (locale === "de") return "Aktiv"
    return "Active"
  }
  if (status === "trashed") {
    const locale = resolveLocale(localeRaw)
    if (locale === "es") return "En papelera"
    if (locale === "de") return "Im Papierkorb"
    return "In Trash"
  }
  return statusLabel(status, localeRaw)
}

/** Variante de badge coherente con la etiqueta de lista (triaged → estilo asignado / neutro). */
export function statusBadgeDisplay(status: string): string {
  if (status === "triaged") return statusBadge("assigned")
  return statusBadge(status)
}

export function urgencyBadge(urgency: string) {
  switch (urgency) {
    case "critica":
      return "urgency-critical"
    case "alta":
      return "urgency-high"
    case "media":
      return "urgency-medium"
    default:
      return "urgency-low"
  }
}

export function urgencyLabel(urgency: string, localeRaw?: string | null) {
  const locale = resolveLocale(localeRaw)
  return URGENCY[locale]?.[urgency] ?? URGENCY.en?.[urgency] ?? urgency
}

export function channelLabel(channel: string, localeRaw?: string | null) {
  const locale = resolveLocale(localeRaw)
  return CHANNEL[locale]?.[channel] ?? CHANNEL.en?.[channel] ?? channel
}

const ACTION_TYPE: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: {
    create_client: "Create client",
    create_project: "Create project",
    create_task: "Create task",
    schedule_followup: "Schedule follow-up",
    assign_operator: "Assign owner",
    generate_proposal: "Generate proposal",
  },
  es: {
    create_client: "Crear cliente",
    create_project: "Crear proyecto",
    create_task: "Crear tarea",
    schedule_followup: "Programar seguimiento",
    assign_operator: "Asignar responsable",
    generate_proposal: "Generar propuesta",
  },
  de: {
    create_client: "Kontakt anlegen",
    create_project: "Projekt anlegen",
    create_task: "Aufgabe anlegen",
    schedule_followup: "Follow-up planen",
    assign_operator: "Verantwortliche Person zuweisen",
    generate_proposal: "Angebot erstellen",
  },
}

export function actionTypeLabel(type: string, locale?: string | null) {
  const key = parseLocale(locale)
  return ACTION_TYPE[key]?.[type] ?? ACTION_TYPE.en?.[type] ?? type
}

export function actionStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return "action-approved"
    case "executed":
      return "action-executed"
    case "dismissed":
      return "action-dismissed"
    case "failed":
      return "action-failed"
    case "suggested":
    default:
      return "action-suggested"
  }
}

const ACTION_STATUS: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: {
    suggested: "Suggested",
    approved: "Approved",
    executed: "Executed",
    dismissed: "Dismissed",
    failed: "Failed",
  },
  es: {
    suggested: "Sugerida",
    approved: "Aprobada",
    executed: "Ejecutada",
    dismissed: "Descartada",
    failed: "Fallida",
  },
  de: {
    suggested: "Vorgeschlagen",
    approved: "Freigegeben",
    executed: "Ausgeführt",
    dismissed: "Verworfen",
    failed: "Fehlgeschlagen",
  },
}

export function actionStatusLabel(status: string, locale?: string | null) {
  const key = parseLocale(locale)
  return ACTION_STATUS[key]?.[status] ?? ACTION_STATUS.en?.[status] ?? status
}

export function formatRoleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/** IMAP sync feedback strings (operator-facing toasts on /inbox). */
const SYNC: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: {
    syncFailed: "Could not sync email.",
    noConnection: "No email connection is configured.",
    inactiveConnection: "The email connection is inactive.",
    manualFetchNotSupported: "This connection does not require a manual fetch.",
    noNewEmails: "No new emails.",
    oneNewEmail: "1 new email received.",
    cursorReset: "IMAP cursor reset.",
    cursorResetDetail:
      "The server reported a uidValidity change or an inconsistent cursor. The next sync will recover recent messages.",
    serverUnreachable: "Could not reach the server.",
    viewHint: 'You are in the "{filter}" view — new emails appear under "Smart Inbox → Inbox".',
  },
  es: {
    syncFailed: "No se pudo sincronizar el email.",
    noConnection: "No hay conexión de email configurada.",
    inactiveConnection: "La conexión de email está inactiva.",
    manualFetchNotSupported: "Esta conexión no requiere fetch manual.",
    noNewEmails: "Sin emails nuevos.",
    oneNewEmail: "1 email nuevo recibido.",
    cursorReset: "Cursor IMAP reiniciado.",
    cursorResetDetail:
      "El servidor reportó un cambio de uidValidity o un cursor inconsistente. El próximo sync recuperará mensajes recientes.",
    serverUnreachable: "No se pudo contactar al servidor.",
    viewHint: 'Estás en la vista "{filter}" — los emails nuevos aparecen en "Smart Inbox → Inbox".',
  },
}

export function syncMessage(key: string, locale?: string | null): string {
  const code = parseLocale(locale)
  return SYNC[code]?.[key] ?? SYNC.en?.[key] ?? key
}

export function syncNewEmails(count: number, locale?: string | null): string {
  const code = parseLocale(locale)
  if (count === 1) return syncMessage("oneNewEmail", locale)
  return code === "es" ? `${count} emails nuevos recibidos.` : `${count} new emails received.`
}

export function syncErrors(count: number, locale?: string | null): string {
  const code = parseLocale(locale)
  if (code === "es") return count === 1 ? "Error durante el sync IMAP." : `${count} errores durante el sync IMAP.`
  return count === 1 ? "An error occurred during the IMAP sync." : `${count} errors occurred during the IMAP sync.`
}
