import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastProvider } from '@/components/toast-provider'
import { KeyboardShortcutsProvider } from '@/components/keyboard-shortcuts-provider'
import { UserProvider } from '@/hooks/use-user'
import { GlobalSearchProvider } from '@/components/global-search-provider'
import { GlobalNewProvider } from '@/components/global-new/global-new-provider'
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
