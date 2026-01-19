const ANNO_REPO_URL =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/?page=1';
const REQUEST_TIMEOUT_MS = 5000;

async function run() {
  const token = process.env.ANNO_REPO_TOKEN_JONA;

  if (!token) {
    console.log('AnnoRepo test skipped (credentials not configured).');
    process.exit(0);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ANNO_REPO_URL, {
      headers: {
        Accept: 'application/ld+json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '[no body]');
      console.error(
        `AnnoRepo request failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`,
      );
      process.exit(1);
    }

    console.log('AnnoRepo request succeeded.');
    process.exit(0);
  } catch (error) {
    console.error('AnnoRepo request failed:', error);
    process.exit(1);
  } finally {
    clearTimeout(timeoutId);
  }
}

run().catch((error) => {
  console.error('AnnoRepo test failed:', error);
  process.exit(1);
});
