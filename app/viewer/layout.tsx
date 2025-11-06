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
    url: 'https://necessaryreunions.org/viewer',
    siteName: 're:Charted - Necessary Reunions',
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

export default function ReChartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
