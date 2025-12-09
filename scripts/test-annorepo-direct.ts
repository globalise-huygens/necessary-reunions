#!/usr/bin/env ts-node

/**
 * Test direct AnnoRepo access to debug production issue
 * Tests both with and without authentication
 */

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

// Sample canvas from production logs
const TEST_CANVAS_ID =
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';

function encodeCanvasUri(uri: string): string {
  return Buffer.from(uri).toString('base64');
}

async function testAnnoRepoAccess(withAuth: boolean = false) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(
    `Testing AnnoRepo ${withAuth ? 'WITH' : 'WITHOUT'} authentication`,
  );
  console.log('='.repeat(80));

  const encoded = encodeCanvasUri(TEST_CANVAS_ID);
  const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded}`;
  const url = new URL(endpoint);
  url.searchParams.set('page', '0');

  console.log('\n📋 Request Details:');
  console.log(`Canvas ID: ${TEST_CANVAS_ID}`);
  console.log(`Encoded: ${encoded.substring(0, 60)}...`);
  console.log(`Full URL: ${url.toString()}`);

  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (withAuth && process.env.ANNO_REPO_TOKEN_JONA) {
    headers.Authorization = `Bearer ${process.env.ANNO_REPO_TOKEN_JONA}`;
    console.log(
      `✅ Using auth token (length: ${process.env.ANNO_REPO_TOKEN_JONA.length})`,
    );
  } else if (withAuth) {
    console.log('❌ Auth requested but ANNO_REPO_TOKEN_JONA not found');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const startTime = Date.now();
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });
    const duration = Date.now() - startTime;

    clearTimeout(timeoutId);

    console.log(`\n📊 Response (${duration}ms):`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ Error Response:`);
      console.error(errorText.substring(0, 500));
      return;
    }

    const data = await response.json();

    console.log(`\n✅ Success:`);
    console.log(
      `Items: ${Array.isArray(data.items) ? data.items.length : 'N/A'}`,
    );
    console.log(`Has More: ${data.next ? 'Yes' : 'No'}`);
    console.log(`Data keys: ${Object.keys(data).join(', ')}`);

    if (data.items && data.items.length > 0) {
      const firstItem = data.items[0];
      console.log(`\n📝 First annotation:`);
      console.log(`  ID: ${firstItem.id}`);
      console.log(`  Type: ${firstItem.type}`);
      console.log(`  Motivation: ${firstItem.motivation}`);
      console.log(`  Has target: ${!!firstItem.target}`);
      console.log(`  Has body: ${!!firstItem.body}`);

      if (firstItem.target?.selector) {
        const selector = firstItem.target.selector;
        if (Array.isArray(selector)) {
          console.log(`  Selector: array with ${selector.length} items`);
          console.log(
            `  Types: ${selector.map((s: any) => s.type).join(', ')}`,
          );
        } else {
          console.log(`  Selector type: ${selector.type}`);
        }
      }
    } else {
      console.log(`\n⚠️  No items in response`);
      console.log(
        `Full response structure: ${JSON.stringify(data, null, 2).substring(0, 500)}`,
      );
    }
  } catch (error) {
    console.error(`\n❌ Exception:`);
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timed out after 10 seconds');
    }
  }
}

async function main() {
  console.log('🔍 Direct AnnoRepo Access Test\n');
  console.log(
    'This script tests whether AnnoRepo returns data with/without auth',
  );

  // Test without auth
  await testAnnoRepoAccess(false);

  // Test with auth
  await testAnnoRepoAccess(true);

  console.log(`\n${'='.repeat(80)}`);
  console.log('✨ Test complete');
  console.log('\nNext steps:');
  console.log(
    '1. If WITHOUT auth returns 0 items but WITH auth returns items:',
  );
  console.log(
    '   → Check Netlify environment variables (ANNO_REPO_TOKEN_JONA)',
  );
  console.log('2. If both return 0 items:');
  console.log('   → AnnoRepo may not have data for this canvas');
  console.log('   → Try a different canvas ID');
  console.log('3. If both return items:');
  console.log('   → Issue is in Next.js API route or client-side code');
}

main().catch(console.error);
