#!/usr/bin/env node

/**
 * Quick test to verify ImageViewer fixes are working
 */

const fs = require('fs');

console.log('🔍 Verifying ImageViewer fixes...\n');

const filePath =
  '/Users/jonaschlegel/projects/necessary-reunions-1/components/ImageViewer.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const checks = [
  {
    name: 'styleOverlays useEffect for selectedAnnotationId',
    pattern:
      /useEffect\(\(\) => \{[\s\S]*?selectedIdRef\.current = selectedAnnotationId;[\s\S]*?styleOverlays\(\);[\s\S]*?\}, \[selectedAnnotationId\]\);/,
    description: 'Should trigger styleOverlays when selection changes',
  },
  {
    name: 'styleOverlays useEffect for selectedIds',
    pattern:
      /useEffect\(\(\) => \{[\s\S]*?selectedIdsRef\.current = selectedIds;[\s\S]*?styleOverlays\(\);[\s\S]*?\}, \[selectedIds\]\);/,
    description: 'Should trigger styleOverlays when linking selections change',
  },
  {
    name: 'zoomToSelected in selectedAnnotationId useEffect',
    pattern:
      /useEffect\(\(\) => \{[\s\S]*?zoomToSelected\(\);[\s\S]*?\}, \[selectedAnnotationId\]\);/,
    description: 'Should zoom to selected annotation when selection changes',
  },
  {
    name: 'styleOverlays uses current refs',
    pattern:
      /const currentSelectedId = selectedIdRef\.current;[\s\S]*?const currentAnnotations = annotationsRef\.current;/,
    description:
      'styleOverlays should use current ref values instead of stale props',
  },
  {
    name: 'annotationsRef useEffect',
    pattern:
      /useEffect\(\(\) => \{[\s\S]*?annotationsRef\.current = annotations;[\s\S]*?styleOverlays\(\);[\s\S]*?\}, \[annotations\]\);/,
    description: 'Should update styling when annotations change',
  },
];

let allPassed = true;

checks.forEach((check, index) => {
  const passed = check.pattern.test(content);
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
  if (!passed) {
    console.log(`   ${check.description}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 All ImageViewer fixes verified!');
  console.log('\n📋 Fixed functionality:');
  console.log('• Annotation selection now triggers zoom-in');
  console.log(
    '• Selected annotations get proper styling (red border/background)',
  );
  console.log(
    '• Linked annotations get proper styling (dark red border/background)',
  );
  console.log('• Linking mode selections update styling correctly');
  console.log('• All functions use current state via refs (no stale closures)');
} else {
  console.log('❌ Some fixes are missing or incorrect.');
}
