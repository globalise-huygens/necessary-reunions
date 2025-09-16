// Empty service worker to prevent 404 errors
// This file exists only to satisfy browser requests for a service worker

self.addEventListener('install', function (event) {
  // Skip waiting and activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // Clean up any old caches if needed
  event.waitUntil(self.clients.claim());
});

// Optional: Add minimal functionality if needed
self.addEventListener('fetch', function (event) {
  // Let all requests pass through without intervention
  return;
});
