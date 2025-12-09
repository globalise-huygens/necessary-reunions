#!/usr/bin/env ts-node

/**
 * Diagnostic script to fetch and analyze SVG annotation data
 * Compares local and production annotation structures
 * 
 * Usage: pnpm tsx scripts/debug-svg-annotations.ts
 */

const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
const CONTAINER = 'necessary-reunions';

// Sample canvas IDs to test (from the NeRu manifest)
const TEST_CANVAS_IDS = [
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
  'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W38.json/canvas/p1',
];

function encodeCanvasUri(uri: string): string {
  return Buffer.from(uri).toString('base64');
}

interface AnnotationSelector {
  type: string;
  value?: string;
}

interface Annotation {
  id: string;
  type: string;
  motivation: string;
  target: {
    source: string;
    selector?: AnnotationSelector | AnnotationSelector[];
  };
  body?: unknown;
}

async function fetchAnnotationsForCanvas(canvasId: string): Promise<Annotation[]> {
  const encoded = encodeCanvasUri(canvasId);
  const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target:target=${encoded}`;
  
  console.log(`\n🔍 Fetching annotations for canvas:`);
  console.log(`   Canvas: ${canvasId.substring(0, 80)}...`);
  console.log(`   Endpoint: ${endpoint}\n`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error(`❌ Fetch failed:`, error instanceof Error ? error.message : error);
    return [];
  }
}

function analyzeSvgSelector(annotation: Annotation) {
  const selector = annotation.target?.selector;
  
  if (!selector) {
    return { hasSvg: false, reason: 'No selector found' };
  }

  let svgSelector: AnnotationSelector | undefined;

  if (Array.isArray(selector)) {
    svgSelector = selector.find(s => s.type === 'SvgSelector');
    if (!svgSelector) {
      return { 
        hasSvg: false, 
        reason: 'Array selector without SvgSelector',
        selectorTypes: selector.map(s => s.type).join(', ')
      };
    }
  } else if (selector.type === 'SvgSelector') {
    svgSelector = selector;
  } else {
    return { 
      hasSvg: false, 
      reason: 'Non-SVG selector type',
      selectorType: selector.type 
    };
  }

  // Check if SVG value contains polygon
  const svgValue = svgSelector.value || '';
  const polygonMatch = svgValue.match(/<polygon points="([^"]+)"/);

  return {
    hasSvg: true,
    hasPolygon: !!polygonMatch,
    svgLength: svgValue.length,
    svgPreview: svgValue.substring(0, 150),
    polygonPoints: polygonMatch ? polygonMatch[1]?.substring(0, 100) : null,
  };
}

async function analyzeCanvas(canvasId: string) {
  const annotations = await fetchAnnotationsForCanvas(canvasId);

  console.log(`📊 Analysis Results:`);
  console.log(`   Total annotations: ${annotations.length}`);

  const iconAnnotations = annotations.filter(
    a => a.motivation === 'iconography' || a.motivation === 'iconograpy'
  );
  console.log(`   Iconography annotations: ${iconAnnotations.length}`);

  const textAnnotations = annotations.filter(
    a => a.motivation === 'textspotting'
  );
  console.log(`   Textspotting annotations: ${textAnnotations.length}`);

  console.log(`\n🔬 SVG Selector Analysis:`);

  const svgResults = annotations.map(a => ({
    id: a.id.substring(a.id.lastIndexOf('/') + 1),
    motivation: a.motivation,
    ...analyzeSvgSelector(a),
  }));

  const withSvg = svgResults.filter(r => r.hasSvg);
  const withPolygon = withSvg.filter(r => r.hasPolygon);
  const withoutSvg = svgResults.filter(r => !r.hasSvg);

  console.log(`   ✅ With SVG selector: ${withSvg.length}`);
  console.log(`   ✅ With valid polygon: ${withPolygon.length}`);
  console.log(`   ❌ Without SVG selector: ${withoutSvg.length}`);

  if (withoutSvg.length > 0) {
    console.log(`\n   ⚠️  Annotations without SVG selectors:`);
    withoutSvg.slice(0, 5).forEach(r => {
      console.log(`      - ${r.id} (${r.motivation}): ${r.reason}`);
      if (r.selectorType || r.selectorTypes) {
        console.log(`        Selector type(s): ${r.selectorType || r.selectorTypes}`);
      }
    });
    if (withoutSvg.length > 5) {
      console.log(`      ... and ${withoutSvg.length - 5} more`);
    }
  }

  if (withSvg.length > 0 && withPolygon.length < withSvg.length) {
    console.log(`\n   ⚠️  SVG selectors without valid polygons:`);
    const noPolygon = withSvg.filter(r => !r.hasPolygon);
    noPolygon.slice(0, 3).forEach(r => {
      console.log(`      - ${r.id} (${r.motivation})`);
      console.log(`        SVG preview: ${r.svgPreview}`);
    });
  }

  if (withPolygon.length > 0) {
    console.log(`\n   ✅ Sample valid SVG annotation:`);
    const sample = withPolygon[0];
    console.log(`      ID: ${sample.id}`);
    console.log(`      Motivation: ${sample.motivation}`);
    console.log(`      SVG length: ${sample.svgLength} chars`);
    console.log(`      Polygon points (first 100 chars): ${sample.polygonPoints}`);
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🚀 SVG Annotation Diagnostic Tool');
  console.log('='.repeat(80));

  for (const canvasId of TEST_CANVAS_IDS) {
    await analyzeCanvas(canvasId);
  }

  console.log('\n✨ Diagnostic complete!');
  console.log('\nNext steps:');
  console.log('1. Compare these results with browser console logs');
  console.log('2. Check if production shows different SVG formats');
  console.log('3. Verify polygon regex matches the actual SVG structure');
}

main().catch(console.error);
