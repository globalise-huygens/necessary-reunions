import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import {
  deleteAnnotation,
  updateAnnotation,
} from '../../../../../lib/viewer/annoRepo';
import {
  repairLinkingAnnotationStructure,
  validateLinkingAnnotationBeforeSave,
} from '../../../../../lib/viewer/linking-repair';
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
    annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${decodedId}`;
  }

  try {
    const body = (await request.json()) as {
      target?: string | string[];
      body?: AnnotationBody | AnnotationBody[];
      [key: string]: unknown;
    };

    const targets: string[] = Array.isArray(body.target)
      ? body.target
      : [body.target].filter((t): t is string => typeof t === 'string');

    const fetchResponse = await fetch(
      `${
        process.env.ANNOREPO_BASE_URL ||
        'https://annorepo.globalise.huygens.knaw.nl'
      }/services/necessary-reunions/search?motivation=linking`,
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

    const repairedAnnotation = repairLinkingAnnotationStructure(
      updatedLinkingAnnotation,
    );

    const validation = validateLinkingAnnotationBeforeSave(repairedAnnotation);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid linking annotation structure',
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    const result = await updateAnnotation(annotationUrl, repairedAnnotation);
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

  if (decodedId.startsWith('https://')) {
    annotationUrl = decodedId;
  } else {
    annotationUrl = `https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/${decodedId}`;
  }

  try {
    await deleteAnnotation(annotationUrl);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error deleting linking annotation:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
