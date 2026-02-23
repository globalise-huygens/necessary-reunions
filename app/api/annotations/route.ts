import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import {
  resolveAnnoRepoConfig,
  canEditProject,
} from '@/lib/shared/annorepo-config';
import { authOptions } from '../auth/[...nextauth]/authOptions';

interface User {
  id?: string;
  email?: string;
  name?: string;
  label?: string;
}

interface Creator {
  id?: string;
  type: string;
  label: string;
}

interface AnnotationBody {
  type?: string;
  value?: string;
  format?: string;
  purpose?: string;
  creator?: Creator;
  created?: string;
  generator?: unknown;
  [key: string]: unknown;
}

interface AnnotationData {
  motivation?: string;
  creator?: Creator;
  created?: string;
  body?: AnnotationBody | AnnotationBody[];
  [key: string]: unknown;
}

interface CreatedAnnotation {
  id: string;
  [key: string]: unknown;
}

interface ErrorResponse {
  error: string;
}

export async function POST(
  request: Request,
): Promise<NextResponse<CreatedAnnotation | ErrorResponse>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to create annotations' },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as AnnotationData;

    const user = session.user as User;
    const annotationWithCreator: AnnotationData = { ...body };

    if (annotationWithCreator.motivation !== 'textspotting') {
      if (!annotationWithCreator.creator) {
        annotationWithCreator.creator = {
          id: user.id || user.email,
          type: 'Person',
          label: user.label || user.name || 'Unknown User',
        };
      }
    }

    if (!annotationWithCreator.created) {
      annotationWithCreator.created = new Date().toISOString();
    }

    if (annotationWithCreator.motivation === 'textspotting') {
      let bodies: AnnotationBody[] = [];
      if (Array.isArray(annotationWithCreator.body)) {
        bodies = annotationWithCreator.body;
      } else if (annotationWithCreator.body) {
        bodies = [annotationWithCreator.body];
      }

      if (bodies.length === 0) {
        annotationWithCreator.body = [
          {
            type: 'TextualBody',
            value: '',
            format: 'text/plain',
            purpose: 'supplementing',
            creator: {
              id: user.id || user.email,
              type: 'Person',
              label: user.label || user.name || 'Unknown User',
            },
            created: new Date().toISOString(),
          },
        ];
      } else {
        annotationWithCreator.body = bodies.map((bodyItem: AnnotationBody) => {
          if (bodyItem.type === 'TextualBody' && !bodyItem.generator) {
            return {
              ...bodyItem,
              creator: bodyItem.creator || {
                id: user.id || user.email,
                type: 'Person',
                label: user.label || user.name || 'Unknown User',
              },
              created: bodyItem.created || new Date().toISOString(),
            };
          }
          return bodyItem;
        });
      }
    }

    const url = new URL(request.url);
    const project = url.searchParams.get('project');

    // Per-project ORCID authorization
    const userOrcid = (session.user as { id?: string })?.id;
    if (!canEditProject(userOrcid, project)) {
      return NextResponse.json(
        { error: 'Forbidden – you are not authorised to edit this project' },
        { status: 403 },
      );
    }

    const { baseUrl, container, authToken } = resolveAnnoRepoConfig(project);
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const annoRepoUrl = `${baseUrl}/w3c/${container}/`;
    const response = await fetch(annoRepoUrl, {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        ...annotationWithCreator,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('AnnoRepo create error:', response.status, errorText);
      throw new Error(
        `AnnoRepo creation failed: ${response.status} ${response.statusText}`,
      );
    }

    const created = (await response.json()) as CreatedAnnotation;
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error creating annotation:', errorMessage);
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
