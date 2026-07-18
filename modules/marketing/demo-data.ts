/**
 * Marketing (Finesse) — ISOLATED demo adapter.
 *
 * Curated, deletable demo content for the Beauty Marketing surface, in the same
 * spirit as `components/today/appointments/appointment-mock.ts`: no real
 * backend for works/posts/campaigns/social metrics exists yet, so this module
 * produces a coherent `MarketingSnapshot` for a realistic salon. The UI always
 * renders the "Vista previa · datos de ejemplo" chip while this adapter is the
 * data source, and it is the ONLY place demo values live — components never
 * hardcode data.
 *
 * Multi-tenant: the snapshot is generated per `workspaceId` (ids are prefixed
 * with it), never shared module-level mutable state. Scheduled dates are
 * derived from `now` passed by the caller — no clock reads here — so the demo
 * week always looks alive without being nondeterministic in tests.
 *
 * Swap path: replace calls to `getBeautyMarketingDemoSnapshot` with a real
 * fetch returning the same `MarketingSnapshot` contract (see `types.ts`).
 */

import type {
  MarketingCampaign,
  MarketingPost,
  MarketingSnapshot,
  MarketingWork,
} from "./types"

function atDay(base: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute)
  return d.toISOString()
}

/** Build the demo snapshot for a workspace. Pure given (workspaceId, now). */
export function getBeautyMarketingDemoSnapshot(workspaceId: string, now: Date): MarketingSnapshot {
  const id = (suffix: string) => `${workspaceId}:demo-mkt-${suffix}`

  const works: MarketingWork[] = [
    {
      id: id("w1"),
      workspaceId,
      title: "Rose Nude Chrome · María",
      clientName: "María",
      service: "Manicura semipermanente",
      style: "Rose nude chrome",
      beforeAfter: true,
      status: "preparado",
      createdAt: atDay(now, 0, 9, 30),
      imageUrl: null,
      placeholderTone: "rose",
      postId: id("p1"),
    },
    {
      id: id("w2"),
      workspaceId,
      title: "Nail art floral · Marta",
      clientName: "Marta",
      service: "Nail art",
      style: "Floral primavera",
      status: "programado",
      createdAt: atDay(now, -1, 17, 0),
      imageUrl: null,
      placeholderTone: "lilac",
      postId: id("p2"),
    },
    {
      id: id("w3"),
      workspaceId,
      title: "Baby boomer · Laura",
      clientName: "Laura",
      service: "Manicura semipermanente",
      style: "Baby boomer",
      status: "publicado",
      createdAt: atDay(now, -2, 12, 0),
      imageUrl: null,
      placeholderTone: "gold",
      postId: id("p3"),
    },
    {
      id: id("w4"),
      workspaceId,
      title: "Esmaltado rojo · Andrea",
      clientName: "Andrea",
      service: "Esmaltado",
      style: "Rojo clásico",
      status: "sin_usar",
      createdAt: atDay(now, -2, 18, 30),
      imageUrl: null,
      placeholderTone: "red",
    },
    {
      id: id("w5"),
      workspaceId,
      title: "Francesa moderna · Sara",
      clientName: "Sara",
      service: "Manicura",
      style: "Francesa moderna",
      status: "nuevo",
      createdAt: atDay(now, 0, 8, 15),
      imageUrl: null,
      placeholderTone: "blush",
    },
  ]

  const posts: MarketingPost[] = [
    {
      id: id("p1"),
      workspaceId,
      workId: id("w1"),
      title: "El Rose Nude Chrome de María quedó para enseñar.",
      caption:
        "Rose nude con acabado espejo ✨ El tono que sienta bien todo el año. ¿Reservamos el tuyo? Quedan huecos esta semana 💅",
      hashtags: ["RoseNude", "uñasMadrid", "manicura"],
      channel: "instagram",
      kind: "carrusel",
      goal: "Atraer clientas nuevas",
      bestTime: "Hoy 19:00",
      cta: "Reserva tu cita",
      status: "preparada",
      scheduledFor: null,
      preparedBy: "freya",
    },
    {
      id: id("p2"),
      workspaceId,
      workId: id("w2"),
      title: "Nail art floral de Marta",
      caption: "Flores que duran más que un ramo 🌸 Nail art a mano alzada para estrenar la temporada.",
      hashtags: ["nailart", "floral", "manicura"],
      channel: "instagram",
      kind: "post",
      goal: "Enseñar trabajo reciente",
      bestTime: null,
      cta: "Escríbenos para tu diseño",
      status: "programada",
      scheduledFor: atDay(now, 2, 18, 30),
      preparedBy: "freya",
    },
    {
      id: id("p3"),
      workspaceId,
      workId: id("w3"),
      title: "Baby boomer de Laura",
      caption: "El degradado que nunca falla. Baby boomer con acabado natural para el día a día ✨",
      hashtags: ["babyBoomer", "uñasNaturales"],
      channel: "instagram",
      kind: "reel",
      goal: "Alcance",
      bestTime: null,
      cta: null,
      status: "programada",
      scheduledFor: atDay(now, 4, 12, 0),
      preparedBy: "freya",
    },
  ]

  const campaigns: MarketingCampaign[] = [
    {
      id: id("c1"),
      workspaceId,
      title: "“Verano de uñas” en marcha",
      agent: "fiona",
      status: "activa",
      reason: "3 publicaciones programadas · 480 personas alcanzadas.",
      audienceSize: 480,
      audienceLabel: "personas alcanzadas",
    },
    {
      id: id("c2"),
      workspaceId,
      title: "“Vuelve al color” para clientas sin reservar",
      agent: "fiona",
      status: "sugerida",
      reason: "14 clientas sin reservar hace 2+ meses · Freya ya preparó las piezas.",
      audienceSize: 14,
      audienceLabel: "clientas sin reservar hace 2+ meses",
    },
  ]

  return {
    workspaceId,
    works,
    posts,
    campaigns,
    pulse: {
      workspaceId,
      periodLabel: "últimos 7 días",
      metrics: [
        { id: "followers", label: "Seguidores", value: "1.240", delta: "+18 este mes", deltaTone: "up" },
        { id: "reach", label: "Alcance", value: "4,8k", delta: "+32% vs. semana", deltaTone: "up" },
        { id: "saves", label: "Guardados", value: "96", delta: "+11 hoy", deltaTone: "up" },
        { id: "inquiries", label: "Consultas", value: "12", delta: "+3 esta semana", deltaTone: "up" },
        { id: "newClients", label: "Clientas por contenido", value: "3", delta: "esta semana", deltaTone: "flat" },
      ],
      insight:
        "3 clientas nuevas escribieron esta semana después de ver una publicación. Fanny ya las está atendiendo.",
    },
    freya: {
      workspaceId,
      message:
        "Tienes 3 fotos listas para publicar y una idea de reel del baby boomer de Laura. Publica hoy antes de las 19:00 para conseguir más alcance.",
      readyCount: 3,
    },
    // No channel is connected yet — publish stays in the honest "aprobada ·
    // canal pendiente" state until real integrations exist.
    channels: [
      { channel: "instagram", connected: false },
      { channel: "facebook", connected: false },
      { channel: "tiktok", connected: false },
    ],
  }
}

/** An intentionally empty snapshot — drives the empty-state QA preview. */
export function getEmptyMarketingSnapshot(workspaceId: string): MarketingSnapshot {
  return {
    workspaceId,
    works: [],
    posts: [],
    campaigns: [],
    pulse: null,
    freya: null,
    channels: [
      { channel: "instagram", connected: false },
      { channel: "facebook", connected: false },
      { channel: "tiktok", connected: false },
    ],
  }
}
