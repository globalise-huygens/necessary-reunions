#!/usr/bin/env tsx
/**
 * Bootstrap the Suriname Time Machine AnnoRepo instance
 *
 * Steps performed:
 * 1. Create a user for API access
 * 2. Create the "suriname-time-machine" container
 * 3. Register custom queries (with-target, with-target-and-motivation-or-purpose)
 * 4. Add search indexes for performance
 * 5. Download ~293 annotation files from the Suriname IIIF GitHub repo
 * 6. Upload annotations in batches to the container
 *
 * Prerequisites:
 * - AnnoRepo server at annorepo.surinametijdmachine.org must be accessible
 * - Root API key must be set in SURINAME_ROOT_API_KEY env var or .env.local
 *
 * Usage:
 *   npx tsx scripts/setup-suriname-annorepo.ts
 *   npx tsx scripts/setup-suriname-annorepo.ts --skip-upload    # Setup only, no annotations
 *   npx tsx scripts/setup-suriname-annorepo.ts --upload-only    # Upload annotations only
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local if present
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const BASE_URL = 'https://annorepo.surinametijdmachine.org';
const CONTAINER_NAME = 'suriname-time-machine';
const ROOT_API_KEY =
  process.env.SURINAME_ROOT_API_KEY ||
  process.env.SURINAME_ANNOREPO_TOKEN ||
  '';
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/SurinameTimeMachine/iiif-suriname/main/annotations/iiif';
const TOTAL_CANVASES = 293;
const BATCH_SIZE = 50;
const CONCURRENT_DOWNLOADS = 10;

if (!ROOT_API_KEY) {
  console.error(
    'Error: SURINAME_ROOT_API_KEY or SURINAME_ANNOREPO_TOKEN not set',
  );
  console.error('Set it in .env.local or as an environment variable');
  process.exit(1);
}

const args = process.argv.slice(2);
const skipUpload = args.includes('--skip-upload');
const uploadOnly = args.includes('--upload-only');

interface AnnoRepoAnnotation {
  '@context'?: string;
  type: string;
  id?: string;
  motivation?: string;
  body?: unknown;
  target?: unknown;
  [key: string]: unknown;
}

async function apiCall(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${ROOT_API_KEY}`,
      ...options.headers,
    },
  });
  return response;
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/about`);
    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>;
      console.log(`  AnnoRepo version: ${data.version ?? 'unknown'}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function createUser(): Promise<string | null> {
  console.log('\n--- Creating API user ---');

  const response = await apiCall('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'suriname-app' }),
  });

  if (response.ok) {
    const data = (await response.json()) as { apiKey?: string };
    console.log('  User "suriname-app" created');
    if (data.apiKey) {
      console.log(`  API key: ${data.apiKey}`);
      console.log(
        '  IMPORTANT: Save this key as SURINAME_ANNOREPO_TOKEN in .env.local',
      );
      return data.apiKey;
    }
    return null;
  }

  if (response.status === 409) {
    console.log('  User "suriname-app" already exists');
    return null;
  }

  console.error(
    `  Failed to create user: ${response.status} ${response.statusText}`,
  );
  const text = await response.text().catch(() => '');
  if (text) console.error(`  Response: ${text}`);
  return null;
}

async function createContainer(): Promise<boolean> {
  console.log('\n--- Creating container ---');

  const response = await apiCall('/w3c/', {
    method: 'POST',
    headers: {
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Slug: CONTAINER_NAME,
    },
    body: JSON.stringify({
      '@context': [
        'http://www.w3.org/ns/anno.jsonld',
        'http://www.w3.org/ns/ldp.jsonld',
      ],
      type: ['BasicContainer', 'AnnotationCollection'],
      label: 'Suriname Time Machine annotations',
    }),
  });

  if (response.ok || response.status === 201) {
    console.log(`  Container "${CONTAINER_NAME}" created`);
    return true;
  }

  if (response.status === 409) {
    console.log(`  Container "${CONTAINER_NAME}" already exists`);
    return true;
  }

  console.error(
    `  Failed to create container: ${response.status} ${response.statusText}`,
  );
  const text = await response.text().catch(() => '');
  if (text) console.error(`  Response: ${text}`);
  return false;
}

async function registerCustomQueries(): Promise<void> {
  console.log('\n--- Registering custom queries ---');

  const queries = [
    {
      name: 'with-target',
      description: 'Find annotations by target canvas',
    },
    {
      name: 'with-target-and-motivation-or-purpose',
      description: 'Find annotations by target and motivation/purpose',
    },
  ];

  for (const query of queries) {
    const response = await apiCall(
      `/services/${CONTAINER_NAME}/custom-query/${query.name}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: query.name,
          description: query.description,
        }),
      },
    );

    if (response.ok || response.status === 200 || response.status === 201) {
      console.log(`  Registered query: ${query.name}`);
    } else if (response.status === 409) {
      console.log(`  Query "${query.name}" already exists`);
    } else {
      console.warn(
        `  Warning: Could not register query "${query.name}": ${response.status}`,
      );
    }
  }
}

async function addIndexes(): Promise<void> {
  console.log('\n--- Adding search indexes ---');

  const indexes = [
    { field: 'target', type: 'Text' },
    { field: 'motivation', type: 'Text' },
    { field: 'body.purpose', type: 'Text' },
  ];

  for (const index of indexes) {
    const response = await apiCall(`/services/${CONTAINER_NAME}/indexes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(index),
    });

    if (response.ok || response.status === 201) {
      console.log(`  Index on "${index.field}" created`);
    } else if (response.status === 409) {
      console.log(`  Index on "${index.field}" already exists`);
    } else {
      console.warn(
        `  Warning: Could not create index on "${index.field}": ${response.status}`,
      );
    }
  }
}

async function downloadAnnotationFile(
  canvasNum: number,
): Promise<AnnoRepoAnnotation[] | null> {
  const url = `${GITHUB_RAW_BASE}/c${canvasNum}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(
          `  Warning: Failed to download c${canvasNum}.json: ${response.status}`,
        );
      }
      return null;
    }

    const data = (await response.json()) as {
      items?: AnnoRepoAnnotation[];
      resources?: AnnoRepoAnnotation[];
    };

    // IIIF AnnotationPage format
    const items = data.items || data.resources || [];
    return items;
  } catch (error) {
    console.warn(
      `  Warning: Error downloading c${canvasNum}.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function uploadAnnotationsBatch(
  annotations: AnnoRepoAnnotation[],
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Use batch endpoint if available, otherwise individual uploads
  const batchEndpoint = `/services/${CONTAINER_NAME}/annotations-batch`;
  const batchResponse = await apiCall(batchEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      annotations.map((a) => {
        // Remove @context and id for upload (AnnoRepo assigns new IDs)
        const { '@context': _ctx, id: _id, ...rest } = a;
        return rest;
      }),
    ),
  });

  if (batchResponse.ok) {
    success = annotations.length;
    return { success, failed };
  }

  // Fallback to individual uploads
  for (const annotation of annotations) {
    try {
      const { '@context': _ctx, id: _id, ...body } = annotation;
      const response = await apiCall(`/w3c/${CONTAINER_NAME}/`, {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
        body: JSON.stringify(body),
      });

      if (response.ok || response.status === 201) {
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

async function uploadAllAnnotations(): Promise<void> {
  console.log('\n--- Downloading and uploading annotations ---');
  console.log(`  Source: ${GITHUB_RAW_BASE}`);
  console.log(`  Canvas files: c1.json through c${TOTAL_CANVASES}.json`);

  let totalDownloaded = 0;
  let totalUploaded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Process in batches of concurrent downloads
  for (let start = 1; start <= TOTAL_CANVASES; start += CONCURRENT_DOWNLOADS) {
    const end = Math.min(start + CONCURRENT_DOWNLOADS - 1, TOTAL_CANVASES);
    const canvasNums = Array.from(
      { length: end - start + 1 },
      (_, i) => start + i,
    );

    // Download batch concurrently
    const downloadResults = await Promise.all(
      canvasNums.map((num) => downloadAnnotationFile(num)),
    );

    // Collect all annotations from this batch
    const batchAnnotations: AnnoRepoAnnotation[] = [];
    for (let i = 0; i < downloadResults.length; i++) {
      const items = downloadResults[i];
      if (items && items.length > 0) {
        totalDownloaded += items.length;
        batchAnnotations.push(...items);
      } else if (items === null) {
        totalSkipped++;
      }
    }

    // Upload collected annotations in sub-batches
    for (let j = 0; j < batchAnnotations.length; j += BATCH_SIZE) {
      const subBatch = batchAnnotations.slice(j, j + BATCH_SIZE);
      const result = await uploadAnnotationsBatch(subBatch);
      totalUploaded += result.success;
      totalFailed += result.failed;
    }

    // Progress update
    const progress = Math.min(100, Math.round((end / TOTAL_CANVASES) * 100));
    process.stdout.write(
      `\r  Progress: ${progress}% (downloaded: ${totalDownloaded}, uploaded: ${totalUploaded}, failed: ${totalFailed})`,
    );
  }

  console.log('\n');
  console.log('  Upload complete:');
  console.log(`    Downloaded: ${totalDownloaded} annotations`);
  console.log(`    Uploaded:   ${totalUploaded} annotations`);
  console.log(`    Failed:     ${totalFailed} annotations`);
  console.log(`    Skipped:    ${totalSkipped} canvas files (empty/missing)`);
}

async function main(): Promise<void> {
  console.log('=== Suriname Time Machine AnnoRepo Bootstrap ===');
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Container: ${CONTAINER_NAME}`);

  // Health check
  console.log('\n--- Health check ---');
  const healthy = await checkServerHealth();
  if (!healthy) {
    console.error('  AnnoRepo server is not accessible');
    process.exit(1);
  }
  console.log('  Server is healthy');

  if (!uploadOnly) {
    // Create user
    const apiKey = await createUser();
    if (apiKey) {
      console.log('\n  Add to .env.local: SURINAME_ANNOREPO_TOKEN=' + apiKey);
    }

    // Create container
    const containerCreated = await createContainer();
    if (!containerCreated) {
      console.error('\n  Cannot proceed without container');
      process.exit(1);
    }

    // Register custom queries
    await registerCustomQueries();

    // Add indexes
    await addIndexes();
  }

  if (!skipUpload) {
    await uploadAllAnnotations();
  }

  console.log('\n=== Bootstrap complete ===');
  if (skipUpload) {
    console.log(
      '  Annotations were not uploaded. Run with --upload-only to upload them later.',
    );
  }
}

main().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
