import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { resolveAnnoRepoConfig } from '@/lib/shared/annorepo-config';
import { authOptions } from '../../../auth/[...nextauth]/authOptions';

interface AnnotationBody {
  selector?: {
    type: string;
    [key: string]: unknown;
  };
  purpose?: string;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
  [key: string]: unknown;
}

interface User {
  id?: string;
  email?: string;
  label?: string;
  name?: string;
}

function validateAndFixBodies(
  bodies: AnnotationBody[],
  user: User,
): AnnotationBody[] {
  return bodies.map((body) => {
    if (
      body.selector?.type === 'PointSelector' &&
      body.purpose === 'highlighting'
    ) {
      body.purpose = 'selecting';
    }

    if (!body.creator) {
      body.creator = {
        id: user.id || user.email || 'unknown',
        type: 'Person',
        label: user.label || user.name || 'Unknown User',
      };
    }

    if (!body.created) {
      body.created = new Date().toISOString();
    }

    return body;
  });
}

type PutResponse =
  | { error: string; details?: unknown; conflictingAnnotations?: string[] }
  | Record<string, never>;

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<PutResponse>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to update linking annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    const url = new URL(request.url);
    const project = url.searchParams.get('project');
    const { baseUrl, container } = resolveAnnoRepoConfig(project);
    annotationUrl = `${baseUrl}/w3c/${container}/${decodedId}`;
  }

  try {
    const body = (await request.json()) as {
      target?: string | string[];
      body?: AnnotationBody | AnnotationBody[];
      project?: string;
      [key: string]: unknown;
    };

    const projectSlug =
      body.project || new URL(request.url).searchParams.get('project');
    const {
      baseUrl: arBaseUrl,
      container: arContainer,
      authToken: arToken,
    } = resolveAnnoRepoConfig(projectSlug);

    const targets: string[] = Array.isArray(body.target)
      ? body.target
      : [body.target].filter((t): t is string => typeof t === 'string');

    const fetchResponse = await fetch(
      `${arBaseUrl}/services/${arContainer}/search?motivation=linking`,
    );

    if (fetchResponse.ok) {
      const data = (await fetchResponse.json()) as {
        items?: Array<{
          id?: string;
          target?: string | string[];
        }>;
      };
      const existingLinkingAnnotations = Array.isArray(data.items)
        ? data.items
        : [];

      const conflictingAnnotations = existingLinkingAnnotations.filter(
        (existing) => {
          if (existing.id === annotationUrl || existing.id === decodedId) {
            return false;
          }

          if (Array.isArray(existing.target)) {
            return existing.target.some((existingTarget: string) =>
              targets.includes(existingTarget),
            );
          }
          return (
            typeof existing.target === 'string' &&
            targets.includes(existing.target)
          );
        },
      );

      if (conflictingAnnotations.length > 0) {
        return NextResponse.json(
          {
            error:
              'One or more annotations are already part of a linking annotation',
            conflictingAnnotations: conflictingAnnotations
              .map((a) => a.id)
              .filter((annoId): annoId is string => typeof annoId === 'string'),
          },
          { status: 409 },
        );
      }
    }

    const user = session.user as User;

    let validatedBodies = body.body;
    if (validatedBodies) {
      const bodiesArray = Array.isArray(validatedBodies)
        ? validatedBodies
        : [validatedBodies];
      validatedBodies = validateAndFixBodies(bodiesArray, user);
    }

    const updatedLinkingAnnotation = {
      ...body,
      motivation: 'linking',
      body: validatedBodies,
      creator: {
        id: user.id || user.email || 'unknown',
        type: 'Person',
        label: user.label || user.name || 'Unknown User',
      },
      modified: new Date().toISOString(),
    };

    if (
      !updatedLinkingAnnotation.target ||
      (Array.isArray(updatedLinkingAnnotation.target) &&
        updatedLinkingAnnotation.target.length === 0)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid linking annotation structure',
          details: ['Missing target annotations'],
        },
        { status: 400 },
      );
    }

    if (
      !updatedLinkingAnnotation.body ||
      !Array.isArray(updatedLinkingAnnotation.body)
    ) {
      updatedLinkingAnnotation.body = [];
    }

    const annotationToUpdate = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      ...updatedLinkingAnnotation,
      id: body.id || annotationUrl,
      type: body.type || 'Annotation',
    };

    const authToken = arToken;
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const getResponse = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to fetch annotation: ${getResponse.status} ${getResponse.statusText} - ${errorText}`,
      );
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      throw new Error('Annotation does not have an ETag');
    }

    const response = await fetch(annotationUrl, {
      method: 'PUT',
      headers: {
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Authorization: `Bearer ${authToken}`,
        'If-Match': etag,
      },
      body: JSON.stringify(annotationToUpdate),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `AnnoRepo update failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    return NextResponse.json(result) as unknown as NextResponse<PutResponse>;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error updating linking annotation:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ error: string } | null>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized – please sign in to delete linking annotations' },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let annotationUrl: string;
  const decodedId = decodeURIComponent(id);
  const url = new URL(request.url);
  const project = url.searchParams.get('project');
  const { baseUrl, container, authToken } = resolveAnnoRepoConfig(project);

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `${baseUrl}/w3c/${container}/${decodedId}`;
  }

  try {
    if (!authToken) {
      throw new Error('AnnoRepo authentication token not configured');
    }

    const getResponse = await fetch(annotationUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to fetch annotation: ${getResponse.status} ${getResponse.statusText} - ${errorText}`,
      );
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      throw new Error('Annotation does not have an ETag');
    }

    const deleteResponse = await fetch(annotationUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'If-Match': etag,
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse
        .text()
        .catch(() => 'Unknown error');
      throw new Error(
        `AnnoRepo deletion failed: ${deleteResponse.status} ${deleteResponse.statusText} - ${errorText}`,
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error deleting linking annotation:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
