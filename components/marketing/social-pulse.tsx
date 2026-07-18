"use client"

import { MessageCircle, PlugZap } from "lucide-react"
import type { BeautyMarketingMessages } from "@modules/marketing/i18n"
import type { SocialPulse } from "@modules/marketing/types"
import { CARD_CLASS } from "./marketing-ui"

/**
 * "Social pulse" — only easy-to-understand metrics (followers, reach, saves,
 * inquiries, new clients from content) plus one useful interpretation that
 * connects marketing to real business results. Never a dense analytics panel.
 */
export function SocialPulseCard({
  messages,
  pulse,
  channelsConnected,
}: {
  messages: BeautyMarketingMessages
  pulse: SocialPulse | null
  channelsConnected: boolean
}) {
  const t = messages.pulse

  return (
    <section aria-labelledby="social-pulse-title">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2
          id="social-pulse-title"
          className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]"
        >
          {t.sectionTitle}
        </h2>
        <span className="font-mono text-[10.5px] text-[var(--text-tertiary-light)]">
          {pulse?.periodLabel ?? t.sectionHint}
        </span>
      </div>

      <div className={`${CARD_CLASS} p-4`}>
        {pulse ? (
          <>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
              {pulse.metrics.map((m) => (
                <div key={m.id}>
                  <dd className="text-[20px] font-semibold leading-none tracking-tight text-[var(--text-primary-light)]">
                    {m.value}
                  </dd>
                  <dt className="mt-1 text-[10px] text-[var(--text-tertiary-light)]">{m.label}</dt>
                  {m.delta ? (
                    <p
                      className="mt-0.5 text-[10px] font-semibold"
                      style={{
                        color:
                          m.deltaTone === "up"
                            ? "var(--inbox-success)"
                            : m.deltaTone === "down"
                              ? "var(--inbox-urgency)"
                              : "var(--text-tertiary-light)",
                      }}
                    >
                      {m.delta}
                    </p>
                  ) : null}
                </div>
              ))}
            </dl>

            {/* Useful interpretation — marketing connected to real results. */}
            <div className="mt-4 flex items-start gap-2.5 border-t border-[var(--border-dark)] pt-3.5">
              <span
                aria-hidden="true"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                style={{
                  background: "var(--inbox-success-soft, color-mix(in srgb, var(--inbox-success) 12%, transparent))",
                  color: "var(--inbox-success)",
                }}
              >
                <MessageCircle size={13} strokeWidth={2} />
              </span>
              <p className="text-[11.5px] leading-relaxed text-[var(--text-secondary-light)]">{pulse.insight}</p>
            </div>
          </>
        ) : null}

        {/* Honest "channels pending" note — no fake metrics when nothing is connected. */}
        {!channelsConnected ? (
          <p
            className={`flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-dark)] px-3 py-2 text-[11px] text-[var(--text-tertiary-light)] ${pulse ? "mt-3" : ""}`}
          >
            <PlugZap size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            {t.channelsPendingNote}
          </p>
        ) : null}
      </div>
    </section>
  )
}
