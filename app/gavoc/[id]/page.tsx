import { redirect } from 'next/navigation';

interface GavocLocationPageProps {
  params: {
    id: string;
  };
}

export default function GavocLocationPage() {
  redirect('/gavoc');
}

export function generateMetadata({ params }: GavocLocationPageProps) {
  // TODO: In the future, we could fetch the location data here and generate proper metadata
  return {
    title: `Grote Atlas Location ${params.id} - Necessary Reunions`,
    description:
      'View detailed information about a specific location in the Gote Atlas.',
  };
}
