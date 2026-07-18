"use client"

import { CalendarClock, Camera, Pencil, Send, Sparkles, Target } from "lucide-react"
import type { BeautyMarketingConfig } from "@modules/marketing/beauty-marketing"
import type { MarketingPost, MarketingWork } from "@modules/marketing/types"
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SOFT,
  BTN_SOFT_STYLE,
  CARD_CLASS,
  CHIP_CLASS,
  POST_STATUS_TONE,
  chipStyle,
  placeholderBackground,
} from "./marketing-ui"
import { MarketingEmptyState } from "./marketing-empty-state"

function fmtScheduled(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * "Publicación de hoy" — the protagonist card. Photo with real prominence,
 * channel + status, Freya attribution, generated caption + hashtags, goal and
 * best time, and the three actions (Publicar ahora · Programar · Editar).
 * Feels ready to use, never like an empty form.
 *
 * HONESTY: while no channel is connected, "Publicar ahora" approves the post
 * (state "Aprobada · canal pendiente de conexión") and the pending-connection
 * note is shown — it never simulates a real publication.
 */
export function FeaturedPostCard({
  config,
  post,
  work,
  channelConnected,
  onPublish,
  onSchedule,
  onEdit,
  onUpload,
}: {
  config: BeautyMarketingConfig
  post: MarketingPost | null
  work: MarketingWork | null
  channelConnected: boolean
  onPublish: (post: MarketingPost) => void
  onSchedule: (post: MarketingPost) => void
  onEdit: (post: MarketingPost) => void
  onUpload: () => void
}) {
  const t = config.featured

  return (
    <section aria-labelledby="featured-post-title">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2
          id="featured-post-title"
          className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]"
        >
          {t.sectionTitle}
        </h2>
        <span className="font-mono text-[10.5px] text-[var(--text-tertiary-light)]">{t.sectionHint}</span>
      </div>

      {!post ? (
        <MarketingEmptyState
          icon={Camera}
          title={t.empty.title}
          description={t.empty.description}
          actionLabel={t.empty.action}
          onAction={onUpload}
        />
      ) : (
        <article className={`${CARD_CLASS} overflow-hidden md:flex`}>
          {/* Photo — enough protagonism: full-width on mobile, wide column on desktop. */}
          <div className="relative h-48 shrink-0 sm:h-56 md:h-auto md:w-[280px] md:min-h-[320px]">
            {work?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={work.imageUrl}
                alt={work.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                aria-label={work ? `Foto: ${work.title}` : "Foto del trabajo"}
                role="img"
                className="absolute inset-0"
                style={{ background: placeholderBackground(work?.placeholderTone) }}
              />
            )}
            <span
              className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold text-white"
              style={{ background: "color-mix(in srgb, var(--text-primary-light) 55%, transparent)", backdropFilter: "blur(4px)" }}
            >
              {config.channelLabels[post.channel]} · {config.kindLabels[post.kind]}
            </span>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className="grid h-6 w-6 place-items-center rounded-lg"
                style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
              >
                <Sparkles size={13} strokeWidth={2} />
              </span>
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-primary-light)]">
                {config.freya.name}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary-light)]">
                {post.preparedBy === "freya" ? t.freyaPrepared : config.publish.proposalNote}
              </span>
              <span className={`${CHIP_CLASS} ml-auto`} style={chipStyle(POST_STATUS_TONE[post.status])}>
                {post.status === "aprobada"
                  ? t.approvedState
                  : config.postStatusLabels[post.status]}
              </span>
            </div>

            <p className="mt-3 text-[14px] font-semibold leading-snug text-[var(--text-primary-light)]">
              {post.title}
            </p>

            <div className="mt-2.5 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
              <p className="text-[12.5px] leading-relaxed text-[var(--text-primary-light)]">
                “{post.caption}”
              </p>
              {post.hashtags.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {post.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {post.goal ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary-light)]">
                  <Target size={12} strokeWidth={2} aria-hidden="true" />
                  <span>
                    <span className="text-[var(--text-tertiary-light)]">{t.goalLabel} </span>
                    <strong className="font-semibold text-[var(--text-primary-light)]">{post.goal}</strong>
                  </span>
                </span>
              ) : null}
              {post.status === "programada" && post.scheduledFor ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary-light)]">
                  <CalendarClock size={12} strokeWidth={2} aria-hidden="true" />
                  <span>
                    <span className="text-[var(--text-tertiary-light)]">{t.scheduledState} </span>
                    <strong className="font-semibold text-[var(--text-primary-light)]">
                      {fmtScheduled(post.scheduledFor)}
                    </strong>
                  </span>
                </span>
              ) : post.bestTime ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary-light)]">
                  <CalendarClock size={12} strokeWidth={2} aria-hidden="true" />
                  <span>
                    <span className="text-[var(--text-tertiary-light)]">{t.bestTimeLabel} </span>
                    <strong className="font-semibold text-[var(--text-primary-light)]">{post.bestTime}</strong>
                  </span>
                </span>
              ) : null}
            </div>

            {/* Honest channel note: only relevant before a real integration exists. */}
            {!channelConnected ? (
              <p className="mt-3 rounded-lg border border-dashed border-[var(--border-dark)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-tertiary-light)]">
                {t.channelPendingNote}
              </p>
            ) : null}

            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <button
                type="button"
                onClick={() => onPublish(post)}
                disabled={post.status === "aprobada" || post.status === "publicada"}
                className={`${BTN_PRIMARY} flex-1 sm:flex-none`}
              >
                <Send size={13} strokeWidth={2} aria-hidden="true" />
                {t.publishNow}
              </button>
              <button type="button" onClick={() => onSchedule(post)} className={BTN_SECONDARY}>
                <CalendarClock size={13} strokeWidth={2} aria-hidden="true" />
                {t.schedule}
              </button>
              <button
                type="button"
                onClick={() => onEdit(post)}
                className={BTN_SOFT}
                style={BTN_SOFT_STYLE}
              >
                <Pencil size={13} strokeWidth={2} aria-hidden="true" />
                {t.edit}
              </button>
            </div>
          </div>
        </article>
      )}
    </section>
  )
}
