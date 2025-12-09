#!/usr/bin/env tsx

/**
 * Test the /api/annotations/external route directly
 * to see what it returns and debug server-side issues
 */

const TEST_CANVAS_ID =
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

async function testApiRoute() {
  console.log('🧪 Testing /api/annotations/external route\n');
  console.log('Base URL:', BASE_URL);
  console.log('Canvas ID:', TEST_CANVAS_ID);
  console.log('='.repeat(80));

  const url = new URL('/api/annotations/external', BASE_URL);
  url.searchParams.set('targetCanvasId', TEST_CANVAS_ID);
  url.searchParams.set('page', '0');

  console.log('\n📡 Request URL:', url.toString());

  try {
    const startTime = Date.now();
    const response = await fetch(url.toString());
    const duration = Date.now() - startTime;

    console.log(`\n⏱️  Response time: ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ Error response:');
      console.error(errorText);
      return;
    }

    const data = await response.json();

    console.log('\n✅ Response data:');
    console.log('Items count:', data.items?.length || 0);
    console.log('Has more:', data.hasMore);

    if (data.debug) {
      console.log('\n🔍 Debug info from server:');
      console.log('  Canvas ID:', data.debug.canvasId);
      console.log('  Encoded (first 100 chars):', data.debug.encoded);
      console.log('  Full endpoint:', data.debug.endpoint);
      console.log('  Has auth token:', data.debug.hasAuthToken);
      console.log('  Response keys:', data.debug.responseKeys);
      console.log('  Response status:', data.debug.responseStatus);
    }

    if (data.items && data.items.length > 0) {
      console.log('\n📝 First annotation:');
      const first = data.items[0];
      console.log('  ID:', first.id);
      console.log('  Motivation:', first.motivation);
      console.log('  Has target:', !!first.target);
      console.log('  Has body:', !!first.body);
    } else {
      console.log('\n⚠️  No items returned');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }

  console.log('\n' + '='.repeat(80));
}

console.log('Starting API route test...');
console.log('Make sure the dev server is running: pnpm dev\n');

testApiRoute().catch(console.error);
