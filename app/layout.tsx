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
import { buildThemeBootstrap } from '@core/theme-registry'
import { applicationBlueStyles } from '@core/design/app-blue'
import { applicationLightStyles } from '@core/design/app-light'
import { buildMaterialBootstrap, DEFAULT_APP_MATERIAL } from '@core/material-registry'
import './globals.css'
import './premium-ui.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: '7F Workspace',
  description: 'Enterprise intelligence platform for executive decision-making.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

// Compiled once from trusted Foundation presets. No account or user CSS input.
const premiumBlueCss = applicationBlueStyles()
const premiumLightCss = applicationLightStyles()

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [workspaceDefaultTheme, requestLocale] = await Promise.all([
    resolveWorkspaceDefaultThemeKey(),
    getRequestLocale(),
  ])

  return (
    <html lang={requestLocale.locale} data-theme={workspaceDefaultTheme} data-material={DEFAULT_APP_MATERIAL} suppressHydrationWarning>
      <head>
        <style id="sevenef-premium-blue-tokens" dangerouslySetInnerHTML={{ __html: premiumBlueCss }} />
        <style id="sevenef-premium-light-tokens" dangerouslySetInnerHTML={{ __html: premiumLightCss }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Query > explicit stored choice > app default. Public site themes are
            not opted into the two new app skins. Keep next-themes' compatibility
            class channel unchanged; data-theme remains the palette authority. */}
        <script id="sevenef-theme-bootstrap" dangerouslySetInnerHTML={{ __html: buildThemeBootstrap(workspaceDefaultTheme) }} />
        <script id="sevenef-material-bootstrap" dangerouslySetInnerHTML={{ __html: buildMaterialBootstrap() }} />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
        <Analytics />
      </body>
    </html>
  )
}
