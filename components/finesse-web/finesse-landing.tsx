import Link from "next/link"
import { ArrowRight, CalendarDays, Images, MessageSquare, Sparkles, Store } from "lucide-react"
import type { FinesseLandingMessages } from "@modules/finesse-web/i18n"
import { AgendaPreview, InboxPreview, PhoneFrame, PresencePreview, TodayPreview } from "./product-previews"

/**
 * Finesse public landing (FINESSE-WEB-01, Phase 1) — the commercial front door.
 *
 * A self-contained marketing page: server-rendered, no client state, no
 * workspace/session/Presence reads, no private APIs. Brand rules: "Finesse" is
 * the brand; SevenF appears ONLY in the footer credit. Every CTA reuses the
 * existing `/login`. Identity: the approved `petrol-pearl` palette, forced through
 * `data-theme` on the page root (same pattern as Presence public sites) so the
 * visitor's own theme never restyles the brand page — tokens only, no hex.
 *
 * R2: the primary CTA is "Entrar en Finesse" (honest: login is account-based,
 * there is no self-serve trial yet); "Ver cómo funciona" is the discovery CTA.
 * Mobile rhythm is editorial: tight section padding, horizontal cards, one
 * phone frame (the hero) and compact previews after it.
 */

export const FINESSE_LOGIN_HREF = "/login"

const CTA_PRIMARY =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 text-[15px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
const CTA_SECONDARY =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] px-5 text-[15px] font-semibold text-[var(--text-primary-light)] transition-colors hover:bg-[var(--app-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-on-dark)]"
const H2 = "mt-2 text-[24px] font-semibold leading-[1.15] tracking-tight text-[var(--text-primary-light)] sm:text-[32px]"
const LEAD = "mt-2.5 text-[15px] leading-relaxed text-[var(--text-secondary-light)] sm:text-[17px]"
/** Editorial rhythm: tighter on mobile, airy from sm/lg. */
const SECTION_PAD = "py-10 sm:py-14 lg:py-16"
const SECTION = "mx-auto w-full max-w-6xl px-5 sm:px-8"

export function FinesseLanding({ t }: { t: FinesseLandingMessages }) {
  return (
    <div
      data-theme="petrol-pearl"
      data-finesse-landing
      className="min-h-screen bg-[var(--app-canvas)] font-sans text-[var(--text-primary-light)] antialiased"
    >
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--app-surface-dark-elevated)] focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold"
      >
        {t.nav.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-[var(--border-dark)] bg-[color-mix(in_srgb,var(--app-canvas)_88%,transparent)] backdrop-blur">
        <div className={`${SECTION} flex h-16 items-center justify-between gap-4`}>
          <Link href="/finesse" className="flex items-center gap-2 rounded-md text-[20px] font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-primary)] text-[var(--primary-foreground)]" aria-hidden="true">
              <Sparkles size={16} strokeWidth={2.25} />
            </span>
            {t.brand}
          </Link>
          <nav aria-label={t.nav.menuLabel} className="flex items-center gap-1 sm:gap-2">
            <a href="#funciones" className="hidden rounded-md px-3 py-2 text-[14px] font-medium text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] md:inline-flex">
              {t.nav.features}
            </a>
            <a href="#para-quien" className="hidden rounded-md px-3 py-2 text-[14px] font-medium text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] md:inline-flex">
              {t.nav.forWho}
            </a>
            <Link href={FINESSE_LOGIN_HREF} className={`${CTA_PRIMARY} min-h-[44px] px-4 text-[14px]`} data-cta="header">
              {t.nav.cta}
            </Link>
          </nav>
        </div>
      </header>

      <main id="contenido">
        {/* HERO */}
        <section className={`${SECTION} grid grid-cols-1 items-center gap-8 pb-10 pt-8 sm:pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10 lg:pt-20`} aria-labelledby="hero-title">
          <div>
            <h1 id="hero-title" className="text-[32px] font-semibold leading-[1.08] tracking-tight sm:text-[46px] lg:text-[54px]">
              {t.hero.title}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--text-secondary-light)] sm:text-[19px]">{t.hero.subtitle}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={FINESSE_LOGIN_HREF} className={CTA_PRIMARY} data-cta="hero">
                {t.hero.cta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#funciones" className={CTA_SECONDARY}>
                {t.hero.secondary}
              </a>
            </div>
          </div>
          <PhoneFrame label={t.hero.previewCaption}>
            <TodayPreview t={t.preview.today} />
          </PhoneFrame>
        </section>

        {/* TU DÍA */}
        <section id="funciones" className="scroll-mt-20 border-t border-[var(--border-dark)] bg-[var(--app-surface-dark)]" aria-labelledby="day-title">
          <div className={`${SECTION} ${SECTION_PAD}`}>
            <div className="max-w-2xl">
              <p className={EYEBROW}>{t.day.eyebrow}</p>
              <h2 id="day-title" className={H2}>{t.day.title}</h2>
              <p className={LEAD}>{t.day.description}</p>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-3 md:gap-4">
              {t.day.items.map((item, i) => {
                const Icon = [Store, Sparkles, Images][i] ?? Sparkles
                return (
                  <li key={item.title} className="flex gap-3.5 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-4 md:flex-col md:p-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-on-dark)]" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-semibold md:mt-2 md:text-[17px]">{item.title}</h3>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-secondary-light)] md:text-[14px]">{item.description}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* TU AGENDA */}
        <FeatureSplit
          id="agenda"
          eyebrow={t.agenda.eyebrow}
          title={t.agenda.title}
          description={t.agenda.description}
          points={t.agenda.points}
          icon={CalendarDays}
          visual={<AgendaPreview t={t.preview.agenda} />}
        />

        {/* TUS MENSAJES */}
        <FeatureSplit
          id="mensajes"
          eyebrow={t.messages.eyebrow}
          title={t.messages.title}
          description={t.messages.description}
          points={t.messages.points}
          icon={MessageSquare}
          reverse
          tinted
          visual={<InboxPreview t={t.preview.inbox} />}
          caption={t.messages.previewLabel}
        />

        {/* TU PRESENCIA */}
        <FeatureSplit
          id="presencia"
          eyebrow={t.presence.eyebrow}
          title={t.presence.title}
          description={t.presence.description}
          points={t.presence.points}
          icon={Store}
          visual={<PresencePreview t={t.preview.presence} />}
        />

        {/* PARA QUIÉN */}
        <section id="para-quien" className="scroll-mt-20 border-t border-[var(--border-dark)] bg-[var(--app-surface-dark)]" aria-labelledby="forwho-title">
          <div className={`${SECTION} ${SECTION_PAD}`}>
            <div className="max-w-2xl">
              <p className={EYEBROW}>{t.forWho.eyebrow}</p>
              <h2 id="forwho-title" className={H2}>{t.forWho.title}</h2>
              <p className={LEAD}>{t.forWho.description}</p>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2 md:mt-8 md:gap-2.5">
              {t.forWho.audiences.map((a) => (
                <li key={a} className="rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-2 text-[14px] font-medium md:px-4 md:py-2.5 md:text-[14.5px]">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* DIFERENCIACIÓN */}
        <section className={`${SECTION} ${SECTION_PAD}`} aria-labelledby="why-title">
          <div className="rounded-[24px] bg-[var(--accent-rich)] px-5 py-8 text-[var(--primary-foreground)] sm:rounded-[28px] sm:px-10 sm:py-14">
            <h2 id="why-title" className="max-w-2xl text-[24px] font-semibold leading-[1.15] tracking-tight sm:text-[34px]">{t.why.title}</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed opacity-90 sm:mt-4 sm:text-[17px]">{t.why.description}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {t.why.pillars.map((p) => (
                <li key={p} className="rounded-full border border-[color-mix(in_srgb,var(--primary-foreground)_35%,transparent)] px-3.5 py-1.5 text-[13.5px] font-semibold">{p}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className={`${SECTION} pb-14 text-center sm:pb-20`} aria-labelledby="final-title">
          <h2 id="final-title" className="text-[26px] font-semibold tracking-tight sm:text-[36px]">{t.finalCta.title}</h2>
          <p className="mx-auto mt-2.5 max-w-lg text-[15.5px] text-[var(--text-secondary-light)] sm:text-[16px]">{t.finalCta.description}</p>
          <div className="mt-6 flex justify-center">
            <Link href={FINESSE_LOGIN_HREF} className={CTA_PRIMARY} data-cta="final">
              {t.finalCta.cta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-dark)] bg-[var(--app-surface-dark)]" data-finesse-footer>
        <div className={`${SECTION} flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <p className="text-[16px] font-semibold tracking-tight">{t.brand}</p>
            <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.footer.tagline}</p>
          </div>
          <div className="flex items-center gap-5 text-[13px]">
            <Link href={FINESSE_LOGIN_HREF} className="font-medium text-[var(--text-primary-light)] hover:text-[var(--accent-on-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] rounded-md">
              {t.footer.login}
            </Link>
            <span className="text-[12px] text-[var(--text-tertiary-light)]">{t.footer.poweredBy}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureSplit({
  id,
  eyebrow,
  title,
  description,
  points,
  icon: Icon,
  visual,
  caption,
  reverse = false,
  tinted = false,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  points: string[]
  icon: typeof CalendarDays
  visual: React.ReactNode
  caption?: string
  reverse?: boolean
  tinted?: boolean
}) {
  return (
    <section id={id} className={`scroll-mt-20 border-t border-[var(--border-dark)] ${tinted ? "bg-[var(--app-surface-dark)]" : ""}`} aria-labelledby={`${id}-title`}>
      <div className={`${SECTION} grid grid-cols-1 items-center gap-7 ${SECTION_PAD} lg:grid-cols-2 lg:gap-10`}>
        <div className={reverse ? "lg:order-2" : ""}>
          <p className={EYEBROW}>{eyebrow}</p>
          <h2 id={`${id}-title`} className={H2}>{title}</h2>
          <p className={LEAD}>{description}</p>
          <ul className="mt-5 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2.5 text-[14.5px] sm:text-[15px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-muted)] text-[var(--accent-on-dark)]" aria-hidden="true">
                  <Icon size={13} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? "lg:order-1" : ""}>
          <div className="mx-auto w-full max-w-md">
            {visual}
            {caption ? <p className="mt-2.5 text-center text-[11.5px] text-[var(--text-tertiary-light)]">{caption}</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
