import {
  CalendarDays,
  Check,
  Ellipsis,
  Globe,
  Images,
  Inbox,
  MapPin,
  Mic,
  Phone,
  Send,
  Store,
  StickyNote,
} from "lucide-react"
import type { FinesseLandingMessages } from "@modules/finesse-web/i18n"
import { TodayDateGlyph } from "@/components/mobile-nav/today-date-glyph"

/**
 * Marketing previews for the Finesse landing (FINESSE-WEB-01).
 *
 * Static, token-only replicas of the REAL product surfaces — the mobile "Hoy"
 * (FINESSE-UI-02), the bottom bar, the calendar list, a conversation card
 * and a business card. They render sample copy from the landing catalog only:
 * no workspace data, no fetches, no client JS, no hardcoded colors. The visual
 * vocabulary (radii, tokens, hierarchy) mirrors `beauty-today-real.tsx` and
 * `vertical-mobile-nav.tsx` so the page shows the product, not a mock-up.
 */

const CARD = "rounded-[16px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"
const LABEL = "text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary-light)]"

type Preview = FinesseLandingMessages["preview"]

/** Phone frame around a preview — the same frame for every visual. */
export function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="mx-auto w-full max-w-[340px]">
      <div
        className="overflow-hidden rounded-[32px] border-[6px] border-[var(--text-primary-light)] bg-[var(--app-canvas)] shadow-[var(--shadow-strong)]"
        aria-hidden="true"
      >
        {children}
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-[var(--text-tertiary-light)]">{label}</figcaption>
    </figure>
  )
}

/** The real mobile "Hoy": header · next client · attention · inspiration · bottom bar. */
export function TodayPreview({ t }: { t: Preview["today"] }) {
  return (
    <div className="flex h-[470px] flex-col text-[var(--text-primary-light)] sm:h-[560px]">
      <div className="relative flex-1 space-y-3 overflow-hidden px-3.5 pt-5">
        {/* Soft fade where the phone content continues under the bar (no hard crop). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-[linear-gradient(to_bottom,transparent,var(--app-canvas))]" />
        <div>
          <p className="text-[10.5px] font-medium text-[var(--text-secondary-light)]">{t.date}</p>
          <p className="text-[17px] font-semibold tracking-tight">{t.studio}</p>
        </div>

        <div className={`${CARD} space-y-3 p-3.5`}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>{t.nowTitle}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--inbox-success-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--inbox-success)]">
              <span className="h-1 w-1 rounded-full bg-[var(--inbox-success)]" />
              {t.inProgress}
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <div>
              <p className="text-[24px] font-semibold leading-none tabular-nums tracking-tight text-[var(--accent-primary)]">{t.time}</p>
              <p className="mt-1 text-[9.5px] text-[var(--text-tertiary-light)]">{t.until}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight">{t.client}</p>
              <p className="truncate text-[11.5px] text-[var(--text-secondary-light)]">{t.service}</p>
            </div>
          </div>
          <div className="flex gap-2 rounded-xl bg-[var(--app-surface-subtle)] p-2.5">
            <StickyNote size={12} className="mt-0.5 shrink-0 text-[var(--accent-on-dark)]" />
            <div className="min-w-0">
              <p className="text-[8.5px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">{t.noteLabel}</p>
              <p className="line-clamp-2 text-[10.5px] leading-snug">{t.note}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 text-[10.5px] font-semibold text-[var(--primary-foreground)]">
              <Phone size={11} />
              {t.call}
            </span>
            <span className="inline-flex h-8 items-center rounded-lg border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-2.5 text-[10.5px] font-semibold text-[var(--accent-on-dark)]">
              {t.viewClient}
            </span>
          </div>
          <p className="flex items-baseline gap-1.5 text-[10.5px] text-[var(--text-secondary-light)]">
            <span className="text-[8.5px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">{t.nextLabel}</span>
            <span className="font-semibold tabular-nums text-[var(--text-primary-light)]">{t.nextTime}</span>
            <span className="truncate">{t.nextClient}</span>
          </p>
          <div className="flex h-9 items-center justify-between rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2.5 text-[11px] font-semibold text-[var(--accent-on-dark)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} />
              {t.viewAgenda}
            </span>
            <span aria-hidden="true">›</span>
          </div>
        </div>

        <div className={`${CARD} space-y-2 p-3.5`}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>{t.attentionTitle}</span>
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent-primary)] px-1 text-[8.5px] font-bold text-[var(--primary-foreground)]">
              {t.attention.length}
            </span>
          </div>
          <ul className="divide-y divide-[var(--border-dark)]">
            {t.attention.map((row, i) => (
              <li key={row} className="flex items-center gap-2 py-1.5 text-[10.5px] font-semibold">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                  style={{
                    background: `color-mix(in srgb, ${i === 0 ? "var(--inbox-urgency)" : i === 1 ? "var(--inbox-info)" : "var(--inbox-lead)"} 14%, transparent)`,
                    color: i === 0 ? "var(--inbox-urgency)" : i === 1 ? "var(--inbox-info)" : "var(--inbox-lead)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </span>
                <span className="truncate">{row}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${CARD} hidden space-y-2 p-3.5 sm:block`}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>{t.inspirationTitle}</span>
            <span className="text-[9.5px] text-[var(--text-secondary-light)]">{t.inspirationCount}</span>
          </div>
          <div className="flex gap-2">
            {["var(--accent-primary)", "var(--agent-rose)", "var(--agent-teal)"].map((tone) => (
              <span
                key={tone}
                className="h-14 w-14 shrink-0 rounded-[10px]"
                style={{ background: `color-mix(in srgb, ${tone} 22%, var(--app-surface-dark-elevated))` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative shrink-0 border-t border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-1 pb-2 pt-1.5">
        <ul className="grid grid-cols-5 items-end text-[8.5px] font-medium text-[var(--text-secondary-light)]">
          <li className="flex flex-col items-center gap-0.5"><Store size={16} />{t.nav.salon}</li>
          <li className="flex flex-col items-center gap-0.5 text-[var(--accent-primary)]">
            <span className="grid h-5 w-9 place-items-center rounded-full bg-[var(--accent-muted)]"><TodayDateGlyph day={3} size={16} /></span>
            {t.nav.today}
          </li>
          <li className="flex flex-col items-center gap-0.5 font-semibold text-[var(--text-primary-light)]">
            <span className="-mt-6 grid h-11 w-11 place-items-center rounded-full border-4 border-[var(--app-surface-dark-elevated)] bg-[var(--accent-primary)] text-[var(--primary-foreground)] shadow-[var(--app-shadow-subtle)]"><Mic size={18} /></span>
            {t.nav.assistant}
          </li>
          <li className="flex flex-col items-center gap-0.5"><Inbox size={16} />{t.nav.messages}</li>
          <li className="flex flex-col items-center gap-0.5"><Ellipsis size={16} />{t.nav.more}</li>
        </ul>
      </div>
    </div>
  )
}

export function AgendaPreview({ t }: { t: Preview["agenda"] }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[var(--border-dark)] px-4 py-3">
        <span className="text-[13px] font-semibold text-[var(--text-primary-light)]">{t.title}</span>
        <CalendarDays size={14} className="text-[var(--accent-on-dark)]" />
      </div>
      <ul>
        {t.rows.map((row, i) => (
          <li key={row.time} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-[var(--border-dark)]" : ""}`}>
            <span className="w-11 shrink-0 text-[12.5px] font-semibold tabular-nums text-[var(--text-primary-light)]">{row.time}</span>
            <span className={`h-8 w-[3px] shrink-0 rounded-full ${i === 1 ? "bg-[var(--inbox-success)]" : "bg-[var(--accent-primary)]"}`} />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary-light)]">{row.client}</span>
              <span className="block truncate text-[11px] text-[var(--text-secondary-light)]">{row.service}</span>
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 border-t border-[var(--border-dark)] bg-[var(--inbox-success-soft)] px-4 py-2.5 text-[11.5px] font-semibold text-[var(--inbox-success)]">
          <span className="w-11 shrink-0" />
          {t.free}
        </li>
      </ul>
    </div>
  )
}

export function InboxPreview({ t }: { t: Preview["inbox"] }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-[var(--border-dark)] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--accent-muted)] text-[12px] font-bold text-[var(--accent-on-dark)]">
          {t.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[var(--text-primary-light)]">{t.name}</span>
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9.5px] font-semibold text-[var(--accent-on-dark)]">{t.intent}</span>
          </span>
          <span className="block text-[11px] text-[var(--text-secondary-light)]">{t.channel} · {t.time}</span>
        </span>
      </div>
      <div className="space-y-2.5 bg-[var(--inbox-chat-background)] px-4 py-4">
        <div className="max-w-[85%] rounded-[14px] rounded-tl-[4px] border border-[var(--inbox-chat-bubble-inbound-border)] bg-[var(--inbox-chat-bubble-inbound)] px-3 py-2 text-[12.5px] leading-snug text-[var(--text-primary-light)]">
          {t.message}
        </div>
        <div className="flex gap-2 pl-1">
          <span className="rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-on-dark)]">{t.viewAppointment}</span>
          <span className="rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-on-dark)]">{t.prepareReply}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--border-dark)] px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--app-surface-subtle)] text-[16px] leading-none text-[var(--text-secondary-light)]">+</span>
        <span className="flex-1 rounded-lg border border-[var(--border-dark)] bg-[var(--inbox-composer-input)] px-3 py-1.5 text-[12px] text-[var(--text-tertiary-light)]">{t.composerPlaceholder}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-primary)] text-[var(--primary-foreground)]"><Send size={13} /></span>
      </div>
    </div>
  )
}

export function PresencePreview({ t }: { t: Preview["presence"] }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-[var(--border-dark)] bg-[var(--accent-soft)] px-4 py-2 text-[10.5px] font-semibold text-[var(--accent-on-dark)]">
        <Globe size={12} />
        {t.webLabel}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-[16px] font-semibold tracking-tight text-[var(--text-primary-light)]">{t.businessName}</p>
          <p className="text-[12px] text-[var(--text-secondary-light)]">{t.tagline}</p>
        </div>
        <div>
          <p className={LABEL}>{t.servicesLabel}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {t.services.map((s) => (
              <li key={s} className="rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary-light)]">{s}</li>
            ))}
          </ul>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {[[Check, t.hoursLabel, t.hours], [MapPin, t.locationLabel, t.location], [Phone, t.contactLabel, t.contact]].map(([Icon, label, value]) => {
            const I = Icon as typeof Check
            return (
              <li key={label as string} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-primary-light)]">
                <I size={11} className="shrink-0 text-[var(--accent-on-dark)]" aria-label={label as string} />
                <span className="font-medium">{value as string}</span>
              </li>
            )
          })}
        </ul>
        <div className="hidden gap-2 sm:flex">
          {["var(--accent-primary)", "var(--agent-rose)", "var(--agent-teal)"].map((tone) => (
            <span key={tone} className="h-12 flex-1 rounded-[10px]" style={{ background: `color-mix(in srgb, ${tone} 20%, var(--app-surface-dark-elevated))` }} />
          ))}
          <span className="grid h-12 w-12 place-items-center rounded-[10px] bg-[var(--app-surface-subtle)] text-[var(--text-tertiary-light)]"><Images size={16} /></span>
        </div>
      </div>
    </div>
  )
}
