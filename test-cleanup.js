#!/usr/bin/env node

/**
 * Simple script to test and run the linking annotation cleanup
 */

const LOCAL_API_BASE = 'http://localhost:3000';

async function testCleanupEndpoint(dryRun = true) {
  console.log(`Testing cleanup endpoint (dryRun: ${dryRun})`);

  try {
    const response = await fetch(
      `${LOCAL_API_BASE}/api/annotations/linking/cleanup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cleanup-duplicates',
          dryRun: dryRun,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Cleanup endpoint response:');
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('Cleanup endpoint failed:', error.message);
    return null;
  }
}

async function main() {
  console.log('Linking Annotation Cleanup Test');
  console.log('==================================');

  // First, run dry run to see what would be cleaned up
  console.log('\n1. Running dry run analysis...');
  const dryRunResult = await testCleanupEndpoint(true);

  if (!dryRunResult) {
    console.log('Dry run failed, stopping');
    return;
  }

  if (dryRunResult.analysis && dryRunResult.analysis.duplicatesToDelete > 0) {
    console.log(
      `\nFound ${dryRunResult.analysis.duplicatesToDelete} duplicates to clean up`,
    );
    console.log(`Total annotations: ${dryRunResult.analysis.totalAnnotations}`);

    // Ask if user wants to proceed with actual cleanup
    console.log('\nReady to run actual cleanup?');
    console.log(
      'Change dryRun to false in the script and run again to execute cleanup',
    );

    // For safety, don't auto-run the actual cleanup
    // Uncomment the next lines to actually run cleanup:
    // console.log('\n2. Running actual cleanup...');
    // const cleanupResult = await testCleanupEndpoint(false);
  } else {
    console.log('No duplicates found to clean up');
  }

  console.log('\nTest completed!');
}

main().catch(console.error);
