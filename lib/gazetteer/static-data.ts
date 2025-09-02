// Static gazetteer data approach to avoid serverless timeout issues
import type { GazetteerPlace, PlaceCategory } from './types';

// Basic place data that can be loaded quickly without API calls
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

// This would ideally be generated from a build script that fetches and processes
// all annotations during build time, not runtime
const STATIC_PLACES: StaticPlaceData[] = [
  // For now, return some example data
  // In production, this would be generated from the annotation data
];

export async function getStaticPlaces(): Promise<StaticPlaceData[]> {
  // In a real implementation, this would load from a JSON file
  // generated during the build process
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

// Function to enrich a static place with full annotation data on-demand
export async function enrichPlaceData(
  staticPlace: StaticPlaceData,
): Promise<GazetteerPlace | null> {
  // This would fetch detailed annotation data for a specific place
  // only when needed (e.g., when viewing a place detail page)

  try {
    // For now, convert static data to full place data
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
    console.error(`Failed to enrich place data for ${staticPlace.id}:`, error);
    return null;
  }
}
