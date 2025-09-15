import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/authOptions';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to create annotations' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();

    const user = session.user as any;
    let annotationWithCreator = { ...body };

    if (annotationWithCreator.motivation !== 'textspotting') {
      if (!annotationWithCreator.creator) {
        annotationWithCreator.creator = {
          id: user?.id || user?.email,
          type: 'Person',
          label: user?.label || user?.name || 'Unknown User',
        };
      }
    }

    if (!annotationWithCreator.created) {
      annotationWithCreator.created = new Date().toISOString();
    }

    if (annotationWithCreator.motivation === 'textspotting') {
      const bodies = Array.isArray(annotationWithCreator.body)
        ? annotationWithCreator.body
        : [annotationWithCreator.body].filter(Boolean);

      if (bodies.length === 0) {
        annotationWithCreator.body = [
          {
            type: 'TextualBody',
            value: '',
            format: 'text/plain',
            purpose: 'supplementing',
            creator: {
              id: user?.id || user?.email,
              type: 'Person',
              label: user?.label || user?.name || 'Unknown User',
            },
            created: new Date().toISOString(),
          },
        ];
      } else {
        annotationWithCreator.body = bodies.map((bodyItem: any) => {
          if (bodyItem.type === 'TextualBody' && !bodyItem.generator) {
            return {
              ...bodyItem,
              creator: bodyItem.creator || {
                id: user?.id || user?.email,
                type: 'Person',
                label: user?.label || user?.name || 'Unknown User',
              },
              created: bodyItem.created || new Date().toISOString(),
            };
          }
          return bodyItem;
        });
      }
    }

    // Create annotation in AnnoRepo
    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const annoRepoUrl = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/`;
    const response = await fetch(annoRepoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        ...annotationWithCreator,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('AnnoRepo create error:', response.status, errorText);
      throw new Error(`AnnoRepo creation failed: ${response.status} ${response.statusText}`);
    }

    const created = await response.json();
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error('Error creating annotation:', err);
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
