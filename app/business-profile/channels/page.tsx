"use client"

import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { BusinessProfileTabs } from "@/components/business-profile/business-profile-tabs"
import { ChannelsSection } from "@/components/business-profile/channels-section"
import { useI18n } from "@/components/i18n-provider"

/**
 * Business Profile → Channels (BUSINESS-PROFILE-CHANNELS-03).
 *
 * Business CONFIGURATION of communication channels: which ones exist, their
 * setup state, the identity each presents, and the real next step. Daily
 * conversation work stays in the Inbox — nothing here reads or renders
 * threads/messages.
 */
export default function BusinessProfileChannelsPage() {
  const { t } = useI18n()
  const copy = t.settings.businessProfileChannelsPage

  return (
    <AppShell>
      <SectionPage title={copy.title} description={copy.description}>
        <BusinessProfileTabs />
        <ChannelsSection />
      </SectionPage>
    </AppShell>
  )
}
