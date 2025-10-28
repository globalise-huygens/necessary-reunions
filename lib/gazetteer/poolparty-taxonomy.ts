/**
 * PoolParty Place Type Taxonomy
 * Maps place types to the GLOBALISE PoolParty controlled vocabulary
 * Based on: https://digitaalerfgoed.poolparty.biz/globalise/
 */

export interface PlaceTypeTaxonomy {
  uri: string;
  label: string;
  key: string;
  parent?: string;
  altLabels?: string[];
  gavocMapping?: string[]; // Map GAVOC Dutch terms
  iconographyMapping?: string[]; // Map iconography thesaurus terms
}

/**
 * Complete GLOBALISE Place Type Taxonomy
 * Hierarchical structure with PoolParty URIs
 */
export const PLACE_TYPE_TAXONOMY: Record<string, PlaceTypeTaxonomy> = {
  // POLITICAL ADMIN BODIES
  empire: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/27785c97-df3c-424e-aa75-bddbd674e183',
    label: 'Empire',
    key: 'empire',
    parent: 'polities',
  },
  kingdom: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/6f1f178a-fa6f-4553-a723-99f9d909a771',
    label: 'Kingdom',
    key: 'kingdom',
    parent: 'polities',
  },
  negorij: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/7c1af419-926c-47c9-9450-05dc5849c05c',
    label: 'Negorij',
    key: 'negorij',
    parent: 'polities',
  },
  province: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/0e3137ad-bc4d-4da6-8ba3-f4fc5fe7058f',
    label: 'Province',
    key: 'province',
    parent: 'political-division',
  },
  regency: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/55f41aea-cc65-4cfb-88c4-766a2841452a',
    label: 'Regency',
    key: 'regency',
    parent: 'political-division',
  },
  district: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/40217104-de46-42ed-80c8-480fac1f8706',
    label: 'District',
    key: 'district',
    parent: 'political-division',
  },

  // SETTLEMENTS
  village: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d4dafba3-2344-4f5a-a94d-ed988069d0e5',
    label: 'Village',
    key: 'village',
    parent: 'settlement',
    gavocMapping: ['dorp'],
  },
  kampong: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d5e1cce4-2779-494a-bf72-a6b3a0b0ace0',
    label: 'Kampong',
    key: 'kampong',
    parent: 'village',
    gavocMapping: ['kampong', 'kampon'],
  },
  town: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/8e41887e-0111-4667-b209-9d0da933b7d8',
    label: 'Town',
    key: 'town',
    parent: 'settlement',
    gavocMapping: ['stad'],
  },
  city: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/20d7cfe7-b3b1-4223-b2b4-d9f6ddb2e683',
    label: 'City',
    key: 'city',
    parent: 'settlement',
    gavocMapping: ['steden'],
    altLabels: ['steden'],
  },
  capital: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/2b007e6a-a299-413b-bc7f-51e69a9e1fab',
    label: 'Capital',
    key: 'capital',
    parent: 'settlement',
    gavocMapping: ['hoofdstad'],
  },
  port: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/93a0b2c9-ad9a-4bab-8620-11b5c1e01f37',
    label: 'Port',
    key: 'port',
    parent: 'settlement',
    gavocMapping: ['havenplaats', 'haven'],
    iconographyMapping: ['haven'],
  },
  'coastal-settlement': {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/954cae70-c7e6-4ee9-8273-73beabc3fc0b',
    label: 'Coastal Settlement',
    key: 'coastal-settlement',
    parent: 'settlement',
    gavocMapping: ['kustplaats'],
  },
  settlement: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/79dd26ba-f8df-4c5e-8783-27417a48fa99',
    label: 'Settlement',
    key: 'settlement',
    gavocMapping: ['plaats', 'nederzetting'],
  },

  // BUILDINGS
  fort: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/84767cdb-cabe-4384-9e51-faca2ae3b864',
    label: 'Fort',
    key: 'fort',
    parent: 'building',
    gavocMapping: ['fort', 'vesting'],
    iconographyMapping: ['fort'],
  },
  temple: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/02db354d-bbd0-4122-aa18-00d6fe8cba28',
    label: 'Temple',
    key: 'temple',
    parent: 'building',
    gavocMapping: ['tempel'],
    iconographyMapping: ['tempel'],
  },
  church: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d988ee0d-6b1c-4ba3-96f5-a95a5fd672da',
    label: 'Church',
    key: 'church',
    parent: 'building',
    gavocMapping: ['kerk'],
    iconographyMapping: ['kerk'],
  },
  palace: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/90c73af5-d79c-482b-ab9e-dc176a02db69',
    label: 'Palace',
    key: 'palace',
    parent: 'building',
    gavocMapping: ['paleis'],
  },

  // BODIES OF WATER
  sea: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/1def21b2-fbe7-48e1-a236-f562dff99614',
    label: 'Sea',
    key: 'sea',
    parent: 'water',
    gavocMapping: ['zee'],
  },
  ocean: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/05abdf2e-d71d-4c3e-9125-e3eed855de10',
    label: 'Ocean',
    key: 'ocean',
    parent: 'water',
    gavocMapping: ['oceaan'],
  },
  river: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/cf7cc49f-738b-48b0-80a7-476244ba4919',
    label: 'River',
    key: 'river',
    parent: 'water',
    gavocMapping: ['rivier'],
    iconographyMapping: ['rivier'],
  },
  stream: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/b2cd216c-9533-449a-849d-1cbd3840a3d2',
    label: 'Stream',
    key: 'stream',
    parent: 'water',
    gavocMapping: ['beek', 'stroom'],
  },
  lake: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/7fce30ff-c0c2-4b6a-aab6-4f2cd2a2bf8e',
    label: 'Lake',
    key: 'lake',
    parent: 'water',
    gavocMapping: ['meer'],
  },
  bay: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/6798ed1b-27a6-4113-9cd8-a78f68b94e7c',
    label: 'Bay',
    key: 'bay',
    parent: 'water',
    gavocMapping: ['baai'],
  },
  gulf: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/f4f67f28-f00c-4888-a286-f712d82aa9a2',
    label: 'Gulf',
    key: 'gulf',
    parent: 'water',
    gavocMapping: ['golf'],
  },
  strait: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/46724d25-aa94-4848-a8ca-17fe02b0db2b',
    label: 'Strait',
    key: 'strait',
    parent: 'water',
    gavocMapping: ['straat'],
  },
  canal: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/4c199e1f-806b-405d-8e19-c86bed78f44b',
    label: 'Canal',
    key: 'canal',
    parent: 'water',
    gavocMapping: ['kanaal', 'gracht'],
    iconographyMapping: ['kanaal'],
  },

  // LANDFORMS
  mountain: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/617a0924-1516-4be8-a478-b451bf47f5bf',
    label: 'Mountain',
    key: 'mountain',
    parent: 'landform',
    gavocMapping: ['berg'],
    iconographyMapping: ['berg'],
  },
  hill: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/c1aab052-d89b-471f-a3ad-51c52cdffe2f',
    label: 'Hill',
    key: 'hill',
    parent: 'landform',
    gavocMapping: ['heuvel'],
  },
  island: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/d8b4d9c6-11b3-430a-ba08-48eb1f3a8f56',
    label: 'Island',
    key: 'island',
    parent: 'landform',
    gavocMapping: ['eiland'],
    iconographyMapping: ['eiland'],
  },
  'island-group': {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/25b09c82-eab3-41d4-9c36-831cfc2b496c',
    label: 'Island Group',
    key: 'island-group',
    parent: 'island',
    gavocMapping: ['eilandengroep'],
  },
  peninsula: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/422b34bb-dffe-4552-b1cd-f720d3efe4df',
    label: 'Peninsula',
    key: 'peninsula',
    parent: 'landform',
    gavocMapping: ['schiereiland'],
  },
  cape: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/ea0cf4b3-3d82-4ff6-ad10-12e77f581218',
    label: 'Cape',
    key: 'cape',
    parent: 'landform',
    gavocMapping: ['kaap'],
    iconographyMapping: ['kaap'],
  },
  point: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/50310cac-a6c2-4e9d-9162-ebaa073a9835',
    label: 'Point',
    key: 'point',
    parent: 'landform',
    gavocMapping: ['punt'],
  },
  coast: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/42bea596-3b26-4598-a894-5922ff137c7c',
    label: 'Coast',
    key: 'coast',
    parent: 'landform',
    gavocMapping: ['kust'],
  },
  reef: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/517cd775-4b32-4dcd-aceb-c9db9d103e24',
    label: 'Reef',
    key: 'reef',
    parent: 'landform',
    iconographyMapping: ['rif'],
  },

  // OTHER
  region: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/06278cc4-0ec4-4376-b869-8c21bf507894',
    label: 'Region',
    key: 'region',
    gavocMapping: ['regio', 'streek'],
  },
  plantation: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/3ab57615-93bf-49cc-a1f0-327e14ca1cfa',
    label: 'Plantation',
    key: 'plantation',
    gavocMapping: ['plantage'],
  },
  garden: {
    uri: 'https://digitaalerfgoed.poolparty.biz/globalise/9ff96df6-316f-4f2d-9a68-84fcd87893f2',
    label: 'Garden',
    key: 'garden',
    gavocMapping: ['tuin'],
  },
};

/**
 * Map GAVOC category to PoolParty taxonomy key
 */
export function mapGavocCategoryToTaxonomy(gavocCategory: string): string {
  const normalized = gavocCategory.toLowerCase().trim();

  // Find matching taxonomy entry
  for (const [key, taxonomy] of Object.entries(PLACE_TYPE_TAXONOMY)) {
    if (taxonomy.gavocMapping?.some((m) => normalized.includes(m))) {
      return key;
    }
  }

  // Fallback mappings
  if (normalized.includes('stad') || normalized.includes('city')) return 'city';
  if (normalized.includes('dorp') || normalized.includes('village'))
    return 'village';
  if (normalized.includes('plaats') || normalized.includes('settlement'))
    return 'settlement';
  if (normalized.includes('rivier') || normalized.includes('river'))
    return 'river';
  if (normalized.includes('eiland') || normalized.includes('island'))
    return 'island';
  if (normalized.includes('berg') || normalized.includes('mountain'))
    return 'mountain';
  if (normalized.includes('haven') || normalized.includes('port'))
    return 'port';
  if (normalized.includes('fort')) return 'fort';

  return 'settlement'; // Default fallback
}

/**
 * Map iconography thesaurus label to PoolParty taxonomy key
 */
export function mapIconographyToTaxonomy(iconLabel: string): string | null {
  const normalized = iconLabel.toLowerCase().trim();

  for (const [key, taxonomy] of Object.entries(PLACE_TYPE_TAXONOMY)) {
    if (taxonomy.iconographyMapping?.some((m) => normalized.includes(m))) {
      return key;
    }
  }

  return null;
}

/**
 * Get human-readable label for category key
 */
export function getCategoryLabel(key: string): string {
  return PLACE_TYPE_TAXONOMY[key]?.label || key;
}

/**
 * Get PoolParty URI for category key
 */
export function getCategoryUri(key: string): string | null {
  return PLACE_TYPE_TAXONOMY[key]?.uri || null;
}
