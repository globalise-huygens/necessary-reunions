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

import fs from 'fs';
import path from 'path';
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
      const geonamesId = value.replace(/^https?:\/\/.*geonames\.org\//, '').split('/')[0];
      return `https://geonames.org/${geonamesId}`;
    case 'wikidata':
      // Already full URL or Q-id
      return value.startsWith('http') ? value : `https://www.wikidata.org/wiki/${value}`;
    case 'amh':
    case 'whg':
      return value;
    case 'tgn':
      return value.startsWith('http') ? value : `http://vocab.getty.edu/tgn/${value}`;
    default:
      return value;
  }
}

function buildRemarksContent(context: string, remarks?: string, source?: string, sourcePage?: string): string {
  let content = `[${context}] ${remarks || ''}`;
  
  if (source || sourcePage) {
    const sourceInfo = [source, sourcePage ? `p. ${sourcePage}` : ''].filter(Boolean).join(', ');
    content += `. Source: ${sourceInfo}`;
  }
  
  return content.trim();
}

// Type mapping to PoolParty URIs (based on GLOBALISE thesaurus)
const TYPE_URI_MAP: Record<string, { id: string; label: string }> = {
  'kingdom': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/koninkrijken-kingdoms',
    label: 'koninkrijken / kingdoms'
  },
  'city': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/20d7cfe7-b3b1-4223-b2b4-d9f6ddb2e683',
    label: 'steden / cities'
  },
  'village': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/d4dafba3-2344-4f5a-a94d-ed988069d0e5',
    label: 'dorpen / villages'
  },
  'port': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/93a0b2c9-ad9a-4bab-8620-11b5c1e01f37',
    label: 'havenplaats / port (settlement)'
  },
  'temple': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/tempels-temples',
    label: 'tempels / temples'
  },
  'church': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/kerken-churches',
    label: 'kerken / churches'
  },
  'fort': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/forten-forts',
    label: 'forten / forts'
  },
  'island': {
    id: 'https://digitaalerfgoed.poolparty.biz/globalise/eilanden-islands',
    label: 'eilanden / islands'
  }
};

function mapTypeToUri(type: string): { id: string; label: string } {
  const normalizedType = type.toLowerCase().trim();
  
  // Check direct mapping
  if (TYPE_URI_MAP[normalizedType]) {
    return TYPE_URI_MAP[normalizedType];
  }
  
  // Return placeholder for unmapped types
  return {
    id: `https://id.necessaryreunions.org/type/${normalizedType.replace(/\s+/g, '-')}`,
    label: type
  };
}

// ============================================================================
// CSV PARSING
// ============================================================================

function readCSV<T>(filePath: string): T[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  return records;
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

function groupDataByGlobId(
  places: PlacesRow[],
  altLabels: AltLabelsRow[],
  placeTypes: PlaceTypesRow[],
  placeRelations: PlaceRelationRow[]
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

  // Step 3: Add place types
  for (const row of placeTypes) {
    if (!row.GLOB_ID || !row.TYPE) continue;
    const place = placeMap.get(row.GLOB_ID);
    if (place) {
      place.types.push({
        type: row.TYPE,
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
    classified_as: [],
    identified_by: [],
    referred_to_by: [],
  };

  // Build classified_as from types
  if (place.types.length > 0) {
    result.classified_as = place.types.map(typeEntry => {
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
        place.prefLabelSourcePage
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
        place.coordSourcePage
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
        place.overallSourcePage
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
          alt.sourcePage || alt.remarkSourcePage
        ),
      });
    }
  }

  // 5. Type remarks
  for (const typeEntry of place.types) {
    if (typeEntry.remark && typeEntry.remark.trim()) {
      remarks.push({
        context: 'TYPE',
        content: buildRemarksContent(
          `TYPE: ${typeEntry.type}`,
          typeEntry.remark,
          typeEntry.source
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
          rel.remark
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
    rel => rel.relation === 'Part Of' && rel.relatedGlobId
  );

  if (partOfRelations.length > 0) {
    result.part_of = partOfRelations.map(rel => ({
      id: generatePlaceId(rel.relatedGlobId!),
      type: 'Place' as const,
      _label: rel.relatedPlace || rel.relatedGlobId || '',
      classified_as: [],
    }));
  }

  // Build defined_by (WKT POINT)
  if (place.latitude !== undefined && place.longitude !== undefined) {
    result.defined_by = `POINT (${place.longitude} ${place.latitude})`;
  }

  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🔄 Starting NeRu CSV to JSON conversion...\n');

  // Define file paths
  const dataDir = path.join(process.cwd(), 'public', 'neru');
  const placesPath = path.join(dataDir, 'Places Form - Meenu - places.csv');
  const altLabelsPath = path.join(dataDir, 'Places Form - Meenu - altLabels.csv');
  const placeTypesPath = path.join(dataDir, 'Places Form - Meenu - placeTypes.csv');
  const placeRelationPath = path.join(dataDir, 'Places Form - Meenu - placeRelation.csv');
  const outputPath = path.join(process.cwd(), 'public', 'neru-place-dataset.json');

  // Read CSV files
  console.log('📖 Reading CSV files...');
  const places = readCSV<PlacesRow>(placesPath);
  const altLabels = readCSV<AltLabelsRow>(altLabelsPath);
  const placeTypes = readCSV<PlaceTypesRow>(placeTypesPath);
  const placeRelations = readCSV<PlaceRelationRow>(placeRelationPath);

  console.log(`   ✓ Places: ${places.length} rows`);
  console.log(`   ✓ Alternative labels: ${altLabels.length} rows`);
  console.log(`   ✓ Place types: ${placeTypes.length} rows`);
  console.log(`   ✓ Place relations: ${placeRelations.length} rows\n`);

  // Group data by GLOB_ID
  console.log('🔗 Grouping data by GLOB_ID...');
  const placeMap = groupDataByGlobId(places, altLabels, placeTypes, placeRelations);
  console.log(`   ✓ Created ${placeMap.size} place entries\n`);

  // Transform to Linked Art JSON
  console.log('🔄 Transforming to Linked Art JSON...');
  const linkedArtPlaces: LinkedArtPlace[] = [];
  
  for (const placeData of placeMap.values()) {
    try {
      const linkedArtPlace = transformToLinkedArt(placeData);
      linkedArtPlaces.push(linkedArtPlace);
    } catch (error) {
      console.error(`   ⚠️  Error transforming ${placeData.globId}: ${error}`);
    }
  }

  console.log(`   ✓ Transformed ${linkedArtPlaces.length} places\n`);

  // Generate statistics
  const stats = {
    totalPlaces: linkedArtPlaces.length,
    placesWithCoords: linkedArtPlaces.filter(p => p.defined_by).length,
    placesWithTypes: linkedArtPlaces.filter(p => p.classified_as.length > 0).length,
    placesWithRelations: linkedArtPlaces.filter(p => p.part_of && p.part_of.length > 0).length,
    totalAltLabels: linkedArtPlaces.reduce(
      (sum, p) => sum + p.identified_by.filter(i => i.type === 'Name' && i.classified_as?.[0]?.id === 'ALT').length,
      0
    ),
    totalRemarks: linkedArtPlaces.reduce((sum, p) => sum + p.referred_to_by.length, 0),
    totalExternalIds: linkedArtPlaces.reduce(
      (sum, p) => sum + p.identified_by.filter(i => i.type === 'Identifier').length,
      0
    ),
  };

  // Write output file
  console.log('💾 Writing output file...');
  fs.writeFileSync(outputPath, JSON.stringify(linkedArtPlaces, null, 2));
  console.log(`   ✓ Written to ${outputPath}\n`);

  // Display statistics
  console.log('📊 Transformation Statistics:');
  console.log(`   • Total places: ${stats.totalPlaces}`);
  console.log(`   • Places with coordinates: ${stats.placesWithCoords}`);
  console.log(`   • Places with type classifications: ${stats.placesWithTypes}`);
  console.log(`   • Places with hierarchical relations: ${stats.placesWithRelations}`);
  console.log(`   • Total alternative labels: ${stats.totalAltLabels}`);
  console.log(`   • Total external identifiers: ${stats.totalExternalIds}`);
  console.log(`   • Total remarks preserved: ${stats.totalRemarks}`);
  console.log('\n✅ Conversion complete!');
}

main().catch(error => {
  console.error('❌ Error during conversion:', error);
  process.exit(1);
});
