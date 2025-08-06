import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GAVOC Atlas – Historical Atlas of Early Modern Kerala',
  description:
    'A comprehensive historical atlas of early modern Kerala based on VOC maps and documentation. Part of the Necessary Reunions project.',
  keywords: [
    'VOC',
    'Kerala',
    'historical atlas',
    'cartography',
    'digital humanities',
  ],
  openGraph: {
    title: 'GAVOC Atlas – Historical Atlas of Early Modern Kerala',
    description:
      'A comprehensive historical atlas of early modern Kerala based on VOC maps and documentation. Part of the Necessary Reunions project.',
    url: 'https://gavoc.necessaryreunions.org',
    siteName: 'GAVOC Atlas - Necessary Reunions',
    locale: 'en_GB',
    type: 'website',
  },
};

export default function GroteAtlasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
