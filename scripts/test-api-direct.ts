const REQUEST_TIMEOUT_MS = 5000;

const baseUrl =
  process.env.API_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

async function run() {
  if (!baseUrl) {
    console.log('API test skipped (base URL not configured).');
    process.exit(0);
  }

  const url = new URL('/api/test', baseUrl).toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '[no body]');
      console.error(
        `API test failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`,
      );
      process.exit(1);
    }

    console.log(`API test succeeded: ${url}`);
    process.exit(0);
  } catch (error) {
    console.error(
      `API test failed: ${url}. Start the dev server or set API_BASE_URL.`,
    );
    console.error(error);
    process.exit(1);
  } finally {
    clearTimeout(timeoutId);
  }
}

run().catch((error) => {
  console.error('API test failed:', error);
  process.exit(1);
});
