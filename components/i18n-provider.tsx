"use client"

/**
 * Client i18n provider + `useI18n()` hook.
 *
 * Serialization contract: UI catalogs contain typed TypeScript FUNCTIONS
 * (e.g. `clients.searchPlaceholder`), so the server never passes message
 * objects across the RSC boundary. `app/layout.tsx` passes only serializable
 * data (locale string + metadata from `getRequestLocale()`); this client
 * module imports `getUIMessages` itself and derives the catalog locally.
 * Because client state starts exactly at the server-resolved locale, the
 * first client render matches the server HTML — no hydration mismatch and no
 * flash in another language. No localStorage is involved anywhere.
 *
 * Responsibilities:
 * - expose `{ locale, source, messages/t, supportedLocales, userLocale,
 *   setUserLocale, isChangingLocale }`;
 * - keep `document.documentElement.lang` in sync after client-side changes;
 * - persist personal changes via `PUT /api/users/me/locale` (optimistic, with
 *   rollback on failure) and reconcile Server Components via
 *   `router.refresh()`;
 * - when the server reported a stale 7f-locale cookie, ask the technical
 *   bridge (`PUT /api/i18n/locale`) to sync it — at most once per mount, so
 *   a failing bridge can never loop.
 *
 * Toasts/notifications intentionally live in the CALLING controls (Account
 * Center / Administración), not here — the provider stays dependency-free so
 * its position in the provider tree is unconstrained.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { SUPPORTED_LOCALES, type SupportedLocale } from "@core/i18n/types"
import type { LocaleSource } from "@core/i18n/resolve"
import { getUIMessages, type UIMessages } from "@core/i18n/ui"

export interface I18nContextValue {
  /** Effective UI locale (what is being rendered right now). */
  locale: SupportedLocale
  /** Which chain step produced `locale` (user/cookie/accept-language/default). */
  source: LocaleSource
  /** Typed UI catalogs for `locale` (es/de fall back to English until P4). */
  messages: UIMessages
  /** Alias of `messages` for call-site ergonomics (`t.nav.today`). */
  t: UIMessages
  supportedLocales: readonly SupportedLocale[]
  /** Persisted personal preference — null means "no explicit preference". */
  userLocale: SupportedLocale | null
  /**
   * Persist a personal preference (null clears it). Optimistic for concrete
   * locales; resolves `true` on success, `false` on failure (state already
   * rolled back) so callers own success/error presentation.
   */
  setUserLocale: (next: SupportedLocale | null) => Promise<boolean>
  isChangingLocale: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

export interface I18nProviderProps {
  /** Server-resolved values from `getRequestLocale()` — all serializable. */
  locale: SupportedLocale
  source: LocaleSource
  userLocale: SupportedLocale | null
  shouldSyncCookie: boolean
  children: React.ReactNode
}

export function I18nProvider({
  locale: serverLocale,
  source: serverSource,
  userLocale: serverUserLocale,
  shouldSyncCookie,
  children,
}: I18nProviderProps) {
  const router = useRouter()

  const [locale, setLocale] = useState<SupportedLocale>(serverLocale)
  const [source, setSource] = useState<LocaleSource>(serverSource)
  const [userLocale, setUserLocaleState] = useState<SupportedLocale | null>(serverUserLocale)
  const [isChangingLocale, setIsChangingLocale] = useState(false)

  /**
   * After `router.refresh()` (or any server re-render) the layout re-resolves
   * and hands down fresh props — adopt them as the new client baseline. This
   * is what reconciles optimistic state with the server truth.
   */
  useEffect(() => {
    setLocale(serverLocale)
    setSource(serverSource)
    setUserLocaleState(serverUserLocale)
  }, [serverLocale, serverSource, serverUserLocale])

  /** Keep <html lang> honest after client-side locale changes (idempotent). */
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  /**
   * One-shot technical cookie sync. The ref guard (not state) means a failed
   * request is NOT retried this mount — the next server render simply reports
   * `shouldSyncCookie` again. That property makes a sync loop impossible.
   */
  const cookieSyncDoneRef = useRef(false)
  useEffect(() => {
    if (!shouldSyncCookie || cookieSyncDoneRef.current) return
    cookieSyncDoneRef.current = true
    const controller = new AbortController()
    fetch("/api/i18n/locale", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: serverLocale }),
      signal: controller.signal,
    }).catch(() => {
      // Purely technical sync; the effective locale is unaffected by failure.
    })
    return () => controller.abort()
  }, [shouldSyncCookie, serverLocale])

  const changeInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setUserLocale = useCallback(
    async (next: SupportedLocale | null): Promise<boolean> => {
      // Ref (not state) dedupes concurrent calls within the same tick.
      if (changeInFlightRef.current) return false
      changeInFlightRef.current = true
      setIsChangingLocale(true)

      const previous = { locale, source, userLocale }

      // Optimistic UI: a concrete selection repaints immediately. Clearing
      // the preference only clears `userLocale` — the effective fallback
      // (the browser's Accept-Language) is server knowledge, so the paint
      // waits for the refresh instead of guessing.
      if (next !== null) {
        setLocale(next)
        setSource("user")
        setUserLocaleState(next)
      } else {
        setUserLocaleState(null)
      }

      try {
        const res = await fetch("/api/users/me/locale", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        })
        const json: unknown = await res.json().catch(() => null)
        const ok =
          res.ok &&
          Boolean(json && typeof json === "object" && (json as { success?: boolean }).success)
        if (!ok) throw new Error("locale-update-failed")

        // Server truth changed — re-render RSCs (and this provider's props).
        router.refresh()
        return true
      } catch {
        if (mountedRef.current) {
          setLocale(previous.locale)
          setSource(previous.source)
          setUserLocaleState(previous.userLocale)
        }
        return false
      } finally {
        changeInFlightRef.current = false
        if (mountedRef.current) setIsChangingLocale(false)
      }
    },
    [locale, source, userLocale, router],
  )

  const messages = useMemo(() => getUIMessages(locale), [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      source,
      messages,
      t: messages,
      supportedLocales: SUPPORTED_LOCALES,
      userLocale,
      setUserLocale,
      isChangingLocale,
    }),
    [locale, source, messages, userLocale, setUserLocale, isChangingLocale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

/** Typed access to the i18n runtime. Throws outside the provider by design. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>")
  return ctx
}
