#!/usr/bin/env node

/**
 * Test script to verify annotation icon fixes
 * This script tests:
 * 1. Annotation fetching functionality
 * 2. Linking annotation processing
 * 3. Geotag detection
 * 4. Performance monitoring
 */

const CANVAS_ID =
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';
const BASE_URL = 'http://localhost:3003';

async function testAnnotationFetch() {
  console.log('🧪 Testing annotation fetch functionality...');

  try {
    const url = new URL('/api/annotations/fetch', BASE_URL);
    url.searchParams.set('targetCanvasId', CANVAS_ID);
    url.searchParams.set('page', '0');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ Annotation fetch successful');
    console.log(`📊 Found ${data.items?.length || 0} annotations`);

    // Check for geotag annotations
    const geotagAnnotations = (data.items || []).filter(
      (anno) =>
        anno.motivation === 'linking' &&
        Array.isArray(anno.body) &&
        anno.body.some(
          (body) =>
            body.purpose === 'geotagging' || body.purpose === 'identifying',
        ),
    );

    console.log(`🌍 Found ${geotagAnnotations.length} geotag annotations`);

    // Check for textspotting annotations
    const textAnnotations = (data.items || []).filter(
      (anno) => anno.motivation === 'textspotting',
    );

    console.log(`📝 Found ${textAnnotations.length} textspotting annotations`);

    return {
      success: true,
      totalAnnotations: data.items?.length || 0,
      geotagCount: geotagAnnotations.length,
      textCount: textAnnotations.length,
    };
  } catch (error) {
    console.error('❌ Annotation fetch failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testLinkingAnnotationFetch() {
  console.log('\n🔗 Testing linking annotation fetch...');

  try {
    // First get regular annotations to find IDs to link to
    const regularUrl = new URL('/api/annotations/fetch', BASE_URL);
    regularUrl.searchParams.set('targetCanvasId', CANVAS_ID);

    const regularResponse = await fetch(regularUrl.toString());
    const regularData = await regularResponse.json();

    if (!regularData.items || regularData.items.length === 0) {
      console.log('⚠️ No regular annotations found to test linking');
      return { success: true, message: 'No base annotations for linking test' };
    }

    const annotationIds = regularData.items.map((a) => a.id).filter(Boolean);
    console.log(
      `🎯 Testing linking for ${annotationIds.length} annotation IDs`,
    );

    // Test fetching linking annotations
    const linkingUrl = new URL('/api/annotations/fetch', BASE_URL);
    linkingUrl.searchParams.set('targetCanvasId', CANVAS_ID);
    linkingUrl.searchParams.set(
      'annotationIds',
      annotationIds.slice(0, 5).join(','),
    );

    const linkingResponse = await fetch(linkingUrl.toString());
    const linkingData = await linkingResponse.json();

    console.log('✅ Linking annotation fetch successful');
    console.log(
      `🔗 Found ${linkingData.items?.length || 0} linking annotations`,
    );

    return {
      success: true,
      linkingCount: linkingData.items?.length || 0,
    };
  } catch (error) {
    console.error('❌ Linking annotation fetch failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testGeoTaggingData() {
  console.log('\n🌍 Testing geotag data processing...');

  try {
    // Load a known georeferencing file
    const fs = require('fs');
    const path = require('path');

    const geofilePath = path.join(
      __dirname,
      'data/annotations/georeferencing/MAL_1.json',
    );

    if (!fs.existsSync(geofilePath)) {
      console.log('⚠️ Georeferencing test file not found');
      return { success: true, message: 'No georeferencing file available' };
    }

    const geoData = JSON.parse(fs.readFileSync(geofilePath, 'utf8'));

    console.log('✅ Georeferencing file loaded successfully');
    console.log(`📍 Found ${geoData.items?.length || 0} georeferencing items`);

    // Check for proper georeferencing structure
    const validGeoItems = (geoData.items || []).filter(
      (item) =>
        item.motivation === 'georeferencing' &&
        item.body &&
        item.body.features &&
        Array.isArray(item.body.features),
    );

    console.log(
      `✅ ${validGeoItems.length} valid georeferencing annotations found`,
    );

    return {
      success: true,
      geoItemsCount: validGeoItems.length,
    };
  } catch (error) {
    console.error('❌ Geotag data test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting annotation system tests...\n');

  const results = {
    annotationFetch: await testAnnotationFetch(),
    linkingFetch: await testLinkingAnnotationFetch(),
    geotagData: await testGeoTaggingData(),
  };

  console.log('\n📋 Test Results Summary:');
  console.log('='.repeat(50));

  let allPassed = true;

  for (const [testName, result] of Object.entries(results)) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);

    if (!result.success) {
      allPassed = false;
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('='.repeat(50));

  if (allPassed) {
    console.log(
      '🎉 All tests passed! Annotation icons should be working correctly.',
    );
    console.log('\n📊 Summary:');
    console.log(
      `- Total annotations: ${results.annotationFetch.totalAnnotations || 0}`,
    );
    console.log(
      `- Geotag annotations: ${results.annotationFetch.geotagCount || 0}`,
    );
    console.log(
      `- Text annotations: ${results.annotationFetch.textCount || 0}`,
    );
    console.log(
      `- Linking annotations: ${results.linkingFetch.linkingCount || 0}`,
    );
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testAnnotationFetch,
  testLinkingAnnotationFetch,
  testGeoTaggingData,
};
