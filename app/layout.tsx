import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastProvider } from '@/components/toast-provider'
import { KeyboardShortcutsProvider } from '@/components/keyboard-shortcuts-provider'
import { UserProvider } from '@/hooks/use-user'
import { GlobalSearchProvider } from '@/components/global-search-provider'
import { GlobalNewProvider } from '@/components/global-new/global-new-provider'
import { I18nProvider } from '@/components/i18n-provider'
import { resolveWorkspaceDefaultThemeKey } from '@core/theme'
import { getRequestLocale } from '@core/i18n/server'
import { LabDemoOverlayBanner } from '@/components/lab/lab-demo-overlay-banner'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: '7F Workspace',
  description: 'Enterprise intelligence platform for executive decision-making.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  /**
   * Server-resolved default `data-theme` for the active workspace (beauty →
   * rose-nude), used ONLY when the user hasn't chosen a theme. See @core/theme.
   * Falls back to midnight for signed-out/public routes or non-beauty verticals.
   *
   * `getRequestLocale()` resolves the effective UI locale (authenticated:
   * User.locale → workspace → en; anonymous: 7f-locale cookie →
   * Accept-Language → en). Read-only; per-request memoized. Both
   * resolutions are independent, so they run in parallel.
   * `suppressHydrationWarning` remains REQUIRED by the theme system (the
   * no-FOUC script mutates <html data-theme> before hydration) — it is not
   * covering any locale mismatch: the provider starts from this same locale.
   */
  const [workspaceDefaultTheme, requestLocale] = await Promise.all([
    resolveWorkspaceDefaultThemeKey(),
    getRequestLocale(),
  ])

  return (
    <html lang={requestLocale.locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/**
         * Theme bridge (no-FOUC). Sets data-theme on <html> before paint.
         * Precedence: ?theme=<name> (persisted) → localStorage `7f-theme` (the
         * user's explicit choice) → the workspace vertical default injected here
         * (`d`, e.g. rose-nude for a Beauty workspace) → midnight. The vertical
         * default is NOT written to localStorage, so a later manual theme change
         * (which does persist) is always respected. Allowed values: midnight |
         * lavender-mist | rose-nude | sage-luxe | noir-or — anything else falls
         * back to midnight. This is a side-channel to next-themes: next-themes
         * keeps owning `class`/`.dark`; we only drive the data-theme attribute
         * that activates the dormant [data-theme="…"] palette blocks in
         * app/globals.css. Keep the allow-list in sync with @core/theme and
         * components/theme-mode-toggle.tsx.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='7f-theme';var A=['midnight','lavender-mist','rose-nude','sage-luxe','noir-or'];var d=${JSON.stringify(workspaceDefaultTheme)};if(A.indexOf(d)<0)d='midnight';var q=new URLSearchParams(location.search).get('theme');if(q&&A.indexOf(q)>-1){localStorage.setItem(k,q);}var t=localStorage.getItem(k);document.documentElement.setAttribute('data-theme',A.indexOf(t)>-1?t:d);}catch(e){document.documentElement.setAttribute('data-theme','midnight');}})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {/**
           * I18nProvider receives ONLY serializable data (locale + metadata) —
           * the typed catalogs contain functions and are imported client-side
           * by the provider itself. Sits directly inside ThemeProvider so
           * every existing provider below keeps its relative order.
           */}
          <I18nProvider
            locale={requestLocale.locale}
            source={requestLocale.source}
            userLocale={requestLocale.userLocale}
            shouldSyncCookie={requestLocale.shouldSyncCookie}
          >
            <UserProvider>
              <ToastProvider>
                <KeyboardShortcutsProvider>
                  <GlobalNewProvider>
                    <GlobalSearchProvider>
                      {children}
                    </GlobalSearchProvider>
                  </GlobalNewProvider>
                </KeyboardShortcutsProvider>
              </ToastProvider>
            </UserProvider>
          </I18nProvider>
        </ThemeProvider>
        {/**
         * DEV-PREVIEW-01C: permanent "fictional data" marker for the real
         * surfaces. Server-derived; renders null unless the active session is
         * exactly the Lab demo identity + workspace on a gated Lab deployment.
         */}
        <LabDemoOverlayBanner />
        <Analytics />
      </body>
    </html>
  )
}
