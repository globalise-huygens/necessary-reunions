// Performance test script to validate optimizations
// Run this with: node performance-test.js

const CANVAS_ID =
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1';

async function testAnnotationLoading() {
  console.log('🚀 Testing annotation loading performance...');

  const startTime = Date.now();

  try {
    // Test the external API endpoint
    const response = await fetch(
      `http://localhost:3000/api/annotations/external?targetCanvasId=${encodeURIComponent(
        CANVAS_ID,
      )}&page=0`,
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const loadTime = Date.now() - startTime;

    console.log(
      `✅ Loaded ${data.items?.length || 0} annotations in ${loadTime}ms`,
    );
    console.log(
      `📊 Performance: ${
        data.items?.length
          ? Math.round((data.items.length / loadTime) * 1000)
          : 0
      } annotations/second`,
    );

    return { success: true, loadTime, count: data.items?.length || 0 };
  } catch (error) {
    console.error('❌ Failed to load annotations:', error);
    return { success: false, error: error.message };
  }
}

async function testBulkLinkingPerformance() {
  console.log('🔗 Testing bulk linking performance...');

  const startTime = Date.now();

  try {
    const response = await fetch(
      `http://localhost:3000/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
        CANVAS_ID,
      )}`,
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const loadTime = Date.now() - startTime;

    console.log(
      `✅ Loaded ${
        data.annotations?.length || 0
      } linking annotations in ${loadTime}ms`,
    );
    console.log(
      `📊 Icon states computed for ${
        Object.keys(data.iconStates || {}).length
      } annotations`,
    );

    return { success: true, loadTime, count: data.annotations?.length || 0 };
  } catch (error) {
    console.error('❌ Failed to load linking annotations:', error);
    return { success: false, error: error.message };
  }
}

async function runPerformanceTests() {
  console.log('🎯 Running performance optimization tests...\n');

  // Test 1: Annotation loading
  const annotationTest = await testAnnotationLoading();

  // Test 2: Bulk linking
  const linkingTest = await testBulkLinkingPerformance();

  // Summary
  console.log('\n📈 Performance Summary:');
  console.log('================================');

  if (annotationTest.success) {
    console.log(
      `✅ Annotation Loading: ${annotationTest.loadTime}ms (${annotationTest.count} items)`,
    );
  } else {
    console.log(`❌ Annotation Loading: FAILED - ${annotationTest.error}`);
  }

  if (linkingTest.success) {
    console.log(
      `✅ Linking Data: ${linkingTest.loadTime}ms (${linkingTest.count} items)`,
    );
  } else {
    console.log(`❌ Linking Data: FAILED - ${linkingTest.error}`);
  }

  const totalTime =
    (annotationTest.loadTime || 0) + (linkingTest.loadTime || 0);
  console.log(`\n🏁 Total Load Time: ${totalTime}ms`);

  if (totalTime < 2000) {
    console.log('🎉 EXCELLENT performance - under 2 seconds!');
  } else if (totalTime < 5000) {
    console.log('👍 GOOD performance - under 5 seconds');
  } else {
    console.log('⚠️  Performance could be improved - over 5 seconds');
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = {
  testAnnotationLoading,
  testBulkLinkingPerformance,
  runPerformanceTests,
};
