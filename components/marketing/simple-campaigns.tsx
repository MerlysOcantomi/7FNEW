"use client"

import { Megaphone, Users } from "lucide-react"
import type { BeautyMarketingConfig } from "@modules/marketing/beauty-marketing"
import type { CampaignStatus, MarketingCampaign } from "@modules/marketing/types"
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CAMPAIGN_STATUS_TONE,
  CARD_CLASS,
  CHIP_CLASS,
  chipStyle,
} from "./marketing-ui"
import { MarketingEmptyState } from "./marketing-empty-state"

/**
 * "Campañas simples" — easy-to-understand campaigns with responsible agent
 * (Fiona), state, title, reason, approximate audience and one-tap actions.
 * No funnels, ROAS or ad-tech jargon anywhere in the copy.
 */
export function SimpleCampaigns({
  config,
  campaigns,
  onTransition,
  onView,
}: {
  config: BeautyMarketingConfig
  campaigns: MarketingCampaign[]
  onTransition: (campaign: MarketingCampaign, to: CampaignStatus) => void
  onView: (campaign: MarketingCampaign) => void
}) {
  const t = config.campaigns
  const visible = campaigns.filter((c) => c.status !== "finalizada")
  const activeCount = campaigns.filter((c) => c.status === "activa").length

  return (
    <section aria-labelledby="simple-campaigns-title">
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2
          id="simple-campaigns-title"
          className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]"
        >
          {t.sectionTitle}
        </h2>
        <span className="font-mono text-[10.5px] text-[var(--text-tertiary-light)]">
          {activeCount} {activeCount === 1 ? "activa" : "activas"}
        </span>
      </div>

      {visible.length === 0 ? (
        <MarketingEmptyState icon={Megaphone} title={t.empty.title} description={t.empty.description} compact />
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {visible.map((campaign) => (
            <li key={campaign.id} className={`${CARD_CLASS} p-3.5`}>
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
                <span className={CHIP_CLASS} style={chipStyle(CAMPAIGN_STATUS_TONE[campaign.status])}>
                  {config.campaignStatusLabels[campaign.status]}
                </span>
              </div>

              <p className="mt-2 text-[12.5px] font-semibold leading-snug text-[var(--text-primary-light)]">
                {campaign.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary-light)]">{campaign.reason}</p>
              {campaign.audienceSize != null ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary-light)]">
                  <Users size={11} strokeWidth={2} aria-hidden="true" />
                  ~{campaign.audienceSize.toLocaleString("es-ES")} {campaign.audienceLabel ?? t.audiencePrefix}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <CampaignActions campaign={campaign} config={config} onTransition={onTransition} onView={onView} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** One-tap actions per campaign state (transitions validated in the pure layer). */
function CampaignActions({
  campaign,
  config,
  onTransition,
  onView,
}: {
  campaign: MarketingCampaign
  config: BeautyMarketingConfig
  onTransition: (campaign: MarketingCampaign, to: CampaignStatus) => void
  onView: (campaign: MarketingCampaign) => void
}) {
  const t = config.campaigns
  const compactBtn = "px-3 py-1.5 text-[11.5px]"

  switch (campaign.status) {
    case "sugerida":
      return (
        <>
          <button type="button" onClick={() => onTransition(campaign, "aprobada")} className={`${BTN_PRIMARY} ${compactBtn} flex-1 sm:flex-none`}>
            {t.approve}
          </button>
          <button type="button" onClick={() => onView(campaign)} className={`${BTN_SECONDARY} ${compactBtn}`}>
            {t.view}
          </button>
        </>
      )
    case "aprobada":
    case "programada":
      return (
        <>
          <button type="button" onClick={() => onTransition(campaign, "activa")} className={`${BTN_PRIMARY} ${compactBtn} flex-1 sm:flex-none`}>
            {config.campaignStatusLabels.activa}
          </button>
          <button type="button" onClick={() => onView(campaign)} className={`${BTN_SECONDARY} ${compactBtn}`}>
            {t.detail}
          </button>
        </>
      )
    case "activa":
      return (
        <>
          <button type="button" onClick={() => onView(campaign)} className={`${BTN_SECONDARY} ${compactBtn}`}>
            {t.detail}
          </button>
          <button type="button" onClick={() => onTransition(campaign, "pausada")} className={`${BTN_SECONDARY} ${compactBtn}`}>
            {t.pause}
          </button>
        </>
      )
    case "pausada":
      return (
        <>
          <button type="button" onClick={() => onTransition(campaign, "activa")} className={`${BTN_PRIMARY} ${compactBtn}`}>
            {t.resume}
          </button>
          <button type="button" onClick={() => onView(campaign)} className={`${BTN_SECONDARY} ${compactBtn}`}>
            {t.detail}
          </button>
        </>
      )
    default:
      return null
  }
}
