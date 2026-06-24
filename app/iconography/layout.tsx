import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Iconography Thesaurus – Necessary Reunions',
  description:
    'A structured thesaurus of iconographic concepts found on early modern VOC maps of Kerala, with definitions and multilingual labels.',
  openGraph: {
    title: 'Iconography Thesaurus – Necessary Reunions',
    description:
      'A structured thesaurus of iconographic concepts found on early modern VOC maps of Kerala, with definitions and multilingual labels.',
    url: 'https://necessaryreunions.org/iconography',
    siteName: 'Necessary Reunions',
    locale: 'en_GB',
    type: 'website',
  },
};

export default function IconographyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
