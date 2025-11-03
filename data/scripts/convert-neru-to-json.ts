#!/usr/bin/env tsx

/**
 * NeRu CSV to Linked Art JSON Converter
 *
 * Converts 4 CSV files (places, altLabels, placeTypes, placeRelation) into
 * a Linked Art JSON-LD dataset matching the GLOBALISE place dataset structure.
 *
 * Key principles:
 * - GLOB_ID connects all tables
 * - PREF_LABEL becomes primary _label
 * - ALT_LABELs link to PREF_LABEL via shared GLOB_ID
 * - ALL REMARKS fields preserved with context
 */

import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line import-x/no-unresolved -- csv-parse/sync exports are valid
import { parse } from 'csv-parse/sync';
import { v5 as uuidv5 } from 'uuid';

// UUID namespace for NeRu places (generated specifically for this project)
const NERU_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PlacesRow {
  EXISTING_PLACE?: string;
  EXISTING_ID?: string;
  GLOB_ID: string;
  PREF_LABEL: string;
  PREF_LABEL_SOURCE?: string;
  PREF_LABEL_SOURCE_PAGE?: string;
  PREF_LABEL_REMARKS?: string;
  PREF_LABEL_REMARKS_SOURCE?: string;
  PREF_LABEL_REMARKS_SOURCE_PAGE?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
  COORD_CERTAINTY?: string;
  COORD_SOURCE?: string;
  COORD_SOURCE_PAGE?: string;
  COORD_REMARKS?: string;
  COORD_REMARKS_SOURCE?: string;
  COORD_REMARKS_SOURCE_PAGE?: string;
  CCODES?: string;
  WHG_ID?: string;
  GEONAMES_ID?: string;
  TGN_ID?: string;
  WIKIDATA_ID?: string;
  AMH_ID?: string;
  EXTERNAL_IDS?: string;
  OVERALL_REMARKS?: string;
  OVERALL_SOURCE?: string;
  OVERALL_SOURCE_PAGE?: string;
}

interface AltLabelsRow {
  GLOB_ID: string;
  ALT_LABEL: string;
  ALT_LABEL_SOURCE?: string;
  ALT_LABEL_SOURCE_PAGE?: string;
  ALT_LABEL_REMARK?: string;
  ALT_LABEL_REMARK_SOURCE?: string;
  ALT_LABEL_REMARK_SOURCE_PAGE?: string;
}

interface PlaceTypesRow {
  PLACE?: string;
  GLOB_ID: string;
  TYPE: string;
  TYPE_REMARKS?: string;
  SOURCE?: string;
}

interface PlaceRelationRow {
  PLACE?: string;
  GLOB_ID: string;
  RELATION?: string;
  RELATED_PLACE?: string;
  RELATED_GLOB_ID?: string;
  RELATION_REMARKS?: string;
}

interface PlaceData {
  globId: string;
  prefLabel: string;
  prefLabelSource?: string;
  prefLabelSourcePage?: string;
  prefLabelRemarks?: string;
  latitude?: number;
  longitude?: number;
  coordCertainty?: string;
  coordSource?: string;
  coordSourcePage?: string;
  coordRemarks?: string;
  ccodes?: string;
  externalIds: {
    geonames?: string;
    wikidata?: string;
    amh?: string;
    tgn?: string;
    whg?: string;
  };
  overallRemarks?: string;
  overallSource?: string;
  overallSourcePage?: string;
  altLabels: Array<{
    label: string;
    source?: string;
    sourcePage?: string;
    remark?: string;
    remarkSource?: string;
    remarkSourcePage?: string;
  }>;
  types: Array<{
    type: string;
    source?: string;
    remark?: string;
  }>;
  relations: Array<{
    relation?: string;
    relatedGlobId?: string;
    relatedPlace?: string;
    remark?: string;
  }>;
}

interface LinkedArtPlace {
  '@context': string;
  id: string;
  type: 'Place';
  _label: string;
  glob_id: string; // Add GLOB_ID
  classified_as: Array<{
    id: string;
    type: 'Type';
    _label: string;
  }>;
  identified_by: Array<{
    type: 'Name' | 'Identifier';
    content: string;
    classified_as?: Array<{
      id: string;
      type: 'Type';
      _label: string;
    }>;
  }>;
  referred_to_by: Array<{
    type: 'LinguisticObject';
    classified_as: Array<{
      id: string;
      type: 'Type';
      _label: string;
      classified_as?: Array<{
        id: string;
        type: 'Type';
        _label: string;
      }>;
    }>;
    content: string;
  }>;
  part_of?: Array<{
    id: string;
    type: 'Place';
    _label: string;
    classified_as: any[];
  }>;
  defined_by?: string;
  coord_certainty?: string; // Add coordinate certainty
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generatePlaceId(globId: string): string {
  const uuid = uuidv5(globId, NERU_NAMESPACE);
  return `https://id.necessaryreunions.org/place/${uuid}`;
}

function parseCoordinate(value?: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

function formatExternalId(type: string, value: string): string {
  if (!value || value.trim() === '') return '';

  switch (type) {
    case 'geonames':
      // Extract ID and format as full URL
      const geonamesId = value
        .replace(/^https?:\/\/.*geonames\.org\//, '')
        .split('/')[0];
      return `https://geonames.org/${geonamesId}`;
    case 'wikidata':
      // Already full URL or Q-id
      return value.startsWith('http')
        ? value
        : `https://www.wikidata.org/wiki/${value}`;
    case 'amh':
    case 'whg':
      return value;
    case 'tgn':
      return value.startsWith('http')
        ? value
        : `http://vocab.getty.edu/tgn/${value}`;
    default:
      return value;
  }
}

function buildRemarksContent(
  context: string,
  remarks?: string,
  source?: string,
  sourcePage?: string,
): string {
  let content = `[${context}] ${remarks || ''}`;

  if (source || sourcePage) {
    const sourceInfo = [source, sourcePage ? `p. ${sourcePage}` : '']
      .filter(Boolean)
      .join(', ');
    content += `. Source: ${sourceInfo}`;
  }

  return content.trim();
}

// Type mapping to PoolParty URIs (ACTUAL URIs from COMPLETED Suggested Organization CSV)
// Only includes types that are present in the PoolParty thesaurus
const typeUriMap: Record<string, { id: string; label: string }> = {
  // Political Administrative Bodies
  kingdom: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/6f1f178a-fa6f-4553-a723-99f9d909a771',
    label: 'kingdom',
  },
  village: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/d4dafba3-2344-4f5a-a94d-ed988069d0e5',
    label: 'village',
  },
  town: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/8e41887e-0111-4667-b209-9d0da933b7d8',
    label: 'town',
  },
  city: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/20d7cfe7-b3b1-4223-b2b4-d9f6ddb2e683',
    label: 'city',
  },
  capital: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/2b007e6a-a299-413b-bc7f-51e69a9e1fab',
    label: 'capital',
  },
  empire: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/27785c97-df3c-424e-aa75-bddbd674e183',
    label: 'empire',
  },
  principality: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/e2aea655-e60c-47a1-96d8-4c2fd0f92ba2',
    label: 'principality',
  },
  province: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/0e3137ad-bc4d-4da6-8ba3-f4fc5fe7058f',
    label: 'province',
  },
  district: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/40217104-de46-42ed-80c8-480fac1f8706',
    label: 'district',
  },
  regency: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/55f41aea-cc65-4cfb-88c4-766a2841452a',
    label: 'regency',
  },
  fief: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/82649d92-e539-41a6-b62b-c5e501f3e3de',
    label: 'fief',
  },
  tsardom: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/898609ad-8253-443f-be2b-455d31e67a7e',
    label: 'tsardom',
  },
  federation: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/aac3913b-50a0-4d44-adbf-080a98a6729c',
    label: 'federation',
  },
  aurung: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/db80a209-840f-4014-a9b4-6d580b1c682a',
    label: 'aurung',
  },
  nusak: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/f2e48ff8-f0e6-4a7d-998a-1a4916658270',
    label: 'nusak',
  },
  perk: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/ff08099f-3b85-48c8-ab5e-e2c50895565b',
    label: 'perk',
  },
  negorij: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/7c1af419-926c-47c9-9450-05dc5849c05c',
    label: 'negorij',
  },
  'voc admin region': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/49b48294-d3be-4a92-a066-a13be466993c',
    label: 'VOC Admin Region',
  },
  // Settlements
  settlement: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/b5a9bd0d-42b8-45c7-a8d9-2b2ef07f4cbb',
    label: 'settlement',
  },
  'coastal settlement': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/954cae70-c7e6-4ee9-8273-73beabc3fc0b',
    label: 'coastal settlement',
  },
  'port (settlement)': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/93a0b2c9-ad9a-4bab-8620-11b5c1e01f37',
    label: 'port (settlement)',
  },
  port: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/93a0b2c9-ad9a-4bab-8620-11b5c1e01f37',
    label: 'port (settlement)',
  },
  // Buildings & Structures
  'fortification/fort': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/84767cdb-cabe-4384-9e51-faca2ae3b864',
    label: 'fortification/fort',
  },
  fort: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/84767cdb-cabe-4384-9e51-faca2ae3b864',
    label: 'fortification/fort',
  },
  fortification: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/84767cdb-cabe-4384-9e51-faca2ae3b864',
    label: 'fortification/fort',
  },
  'guard post': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/07b3f630-b359-4d5d-a0cd-3c029dc1c394',
    label: 'guard post',
  },
  gate: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/385fe473-cafc-4f17-9f72-cbecd4088e6b',
    label: 'gate',
  },
  temple: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/02db354d-bbd0-4122-aa18-00d6fe8cba28',
    label: 'temple',
  },
  church: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/d988ee0d-6b1c-4ba3-96f5-a95a5fd672da',
    label: 'church',
  },
  palace: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/90c73af5-d79c-482b-ab9e-dc176a02db69',
    label: 'palace',
  },
  'religious center': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/a5da1966-bdf3-4a6d-8c81-1f09b53f9060',
    label: 'religious center',
  },
  factory: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/548ee91d-6717-49f1-917f-827280553153',
    label: 'factory',
  },
  'trading post': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/7ae1058d-6313-435b-a30a-fd1c1b2ac9ee',
    label: 'trading post',
  },
  // Water Bodies
  ocean: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/05abdf2e-d71d-4c3e-9125-e3eed855de10',
    label: 'ocean',
  },
  sea: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/1def21b2-fbe7-48e1-a236-f562dff99614',
    label: 'sea',
  },
  gulf: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/f4f67f28-f00c-4888-a286-f712d82aa9a2',
    label: 'gulf',
  },
  bay: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/6798ed1b-27a6-4113-9cd8-a78f68b94e7c',
    label: 'bay',
  },
  strait: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/46724d25-aa94-4848-a8ca-17fe02b0db2b',
    label: 'strait',
  },
  channel: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/1db49a35-5b65-406c-bd1e-6c56d5b649b9',
    label: 'channel',
  },
  river: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/cf7cc49f-738b-48b0-80a7-476244ba4919',
    label: 'river',
  },
  stream: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/b2cd216c-9533-449a-849d-1cbd3840a3d2',
    label: 'stream',
  },
  lake: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/7fce30ff-c0c2-4b6a-aab6-4f2cd2a2bf8e',
    label: 'lake',
  },
  canal: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/4c199e1f-806b-405d-8e19-c86bed78f44b',
    label: 'canal',
  },
  reservoir: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/b219dc73-8d54-4181-af77-0a927aa37038',
    label: 'reservoir',
  },
  'hot spring': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/76721ef1-2272-4f2b-a443-a7886d5c2307',
    label: 'hot spring',
  },
  // Landforms
  island: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/d8b4d9c6-11b3-430a-ba08-48eb1f3a8f56',
    label: 'island',
  },
  peninsula: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/422b34bb-dffe-4552-b1cd-f720d3efe4df',
    label: 'peninsula',
  },
  isthmus: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/975ea685-36be-4215-8758-2bb27ce47b18',
    label: 'isthmus',
  },
  cape: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/ea0cf4b3-3d82-4ff6-ad10-12e77f581218',
    label: 'cape',
  },
  point: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/50310cac-a6c2-4e9d-9162-ebaa073a9835',
    label: 'point',
  },
  coast: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/42bea596-3b26-4598-a894-5922ff137c7c',
    label: 'coast',
  },
  bank: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/bd0dfde6-0fb2-476b-ad5e-2f63ed7787ff',
    label: 'bank',
  },
  'pearl bank': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/6b7fbbae-8d7f-4fd1-bf49-9b4b7d2cb2e5',
    label: 'pearl bank',
  },
  mountain: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/617a0924-1516-4be8-a478-b451bf47f5bf',
    label: 'mountain',
  },
  hill: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/c1aab052-d89b-471f-a3ad-51c52cdffe2f',
    label: 'hill',
  },
  highland: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/102c5c4b-5272-42b0-ad22-7428c97367bf',
    label: 'highland',
  },
  plateau: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/9701db61-cd99-447b-96e4-1194539b40df',
    label: 'plateau',
  },
  // Regions
  continent: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/7006b73c-c2eb-4873-8393-5af701fae308',
    label: 'continent',
  },
  landschap: {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/d1f592cd-dec1-4f42-bb73-930ce816dfaf',
    label: 'landschap',
  },
};

function mapTypeToUri(type: string): { id: string; label: string } {
  const normalizedType = type.toLowerCase().trim();

  // Check direct mapping
  if (typeUriMap[normalizedType]) {
    return typeUriMap[normalizedType];
  }

  // Return placeholder for unmapped types
  return {
    id: `https://id.necessaryreunions.org/type/${normalizedType.replace(/\s+/g, '-')}`,
    label: type,
  };
}

// ============================================================================
// CSV PARSING
// ============================================================================

function readCSV<T>(filePath: string): T[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- csv-parse has correct types
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as T[];
  return records;
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function groupDataByGlobId(
  places: PlacesRow[],
  altLabels: AltLabelsRow[],
  placeTypes: PlaceTypesRow[],
  placeRelations: PlaceRelationRow[],
): Map<string, PlaceData> {
  const placeMap = new Map<string, PlaceData>();

  // Step 1: Load base place data
  for (const row of places) {
    if (!row.GLOB_ID || !row.PREF_LABEL) continue;

    placeMap.set(row.GLOB_ID, {
      globId: row.GLOB_ID,
      prefLabel: row.PREF_LABEL,
      prefLabelSource: row.PREF_LABEL_SOURCE,
      prefLabelSourcePage: row.PREF_LABEL_SOURCE_PAGE,
      prefLabelRemarks: row.PREF_LABEL_REMARKS,
      latitude: parseCoordinate(row.LATITUDE),
      longitude: parseCoordinate(row.LONGITUDE),
      coordCertainty: row.COORD_CERTAINTY,
      coordSource: row.COORD_SOURCE,
      coordSourcePage: row.COORD_SOURCE_PAGE,
      coordRemarks: row.COORD_REMARKS,
      ccodes: row.CCODES,
      externalIds: {
        geonames: row.GEONAMES_ID,
        wikidata: row.WIKIDATA_ID,
        amh: row.AMH_ID,
        tgn: row.TGN_ID,
        whg: row.WHG_ID,
      },
      overallRemarks: row.OVERALL_REMARKS,
      overallSource: row.OVERALL_SOURCE,
      overallSourcePage: row.OVERALL_SOURCE_PAGE,
      altLabels: [],
      types: [],
      relations: [],
    });
  }

  // Step 2: Add alternative labels
  for (const row of altLabels) {
    if (!row.GLOB_ID || !row.ALT_LABEL) continue;
    const place = placeMap.get(row.GLOB_ID);
    if (place) {
      place.altLabels.push({
        label: row.ALT_LABEL,
        source: row.ALT_LABEL_SOURCE,
        sourcePage: row.ALT_LABEL_SOURCE_PAGE,
        remark: row.ALT_LABEL_REMARK,
        remarkSource: row.ALT_LABEL_REMARK_SOURCE,
        remarkSourcePage: row.ALT_LABEL_REMARK_SOURCE_PAGE,
      });
    }
  }

  // Step 3: Add place types (include entries with just TYPE_REMARKS even if TYPE is empty)
  for (const row of placeTypes) {
    if (!row.GLOB_ID) continue;
    // Skip only if both TYPE and TYPE_REMARKS are empty
    if (!row.TYPE && !row.TYPE_REMARKS) continue;
    const place = placeMap.get(row.GLOB_ID);
    if (place) {
      place.types.push({
        type: row.TYPE || '', // Allow empty type if remarks exist
        source: row.SOURCE,
        remark: row.TYPE_REMARKS,
      });
    }
  }

  // Step 4: Add place relations
  for (const row of placeRelations) {
    if (!row.GLOB_ID) continue;
    const place = placeMap.get(row.GLOB_ID);
    if (place) {
      place.relations.push({
        relation: row.RELATION,
        relatedGlobId: row.RELATED_GLOB_ID,
        relatedPlace: row.RELATED_PLACE,
        remark: row.RELATION_REMARKS,
      });
    }
  }

  return placeMap;
}

function transformToLinkedArt(place: PlaceData): LinkedArtPlace {
  const result: LinkedArtPlace = {
    '@context': 'https://linked.art/ns/v1/linked-art.json',
    id: generatePlaceId(place.globId),
    type: 'Place',
    _label: place.prefLabel,
    glob_id: place.globId, // Include GLOB_ID
    classified_as: [],
    identified_by: [],
    referred_to_by: [],
  };

  // Build classified_as from types (only include entries with actual type values)
  if (place.types.length > 0) {
    result.classified_as = place.types
      .filter((typeEntry) => typeEntry.type && typeEntry.type.trim())
      .map((typeEntry) => {
        const typeInfo = mapTypeToUri(typeEntry.type);
        return {
          id: typeInfo.id,
          type: 'Type' as const,
          _label: typeInfo.label,
        };
      });
  }

  // Build identified_by array
  // 1. Preferred name
  result.identified_by.push({
    type: 'Name',
    content: place.prefLabel,
    classified_as: [
      {
        id: 'PREF',
        type: 'Type',
        _label: 'PREF',
      },
    ],
  });

  // 2. Alternative names
  for (const alt of place.altLabels) {
    result.identified_by.push({
      type: 'Name',
      content: alt.label,
      classified_as: [
        {
          id: 'ALT',
          type: 'Type',
          _label: 'ALT',
        },
      ],
    });
  }

  // 3. External identifiers
  const externalIdEntries = [
    { type: 'amh', value: place.externalIds.amh },
    { type: 'geonames', value: place.externalIds.geonames },
    { type: 'wikidata', value: place.externalIds.wikidata },
    { type: 'tgn', value: place.externalIds.tgn },
    { type: 'whg', value: place.externalIds.whg },
  ];

  for (const { type, value } of externalIdEntries) {
    if (value && value.trim()) {
      const formatted = formatExternalId(type, value);
      if (formatted) {
        result.identified_by.push({
          type: 'Identifier',
          content: formatted,
        });
      }
    }
  }

  // Build referred_to_by array (ALL REMARKS)
  const remarks: Array<{ context: string; content: string }> = [];

  // 1. PREF_LABEL remarks
  if (place.prefLabelRemarks && place.prefLabelRemarks.trim()) {
    remarks.push({
      context: 'PREF_LABEL',
      content: buildRemarksContent(
        'PREF_LABEL',
        place.prefLabelRemarks,
        place.prefLabelSource,
        place.prefLabelSourcePage,
      ),
    });
  }

  // 2. Coordinate remarks
  if (place.coordRemarks && place.coordRemarks.trim()) {
    remarks.push({
      context: 'COORD',
      content: buildRemarksContent(
        'COORD',
        place.coordRemarks,
        place.coordSource,
        place.coordSourcePage,
      ),
    });
  }

  // 3. Overall/context remarks
  if (place.overallRemarks && place.overallRemarks.trim()) {
    remarks.push({
      context: 'CONTEXT',
      content: buildRemarksContent(
        'CONTEXT',
        place.overallRemarks,
        place.overallSource,
        place.overallSourcePage,
      ),
    });
  }

  // 4. Alternative label remarks
  for (const alt of place.altLabels) {
    if (alt.remark && alt.remark.trim()) {
      remarks.push({
        context: 'ALT_LABEL',
        content: buildRemarksContent(
          `ALT_LABEL: ${alt.label}`,
          alt.remark,
          alt.source || alt.remarkSource,
          alt.sourcePage || alt.remarkSourcePage,
        ),
      });
    }
  }

  // 5. Type remarks (include even if type is empty but remark exists)
  for (const typeEntry of place.types) {
    if (typeEntry.remark && typeEntry.remark.trim()) {
      const typeLabel = typeEntry.type ? `TYPE: ${typeEntry.type}` : 'TYPE';
      remarks.push({
        context: 'TYPE',
        content: buildRemarksContent(
          typeLabel,
          typeEntry.remark,
          typeEntry.source,
        ),
      });
    }
  }

  // 6. Relation remarks
  for (const rel of place.relations) {
    if (rel.remark && rel.remark.trim()) {
      remarks.push({
        context: 'RELATION',
        content: buildRemarksContent(
          `RELATION: ${rel.relation} ${rel.relatedPlace || rel.relatedGlobId || ''}`,
          rel.remark,
        ),
      });
    }
  }

  // Add all remarks to referred_to_by following GLOBALISE structure
  for (const remark of remarks) {
    result.referred_to_by.push({
      type: 'LinguisticObject',
      classified_as: [
        {
          id: 'http://vocab.getty.edu/aat/300435416',
          type: 'Type',
          _label: 'Description',
          classified_as: [
            {
              id: 'http://vocab.getty.edu/aat/300418049',
              type: 'Type',
              _label: 'Brief Text',
            },
          ],
        },
      ],
      content: remark.content,
    });
  }

  // Build part_of array from relations
  const partOfRelations = place.relations.filter(
    (rel) => rel.relation === 'Part Of' && rel.relatedGlobId,
  );

  if (partOfRelations.length > 0) {
    result.part_of = partOfRelations.map((rel) => ({
      id: generatePlaceId(rel.relatedGlobId!),
      type: 'Place' as const,
      _label: rel.relatedPlace || rel.relatedGlobId || '',
      classified_as: [],
    }));
  }

  // Build defined_by (WKT POINT) and coord_certainty
  if (place.latitude !== undefined && place.longitude !== undefined) {
    result.defined_by = `POINT (${place.longitude} ${place.latitude})`;
    // Add coordinate certainty if available
    if (place.coordCertainty && place.coordCertainty.trim()) {
      result.coord_certainty = place.coordCertainty;
    }
  }

  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('Starting NeRu CSV to JSON conversion...\n');

  // Define file paths
  const dataDir = path.join(process.cwd(), 'public', 'neru');
  const placesPath = path.join(dataDir, 'Places Form - Meenu - places.csv');
  const altLabelsPath = path.join(
    dataDir,
    'Places Form - Meenu - altLabels.csv',
  );
  const placeTypesPath = path.join(
    dataDir,
    'Places Form - Meenu - placeTypes.csv',
  );
  const placeRelationPath = path.join(
    dataDir,
    'Places Form - Meenu - placeRelation.csv',
  );
  const outputPath = path.join(
    process.cwd(),
    'public',
    'neru-place-dataset.json',
  );

  // Read CSV files
  console.log('Reading CSV files...');
  const places = readCSV<PlacesRow>(placesPath);
  const altLabels = readCSV<AltLabelsRow>(altLabelsPath);
  const placeTypes = readCSV<PlaceTypesRow>(placeTypesPath);
  const placeRelations = readCSV<PlaceRelationRow>(placeRelationPath);

  console.log(`   Places: ${places.length} rows`);
  console.log(`   Alternative labels: ${altLabels.length} rows`);
  console.log(`   Place types: ${placeTypes.length} rows`);
  console.log(`   Place relations: ${placeRelations.length} rows\n`);

  // Group data by GLOB_ID
  console.log('Grouping data by GLOB_ID...');
  const placeMap = groupDataByGlobId(
    places,
    altLabels,
    placeTypes,
    placeRelations,
  );
  console.log(`   Created ${placeMap.size} place entries\n`);

  // Transform to Linked Art JSON
  console.log('Transforming to Linked Art JSON...');
  const linkedArtPlaces: LinkedArtPlace[] = [];

  // Process ALL places
  const allPlaces = Array.from(placeMap.values());
  console.log(`   Processing all ${allPlaces.length} entries\n`);

  for (const placeData of allPlaces) {
    try {
      const linkedArtPlace = transformToLinkedArt(placeData);
      linkedArtPlaces.push(linkedArtPlace);
      console.log(
        `   Transformed: ${placeData.globId} - ${placeData.prefLabel}`,
      );
    } catch (error) {
      console.error(`   Error transforming ${placeData.globId}:`, error);
    }
  }

  console.log(`\n   Transformed ${linkedArtPlaces.length} places\n`);

  // Generate statistics
  const stats = {
    totalPlaces: linkedArtPlaces.length,
    placesWithCoords: linkedArtPlaces.filter((p) => p.defined_by).length,
    placesWithTypes: linkedArtPlaces.filter((p) => p.classified_as.length > 0)
      .length,
    placesWithRelations: linkedArtPlaces.filter(
      (p) => p.part_of && p.part_of.length > 0,
    ).length,
    totalAltLabels: linkedArtPlaces.reduce(
      (sum, p) =>
        sum +
        p.identified_by.filter(
          (i) => i.type === 'Name' && i.classified_as?.[0]?.id === 'ALT',
        ).length,
      0,
    ),
    totalRemarks: linkedArtPlaces.reduce(
      (sum, p) => sum + p.referred_to_by.length,
      0,
    ),
    totalExternalIds: linkedArtPlaces.reduce(
      (sum, p) =>
        sum + p.identified_by.filter((i) => i.type === 'Identifier').length,
      0,
    ),
  };

  // Write output file
  console.log('Writing output file...');
  fs.writeFileSync(outputPath, JSON.stringify(linkedArtPlaces, null, 2));
  console.log(`   Written to ${outputPath}\n`);

  // Display statistics
  console.log('Transformation Statistics:');
  console.log(`   Total places: ${stats.totalPlaces}`);
  console.log(`   Places with coordinates: ${stats.placesWithCoords}`);
  console.log(`   Places with type classifications: ${stats.placesWithTypes}`);
  console.log(
    `   Places with hierarchical relations: ${stats.placesWithRelations}`,
  );
  console.log(`   Total alternative labels: ${stats.totalAltLabels}`);
  console.log(`   Total external identifiers: ${stats.totalExternalIds}`);
  console.log(`   Total remarks preserved: ${stats.totalRemarks}`);
  console.log('\nConversion complete!');
}

try {
  main();
} catch (error) {
  console.error('Error during conversion:', error);
  process.exit(1);
}
