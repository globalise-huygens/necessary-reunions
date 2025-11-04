/**
 * Cascade Deletion Logic for Linking Annotations
 *
 * When a textspotting or iconography annotation is deleted, we must maintain
 * referential integrity by updating or deleting any linking annotations that
 * reference it in their target array.
 *
 * Strategy:
 * 1. Find all linking annotations that reference the deleted annotation
 * 2. Remove the deleted annotation from their target arrays
 * 3. Validate remaining linking annotations:
 *    - If 2+ targets remain: Update the annotation
 *    - If 1 target + geotag/point: Update the annotation (still valid)
 *    - If 1 target + no geotag/point: Delete the annotation (invalid)
 *    - If 0 targets: Delete the annotation (invalid)
 */

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

interface Annotation {
  id: string;
  type: string;
  motivation?: string | string[];
  target?: string | string[];
  body?: unknown;
  [key: string]: unknown;
}

interface CascadeResult {
  affectedLinking: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/**
 * Check if a body array contains geotag or point selection data
 */
function hasEnhancementData(body: unknown): boolean {
  const bodyArray = Array.isArray(body) ? body : [body];

  return bodyArray.some((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const purpose = (item as { purpose?: string }).purpose;
    return purpose === 'geotagging' || purpose === 'selecting';
  });
}

/**
 * Fetch all linking annotations from AnnoRepo
 */
async function fetchAllLinkingAnnotations(
  authToken: string,
): Promise<Annotation[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Use custom query to get all linking annotations
    const motivationB64 = btoa('linking');
    const url = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=${motivationB64}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/ld+json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch linking annotations: ${response.status}`,
      );
    }

    const data = (await response.json()) as
      | {
          type: string;
          first?: { items?: Annotation[] };
          items?: Annotation[];
        }
      | Annotation[];

    // Handle both ActivityStreams container and direct array
    if (!Array.isArray(data)) {
      if (data.type === 'OrderedCollection' || data.type === 'Collection') {
        return data.first?.items || data.items || [];
      }
    }

    return Array.isArray(data) ? data : [];
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error('Timeout fetching linking annotations');
      return [];
    }
    console.error('Error fetching linking annotations:', error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Update a linking annotation in AnnoRepo
 */
async function updateLinkingAnnotation(
  annotation: Annotation,
  authToken: string,
): Promise<boolean> {
  try {
    // First, get the ETag
    const getResponse = await fetch(annotation.id, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      console.error(`Failed to fetch ETag for ${annotation.id}`);
      return false;
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      console.error(`No ETag found for ${annotation.id}`);
      return false;
    }

    // Update the annotation
    const updateResponse = await fetch(annotation.id, {
      method: 'PUT',
      headers: {
        'Content-Type':
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        Authorization: `Bearer ${authToken}`,
        'If-Match': etag,
      },
      body: JSON.stringify({
        ...annotation,
        modified: new Date().toISOString(),
      }),
    });

    return updateResponse.ok;
  } catch (error) {
    console.error(`Error updating linking annotation ${annotation.id}:`, error);
    return false;
  }
}

/**
 * Delete a linking annotation from AnnoRepo
 */
async function deleteLinkingAnnotation(
  annotationId: string,
  authToken: string,
): Promise<boolean> {
  try {
    // Get ETag
    const getResponse = await fetch(annotationId, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!getResponse.ok) {
      console.error(`Failed to fetch ETag for ${annotationId}`);
      return false;
    }

    const etag = getResponse.headers.get('ETag');
    if (!etag) {
      console.error(`No ETag found for ${annotationId}`);
      return false;
    }

    // Delete the annotation
    const deleteResponse = await fetch(annotationId, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'If-Match': etag,
      },
    });

    return deleteResponse.ok;
  } catch (error) {
    console.error(`Error deleting linking annotation ${annotationId}:`, error);
    return false;
  }
}

/**
 * Main cascade deletion function
 *
 * Finds and updates/deletes linking annotations that reference the deleted annotation(s)
 */
export async function cascadeDeleteFromLinking(
  deletedAnnotationIds: string[],
  authToken: string,
): Promise<CascadeResult> {
  const result: CascadeResult = {
    affectedLinking: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Fetch all linking annotations
    const linkingAnnotations = await fetchAllLinkingAnnotations(authToken);

    // Find linking annotations that reference any of the deleted annotations
    const affectedLinking = linkingAnnotations.filter((linking) => {
      const targets = Array.isArray(linking.target)
        ? linking.target
        : [linking.target];

      return targets.some(
        (target) =>
          target &&
          deletedAnnotationIds.some((deletedId) => {
            // Match both full URLs and annotation names
            return (
              target === deletedId ||
              target === `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${deletedId}` ||
              target.endsWith(`/${deletedId}`)
            );
          }),
      );
    });

    result.affectedLinking = affectedLinking.length;

    // Process each affected linking annotation
    for (const linking of affectedLinking) {
      const targets = Array.isArray(linking.target)
        ? linking.target
        : [linking.target];

      // Remove deleted annotations from target array
      const newTargets = targets.filter(
        (target) =>
          target &&
          !deletedAnnotationIds.some((deletedId) => {
            return (
              target === deletedId ||
              target === `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${deletedId}` ||
              target.endsWith(`/${deletedId}`)
            );
          }),
      );

      // Determine action based on remaining targets and enhancement data
      const hasEnhancements = hasEnhancementData(linking.body);
      const shouldDelete =
        newTargets.length === 0 ||
        (newTargets.length === 1 && !hasEnhancements);

      if (shouldDelete) {
        // Delete the linking annotation
        const success = await deleteLinkingAnnotation(linking.id, authToken);
        if (success) {
          result.deleted++;
          console.log(
            `Cascade deleted linking annotation ${linking.id} (${newTargets.length} targets, hasEnhancements: ${hasEnhancements})`,
          );
        } else {
          result.errors.push(`Failed to delete linking ${linking.id}`);
        }
      } else {
        // Update the linking annotation with new targets
        const filteredTargets = newTargets.filter(
          (t): t is string => typeof t === 'string',
        );
        const updatedLinking: Annotation = {
          ...linking,
          target:
            filteredTargets.length === 1 ? filteredTargets[0] : filteredTargets,
        };

        const success = await updateLinkingAnnotation(
          updatedLinking,
          authToken,
        );
        if (success) {
          result.updated++;
          console.log(
            `Cascade updated linking annotation ${linking.id} (removed ${targets.length - newTargets.length} target(s))`,
          );
        } else {
          result.errors.push(`Failed to update linking ${linking.id}`);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error in cascade deletion:', error);
    result.errors.push(
      `Cascade deletion error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    return result;
  }
}
