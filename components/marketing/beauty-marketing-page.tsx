"use client"

import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronDown, Users } from "lucide-react"
import { toast } from "sonner"
import { AppShell } from "@/components/app-shell"
import { SmartModal } from "@/components/smart-modal"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import type { BeautyMarketingConfig } from "@modules/marketing/beauty-marketing"
import {
  getBeautyMarketingDemoSnapshot,
  getEmptyMarketingSnapshot,
} from "@modules/marketing/demo-data"
import {
  applyPostEdits,
  approvePost,
  buildDraftPostFromWork,
  buildEditorialWeek,
  deriveWeeklySummary,
  pickFeaturedPost,
  schedulePost,
  transitionCampaign,
  workStatusForPost,
  type PostEdits,
} from "@modules/marketing/state"
import type {
  CampaignStatus,
  MarketingCampaign,
  MarketingPost,
  MarketingSnapshot,
  MarketingWork,
  PostChannel,
} from "@modules/marketing/types"
import { MarketingHeader } from "./marketing-header"
import { FreyaMarketingBrief } from "./freya-marketing-brief"
import { FeaturedPostCard } from "./featured-post-card"
import { WorkGallery } from "./work-gallery"
import { ContentCalendar } from "./content-calendar"
import { SimpleCampaigns } from "./simple-campaigns"
import { SocialPulseCard } from "./social-pulse"
import { UploadWorkDialog, type UploadedWorkDraft } from "./upload-work-dialog"
import { EditPostDialog } from "./edit-post-dialog"
import { SchedulePostDialog } from "./schedule-post-dialog"
import {
  BTN_PRIMARY,
  CARD_CLASS,
  CHIP_CLASS,
  WORK_STATUS_TONE,
  chipStyle,
  placeholderBackground,
} from "./marketing-ui"

/**
 * Finesse Marketing — the Beauty vertical's Marketing experience at
 * `/contenido` (see `app/contenido/page.tsx` for the vertical dispatch).
 *
 * Narrative: the professional uploads a photo of a real job, Freya prepares
 * the publication, and she only reviews, edits, schedules or approves.
 *
 * Layout: AppShell owns navigation (sidebar + real mobile nav — no parallel
 * shells). Desktop is a two-column grid with the featured post as protagonist;
 * mobile re-orders the same sections for phone-first daily use (Freya brief →
 * featured post → gallery → campaign → pulse, calendar collapsed) via
 * `display: contents` wrappers + `order-*`, without duplicating markup.
 *
 * Data: the isolated demo adapter provides the workspace-scoped snapshot (no
 * Marketing backend yet — the header shows the preview chip permanently). All
 * mutations run through the pure functions in `@modules/marketing/state`, so
 * this component stays a thin orchestrator. Publish NEVER simulates a real
 * publication: with no channel connected it moves the post to the honest
 * "aprobada · canal pendiente" state.
 */

// ─── Local state (reducer over the snapshot) ─────────────────────────────────

type MarketingAction =
  | { type: "add_works"; works: MarketingWork[] }
  | { type: "add_post"; post: MarketingPost }
  | { type: "replace_post"; post: MarketingPost }
  | { type: "update_campaign"; campaign: MarketingCampaign }

function marketingReducer(state: MarketingSnapshot, action: MarketingAction): MarketingSnapshot {
  switch (action.type) {
    case "add_works":
      return { ...state, works: [...action.works, ...state.works] }
    case "add_post":
      return {
        ...state,
        posts: [action.post, ...state.posts],
        works: state.works.map((w) =>
          w.id === action.post.workId
            ? { ...w, status: workStatusForPost(action.post.status), postId: action.post.id }
            : w,
        ),
      }
    case "replace_post":
      return {
        ...state,
        posts: state.posts.map((p) => (p.id === action.post.id ? action.post : p)),
        // Keep the source work's visual state in sync with its post.
        works: state.works.map((w) =>
          w.id === action.post.workId ? { ...w, status: workStatusForPost(action.post.status) } : w,
        ),
      }
    case "update_campaign":
      return {
        ...state,
        campaigns: state.campaigns.map((c) => (c.id === action.campaign.id ? action.campaign : c)),
      }
  }
}

// ─── Entry ───────────────────────────────────────────────────────────────────

export function BeautyMarketingPage({ config }: { config: BeautyMarketingConfig }) {
  const searchParams = useSearchParams()
  const { workspace } = useActiveWorkspace()

  // QA/preview helpers (mirror `?vertical=beauty`): force the empty or error
  // dataset to review those states without touching real data.
  const demoMode = searchParams.get("marketingDemo")

  // Gate on client mount before reading the clock: the demo snapshot derives
  // its week from "now", and computing it during SSR would risk a hydration
  // mismatch around day boundaries.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
  }, [])

  const workspaceId = workspace?.id ?? "preview"

  return (
    <AppShell currentSection="contenido" breadcrumbs={[{ label: "7F" }, { label: config.header.title }]} contentClassName="max-w-7xl">
      {demoMode === "error" ? (
        <MarketingErrorState config={config} />
      ) : now === null ? (
        <MarketingLoading />
      ) : (
        <MarketingContent
          key={`${workspaceId}:${demoMode ?? "demo"}`}
          config={config}
          workspaceId={workspaceId}
          now={now}
          empty={demoMode === "empty"}
        />
      )}
    </AppShell>
  )
}

// ─── States: loading / error ─────────────────────────────────────────────────

function MarketingLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando Marketing">
      <div className={`${CARD_CLASS} h-24 animate-pulse`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className={`${CARD_CLASS} h-80 animate-pulse`} />
          <div className={`${CARD_CLASS} h-52 animate-pulse`} />
        </div>
        <div className="flex flex-col gap-6">
          <div className={`${CARD_CLASS} h-28 animate-pulse`} />
          <div className={`${CARD_CLASS} h-64 animate-pulse`} />
        </div>
      </div>
    </div>
  )
}

function MarketingErrorState({ config }: { config: BeautyMarketingConfig }) {
  const t = config.errorState
  return (
    <div className={`${CARD_CLASS} mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center`}>
      <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">{t.title}</p>
      <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.description}</p>
      <Link href="/contenido" className={`${BTN_PRIMARY} mt-2`}>
        {t.retry}
      </Link>
    </div>
  )
}

// ─── Content ─────────────────────────────────────────────────────────────────

function MarketingContent({
  config,
  workspaceId,
  now,
  empty,
}: {
  config: BeautyMarketingConfig
  workspaceId: string
  now: Date
  empty: boolean
}) {
  const [snapshot, dispatch] = useReducer(
    marketingReducer,
    undefined,
    () => (empty ? getEmptyMarketingSnapshot(workspaceId) : getBeautyMarketingDemoSnapshot(workspaceId, now)),
  )

  // Dialog state.
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<MarketingPost | null>(null)
  const [schedulingPost, setSchedulingPost] = useState<MarketingPost | null>(null)
  const [viewingCampaign, setViewingCampaign] = useState<MarketingCampaign | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)

  const summary = useMemo(() => deriveWeeklySummary(snapshot.posts, snapshot.campaigns), [snapshot])
  const featured = useMemo(() => pickFeaturedPost(snapshot.posts), [snapshot.posts])
  const featuredWork = useMemo(
    () => (featured?.workId ? snapshot.works.find((w) => w.id === featured.workId) ?? null : null),
    [featured, snapshot.works],
  )
  const week = useMemo(
    () => buildEditorialWeek(snapshot.posts, snapshot.campaigns, now),
    [snapshot.posts, snapshot.campaigns, now],
  )
  const anyChannelConnected = snapshot.channels.some((c) => c.connected)

  // ── Handlers (pure computation → granular dispatch) ────────────────────────

  const handleUploadConfirm = useCallback(
    (drafts: UploadedWorkDraft[]) => {
      const created: MarketingWork[] = drafts.map((d, i) => ({
        id: `${workspaceId}:work-${Date.now()}-${i}`,
        workspaceId,
        title: buildWorkTitle(d),
        clientName: d.clientName || null,
        service: d.service || null,
        style: d.style || null,
        beforeAfter: d.beforeAfter,
        notesForFreya: d.notesForFreya || null,
        status: "nuevo",
        createdAt: new Date().toISOString(),
        imageUrl: d.imageUrl,
      }))
      dispatch({ type: "add_works", works: created })
      setUploadOpen(false)
      toast.success(config.upload.successToast)
    },
    [workspaceId, config.upload.successToast],
  )

  const handlePreparePost = useCallback(
    (work: MarketingWork) => {
      const draft = buildDraftPostFromWork(work, { id: `${workspaceId}:post-${Date.now()}` })
      dispatch({ type: "add_post", post: draft })
      // Straight into review/edit — the proposal never feels like an empty form.
      setEditingPost(draft)
      setGalleryOpen(false)
    },
    [workspaceId],
  )

  const handlePublish = useCallback(
    (post: MarketingPost) => {
      const channelConnected = snapshot.channels.some((c) => c.channel === post.channel && c.connected)
      dispatch({ type: "replace_post", post: approvePost(post, { channelConnected }) })
      toast.success(config.publish.approvedToast)
    },
    [snapshot.channels, config.publish.approvedToast],
  )

  const handleScheduleConfirm = useCallback(
    (post: MarketingPost, iso: string, channel: PostChannel): boolean => {
      const scheduled = schedulePost({ ...post, channel }, iso, new Date())
      if (!scheduled) return false
      dispatch({ type: "replace_post", post: scheduled })
      toast.success(config.schedule.successToast)
      return true
    },
    [config.schedule.successToast],
  )

  const handleEditSave = useCallback(
    (post: MarketingPost, edits: PostEdits): boolean => {
      const updated = applyPostEdits(post, edits)
      if (!updated) return false
      dispatch({ type: "replace_post", post: updated })
      toast.success(config.editPost.successToast)
      return true
    },
    [config.editPost.successToast],
  )

  const handleCampaignTransition = useCallback(
    (campaign: MarketingCampaign, to: CampaignStatus) => {
      const updated = transitionCampaign(campaign, to)
      if (!updated) return
      dispatch({ type: "update_campaign", campaign: updated })
      toast.success(`${config.campaigns.sectionTitle}: ${config.campaignStatusLabels[to].toLowerCase()}`)
    },
    [config],
  )

  const openUpload = useCallback(() => setUploadOpen(true), [])

  // ── Layout ─────────────────────────────────────────────────────────────────
  // Mobile: one ordered column (Freya → featured → gallery → campaigns →
  // pulse → collapsible calendar). Desktop (lg+): 2-column grid via
  // `display: contents` wrappers, so the same nodes serve both layouts.

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <MarketingHeader config={config} summary={summary} onUpload={openUpload} />

      <div className="flex flex-col gap-5 md:gap-6 lg:grid lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] lg:items-start">
        {/* Left column (protagonist) */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div className="order-2 lg:order-none">
            <FeaturedPostCard
              config={config}
              post={featured}
              work={featuredWork}
              channelConnected={anyChannelConnected}
              onPublish={handlePublish}
              onSchedule={setSchedulingPost}
              onEdit={setEditingPost}
              onUpload={openUpload}
            />
          </div>
          <div className="order-3 lg:order-none">
            <WorkGallery
              config={config}
              works={snapshot.works}
              onUpload={openUpload}
              onPreparePost={handlePreparePost}
              onViewAll={() => setGalleryOpen(true)}
            />
          </div>
          <div className="order-6 lg:order-none">
            {/* Mobile: collapsed so the screen never gets too long. */}
            <details className="group lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--text-primary-light)] [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                />
                {config.calendar.mobileToggle}
              </summary>
              <div className="mt-3">
                <ContentCalendar config={config} days={week} showHeading={false} />
              </div>
            </details>
            <div className="hidden lg:block">
              <ContentCalendar config={config} days={week} />
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <div className="order-1 lg:order-none">
            <FreyaMarketingBrief config={config} brief={snapshot.freya} />
          </div>
          <div className="order-4 lg:order-none">
            <SimpleCampaigns
              config={config}
              campaigns={snapshot.campaigns}
              onTransition={handleCampaignTransition}
              onView={setViewingCampaign}
            />
          </div>
          <div className="order-5 lg:order-none">
            <SocialPulseCard config={config} pulse={snapshot.pulse} channelsConnected={anyChannelConnected} />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <UploadWorkDialog config={config} open={uploadOpen} onClose={() => setUploadOpen(false)} onConfirm={handleUploadConfirm} />
      <EditPostDialog config={config} post={editingPost} onClose={() => setEditingPost(null)} onSave={handleEditSave} />
      <SchedulePostDialog
        config={config}
        post={schedulingPost}
        onClose={() => setSchedulingPost(null)}
        onConfirm={handleScheduleConfirm}
      />
      <CampaignDetailModal
        config={config}
        campaign={viewingCampaign}
        onClose={() => setViewingCampaign(null)}
      />
      <FullGalleryModal
        config={config}
        open={galleryOpen}
        works={snapshot.works}
        onClose={() => setGalleryOpen(false)}
        onPreparePost={handlePreparePost}
      />
    </div>
  )
}

/** Human title for an uploaded work, composed from its metadata. */
function buildWorkTitle(d: UploadedWorkDraft): string {
  const base = d.style || d.service || "Nuevo trabajo"
  return d.clientName ? `${base} · ${d.clientName}` : base
}

// ─── Campaign detail (simple, plain-language) ────────────────────────────────

function CampaignDetailModal({
  config,
  campaign,
  onClose,
}: {
  config: BeautyMarketingConfig
  campaign: MarketingCampaign | null
  onClose: () => void
}) {
  return (
    <SmartModal open={campaign !== null} onClose={onClose} title={campaign?.title} size="sm">
      {campaign ? (
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={CHIP_CLASS}
              style={{
                background: "var(--inbox-info-soft, color-mix(in srgb, var(--inbox-info) 12%, transparent))",
                color: "var(--inbox-info)",
                borderColor: "color-mix(in srgb, var(--inbox-info) 32%, transparent)",
              }}
            >
              {config.agentLabels[campaign.agent]}
            </span>
            <span className={CHIP_CLASS} style={chipStyle(WORK_STATUS_TONE.preparado)}>
              {config.campaignStatusLabels[campaign.status]}
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">{campaign.reason}</p>
          {campaign.audienceSize != null ? (
            <p className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--text-tertiary-light)]">
              <Users size={12} strokeWidth={2} aria-hidden="true" />
              ~{campaign.audienceSize.toLocaleString("es-ES")} {campaign.audienceLabel ?? config.campaigns.audiencePrefix}
            </p>
          ) : null}
        </div>
      ) : null}
    </SmartModal>
  )
}

// ─── Full gallery (all works, same states) ───────────────────────────────────

function FullGalleryModal({
  config,
  open,
  works,
  onClose,
  onPreparePost,
}: {
  config: BeautyMarketingConfig
  open: boolean
  works: MarketingWork[]
  onClose: () => void
  onPreparePost: (work: MarketingWork) => void
}) {
  return (
    <SmartModal open={open} onClose={onClose} title={config.gallery.sectionTitle} size="xl">
      <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4" role="list">
        {works.map((work) => {
          const unused = work.status === "nuevo" || work.status === "sin_usar"
          return (
            <li key={work.id} className="flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-dark)]">
                {work.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={work.imageUrl} alt={work.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div
                    role="img"
                    aria-label={`Foto: ${work.title}`}
                    className="absolute inset-0"
                    style={{ background: placeholderBackground(work.placeholderTone) }}
                  />
                )}
                <span className={`${CHIP_CLASS} absolute left-2 top-2`} style={chipStyle(WORK_STATUS_TONE[work.status])}>
                  {config.workStatusLabels[work.status]}
                </span>
              </div>
              <p className="truncate text-[11.5px] font-medium text-[var(--text-primary-light)]">{work.title}</p>
              {unused ? (
                <button
                  type="button"
                  onClick={() => onPreparePost(work)}
                  className="self-start text-[11px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 rounded"
                >
                  {config.gallery.preparePost} →
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </SmartModal>
  )
}
