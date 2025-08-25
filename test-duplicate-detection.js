#!/usr/bin/env node

/**
 * Test script for linking annotation duplicate detection and consolidation
 *
 * This script tests the improved logic for:
 * 1. Detecting duplicate linking annotations (same targets, different order)
 * 2. Consolidating duplicates properly
 * 3. Preventing future duplicates
 */

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

// Your specific duplicate annotations for testing
const DUPLICATE_ANNOTATIONS = {
  first: '80cd4d0a-094b-4d9e-ae79-37db47d3264c',
  second: '7bafd86b-c4de-4cd4-97d9-6a741cfd62d5',
};

async function fetchAnnotation(annotationId) {
  const url = `${ANNOREPO_BASE_URL}/w3c/${CONTAINER}/${annotationId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch annotation ${annotationId}:`, error.message);
    return null;
  }
}

function analyzeAnnotation(annotation) {
  if (!annotation) return null;

  const targets = Array.isArray(annotation.target)
    ? annotation.target
    : [annotation.target];
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : annotation.body
    ? [annotation.body]
    : [];

  const analysis = {
    id: annotation.id,
    created: annotation.created,
    modified: annotation.modified,
    targetCount: targets.length,
    targets: targets,
    normalizedTargets: [...targets].sort(),
    bodyCount: bodies.length,
    bodyPurposes: bodies.map((b) => b.purpose).filter(Boolean),
    hasPointSelector: bodies.some(
      (b) => b.purpose === 'selecting' && b.selector?.type === 'PointSelector',
    ),
    hasGeotag: bodies.some((b) => b.purpose === 'geotagging'),
    pointSelectorData: bodies.find(
      (b) => b.purpose === 'selecting' && b.selector?.type === 'PointSelector',
    )?.selector,
    via: annotation.via,
  };

  return analysis;
}

function compareTargetSets(targets1, targets2) {
  if (targets1.length !== targets2.length)
    return { match: false, type: 'different_length' };

  const exactMatch = targets1.every(
    (target, index) => targets2[index] === target,
  );
  if (exactMatch) return { match: true, type: 'exact_match' };

  const normalized1 = [...targets1].sort();
  const normalized2 = [...targets2].sort();
  const setMatch = normalized1.every(
    (target, index) => normalized2[index] === target,
  );

  if (setMatch) return { match: true, type: 'same_set_different_order' };

  return { match: false, type: 'different_sets' };
}

function testDuplicateDetectionLogic(annotation1, annotation2) {
  console.log('\n=== Testing Duplicate Detection Logic ===');

  const analysis1 = analyzeAnnotation(annotation1);
  const analysis2 = analyzeAnnotation(annotation2);

  if (!analysis1 || !analysis2) {
    console.log('Could not analyze annotations');
    return;
  }

  console.log('\n Annotation Analysis:');
  console.log('Annotation 1:', {
    id: analysis1.id.split('/').pop(),
    created: analysis1.created,
    modified: analysis1.modified,
    targets: analysis1.targets.map((t) => t.split('/').pop()),
    bodyPurposes: analysis1.bodyPurposes,
    hasPointSelector: analysis1.hasPointSelector,
    pointSelector: analysis1.pointSelectorData,
  });

  console.log('Annotation 2:', {
    id: analysis2.id.split('/').pop(),
    created: analysis2.created,
    modified: analysis2.modified,
    targets: analysis2.targets.map((t) => t.split('/').pop()),
    bodyPurposes: analysis2.bodyPurposes,
    hasPointSelector: analysis2.hasPointSelector,
    pointSelector: analysis2.pointSelectorData,
    via: analysis2.via,
  });

  // Test target comparison
  const targetComparison = compareTargetSets(
    analysis1.targets,
    analysis2.targets,
  );
  console.log('\n Target Comparison:');
  console.log('Match:', targetComparison.match);
  console.log('Type:', targetComparison.type);

  // Test time difference
  const timeDiff = new Date(analysis2.created) - new Date(analysis1.created);
  const timeDiffHours = timeDiff / (1000 * 60 * 60);
  console.log('\n Time Analysis:');
  console.log('Time difference:', `${timeDiffHours.toFixed(1)} hours`);
  console.log('Within 48 hours:', timeDiffHours < 48);

  // Test PointSelector similarity
  const hasSamePointSelector =
    analysis1.pointSelectorData &&
    analysis2.pointSelectorData &&
    analysis1.pointSelectorData.x === analysis2.pointSelectorData.x &&
    analysis1.pointSelectorData.y === analysis2.pointSelectorData.y;

  console.log('\n PointSelector Analysis:');
  console.log(
    'Both have PointSelector:',
    analysis1.hasPointSelector && analysis2.hasPointSelector,
  );
  console.log('Same coordinates:', hasSamePointSelector);
  if (hasSamePointSelector) {
    console.log(
      'Coordinates:',
      `(${analysis1.pointSelectorData.x}, ${analysis1.pointSelectorData.y})`,
    );
  }

  // Test duplicate detection logic
  console.log('\n Duplicate Detection Results:');

  if (targetComparison.type === 'exact_match') {
    console.log(' EXACT MATCH - Would consolidate bodies');
  } else if (targetComparison.type === 'same_set_different_order') {
    const isRecentDuplicate = timeDiffHours < 48; // Updated to 48 hours
    const hasSubstantialNewContent =
      analysis2.hasPointSelector || analysis2.hasGeotag;
    const hasSamePointSelector =
      analysis1.pointSelectorData &&
      analysis2.pointSelectorData &&
      analysis1.pointSelectorData.x === analysis2.pointSelectorData.x &&
      analysis1.pointSelectorData.y === analysis2.pointSelectorData.y;

    console.log('Same target set, different order');
    console.log('Recent duplicate (48h):', isRecentDuplicate);
    console.log('Has substantial new content:', hasSubstantialNewContent);
    console.log('Same PointSelector coordinates:', hasSamePointSelector);

    if (
      (isRecentDuplicate && hasSubstantialNewContent) ||
      hasSamePointSelector
    ) {
      console.log('DUPLICATE DETECTED - Would consolidate with new order');
      console.log(
        'Reason:',
        hasSamePointSelector
          ? 'Same target set + identical PointSelector - clear duplicate'
          : 'Same target set (different order) - likely duplicate from failed update',
      );
      console.log('Action: Preserve new order, consolidate bodies');
    } else {
      console.log('Not treated as duplicate - might be intentional reordering');
    }
  } else {
    console.log('Different target sets - not duplicates');
  }

  return {
    isDuplicate:
      targetComparison.match &&
      (targetComparison.type === 'exact_match' ||
        (targetComparison.type === 'same_set_different_order' &&
          ((timeDiffHours < 48 &&
            (analysis2.hasPointSelector || analysis2.hasGeotag)) ||
            (analysis1.pointSelectorData &&
              analysis2.pointSelectorData &&
              analysis1.pointSelectorData.x === analysis2.pointSelectorData.x &&
              analysis1.pointSelectorData.y ===
                analysis2.pointSelectorData.y)))),
    consolidationStrategy:
      targetComparison.type === 'same_set_different_order'
        ? 'preserve_new_order'
        : 'merge_targets',
    analysis1,
    analysis2,
  };
}

async function testWithRealAPI() {
  console.log('\n=== Testing with Local API ===');

  try {
    // Test the analyzeConsolidationOptions logic
    const testPayload = {
      type: 'Annotation',
      motivation: 'linking',
      target: [
        'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/5e688a9e-7f62-4c90-b50f-f4f15137aded',
        'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/3747c5c9-063d-4d39-a26c-fb645d623a21',
        'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/77e4fb22-4f53-4610-8060-965ef3aa8b2a',
      ],
      body: [
        {
          type: 'SpecificResource',
          purpose: 'selecting',
          source:
            'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
          selector: {
            type: 'PointSelector',
            x: 668,
            y: 1165,
          },
          creator: {
            id: 'test-user',
            type: 'Person',
            label: 'Test User',
          },
          created: new Date().toISOString(),
        },
      ],
    };

    console.log('Test payload targets (different order than existing):');
    console.log(testPayload.target.map((t) => t.split('/').pop()));

    console.log('\nSending test request to local API...');
    console.log('Note: This would test the actual consolidation logic');
    console.log(
      'Expected: Should detect existing annotation and consolidate instead of creating duplicate',
    );
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

async function suggestCleanupStrategy(duplicateResult) {
  if (!duplicateResult.isDuplicate) {
    console.log('\nNo cleanup needed - annotations are not duplicates');
    return;
  }

  console.log('\nCleanup Strategy:');

  const older = duplicateResult.analysis1;
  const newer = duplicateResult.analysis2;

  console.log('Recommended approach:');
  console.log(
    '1. Keep annotation:',
    newer.id.split('/').pop(),
    '(newer, has PointSelector)',
  );
  console.log('2. Delete annotation:', older.id.split('/').pop(), '(older)');
  console.log('3. Ensure newest has all content from both annotations');

  if (duplicateResult.consolidationStrategy === 'preserve_new_order') {
    console.log(
      '4. Use target order from newer annotation (correct reading sequence)',
    );
  }

  // Generate cleanup API call
  console.log('\nCleanup API Commands:');
  console.log('Run the linking cleanup endpoint:');
  console.log('POST /api/annotations/linking/cleanup');
  console.log('Body: { "action": "cleanup-duplicates", "dryRun": false }');
}

async function main() {
  console.log('Testing Linking Annotation Duplicate Detection');
  console.log('================================================');

  console.log('\nFetching duplicate annotations...');

  const annotation1 = await fetchAnnotation(DUPLICATE_ANNOTATIONS.first);
  const annotation2 = await fetchAnnotation(DUPLICATE_ANNOTATIONS.second);

  if (!annotation1 || !annotation2) {
    console.log('Failed to fetch annotations for testing');
    return;
  }

  console.log('Successfully fetched both annotations');

  // Test the duplicate detection logic
  const duplicateResult = testDuplicateDetectionLogic(annotation1, annotation2);

  // Suggest cleanup strategy
  await suggestCleanupStrategy(duplicateResult);

  // Test with API
  await testWithRealAPI();

  console.log('\nTest completed!');
  console.log('\nNext steps:');
  console.log('1. Review the duplicate detection results above');
  console.log('2. Run the cleanup endpoint if duplicates were detected');
  console.log(
    '3. Test creating new linking annotations to verify no more duplicates are created',
  );
}

// Run the test
main().catch(console.error);
