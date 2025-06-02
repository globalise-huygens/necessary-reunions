#!/usr/bin/env node

// Test script to verify the annotation loading fixes

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';
const QUERY_NAME = 'with-target';

// Test canvas URI from the manifest
const testCanvasUri = 'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';

function encodeCanvasUri(uri) {
  const base64 = Buffer.from(uri).toString('base64');
  console.log('Original URI:', uri);
  console.log('Base64 encoded:', base64);

  // URL encode the Base64 string to handle special characters safely
  const urlEncoded = encodeURIComponent(base64);
  console.log('URL encoded Base64:', urlEncoded);

  return urlEncoded;
}

async function testAnnotationFetch() {
  try {
    const encodedCanvas = encodeCanvasUri(testCanvasUri);
    const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encodedCanvas}`;
    const url = new URL(endpoint);
    url.searchParams.set('page', '0');

    console.log('\nTesting API endpoint:');
    console.log(url.toString());

    const response = await fetch(url.toString());

    console.log('\nResponse status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text().catch(() => '[no body]');
      console.error('API Error:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('\nResponse data:');
    console.log('Items count:', data.items?.length || 0);
    console.log('Has more pages:', !!data.next);
    console.log('First few items:', data.items?.slice(0, 3).map(item => ({
      id: item.id,
      motivation: item.motivation
    })));

    return true;
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('=== Testing Annotation Loading Fix ===\n');

  const success = await testAnnotationFetch();

  if (success) {
    console.log('\n✅ Test PASSED: Annotation loading is working correctly!');
  } else {
    console.log('\n❌ Test FAILED: Annotation loading still has issues.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
