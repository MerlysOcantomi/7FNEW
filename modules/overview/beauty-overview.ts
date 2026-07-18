/**
 * Beauty "Mi salón" — the Spanish, Finesse-branded configuration the business
 * overview uses when a workspace is Beauty.
 *
 * Mirrors `modules/marketing/beauty-marketing.ts`: pure and DB-free, resolves
 * entirely from `verticalKey` (covering aliases salon/nails/… via the business
 * type) and returns `null` for any non-beauty vertical, so `/` keeps its
 * generic core overview untouched for everyone else. All UI strings live here
 * (Spanish, España) — nothing user-facing is hardcoded inside the components.
 *
 * DATA HONESTY: no overview backend exists yet (no Appointment/Service/Payment
 * models), so the surface runs on the isolated demo adapter (`demo-data.ts`)
 * and ALWAYS shows the "Vista previa · datos de ejemplo" chip. The Finesse
 * brief and every card are generated from ONE snapshot (see `derive.ts`) so
 * the summary can never contradict the metrics.
 */

import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import { mapVerticalKeyToBusinessType } from "@core/personalization"
import { formatCurrency, formatPercent, type FormatLocale } from "@core/i18n/format"
import type { OverviewBriefFacts } from "./derive"
import type {
  BookingSourceKind,
  BusinessRecommendation,
  DriverConfidence,
  LookingAheadNote,
  OverviewPeriodPreset,
  PerformanceDriver,
  RecommendationAgent,
} from "./types"

export interface BeautyOverviewConfig {
  /** "Finesse · by Sevenef" brand chip. */
  brandChip: string
  /** "Vista previa · datos de ejemplo" — always visible while demo data drives the page. */
  previewChip: string
  header: {
    title: string
    description: string
    exportLabel: string
    periodLabels: Record<OverviewPeriodPreset, string>
  }
  periodCard: {
    eyebrow: string
    /** Header for the honest first-period state ("sin periodo anterior"). */
    noComparisonNote: string
  }
  brief: {
    agentName: string
    tagline: string
  }
  kpis: {
    earnings: string
    visits: string
    newClients: string
    returningRate: string
    /** "que la semana pasada" … keyed by preset. */
    comparisonSuffix: Record<OverviewPeriodPreset, string>
    noComparison: string
    noData: string
    /** Accessible description of the mini sparkline. */
    sparkAria: string
  }
  revenue: {
    title: string
    subtitle: Record<"day" | "week" | "month", string>
    /** e.g. "más que el periodo anterior" / "menos que el periodo anterior". */
    moreSuffix: string
    lessSuffix: string
    sameNote: string
    empty: { title: string; description: string }
    /** Bucket tick labels. */
    weekPrefix: string
  }
  drivers: {
    titleUp: string
    titleDown: string
    subtitle: string
    sourceLabels: Record<PerformanceDriver["source"], string>
    confidenceLabels: Record<DriverConfidence, string>
    empty: string
  }
  lookingAhead: {
    lead: string
    texts: Record<LookingAheadNote["kind"], string>
    actions: Record<LookingAheadNote["kind"], string>
  }
  services: {
    title: string
    /** "De {visits} visitas este periodo". */
    hintPrefix: string
    hintSuffix: string
    empty: { title: string; description: string }
    archivedLabel: string
  }
  demand: {
    title: string
    hint: string
    /** Mon → Sun short labels (ISO order, matches `DemandDay.weekday`). */
    weekdays: [string, string, string, string, string, string, string]
    weekdaysLong: [string, string, string, string, string, string, string]
    /** "Tus horas punta:" prefix when hourly data exists. */
    peakLead: string
    empty: string
    actionLabel: string
  }
  clientMix: {
    title: string
    returning: string
    newLabel: string
    centerLabel: string
    empty: string
  }
  topClients: {
    title: string
    hint: string
    visitsSuffix: string
    vipLabel: string
    empty: string
    restrictedSpend: string
  }
  sources: {
    title: string
    labels: Record<BookingSourceKind, string>
    empty: string
  }
  recommendations: {
    title: string
    agentLabels: Record<RecommendationAgent, string>
    actionLabels: Record<BusinessRecommendation["kind"], string>
    emptyPositive: string
  }
  states: {
    loading: string
    error: { title: string; description: string; retry: string }
    emptyPage: {
      title: string
      description: string
      cta: string
    }
    sectionNoData: string
    noFinance: string
  }
}

const BEAUTY_OVERVIEW_CONFIG: BeautyOverviewConfig = {
  brandChip: "Finesse · by Sevenef",
  previewChip: "Vista previa · datos de ejemplo",
  header: {
    title: "Mi salón",
    description:
      "Así va tu salón este periodo: lo que ganaste, los servicios que más gustaron y quién vuelve a reservar.",
    exportLabel: "Exportar",
    periodLabels: {
      week: "Semana",
      month: "Mes",
      quarter: "Trimestre",
      year: "Año",
    },
  },
  periodCard: {
    eyebrow: "Periodo",
    noComparisonNote: "Primer periodo · sin comparativa",
  },
  brief: {
    agentName: BEAUTY_SPECIALIST_AGENT.name,
    tagline: "beauty intelligence",
  },
  kpis: {
    earnings: "Ingresos",
    visits: "Visitas",
    newClients: "Clientas nuevas",
    returningRate: "Volvieron a reservar",
    comparisonSuffix: {
      week: "que la semana pasada",
      month: "que el mes pasado",
      quarter: "que el trimestre anterior",
      year: "que el año pasado",
    },
    noComparison: "Sin comparativa aún",
    noData: "Sin datos todavía",
    sparkAria: "Evolución reciente",
  },
  revenue: {
    title: "Lo que ganaste",
    subtitle: {
      day: "Día a día",
      week: "Semana a semana",
      month: "Mes a mes",
    },
    moreSuffix: "más que el periodo anterior",
    lessSuffix: "menos que el periodo anterior",
    sameNote: "Igual que el periodo anterior",
    empty: {
      title: "Aún no hay ingresos registrados.",
      description: "Cuando registres cobros, verás aquí su evolución.",
    },
    weekPrefix: "Sem.",
  },
  drivers: {
    titleUp: "Por qué ganaste más",
    titleDown: "Por qué ganaste menos",
    subtitle: "Finesse analizó qué cambió",
    sourceLabels: {
      services: "Tus servicios estrella se pidieron más",
      bookings: "Hubo menos reservas que el periodo anterior",
      "new-clients": "Clientas nuevas te encontraron por {detail}",
      rebooking: "Más clientas repitieron cita",
      cancellations: "Hubo más cancelaciones de última hora",
      "walk-ins": "Menos visitas sin cita",
      campaign: "Tu campaña atrajo reservas",
      schedule: "Ampliaste tu horario",
      weather: "El tiempo influyó en las visitas sin cita",
    },
    confidenceLabels: {
      confirmed: "Dato confirmado",
      correlation: "Según datos de reserva",
      inference: "Posible influencia",
    },
    empty: "Sin cambios que explicar este periodo.",
  },
  lookingAhead: {
    lead: "Mirando adelante:",
    texts: {
      "quiet-period":
        "Se acerca una época más tranquila — muchas clientas viajan. Una pequeña promo ahora puede mantener tu agenda llena.",
      "peak-nearly-full":
        "Tus días punta están casi completos. Un par de huecos extra por la tarde te dejarían atender a más clientas.",
      "service-growing":
        "Un servicio está creciendo con fuerza. Puede ser buen momento para destacarlo.",
      "rebooking-falling":
        "Las re-reservas están bajando un poco. Un recordatorio amable puede ayudar.",
    },
    actions: {
      "quiet-period": "Crear campaña",
      "peak-nearly-full": "Revisar agenda",
      "service-growing": "Ver servicios",
      "rebooking-falling": "Contactar clientas",
    },
  },
  services: {
    title: "Lo que más aman tus clientas",
    hintPrefix: "De",
    hintSuffix: "visitas este periodo",
    empty: {
      title: "Aún no hay datos de servicios.",
      description: "Cuando registres citas con servicios, verás aquí los favoritos.",
    },
    archivedLabel: "Archivado",
  },
  demand: {
    title: "Tus días más ocupados",
    hint: "visitas por día",
    weekdays: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    weekdaysLong: [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábados",
      "domingos",
    ],
    peakLead: "Tus horas punta:",
    empty: "Aún no hay suficientes citas para ver un patrón.",
    actionLabel: "Ver agenda",
  },
  clientMix: {
    title: "Clientas nuevas y habituales",
    returning: "Habituales",
    newLabel: "Nuevas",
    centerLabel: "clientas",
    empty: "Aún no hay clientas registradas este periodo.",
  },
  topClients: {
    title: "Tus clientas más fieles",
    hint: "las que más te visitan",
    visitsSuffix: "visitas",
    vipLabel: "VIP",
    empty: "Cuando tengas visitas registradas verás aquí a tus clientas más habituales.",
    restrictedSpend: "—",
  },
  sources: {
    title: "Cómo te encuentran",
    labels: {
      instagram: "Instagram",
      whatsapp: "WhatsApp",
      google: "Google",
      website: "Tu web",
      direct: "Reserva directa",
      "walk-in": "Sin cita",
      referral: "Recomendación",
      phone: "Teléfono",
      unknown: "Sin identificar",
    },
    empty: "Aún no hay datos de origen de reservas.",
  },
  recommendations: {
    title: "Ideas de Finesse",
    agentLabels: {
      fiona: "Fiona",
      felix: "Felix",
      fanny: "Fanny",
      finesse: "Finesse",
    },
    actionLabels: {
      reactivation: "Crear campaña de reactivación",
      "pending-payments": "Revisar cobros",
      availability: "Revisar agenda",
      "quiet-period": "Crear campaña",
    },
    emptyPositive: "Todo en orden — nada pendiente que Finesse quiera destacar hoy. ✨",
  },
  states: {
    loading: "Cargando Mi salón",
    error: {
      title: "No hemos podido cargar Mi salón.",
      description: "Vuelve a intentarlo en unos segundos.",
      retry: "Reintentar",
    },
    emptyPage: {
      title: "Tu salón está listo para empezar.",
      description:
        "Cuando tengas citas, cobros y clientas registradas, Finesse te mostrará aquí cómo va tu negocio y qué puedes mejorar.",
      cta: "Ver mi agenda",
    },
    sectionNoData: "Sin datos en este periodo.",
    noFinance: "Los datos de ingresos no están disponibles.",
  },
}

/**
 * Resolve the Beauty overview config for a vertical, or `null` when it is not
 * a beauty workspace (covers aliases salon/nails/… via business type).
 *
 * Activation note: like Finesse Marketing (and unlike the appointment Today),
 * this surface activates for real Beauty workspaces — it is the designed
 * business overview for the vertical, its demo layer is always labeled with
 * the preview chip, and nothing on the page mutates business data.
 */
export function resolveBeautyOverviewConfig(
  verticalKey: string | null | undefined,
): BeautyOverviewConfig | null {
  if (!verticalKey) return null
  return mapVerticalKeyToBusinessType(verticalKey) === "beauty" ? BEAUTY_OVERVIEW_CONFIG : null
}

// ─── Driver copy ─────────────────────────────────────────────────────────────

/**
 * Spanish label for a performance driver. Templates may carry a `{detail}`
 * placeholder (e.g. the attribution channel) filled from the driver itself.
 */
export function buildDriverLabel(
  driver: PerformanceDriver,
  config: BeautyOverviewConfig,
): string {
  const template = config.drivers.sourceLabels[driver.source]
  return template.replace("{detail}", driver.detail ?? "redes sociales")
}

// ─── Recommendation copy (from derived, data-backed recommendations) ─────────

/**
 * Spanish sentence for a derived recommendation. Numbers come from the
 * recommendation's own `value` (which `deriveRecommendations` took from the
 * snapshot signals), so the card text always matches the data.
 */
export function buildRecommendationText(
  rec: BusinessRecommendation,
  { locale, currency }: { locale: FormatLocale; currency: string },
): string {
  switch (rec.kind) {
    case "reactivation":
      return `${rec.value} clientas llevan tiempo sin venir — una nota de "te echamos de menos" puede hacer que vuelvan.`
    case "pending-payments":
      return `Aún tienes ${formatCurrency(rec.value, { locale, currency })} por cobrar de visitas ya completadas.`
    case "availability":
      return `Tus días punta están al ${rec.value}% — un par de huecos extra por la tarde te dejarían atender a más clientas.`
    case "quiet-period":
      return "Se acerca una época más tranquila. Una campaña sencilla ahora puede mantener tu agenda llena."
  }
}

// ─── Finesse brief (generated from snapshot facts, never hardcoded) ──────────

/**
 * Assemble the Finesse business brief from derived facts. Only states what the
 * snapshot supports: no earnings data → no earnings clause; no retention data
 * → no retention clause. Returns `null` when there is nothing to summarize
 * (the UI then shows the empty-page state instead of an invented summary).
 */
export function buildBeautyOverviewBrief(
  facts: OverviewBriefFacts,
  { locale }: { locale: FormatLocale },
): string | null {
  if (!facts.hasAnyData) return null

  const parts: string[] = []

  if (facts.earnings && facts.earnings.deltaRatio !== null) {
    const pct = formatPercent(Math.abs(facts.earnings.deltaRatio), { locale })
    if (facts.earnings.tone === "up") {
      const from = facts.topServiceName
        ? `, sobre todo gracias a ${facts.topServiceName.toLowerCase()}`
        : ""
      parts.push(`Buen periodo — ganaste un ${pct} más${from}.`)
    } else if (facts.earnings.tone === "down") {
      parts.push(
        `Un periodo más tranquilo — ganaste un ${pct} menos que el anterior.`,
      )
    } else {
      parts.push("Un periodo estable — tus ingresos se mantienen.")
    }
  } else if (facts.topServiceName) {
    parts.push(`Tus clientas están pidiendo sobre todo ${facts.topServiceName.toLowerCase()}.`)
  }

  if (facts.peakNearlyFull) {
    parts.push("Tus días punta están casi completos.")
  }

  if (facts.returningRate !== null) {
    const pct = formatPercent(facts.returningRate, { locale })
    parts.push(`Y el ${pct} de tus clientas volvió a reservar.`)
  }

  return parts.length > 0 ? parts.join(" ") : null
}
