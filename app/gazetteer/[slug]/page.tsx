import { PlaceDetail } from '@/components/gazetteer/PlaceDetail';
import type { Metadata } from 'next';

interface PlacePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;

  const placeName = slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    title: `${placeName} – Gazetteer – Necessary Reunions`,
    description: `Information about ${placeName} from the early modern Kerala maps and texts in the Necessary Reunions project.`,
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;

  return <PlaceDetail slug={slug} />;
}
