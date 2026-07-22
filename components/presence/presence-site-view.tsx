/**
 * Sevenef Presence — public site renderer (PRESENCE-03).
 *
 * A SERVER component that renders a `PresenceRenderPlan` into a responsive,
 * accessible public page using the repo's existing theme tokens (no new colors).
 * It renders ONLY the planned sections; it never reads raw config or business
 * data. Content vs presentation stay separated: all values come from the plan.
 *
 * The subtree is wrapped in `<div data-theme=…>` so the site's own theme drives
 * the token palette regardless of the visitor's `<html data-theme>`.
 *
 * Accessibility: semantic landmarks (header/nav/main/section/footer), a skip
 * link, `aria-labelledby` per section, alt text on images, keyboard-reachable
 * CTAs, token-based contrast, and no motion (respects reduced-motion by simply
 * not animating). This is the first COMMON template — no Beauty-specific logic.
 */

import type {
  PresenceRenderPlan,
  PlannedSection,
  PlannedImage,
  PlannedCta,
} from "@engines/presence/render-plan"
import { FannyReception } from "./fanny-reception"

/** The dual-reception model (Fanny + WhatsApp), resolved server-side. */
export interface PresenceReception {
  slug: string
  model: {
    fanny: { enabled: boolean; greeting: string; quickActions: Array<{ id: string; label: string }> }
    whatsapp: { available: boolean; connected: boolean; link: { href: string; display: string } | null }
  }
}

const CONTAINER = "mx-auto w-full max-w-5xl px-5 sm:px-8"

function CtaLink({ cta, variant = "primary" }: { cta: PlannedCta; variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--app-control-radius)] px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-canvas)]"
  const styles =
    variant === "primary"
      ? "bg-[var(--accent-primary)] text-[var(--accent-on-dark)] hover:bg-[var(--accent-primary-hover)]"
      : "border border-[var(--border-dark-strong)] text-[var(--text-primary-light)] hover:bg-[var(--app-surface-dark-hover)]"
  return (
    <a href={cta.href} className={`${base} ${styles}`} rel="noopener noreferrer">
      {cta.label}
    </a>
  )
}

/* eslint-disable @next/next/no-img-element */
function SiteImage({ image, className }: { image: PlannedImage; className?: string }) {
  return (
    <img
      src={image.url}
      alt={image.alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading="lazy"
      decoding="async"
      className={className}
    />
  )
}
/* eslint-enable @next/next/no-img-element */

function HeroSection({ data, siteName }: { data: Extract<PlannedSection, { kind: "hero" }>["data"]; siteName: string }) {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-[var(--border-dark)]"
    >
      {data.background ? (
        <div aria-hidden="true" className="absolute inset-0">
          <SiteImage image={data.background} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--app-canvas)_72%,transparent)]" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(135deg,var(--app-surface-dark),var(--app-canvas))]"
        />
      )}
      <div className={`${CONTAINER} relative flex min-h-[62vh] flex-col justify-center py-20`}>
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--accent-on-dark)]">
          {siteName}
        </p>
        <h1
          id="hero-title"
          className="max-w-2xl text-4xl font-semibold leading-tight text-[var(--text-primary-light)] sm:text-5xl"
        >
          {data.title}
        </h1>
        {data.subtitle ? (
          <p className="mt-4 max-w-xl text-lg text-[var(--text-secondary-light)]">{data.subtitle}</p>
        ) : null}
        {data.cta ? (
          <div className="mt-8">
            <CtaLink cta={data.cta} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ServicesSection({ data }: { data: Extract<PlannedSection, { kind: "services" }>["data"] }) {
  return (
    <section id="services" aria-labelledby="services-title" className={`${CONTAINER} py-16`}>
      <h2 id="services-title" className="text-2xl font-semibold text-[var(--text-primary-light)]">
        Services
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((s, i) => (
          <li
            key={`${s.name}-${i}`}
            className="rounded-[16px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-5"
          >
            <p className="font-medium text-[var(--text-primary-light)]">{s.name}</p>
            {s.category ? (
              <p className="mt-1 text-sm text-[var(--text-tertiary-light)]">{s.category}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

function GallerySection({ data }: { data: Extract<PlannedSection, { kind: "gallery" }>["data"] }) {
  return (
    <section id="gallery" aria-labelledby="gallery-title" className={`${CONTAINER} py-16`}>
      <h2 id="gallery-title" className="text-2xl font-semibold text-[var(--text-primary-light)]">
        Gallery
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.images.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-[12px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"
          >
            <SiteImage image={img} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  )
}

function LocationSection({ data }: { data: Extract<PlannedSection, { kind: "location" }>["data"] }) {
  return (
    <section id="location" aria-labelledby="location-title" className={`${CONTAINER} py-16`}>
      <h2 id="location-title" className="text-2xl font-semibold text-[var(--text-primary-light)]">
        Location &amp; hours
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {data.region ? (
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--text-tertiary-light)]">
              Area
            </h3>
            <p className="mt-1 text-[var(--text-primary-light)]">{data.region}</p>
          </div>
        ) : null}
        {data.hours ? (
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--text-tertiary-light)]">
              Opening hours
            </h3>
            <p className="mt-1 whitespace-pre-line text-[var(--text-primary-light)]">{data.hours}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function WhatsappSection({ data }: { data: Extract<PlannedSection, { kind: "whatsapp" }>["data"] }) {
  return (
    <section id="whatsapp" aria-labelledby="whatsapp-title" className={`${CONTAINER} py-16`}>
      <div className="rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-8 text-center">
        <h2 id="whatsapp-title" className="text-2xl font-semibold text-[var(--text-primary-light)]">
          Get in touch
        </h2>
        <p className="mt-2 text-[var(--text-secondary-light)]">Message us directly on WhatsApp.</p>
        <div className="mt-6 flex justify-center">
          <CtaLink cta={{ label: `WhatsApp ${data.display}`, href: data.href }} />
        </div>
      </div>
    </section>
  )
}

function renderSection(section: PlannedSection, siteName: string) {
  switch (section.kind) {
    case "hero":
      return <HeroSection key="hero" data={section.data} siteName={siteName} />
    case "services":
      return <ServicesSection key="services" data={section.data} />
    case "gallery":
      return <GallerySection key="gallery" data={section.data} />
    case "location":
      return <LocationSection key="location" data={section.data} />
    case "whatsapp":
      return <WhatsappSection key="whatsapp" data={section.data} />
    default:
      return null
  }
}

export function PresenceSiteView({
  plan,
  reception,
}: {
  plan: PresenceRenderPlan
  reception?: PresenceReception | null
}) {
  return (
    <div
      data-theme={plan.themeKey}
      className="min-h-screen bg-[var(--app-canvas)] font-sans text-[var(--text-primary-light)] antialiased"
    >
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--accent-primary)] focus:px-4 focus:py-2 focus:text-[var(--accent-on-dark)]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--border-dark)] bg-[color-mix(in_srgb,var(--app-canvas)_85%,transparent)] backdrop-blur">
        <nav aria-label="Primary" className={`${CONTAINER} flex items-center justify-between py-4`}>
          <a href="#hero" className="text-lg font-semibold text-[var(--text-primary-light)]">
            {plan.siteName}
          </a>
          <div className="flex items-center gap-5">
            {plan.nav.length > 0 ? (
              <ul className="hidden items-center gap-5 sm:flex">
                {plan.nav.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="text-sm text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {plan.primaryCta ? <CtaLink cta={plan.primaryCta} variant="ghost" /> : null}
          </div>
        </nav>
      </header>

      <main>{plan.sections.map((s) => renderSection(s, plan.siteName))}</main>

      <footer className="border-t border-[var(--border-dark)]">
        <div className={`${CONTAINER} flex flex-col gap-6 py-8`}>
          {plan.social.length > 0 ? (
            <nav aria-label="Social networks" className="flex flex-col items-center gap-3 sm:items-start">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary-light)]">
                Follow us
              </span>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {plan.social.map((s) => (
                  <li key={s.platform}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`${plan.siteName} on ${s.label}`}
                      className="text-sm text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)]"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="flex flex-col items-center justify-between gap-2 text-sm text-[var(--text-tertiary-light)] sm:flex-row">
            <span>© {plan.siteName}</span>
            <span>Powered by Sevenef Presence</span>
          </div>
        </div>
      </footer>

      {reception && reception.model.fanny.enabled ? (
        <FannyReception slug={reception.slug} model={reception.model} />
      ) : null}
    </div>
  )
}
