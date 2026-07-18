"use client"

import { useEffect, useState } from "react"
import { SmartModal } from "@/components/smart-modal"
import type { BeautyMarketingConfig } from "@modules/marketing/beauty-marketing"
import type { MarketingPost, PostChannel } from "@modules/marketing/types"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_CLASS, LABEL_CLASS } from "./marketing-ui"

const CHANNELS: PostChannel[] = ["instagram", "facebook", "tiktok"]

/**
 * "Programar" — a simple date / time / channel picker. Future-date validation
 * lives in the pure layer (`schedulePost`); this dialog only collects input.
 */
export function SchedulePostDialog({
  config,
  post,
  onClose,
  onConfirm,
}: {
  config: BeautyMarketingConfig
  /** The post being scheduled, or null when closed. */
  post: MarketingPost | null
  onClose: () => void
  /** Returns false when the chosen date/time was rejected (e.g. in the past). */
  onConfirm: (post: MarketingPost, scheduledForIso: string, channel: PostChannel) => boolean
}) {
  const t = config.schedule

  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [channel, setChannel] = useState<PostChannel>("instagram")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!post) return
    // Sensible default: tomorrow at 19:00 (a good evening slot), always future.
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    setTime("19:00")
    setChannel(post.channel)
    setError(null)
  }, [post])

  function handleConfirm() {
    if (!post) return
    if (!date || !time) {
      setError(t.errorPast)
      return
    }
    const iso = new Date(`${date}T${time}`).toISOString()
    if (onConfirm(post, iso, channel)) {
      onClose()
    } else {
      setError(t.errorPast)
    }
  }

  return (
    <SmartModal open={post !== null} onClose={onClose} title={t.title} size="sm">
      <div className="flex flex-col gap-3.5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-date" className={LABEL_CLASS}>
              {t.dateLabel}
            </label>
            <input
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-time" className={LABEL_CLASS}>
              {t.timeLabel}
            </label>
            <input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="schedule-channel" className={LABEL_CLASS}>
            {t.channelLabel}
          </label>
          <select
            id="schedule-channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as PostChannel)}
            className={INPUT_CLASS}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {config.channelLabels[c]}
              </option>
            ))}
          </select>
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
          <button type="button" onClick={handleConfirm} className={BTN_PRIMARY}>
            {t.confirm}
          </button>
        </div>
      </div>
    </SmartModal>
  )
}
