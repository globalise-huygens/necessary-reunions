import { test, expect } from '@playwright/test';

const VIEWER_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://necessaryreunions.netlify.app/viewer';
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
    await page.goto(VIEWER_URL, { waitUntil: 'networkidle' });
    
    // Wait for the viewer to be ready
    await page.waitForSelector('[data-testid="manifest-viewer"], .manifest-viewer, canvas', {
      timeout: TIMEOUT,
    });

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
      
      expect(healthReport.baseAnnotations.loaded, 
        'Base annotations should be loaded').toBe(true);
      
      expect(healthReport.baseAnnotations.count, 
        'Should have at least some base annotations').toBeGreaterThan(0);
      
      expect(healthReport.status, 
        `Health check status should not be error. Issues: ${healthReport.issues.join(', ')}`
      ).not.toBe('error');
    } else {
      // Fallback: Check for annotation elements in the DOM
      const hasAnnotations = await page.evaluate(() => {
        // Check for annotation list items or SVG overlays
        const annotationItems = document.querySelectorAll('[data-annotation-id], .annotation-item, .annotation-overlay');
        return annotationItems.length > 0;
      });
      
      expect(hasAnnotations, 'Should find annotation elements in the DOM').toBe(true);
    }
  });

  test('Linking annotations should load after base annotations', async ({ page }) => {
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

    await page.goto(VIEWER_URL, { waitUntil: 'networkidle' });
    
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
      console.log('Linking Health Report:', JSON.stringify(healthReport, null, 2));
      
      if (healthReport.linkingAnnotations.enabled) {
        expect(healthReport.timing.loadSequenceCorrect, 
          'Linking annotations should load after base annotations').toBe(true);
        
        expect(healthReport.timing.baseLoadedFirst,
          'Base annotations must load first').toBe(true);
      }
      
      // Check for critical issues
      const criticalIssues = healthReport.issues.filter((issue: string) => 
        issue.includes('CRITICAL')
      );
      expect(criticalIssues.length, 
        `Should have no critical issues. Found: ${criticalIssues.join(', ')}`
      ).toBe(0);
    }

    // Verify load sequence from console logs
    if (loadSequence.length >= 2) {
      const baseIndex = loadSequence.findIndex(e => e.type === 'base');
      const linkingIndex = loadSequence.findIndex(e => e.type === 'linking');
      
      if (baseIndex !== -1 && linkingIndex !== -1) {
        expect(baseIndex < linkingIndex, 
          'Base annotations should load before linking annotations'
        ).toBe(true);
      }
    }
  });

  test('Linking annotations should resolve their targets', async ({ page }) => {
    await page.goto(VIEWER_URL, { waitUntil: 'networkidle' });
    
    // Wait for everything to load
    await page.waitForTimeout(10000);

    const healthReport = await page.evaluate(() => {
      if (typeof (window as any).__getAnnotationHealth === 'function') {
        return (window as any).__getAnnotationHealth();
      }
      return null;
    });

    if (healthReport && healthReport.linkingAnnotations.loaded) {
      console.log('Resolution Report:', JSON.stringify(healthReport.resolution, null, 2));
      
      expect(healthReport.resolution.canResolveTargets,
        `Should be able to resolve all targets. Unresolved: ${healthReport.resolution.unresolvedCount}`
      ).toBe(true);
      
      if (!healthReport.resolution.canResolveTargets) {
        console.warn(
          `Warning: ${healthReport.resolution.unresolvedCount} out of ${healthReport.resolution.totalLinkingAnnotations} linking annotations cannot resolve targets`
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
        if (!text.includes('favicon') && 
            !text.includes('Extension') &&
            !text.includes('Chrome')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(VIEWER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(10000);

    expect(consoleErrors.length, 
      `Should have no console errors. Found: ${consoleErrors.join('\n')}`
    ).toBe(0);
  });

  test('API routes should respond within acceptable time', async ({ page, request }) => {
    // Test the linking-bulk endpoint
    const startTime = Date.now();
    const response = await request.get(`${VIEWER_URL.replace('/viewer', '')}/api/annotations/linking-bulk?page=0`, {
      timeout: 15000,
    });
    const duration = Date.now() - startTime;

    console.log(`API response time: ${duration}ms, status: ${response.status()}`);

    expect(response.status(), 'API should return 200').toBe(200);
    expect(duration, 'API should respond within 15 seconds').toBeLessThan(15000);

    const data = await response.json();
    console.log('API response:', {
      hasAnnotations: Array.isArray(data.annotations),
      count: data.annotations?.length || 0,
      hasError: !!data.error,
    });

    // It's okay if there's an error (SocketError) as long as direct fallback works
    if (data.error) {
      console.warn('API returned error (expected for SocketError):', data.error);
    }
  });

  test('AnnoRepo direct access should work', async ({ request }) => {
    const testCanvasId = 'https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C/C.2/C.2.4/chetwai/918.json/canvas/p1';
    const encoded = Buffer.from(testCanvasId).toString('base64');
    const url = `https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target:target=${encoded}`;

    console.log('Testing direct AnnoRepo access...');
    
    const startTime = Date.now();
    const response = await request.get(url, {
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
      },
    });
    const duration = Date.now() - startTime;

    console.log(`AnnoRepo response time: ${duration}ms, status: ${response.status()}`);

    expect(response.status(), 
      'AnnoRepo should be accessible'
    ).toBe(200);

    const data = await response.json();
    console.log('AnnoRepo response:', {
      hasItems: Array.isArray(data.items),
      count: data.items?.length || 0,
    });

    expect(Array.isArray(data.items), 
      'AnnoRepo should return items array'
    ).toBe(true);
  });
});
