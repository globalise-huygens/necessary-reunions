# NeRu Place Data

This folder contains the source CSV files for the Necessary Reunions (NeRu) place dataset.

## Source Files

The dataset consists of four CSV files:

- `Places Form - Meenu - places.csv` - Main places data with coordinates and metadata
- `Places Form - Meenu - altLabels.csv` - Alternative labels/names for places
- `Places Form - Meenu - placeTypes.csv` - Place type classifications
- `Places Form - Meenu - placeRelation.csv` - Hierarchical relationships between places

Additionally:

- `COMPLETED Suggested Organization of place types - Suggestion.csv` - PoolParty thesaurus mapping for place types

## Automatic Conversion

When you modify or add CSV files in this folder, a GitHub Actions workflow automatically:

1. Runs the conversion script (`data/scripts/convert-neru-to-json.ts`)
2. Generates updated `public/neru-place-dataset.json`
3. Commits the changes back to your branch

This ensures the JSON dataset is always synchronized with the CSV sources.

## Manual Conversion

To manually run the conversion script locally:

```bash
pnpm tsx data/scripts/convert-neru-to-json.ts
```

## Data Structure

The output JSON follows the Linked Art format and includes:

- Place identifiers and labels
- PoolParty thesaurus URIs for type classifications
- Alternative names and external identifiers (Wikidata, GeoNames, etc.)
- Coordinates with certainty indicators
- Hierarchical relationships
- Contextual remarks from all source fields

## Adding New Places

To add new places:

1. Edit the relevant CSV files in this folder
2. Ensure GLOB_ID values are unique and consistent across files
3. Commit and push your changes
4. The GitHub Actions workflow will automatically generate the updated JSON

## PoolParty Type Mapping

Place types are mapped to GLOBALISE PoolParty thesaurus URIs. The mapping includes ~100 place types across categories:

- Political Administrative Bodies (kingdom, city, village, province, etc.)
- Settlements (coastal settlement, port, town, etc.)
- Buildings & Structures (temple, church, fort, factory, etc.)
- Water Bodies (river, ocean, bay, strait, etc.)
- Landforms (island, mountain, cape, point, etc.)

Unmapped types will use a placeholder URI.
