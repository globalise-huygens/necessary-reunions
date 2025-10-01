import 'leaflet/dist/leaflet.css';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { Toaster } from '@/components/shared/Toaster';
import { UnifiedHeader } from '@/components/UnifiedHeader';
import type { Metadata } from 'next';
import { Lexend, Roboto } from 'next/font/google';
import { Providers } from './providers';
import { SessionProviderWrapper } from './SessionProviderWrapper';

export const metadata: Metadata = {
  title: 'Necessary Reunions – Remarrying Maps to Text',
  description:
    'Reconceptualizing histories of early modern Kerala through the reunion of VOC maps and textual sources using emerging digital techniques.',
  keywords: [
    'VOC',
    'Kerala',
    'digital humanities',
    'maps',
    'georeferencing',
    'historical research',
  ],
  authors: [
    { name: 'Dr Manjusha Kuruppath' },
    { name: 'Leon van Wissen' },
    { name: 'Jona Schlegel' },
  ],
  openGraph: {
    title: 'Necessary Reunions – Remarrying Maps to Text',
    description:
      'Reconceptualizing histories of early modern Kerala through the reunion of VOC maps and textual sources using emerging digital techniques.',
    url: 'https://necessaryreunions.org',
    siteName: 'Necessary Reunions',
    images: [
      {
        url: 'https://necessaryreunions.org/api/og',
        width: 1200,
        height: 630,
        alt: 'Necessary Reunions Project',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
};

const lexend = Lexend({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-lexend',
});
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-roboto',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Global error handler for third-party script errors
              window.addEventListener('error', function(e) {
                if (e.filename && (
                  e.filename.includes('amplitude') ||
                  e.filename.includes('g0Widget') ||
                  e.filename.includes('api2.amplitude.com')
                )) {
                  console.warn('Third-party analytics error suppressed:', e.message);
                  e.preventDefault();
                  return false;
                }
              });

              // Handle unhandled promise rejections from third-party scripts
              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.toString().includes('amplitude')) {
                  console.warn('Third-party analytics promise rejection suppressed:', e.reason);
                  e.preventDefault();
                }
              });
            `,
          }}
        />
      </head>
      <body
        className={`${lexend.variable} ${roboto.variable} font-body bg-white text-foreground antialiased h-full flex flex-col`}
        suppressHydrationWarning={true}
      >
        <SessionProviderWrapper>
          <Providers>
            <ErrorBoundary>
              <UnifiedHeader />
              <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
              <Footer />
              <Toaster />
            </ErrorBoundary>
          </Providers>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
