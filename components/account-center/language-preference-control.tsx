"use client"

/**
 * Personal app-language control — Account Center "Language" section.
 *
 * Persists ONLY `User.locale` (self-scoped API): it never touches the
 * workspace language or customer-facing communications. Labels come from the
 * `settings.language` UI namespace via `useI18n()`. Language option names are
 * native proper nouns (English / Español / Deutsch) and are never translated.
 *
 * Offered options follow `offeredUiLocales` (P4.FINESSE-ENES §2): a Finesse
 * (beauty) workspace temporarily offers only English/Español — the locales
 * fully covered across Finesse — so no selection can produce a mixed-language
 * app. An already-persisted preference outside the offer stays visible so the
 * control never hides the user's real state.
 *
 * Success/error presentation lives here (toasts); optimistic state, rollback
 * on failure, request dedupe and `router.refresh()` live in the provider's
 * `setUserLocale`.
 */

import { useMemo, useState } from "react"
import { Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { useToast } from "@/components/toast-provider"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { mapVerticalKeyToBusinessType } from "@core/personalization"
import { LOCALE_DISPLAY_NAMES } from "@core/i18n/locale"
import { localeHasPendingCoverage, offeredUiLocales } from "@core/i18n/ui"
import type { SupportedLocale } from "@core/i18n/types"

export function LanguagePreferenceControl() {
  const { t, locale, userLocale, setUserLocale, isChangingLocale } = useI18n()
  const { addToast } = useToast()
  const { workspace } = useActiveWorkspace()
  const [pendingLocale, setPendingLocale] = useState<SupportedLocale | null>(null)
  const [clearingPreference, setClearingPreference] = useState(false)

  const strings = t.settings.language

  const offeredLocales = useMemo(() => {
    const businessType = workspace?.verticalKey
      ? mapVerticalKeyToBusinessType(workspace.verticalKey)
      : null
    const offered = offeredUiLocales(businessType)
    // Never hide a persisted preference, even if it is outside today's offer.
    return userLocale && !offered.includes(userLocale) ? [...offered, userLocale] : offered
  }, [workspace?.verticalKey, userLocale])

  const handleSelect = async (next: SupportedLocale) => {
    if (isChangingLocale || next === userLocale) return
    setPendingLocale(next)
    const ok = await setUserLocale(next)
    setPendingLocale(null)
    if (ok) {
      addToast({
        type: "success",
        title: strings.updatedToast,
        description: LOCALE_DISPLAY_NAMES[next],
      })
    } else {
      addToast({
        type: "error",
        title: strings.updateErrorTitle,
        description: strings.updateErrorBody,
      })
    }
  }

  /**
   * "Use my device language": clears the personal preference (User.locale =
   * null via the same self-scoped PUT — the route also deletes the 7f-locale
   * cookie) so resolution falls back to the browser's Accept-Language. The
   * provider keeps the current paint until router.refresh() re-resolves
   * server-side, then the UI adopts the device language.
   */
  const handleUseDeviceLanguage = async () => {
    if (isChangingLocale || userLocale === null) return
    setClearingPreference(true)
    const ok = await setUserLocale(null)
    setClearingPreference(false)
    if (ok) {
      addToast({ type: "success", title: strings.clearedToast })
    } else {
      addToast({
        type: "error",
        title: strings.updateErrorTitle,
        description: strings.updateErrorBody,
      })
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary-light)]/80">
        {strings.appLabel}
      </p>
      <div
        role="radiogroup"
        aria-label={strings.appLabel}
        className="flex flex-wrap gap-1 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] p-1"
      >
        {offeredLocales.map((option) => {
          /**
           * Selected = the persisted personal preference. Without one, the
           * effective locale gets a quiet outline so the user still sees
           * what is active — but no button claims to be their choice.
           */
          const isChosen = userLocale === option
          const isEffectiveFallback = userLocale === null && locale === option
          const isPending = pendingLocale === option
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isChosen}
              onClick={() => handleSelect(option)}
              disabled={isChangingLocale}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isChosen
                  ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : isEffectiveFallback
                    ? "border border-[var(--border-dark)] text-[var(--app-sidebar-text)]"
                    : "text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-sidebar-text)]",
              )}
            >
              {isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isChosen ? (
                <Check size={12} />
              ) : null}
              {LOCALE_DISPLAY_NAMES[option]}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--text-secondary-light)]">
        {strings.appDescription}
        {userLocale === null ? ` ${strings.followingDefault}` : ""}
      </p>
      {localeHasPendingCoverage(userLocale ?? locale) ? (
        <p className="mt-1 text-[11px] italic leading-snug text-[var(--text-secondary-light)]/85">
          {strings.inProgressNote}
        </p>
      ) : null}
      {userLocale !== null ? (
        <button
          type="button"
          onClick={handleUseDeviceLanguage}
          disabled={isChangingLocale}
          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          {clearingPreference ? <Loader2 size={11} className="animate-spin" /> : null}
          {strings.useDeviceLanguage}
        </button>
      ) : null}
    </div>
  )
}
