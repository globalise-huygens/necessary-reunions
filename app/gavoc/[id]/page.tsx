import { redirect } from 'next/navigation';

interface GavocLocationPageProps {
  params: {
    id: string;
  };
}

export default function GavocLocationPage({ params }: GavocLocationPageProps) {
  // This is a client-side redirect since we want to handle everything in the main gavoc page
  // The URL will be preserved and handled by the client-side routing logic
  redirect('/gavoc');
}

export async function generateMetadata({ params }: GavocLocationPageProps) {
  // TODO: In the future, we could fetch the location data here and generate proper metadata
  return {
    title: `GAVOC Location ${params.id} - Necessary Reunions`,
    description:
      'View detailed information about a specific location in the GAVOC Atlas.',
  };
}
