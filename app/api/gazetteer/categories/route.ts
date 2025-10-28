import { mapIconographyToTaxonomy } from '@/lib/gazetteer/poolparty-taxonomy';

// Use Edge runtime for better performance
export const runtime = 'edge';

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

interface CategoryCount {
  key: string;
  label: string;
  count: number;
  uri?: string;
}

interface LinkingAnnotation {
  id: string;
  target?: string[];
  body?: Array<{
    purpose?: string;
    source?: {
      category?: string;
      properties?: { category?: string };
    };
  }>;
}

// Import the taxonomy mapping (we'll inline the essential parts for Edge runtime)
const categoryLabels: Record<string, { label: string; uri: string }> = {
  settlement: {
    label: 'Settlement',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/79dd26ba-f8df-4c5e-8783-27417a48fa99',
  },
  village: {
    label: 'Village',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d4dafba3-2344-4f5a-a94d-ed988069d0e5',
  },
  town: {
    label: 'Town',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/8e41887e-0111-4667-b209-9d0da933b7d8',
  },
  city: {
    label: 'City',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/20d7cfe7-b3b1-4223-b2b4-d9f6ddb2e683',
  },
  port: {
    label: 'Port',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/93a0b2c9-ad9a-4bab-8620-11b5c1e01f37',
  },
  fort: {
    label: 'Fort',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/84767cdb-cabe-4384-9e51-faca2ae3b864',
  },
  temple: {
    label: 'Temple',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/02db354d-bbd0-4122-aa18-00d6fe8cba28',
  },
  church: {
    label: 'Church',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d988ee0d-6b1c-4ba3-96f5-a95a5fd672da',
  },
  river: {
    label: 'River',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/cf7cc49f-738b-48b0-80a7-476244ba4919',
  },
  island: {
    label: 'Island',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d8b4d9c6-11b3-430a-ba08-48eb1f3a8f56',
  },
  mountain: {
    label: 'Mountain',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/617a0924-1516-4be8-a478-b451bf47f5bf',
  },
  cape: {
    label: 'Cape',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/ea0cf4b3-3d82-4ff6-ad10-12e77f581218',
  },
  bay: {
    label: 'Bay',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/6798ed1b-27a6-4113-9cd8-a78f68b94e7c',
  },
  reef: {
    label: 'Reef',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/517cd775-4b32-4dcd-aceb-c9db9d103e24',
  },
  canal: {
    label: 'Canal',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/4c199e1f-806b-405d-8e19-c86bed78f44b',
  },
  region: {
    label: 'Region',
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/06278cc4-0ec4-4376-b869-8c21bf507894',
  },
};

function mapCategoryToTaxonomy(category: string): string {
  const normalized = category.toLowerCase().trim().split('/')[0] || 'plaats';

  // GAVOC Dutch to taxonomy
  const mappings: Record<string, string> = {
    plaats: 'settlement',
    dorp: 'village',
    stad: 'town',
    steden: 'city',
    havenplaats: 'port',
    haven: 'port',
    fort: 'fort',
    vesting: 'fort',
    tempel: 'temple',
    kerk: 'church',
    rivier: 'river',
    eiland: 'island',
    berg: 'mountain',
    kaap: 'cape',
    baai: 'bay',
    rif: 'reef',
    kanaal: 'canal',
    regio: 'region',
  };

  return mappings[normalized] || 'settlement';
}

async function fetchCategoriesFromLinking(): Promise<CategoryCount[]> {
  const categoryCounts = new Map<string, number>();

  try {
    // Fetch first page of linking annotations from custom query
    const customQueryUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(customQueryUrl, {
      headers: { Accept: '*/*' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = (await response.json()) as {
      items?: LinkingAnnotation[];
    };
    const annotations = result.items || [];

    // Extract categories from linking annotations - both geotagging and iconography
    for (const annotation of annotations) {
      if (!annotation.body || !Array.isArray(annotation.body)) {
        continue;
      }

      // Get category from geotagging body
      annotation.body.forEach((body) => {
        if (body.purpose === 'geotagging' && body.source) {
          const category =
            body.source.category ||
            body.source.properties?.category ||
            'plaats';
          const taxonomyKey = mapCategoryToTaxonomy(category);

          categoryCounts.set(
            taxonomyKey,
            (categoryCounts.get(taxonomyKey) || 0) + 1,
          );
        }
      });

      // Also check targets for iconography annotations
      if (annotation.target && Array.isArray(annotation.target)) {
        const iconographyTargets = annotation.target.filter(
          (t) => typeof t === 'string',
        );

        // Fetch a sample of iconography annotations (limit to avoid timeout)
        const sampleSize = Math.min(iconographyTargets.length, 3);
        const iconPromises = iconographyTargets
          .slice(0, sampleSize)
          .map(async (targetId) => {
            try {
              const iconController = new AbortController();
              const iconTimeout = setTimeout(
                () => iconController.abort(),
                2000,
              );

              const iconResponse = await fetch(targetId, {
                headers: { Accept: '*/*' },
                signal: iconController.signal,
              });

              clearTimeout(iconTimeout);

              if (iconResponse.ok) {
                const iconData = (await iconResponse.json()) as {
                  motivation?: string;
                  body?: Array<{
                    purpose?: string;
                    source?: { label?: string; id?: string };
                  }>;
                };

                if (iconData.motivation === 'iconography' && iconData.body) {
                  iconData.body.forEach((iconBody) => {
                    if (
                      iconBody.purpose === 'classifying' &&
                      iconBody.source?.label
                    ) {
                      const iconLabel = iconBody.source.label.toLowerCase();
                      const taxonomyKey = mapIconographyToTaxonomy(iconLabel);
                      if (taxonomyKey) {
                        categoryCounts.set(
                          taxonomyKey,
                          (categoryCounts.get(taxonomyKey) || 0) + 1,
                        );
                      }
                    }
                  });
                }
              }
              return null;
            } catch {
              return null;
            }
          });

        await Promise.all(iconPromises);
      }
    }

    // Convert to array and add labels
    const categories: CategoryCount[] = Array.from(categoryCounts.entries())
      .map(([key, count]) => ({
        key,
        label: categoryLabels[key]?.label || key,
        uri: categoryLabels[key]?.uri,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// eslint-disable-next-line no-restricted-syntax -- Edge runtime requires Response not NextResponse
export async function GET(): Promise<Response> {
  try {
    const categories = await fetchCategoriesFromLinking();

    // If we got categories, return them
    if (categories.length > 0) {
      return new Response(JSON.stringify(categories), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    // Fallback to basic categories
    const fallback: CategoryCount[] = [
      {
        key: 'settlement',
        label: 'Settlement',
        uri: categoryLabels.settlement?.uri,
        count: 0,
      },
      {
        key: 'river',
        label: 'River',
        uri: categoryLabels.river?.uri,
        count: 0,
      },
      {
        key: 'island',
        label: 'Island',
        uri: categoryLabels.island?.uri,
        count: 0,
      },
      {
        key: 'mountain',
        label: 'Mountain',
        uri: categoryLabels.mountain?.uri,
        count: 0,
      },
    ];

    return new Response(JSON.stringify(fallback), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Categories API error:', error);

    const fallback: CategoryCount[] = [
      {
        key: 'settlement',
        label: 'Settlement',
        uri: categoryLabels.settlement?.uri,
        count: 0,
      },
    ];

    return new Response(JSON.stringify(fallback), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
