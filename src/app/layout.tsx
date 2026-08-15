import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'
import { ServiceWorkerRegistration } from '@/components/layout/ServiceWorkerRegistration'
import { t } from '@/i18n'
import { ACCENT_STORAGE_KEY } from '@/lib/accent'
import { appleStartupImages } from '@/lib/splashScreens'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ variable: '--font-space-grotesk', subsets: ['latin'], weight: ['500', '600', '700'] })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-jetbrains-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://runomics-demo.vercel.app/'),
  applicationName: 'RunOmics',
  title: {
    default: 'RunOmics - Running Analytics Platform',
    template: '%s - RunOmics',
  },
  description: t.meta.description,
  keywords: ['running analytics', 'Garmin', 'training load', 'data visualization', 'MapLibre'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RunOmics',
    startupImage: [...appleStartupImages],
  },
  other: {
    // Next 16's `appleWebApp.capable` now emits only the standardized
    // `mobile-web-app-capable`. iOS still needs the legacy apple-prefixed meta
    // to honour the apple-touch-startup-image launch screens - without it the
    // installed PWA opens on a black screen instead of the splash.
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [{ url: '/icons/logo.svg', type: 'image/svg+xml' }],
    apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
  },
  openGraph: {
    type: 'website',
    siteName: 'RunOmics',
    url: '/',
    title: 'RunOmics - Running Analytics Platform',
    description: t.meta.description,
    images: [
      {
        url: '/og/runomics-social.png',
        width: 1200,
        height: 630,
        alt: 'RunOmics running analytics platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RunOmics - Running Analytics Platform',
    description: t.meta.description,
    images: ['/og/runomics-social.png'],
  },
  robots: {
    index: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
    follow: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // theme-color is set dynamically by ThemeSync (accent + light/dark aware);
  // a static value here would fight its updates.
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang={t.locale.split('-')[0]}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <Script id="accent-init" strategy="beforeInteractive">
          {`try{
            var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');
            if(a&&a!=='nature'){
              document.documentElement.setAttribute('data-accent',a);
            }
          }catch(e){}`}
        </Script>
        <Providers>
          <AppShell demoMode={!process.env.RUNOMICS_DATA_REPO_URL}>{children}</AppShell>
        </Providers>
        <ServiceWorkerRegistration />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
