import type { GazetteerPlace, PlaceCategory } from './types';

export interface StaticPlaceData {
  id: string;
  name: string;
  category: string;
  hasCoordinates: boolean;
  hasModernName: boolean;
  linkingAnnotationCount: number;
  created?: string;
  source: 'static' | 'gavoc' | 'cached';
}

const STATIC_PLACES: StaticPlaceData[] = [];

export async function getStaticPlaces(): Promise<StaticPlaceData[]> {
  return STATIC_PLACES;
}

export async function getStaticCategories(): Promise<PlaceCategory[]> {
  const places = await getStaticPlaces();
  const categoryMap = new Map<string, number>();

  places.forEach((place) => {
    const category = place.category || 'Unknown';
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  });

  return Array.from(categoryMap.entries())
    .map(([key, count]) => ({
      key,
      label: formatCategoryLabel(key),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function formatCategoryLabel(category: string): string {
  const categoryMap: Record<string, string> = {
    place: 'Place',
    plaats: 'Settlement',
    eiland: 'Island',
    rivier: 'River',
    berg: 'Mountain',
    kaap: 'Cape',
    baai: 'Bay',
    meer: 'Lake',
    landstreek: 'Region',
    gebouw: 'Building',
    ondiepte: 'Shoals',
    rif: 'Reef',
    voorde: 'Ford',
    lagune: 'Lagoon',
    wijk: 'District',
  };

  return categoryMap[category] || category;
}

export async function enrichPlaceData(
  staticPlace: StaticPlaceData,
): Promise<GazetteerPlace | null> {
  try {
    const enrichedPlace: GazetteerPlace = {
      id: staticPlace.id,
      name: staticPlace.name,
      category: staticPlace.category,
      created: staticPlace.created,
      textParts: [],
      targetAnnotationCount: staticPlace.linkingAnnotationCount,
      textRecognitionSources: [],
    };

    return enrichedPlace;
  } catch (error) {
    // Failed to enrich place data - return null
    return null;
  }
}
