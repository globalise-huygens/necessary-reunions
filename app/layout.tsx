import { Lexend, Roboto } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

import { Toaster } from '@/components/Toaster';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Providers } from './providers';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 're:Charted – IIIF Viewer and Editor',
  description:
    'A viewer and editor for IIIF resources using a manifest.json file. Created by the Necessary Reunions project.',
  keywords: ['VOC', 'IIIF', 'georeferencing', 'Kerala', 'digital humanities'],
  authors: [
    { name: 'Dr Manjusha Kuruppath' },
    { name: 'Leon van Wissen' },
    { name: 'Jona Schlegel' },
  ],
  openGraph: {
    title: 're:Charted – IIIF Viewer and Editor',
    description:
      'A viewer and editor for IIIF resources using a manifest.json file. Created by the Necessary Reunions project.',
    url: 'https://necessaryreunions.org',
    siteName: 'Necessary Reunions',
    images: [
      {
        url: 'https://necessaryreunions.org/api/og',
        width: 1200,
        height: 630,
        alt: 're:Charted OG Image',
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
      <body
        className={`${lexend.variable} ${roboto.variable}font-body bg-white text-foreground antialiased grid grid-rows-[auto_1fr_auto] h-full overflow-hidden`}
      >
        <Providers>
          <Header />
        </Providers>
        <main className="flex-1 overflow-hidden">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
