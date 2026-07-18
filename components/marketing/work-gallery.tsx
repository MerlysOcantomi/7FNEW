"use client"

import { Camera, Plus, Wand2 } from "lucide-react"
import type { BeautyMarketingMessages } from "@modules/marketing/i18n"
import type { MarketingWork } from "@modules/marketing/types"
import {
  CHIP_CLASS,
  WORK_STATUS_TONE,
  chipStyle,
  placeholderBackground,
} from "./marketing-ui"
import { MarketingEmptyState } from "./marketing-empty-state"

/**
 * "Your work" — recent work photos with localized visual states, an upload
 * tile and a link to the full gallery. Selecting an unused photo starts the
 * convert-to-post flow.
 */
export function WorkGallery({
  messages,
  works,
  onUpload,
  onPreparePost,
  onViewAll,
}: {
  messages: BeautyMarketingMessages
  works: MarketingWork[]
  onUpload: () => void
  onPreparePost: (work: MarketingWork) => void
  onViewAll?: () => void
}) {
  const t = messages.gallery
  const recent = works.slice(0, 5)

  return (
    <section aria-labelledby="work-gallery-title">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2
          id="work-gallery-title"
          className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]"
        >
          {t.sectionTitle}
        </h2>
        <span className="font-mono text-[10.5px] text-[var(--text-tertiary-light)]">{t.sectionHint}</span>
        <span className="flex-1" />
        {works.length > 0 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[11.5px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 rounded"
          >
            {t.viewAll}
          </button>
        ) : null}
      </div>

      {works.length === 0 ? (
        <MarketingEmptyState
          icon={Camera}
          title={t.empty.title}
          description={t.empty.description}
          actionLabel={t.empty.action}
          onAction={onUpload}
          compact
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3" role="list">
          {/* Upload tile first — capture is always one tap away. */}
          <li>
            <button
              type="button"
              onClick={onUpload}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[var(--border-dark-strong)] bg-[var(--app-surface-subtle)] text-[var(--accent-on-dark)] transition-colors hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full border bg-[var(--app-surface-dark-elevated)]"
                style={{ borderColor: "var(--accent-muted-border)" }}
              >
                <Plus size={17} strokeWidth={2} />
              </span>
              <span className="text-[11.5px] font-semibold">{t.uploadTile}</span>
            </button>
          </li>

          {recent.map((work) => {
            const unused = work.status === "nuevo" || work.status === "sin_usar"
            return (
              <li key={work.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-[var(--border-dark)]">
                {work.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={work.imageUrl} alt={work.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div
                    role="img"
                    aria-label={messages.a11y.workPhotoAlt(work.title)}
                    className="absolute inset-0"
                    style={{ background: placeholderBackground(work.placeholderTone) }}
                  />
                )}
                <span className={`${CHIP_CLASS} absolute left-2 top-2`} style={chipStyle(WORK_STATUS_TONE[work.status])}>
                  {messages.workStatusLabels[work.status]}
                </span>
                <div
                  className="absolute inset-x-0 bottom-0 px-2.5 pb-2 pt-6"
                  style={{
                    background: "linear-gradient(transparent, color-mix(in srgb, var(--text-primary-light) 72%, transparent))",
                  }}
                >
                  <p className="truncate text-[11px] font-semibold text-white">{work.title}</p>
                </div>
                {/* Unused photo → start the convert-to-post flow. The pill is
                    always visible on touch screens and hover/focus-revealed on
                    md+ (hover is not available on mobile). */}
                {unused ? (
                  <button
                    type="button"
                    onClick={() => onPreparePost(work)}
                    aria-label={t.preparePostAria(work.title)}
                    className="absolute inset-0 flex items-center justify-center transition-opacity focus-visible:opacity-100 focus-visible:outline-none md:opacity-0 md:group-hover:opacity-100"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-md">
                      <Wand2 size={12} strokeWidth={2} aria-hidden="true" />
                      {t.preparePost}
                    </span>
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
