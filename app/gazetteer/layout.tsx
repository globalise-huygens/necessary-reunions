import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gazetteer – Place Names Database of Early Modern Kerala',
  description:
    'A comprehensive database of place names, locations, and geographical information about early modern Kerala based on VOC archives. Part of the Necessary Reunions project.',
  keywords: [
    'VOC',
    'Kerala',
    'gazetteer',
    'place names',
    'geography',
    'digital humanities',
  ],
  openGraph: {
    title: 'Gazetteer – Place Names Database of Early Modern Kerala',
    description:
      'A comprehensive database of place names, locations, and geographical information about early modern Kerala based on VOC archives. Part of the Necessary Reunions project.',
    url: 'https://gazetteer.necessaryreunions.org',
    siteName: 'Gazetteer - Necessary Reunions',
    locale: 'en_GB',
    type: 'website',
  },
};

export default function GazetteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex min-h-0 overflow-hidden bg-gradient-to-br from-background via-muted/30 to-background">
        {children}
      </div>
    </div>
  );
}
