"use client"

import { useEffect, useState } from "react"
import { SmartModal } from "@/components/smart-modal"
import type { BeautyMarketingMessages } from "@modules/marketing/i18n"
import type { PostEdits } from "@modules/marketing/state"
import type { MarketingPost, PostChannel, PostKind } from "@modules/marketing/types"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_CLASS, LABEL_CLASS } from "./marketing-ui"

const CHANNELS: PostChannel[] = ["instagram", "facebook", "tiktok"]
const KINDS: PostKind[] = ["post", "reel", "story", "carrusel"]

/**
 * "Edit post" — text, hashtags, channel, content type, goal, CTA and
 * (when already scheduled) date/time. Validation lives in the pure layer
 * (`applyPostEdits`); this dialog only collects input and surfaces errors.
 */
export function EditPostDialog({
  messages,
  post,
  onClose,
  onSave,
}: {
  messages: BeautyMarketingMessages
  /** The post being edited, or null when closed. */
  post: MarketingPost | null
  onClose: () => void
  /** Returns false when the edits were rejected (e.g. empty caption). */
  onSave: (post: MarketingPost, edits: PostEdits) => boolean
}) {
  const t = messages.editPost

  const [title, setTitle] = useState("")
  const [caption, setCaption] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [channel, setChannel] = useState<PostChannel>("instagram")
  const [kind, setKind] = useState<PostKind>("post")
  const [goal, setGoal] = useState("")
  const [cta, setCta] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Sync the form whenever a post is opened for editing.
  useEffect(() => {
    if (!post) return
    setTitle(post.title)
    setCaption(post.caption)
    setHashtags(post.hashtags.join(", "))
    setChannel(post.channel)
    setKind(post.kind)
    setGoal(post.goal ?? "")
    setCta(post.cta ?? "")
    if (post.scheduledFor) {
      const d = new Date(post.scheduledFor)
      setScheduledDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      )
      setScheduledTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)
    } else {
      setScheduledDate("")
      setScheduledTime("")
    }
    setError(null)
  }, [post])

  function handleSave() {
    if (!post) return
    if (!caption.trim()) {
      setError(t.errorCaption)
      return
    }
    const edits: PostEdits = {
      title,
      caption,
      hashtags: hashtags.split(/[,\n]/),
      channel,
      kind,
      goal: goal.trim() || null,
      cta: cta.trim() || null,
    }
    if (post.scheduledFor && scheduledDate && scheduledTime) {
      edits.scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
    }
    if (onSave(post, edits)) {
      onClose()
    } else {
      setError(t.errorCaption)
    }
  }

  return (
    <SmartModal open={post !== null} onClose={onClose} title={t.title} size="lg">
      <div className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-title" className={LABEL_CLASS}>
            {t.titleLabel}
          </label>
          <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-caption" className={LABEL_CLASS}>
            {t.captionLabel}
          </label>
          <textarea
            id="edit-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-hashtags" className={LABEL_CLASS}>
            {t.hashtagsLabel}
          </label>
          <input
            id="edit-hashtags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className={INPUT_CLASS}
            aria-describedby="edit-hashtags-hint"
          />
          <p id="edit-hashtags-hint" className="text-[10.5px] text-[var(--text-tertiary-light)]">
            {t.hashtagsHint}
          </p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-channel" className={LABEL_CLASS}>
              {t.channelLabel}
            </label>
            <select
              id="edit-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as PostChannel)}
              className={INPUT_CLASS}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {messages.channelLabels[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-kind" className={LABEL_CLASS}>
              {t.kindLabel}
            </label>
            <select
              id="edit-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as PostKind)}
              className={INPUT_CLASS}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {messages.kindLabels[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-goal" className={LABEL_CLASS}>
              {t.goalLabel}
            </label>
            <input id="edit-goal" value={goal} onChange={(e) => setGoal(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-cta" className={LABEL_CLASS}>
              {t.ctaLabel}
            </label>
            <input id="edit-cta" value={cta} onChange={(e) => setCta(e.target.value)} className={INPUT_CLASS} />
          </div>

          {/* Date/time — only when the post is already scheduled. */}
          {post?.scheduledFor ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-date" className={LABEL_CLASS}>
                  {messages.schedule.dateLabel}
                </label>
                <input
                  id="edit-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-time" className={LABEL_CLASS}>
                  {messages.schedule.timeLabel}
                </label>
                <input
                  id="edit-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-[12px] font-medium" style={{ color: "var(--inbox-urgency)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-[var(--border-dark)] pt-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {t.cancel}
          </button>
          <button type="button" onClick={handleSave} className={BTN_PRIMARY}>
            {t.save}
          </button>
        </div>
      </div>
    </SmartModal>
  )
}
