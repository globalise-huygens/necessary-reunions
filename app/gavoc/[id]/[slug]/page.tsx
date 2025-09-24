import { redirect } from 'next/navigation';

interface GavocLocationSlugPageProps {
  params: {
    id: string;
    slug: string;
  };
}

export default function GavocLocationSlugPage({
  params,
}: GavocLocationSlugPageProps) {
  redirect('/gavoc');
}

export async function generateMetadata({ params }: GavocLocationSlugPageProps) {
  // TODO: In the future, we could fetch the location data here and generate proper metadata
  const decodedSlug = decodeURIComponent(params.slug).replace(/-/g, ' ');
  return {
    title: `${decodedSlug} - Grote Atlas Location ${params.id} - Necessary Reunions`,
    description: `View detailed information about ${decodedSlug} in the Grote Atlas.`,
  };
}
