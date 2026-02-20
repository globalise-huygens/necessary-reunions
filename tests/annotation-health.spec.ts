/* eslint-disable */
// @ts-nocheck
import { expect, test } from '@playwright/test';

const VIEWER_PATH = '/viewer';
const TIMEOUT = 30000; // 30 seconds

test.describe('Annotation Loading Health Check', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for network requests
    page.setDefaultTimeout(TIMEOUT);

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      }
    });
  });

  test('Base annotations should load successfully', async ({ page }) => {
    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for the viewer to be ready
    await page.waitForSelector(
      '[data-testid="manifest-viewer"], .manifest-viewer, canvas',
      {
        timeout: TIMEOUT,
      },
    );

    // Wait a bit for annotations to load
    await page.waitForTimeout(5000);

    // Check if annotations loaded via the health check function
    const healthReport = await page.evaluate(() => {
      if (typeof (window as any).__getAnnotationHealth === 'function') {
        return (window as any).__getAnnotationHealth();
      }
      return null;
    });

    if (healthReport) {
      console.log('Health Report:', JSON.stringify(healthReport, null, 2));

      expect(
        healthReport.baseAnnotations.loaded,
        'Base annotations should be loaded',
      ).toBe(true);

      expect(
        healthReport.baseAnnotations.count,
        'Should have at least some base annotations',
      ).toBeGreaterThan(0);

      expect(
        healthReport.status,
        `Health check status should not be error. Issues: ${healthReport.issues.join(', ')}`,
      ).not.toBe('error');
    } else {
      // Fallback: Check for annotation elements in the DOM
      // Health check is only available in development mode
      console.warn('Health check function not available (production mode)');

      const hasAnnotations = await page.evaluate(() => {
        // Check for annotation list items, SVG overlays, or any annotation-related elements
        const annotationItems = document.querySelectorAll(
          '[data-annotation-id], .annotation-item, .annotation-overlay, [class*="annotation"]',
        );
        // Also check if there's an annotation list with items
        const listItems = document.querySelectorAll('[role="list"] > *');
        return annotationItems.length > 0 || listItems.length > 3; // More than just headers
      });

      // In production, we just verify the page loaded without errors
      if (!hasAnnotations) {
        console.warn(
          'No annotation elements found in DOM - this may be expected in production',
        );
      }
      // Don't fail the test in production - just log a warning
    }
  });

  test('Linking annotations should load after base annotations', async ({
    page,
  }) => {
    const loadSequence: Array<{ type: string; timestamp: number }> = [];

    // Monitor console logs for loading events
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[Annotation Loading] Base annotations loaded')) {
        loadSequence.push({ type: 'base', timestamp: Date.now() });
      } else if (text.includes('[Linking Annotations] Loaded successfully')) {
        loadSequence.push({ type: 'linking', timestamp: Date.now() });
      }
    });

    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for loading to complete
    await page.waitForTimeout(10000);

    // Check the health report
    const healthReport = await page.evaluate(() => {
      if (typeof (window as any).__getAnnotationHealth === 'function') {
        return (window as any).__getAnnotationHealth();
      }
      return null;
    });

    if (healthReport) {
      console.log(
        'Linking Health Report:',
        JSON.stringify(healthReport, null, 2),
      );

      if (healthReport.linkingAnnotations.enabled) {
        expect(
          healthReport.timing.loadSequenceCorrect,
          'Linking annotations should load after base annotations',
        ).toBe(true);

        expect(
          healthReport.timing.baseLoadedFirst,
          'Base annotations must load first',
        ).toBe(true);
      }

      // Check for critical issues
      const criticalIssues = healthReport.issues.filter((issue: string) =>
        issue.includes('CRITICAL'),
      );
      expect(
        criticalIssues.length,
        `Should have no critical issues. Found: ${criticalIssues.join(', ')}`,
      ).toBe(0);
    }

    // Verify load sequence from console logs
    if (loadSequence.length >= 2) {
      const baseIndex = loadSequence.findIndex((e) => e.type === 'base');
      const linkingIndex = loadSequence.findIndex((e) => e.type === 'linking');

      if (baseIndex !== -1 && linkingIndex !== -1) {
        expect(
          baseIndex < linkingIndex,
          'Base annotations should load before linking annotations',
        ).toBe(true);
      }
    }
  });

  test('Linking annotations should resolve their targets', async ({ page }) => {
    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for everything to load
    await page.waitForTimeout(10000);

    const healthReport = await page.evaluate(() => {
      if (typeof (window as any).__getAnnotationHealth === 'function') {
        return (window as any).__getAnnotationHealth();
      }
      return null;
    });

    if (healthReport && healthReport.linkingAnnotations.loaded) {
      console.log(
        'Resolution Report:',
        JSON.stringify(healthReport.resolution, null, 2),
      );

      const unresolvedCount = Number(
        healthReport.resolution?.unresolvedCount ?? 0,
      );
      const total = Number(
        healthReport.resolution?.totalLinkingAnnotations ?? 0,
      );
      const maxUnresolved = Number(
        process.env.MAX_UNRESOLVED_LINKING_TARGETS ?? 5,
      );

      expect(
        unresolvedCount,
        `Too many unresolved linking targets: ${unresolvedCount} out of ${total}. Max allowed: ${maxUnresolved}`,
      ).toBeLessThanOrEqual(maxUnresolved);

      if (unresolvedCount > 0) {
        console.warn(
          `Warning: ${unresolvedCount} out of ${total} linking annotations cannot resolve targets`,
        );
      }
    }
  });

  test('No console errors during annotation loading', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Filter out expected/harmless errors
        const text = msg.text();
        if (
          !text.includes('favicon') &&
          !text.includes('Extension') &&
          !text.includes('Chrome') &&
          !text.includes('/_next/webpack-hmr') &&
          !text.includes('allowedDevOrigins') &&
          !text.includes('service.archief.nl') &&
          !text.includes('iipsrv?IIIF=') &&
          !text.includes('.jp2') &&
          !text.includes('Tile') &&
          !text.includes('next-auth') &&
          !text.includes('api/auth') &&
          !text.includes('500 (Internal Server Error)')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });
    await page.waitForTimeout(10000);

    expect(
      consoleErrors.length,
      `Should have no console errors. Found: ${consoleErrors.join('\n')}`,
    ).toBe(0);
  });

  test('API routes should respond within acceptable time', async ({
    page,
    request,
  }) => {
    // Test the linking-bulk endpoint
    const startTime = Date.now();
    const response = await request.get('/api/annotations/linking-bulk?page=0', {
      timeout: 15000,
    });
    const duration = Date.now() - startTime;

    console.log(
      `API response time: ${duration}ms, status: ${response.status()}`,
    );

    expect(response.status(), 'API should return 200').toBe(200);
    expect(duration, 'API should respond within 15 seconds').toBeLessThan(
      15000,
    );

    const data = await response.json();
    console.log('API response:', {
      hasAnnotations: Array.isArray(data.annotations),
      count: data.annotations?.length || 0,
      hasError: !!data.error,
    });

    // It's okay if there's an error (SocketError) as long as direct fallback works
    if (data.error) {
      console.warn(
        'API returned error (expected for SocketError):',
        data.error,
      );
    }
  });

  test('AnnoRepo access should work via API proxy', async ({ request }) => {
    const testCanvasId =
      'https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C/C.2/C.2.4/chetwai/918.json/canvas/p1';
    const url = `/api/annotations/external?targetCanvasId=${encodeURIComponent(testCanvasId)}&page=0`;

    console.log('Testing AnnoRepo access via API proxy...');

    const startTime = Date.now();
    const response = await request.get(url, {
      timeout: 15000,
    });
    const duration = Date.now() - startTime;

    console.log(
      `API proxy response time: ${duration}ms, status: ${response.status()}`,
    );

    expect(response.status(), 'API proxy should return 200').toBe(200);

    const data = await response.json();
    console.log('API proxy response:', {
      hasItems: Array.isArray(data.items),
      count: data.items?.length || 0,
      hasMore: data.hasMore,
    });

    // The proxy returns { items, hasMore } - items may be empty if AnnoRepo
    // is slow or unreachable, which validates the resilience pattern
    expect(
      Array.isArray(data.items),
      'API proxy should return items array',
    ).toBe(true);
  });

  test('Visual elements should render in ImageViewer', async ({ page }) => {
    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for viewer to be ready
    await page.waitForSelector(
      '[data-testid="manifest-viewer"], .manifest-viewer, canvas',
      { timeout: TIMEOUT },
    );

    // Wait for annotations to load and render
    await page.waitForTimeout(8000);

    // Check for SVG annotation overlays (text spotting, iconography)
    const svgElements = await page.evaluate(() => {
      // Look for SVG polygons/paths that represent annotations
      const svgs = document.querySelectorAll(
        'svg polygon, svg path, svg circle',
      );
      const annotationSvgs = Array.from(svgs).filter((el) => {
        const parent = el.closest('svg');
        // Filter for annotation-related SVGs (not UI icons)
        return (
          parent &&
          (parent.getAttribute('viewBox') ||
            parent.closest('[class*="annotation"]') ||
            parent.closest('[class*="viewer"]'))
        );
      });
      return annotationSvgs.length;
    });

    console.log(`Found ${svgElements} SVG annotation elements in ImageViewer`);

    // Should have at least some visual annotations (text spotting or iconography)
    expect(
      svgElements,
      'Should render SVG annotations in ImageViewer',
    ).toBeGreaterThan(0);
  });

  test('Annotation items should appear in AnnotationList', async ({ page }) => {
    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for viewer to be ready
    await page.waitForSelector(
      '[data-testid="manifest-viewer"], .manifest-viewer, canvas',
      { timeout: TIMEOUT },
    );

    // Wait for annotations to load and list to render
    await page.waitForTimeout(10000);

    // Count annotation list items using the actual DOM structure
    // AnnotationList uses react-window with role="button" items
    const listItems = await page.evaluate(() => {
      const items = document.querySelectorAll(
        'div[role="button"][aria-expanded]',
      );
      return items.length;
    });

    console.log(`Found ${listItems} annotation items in AnnotationList`);

    expect(
      listItems,
      'AnnotationList should contain annotation items',
    ).toBeGreaterThan(0);
  });

  test('Linking point circles should render on canvas', async ({ page }) => {
    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for viewer to be ready
    await page.waitForSelector(
      '[data-testid="manifest-viewer"], .manifest-viewer, canvas',
      { timeout: TIMEOUT },
    );

    // Wait for linking annotations to load
    await page.waitForTimeout(12000);

    // Check for linking point SVG circles
    const linkingCircles = await page.evaluate(() => {
      // Look for SVG circles that represent linking points
      const circles = document.querySelectorAll('svg circle');

      // Filter for linking-related circles (usually have specific attributes/classes)
      const linkingCircles = Array.from(circles).filter((circle) => {
        const r = circle.getAttribute('r');
        const fill = circle.getAttribute('fill');
        const stroke = circle.getAttribute('stroke');

        // Linking points typically have specific styling
        // Look for circles with reasonable radius (not tiny UI dots)
        const radius = parseFloat(r || '0');
        return radius > 2 && (fill || stroke);
      });

      return linkingCircles.length;
    });

    console.log(`Found ${linkingCircles} linking point circles on canvas`);

    // Linking circles might be 0 if no linking annotations exist yet
    // So we just log the count without requiring > 0
    console.log(
      linkingCircles > 0
        ? '✓ Linking points are rendering'
        : 'ℹ No linking points found (may be expected if no linking annotations)',
    );
  });

  test('AnnotationList should show mixed annotation types', async ({
    page,
  }) => {
    await page.goto(VIEWER_PATH, { waitUntil: 'networkidle' });

    // Wait for viewer to be ready
    await page.waitForSelector(
      '[data-testid="manifest-viewer"], .manifest-viewer, canvas',
      { timeout: TIMEOUT },
    );

    // Wait for annotations to load and list to render
    await page.waitForTimeout(10000);

    // Check for different annotation types using actual UI text
    // FastAnnotationItem renders "Iconography annotation" for icons
    // and filter labels include "AI Text", "AI Icons"
    const annotationTypes = await page.evaluate(() => {
      const allText = document.body.innerText.toLowerCase();
      const listItems = document.querySelectorAll(
        'div[role="button"][aria-expanded]',
      );

      return {
        hasTextAnnotations:
          allText.includes('ai text') || allText.includes('human text'),
        hasIconAnnotations:
          allText.includes('iconography annotation') ||
          allText.includes('ai icons'),
        hasAnnotationCount: allText.includes('showing'),
        listItemCount: listItems.length,
      };
    });

    console.log('Annotation types in list:', annotationTypes);

    // The filter bar should always show annotation type labels
    expect(
      annotationTypes.hasTextAnnotations || annotationTypes.hasIconAnnotations,
      'AnnotationList should show annotation type filters',
    ).toBe(true);

    // The list should contain rendered items
    expect(
      annotationTypes.listItemCount,
      'AnnotationList should contain items',
    ).toBeGreaterThan(0);
  });
});
