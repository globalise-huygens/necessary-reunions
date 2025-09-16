import 'leaflet/dist/leaflet.css';
import './globals.css';
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
              (function() {
                if (typeof window !== 'undefined') {
                  const originalLog = console.log;
                  const originalInfo = console.info;
                  const originalDebug = console.debug;

                  const filterMessage = (message) => {
                    return (
                      message.includes('[SW]') ||
                      message.includes('Fetching fresh') ||
                      message.includes('Serving from cache') ||
                      message.includes('Serving static asset') ||
                      message.includes('Serving image')
                    );
                  };

                  console.log = function(...args) {
                    const message = args.join(' ');
                    if (!filterMessage(message)) {
                      originalLog.apply(console, args);
                    }
                  };

                  console.info = function(...args) {
                    const message = args.join(' ');
                    if (!filterMessage(message)) {
                      originalInfo.apply(console, args);
                    }
                  };

                  console.debug = function(...args) {
                    const message = args.join(' ');
                    if (!filterMessage(message)) {
                      originalDebug.apply(console, args);
                    }
                  };
                }
              })();
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
            <UnifiedHeader />
            <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
            <Footer />
            <Toaster />
          </Providers>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
