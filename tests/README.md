# Annotation Loading Health Checks

Automated tests to monitor the health of annotation loading system.

## What It Tests

1. **Base Annotations Loading** - Verifies that base annotations (textspotting, iconography) load successfully
2. **Linking Annotations Loading** - Ensures linking annotations load AFTER base annotations
3. **Target Resolution** - Validates that linking annotations can find their target annotations
4. **Load Sequence** - Confirms the correct dependency order (base → linking)
5. **API Response Times** - Checks that API routes respond within acceptable timeframes
6. **AnnoRepo Accessibility** - Verifies direct access to AnnoRepo service works
7. **No Console Errors** - Ensures no JavaScript errors during loading

## Running Tests Locally

### Setup

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium
```

### Run Tests

```bash
# Run all health checks
pnpm exec playwright test tests/annotation-health.spec.ts

# Run with UI
pnpm exec playwright test tests/annotation-health.spec.ts --ui

# Run specific test
pnpm exec playwright test tests/annotation-health.spec.ts -g "Base annotations"

# Test against local development server
# (Playwright will auto-start the Next.js server when targeting localhost)
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 pnpm exec playwright test tests/annotation-health.spec.ts
```

### View Results

```bash
# Open HTML report
pnpm exec playwright show-report
```

## GitHub Actions

### Automatic Runs

- **Every 2 weeks** on Monday at 9:00 AM UTC
- **On push** to main branch (only when annotation code changes)

### Manual Trigger

1. Go to: https://github.com/globalise-huygens/necessary-reunions/actions/workflows/annotation-health-check.yml
2. Click "Run workflow"
3. Select branch
4. Click "Run workflow" button

### Failure Handling

When tests fail:

- Workflow will fail and send notification
- If it's a scheduled run, a GitHub issue will be created automatically
- Test artifacts (screenshots, videos, reports) are uploaded for 30 days
- Check the workflow logs for detailed failure reasons

## What To Do If Tests Fail

1. **Check the workflow logs** - See which specific test failed
2. **Review the HTML report** - Download the artifact and open `playwright-report/index.html`
3. **Common Issues:**
   - **AnnoRepo down** - Service might be temporarily unavailable
   - **Netlify timeout** - Serverless function may need optimization
   - **Load sequence wrong** - Linking loaded before base (CRITICAL)
   - **Target resolution failure** - Base annotations incomplete

4. **Manual verification:**

   ```bash
   # Test locally
   pnpm exec playwright test tests/annotation-health.spec.ts --debug

   # Check production site manually
   open https://necessaryreunions.netlify.app/viewer
   # Open console and run: window.__getAnnotationHealth()
   ```

## Test Configuration

See `playwright.config.ts` for timeout and retry settings.

## Extending Tests

To add new health checks:

1. Add a new `test()` block in `tests/annotation-health.spec.ts`
2. Use the health check API: `window.__getAnnotationHealth()`
3. Assert expectations with helpful error messages
4. Run locally to verify before committing

## Environment Variables

- `PLAYWRIGHT_TEST_BASE_URL` - Override the base URL (default: production site)
- `CI` - Automatically set by GitHub Actions, enables stricter settings
