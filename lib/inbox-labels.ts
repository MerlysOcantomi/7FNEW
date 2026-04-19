import { DEFAULT_LOCALE, parseLocale, type SupportedLocale } from "@core/i18n"

function resolveLocale(localeRaw?: string | null): SupportedLocale {
  return localeRaw ? parseLocale(localeRaw) : DEFAULT_LOCALE
}

const STATUS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    new: "New",
    triaged: "Triaged",
    assigned: "Assigned",
    awaiting_response: "Awaiting response",
    lead_detected: "Lead detected",
    converted: "Converted",
    closed: "Closed",
    archived: "Archived",
  },
  es: {
    new: "Nuevo",
    triaged: "Clasificado",
    assigned: "Asignado",
    awaiting_response: "Esperando respuesta",
    lead_detected: "Lead detectado",
    converted: "Convertido",
    closed: "Cerrado",
    archived: "Archivado",
  },
  de: {
    new: "Neu",
    triaged: "Sortiert",
    assigned: "Zugewiesen",
    awaiting_response: "Wartet auf Antwort",
    lead_detected: "Lead erkannt",
    converted: "Konvertiert",
    closed: "Geschlossen",
    archived: "Archiviert",
  },
}

const URGENCY: Record<SupportedLocale, Record<string, string>> = {
  en: { critica: "Critical", alta: "High", media: "Medium", baja: "Low" },
  es: { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" },
  de: { critica: "Kritisch", alta: "Hoch", media: "Mittel", baja: "Niedrig" },
}

const CHANNEL: Record<SupportedLocale, Record<string, string>> = {
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

const REL_NOW: Record<SupportedLocale, string> = {
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

  if (minutes < 1) return REL_NOW[locale]
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
  return STATUS[locale][status] ?? STATUS.en[status] ?? status
}

/** Etiqueta visible del Inbox: `triaged` no se muestra como tal (el flujo ya está clasificado por IA). */
export function statusLabelDisplay(status: string, localeRaw?: string | null): string {
  if (status === "triaged") {
    const locale = resolveLocale(localeRaw)
    if (locale === "es") return "Activo"
    if (locale === "de") return "Aktiv"
    return "Active"
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
  return URGENCY[locale][urgency] ?? URGENCY.en[urgency] ?? urgency
}

export function channelLabel(channel: string, localeRaw?: string | null) {
  const locale = resolveLocale(localeRaw)
  return CHANNEL[locale][channel] ?? CHANNEL.en[channel] ?? channel
}

export function actionTypeLabel(type: string) {
  return (
    {
      create_client: "Create client",
      create_project: "Create project",
      create_task: "Create task",
      schedule_followup: "Schedule follow-up",
      assign_operator: "Assign owner",
      generate_proposal: "Generate proposal",
    } as Record<string, string>
  )[type] ?? type
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

export function actionStatusLabel(status: string) {
  return (
    {
      suggested: "Suggested",
      approved: "Approved",
      executed: "Executed",
      dismissed: "Dismissed",
      failed: "Failed",
    } as Record<string, string>
  )[status] ?? status
}

export function formatRoleLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
