import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Ensure the new service worker activates and claims clients immediately
self.skipWaiting();
clientsClaim();

// Precaching provided by VitePWA
precacheAndRoute(self.__WB_MANIFEST || []);

// Setup SPA navigation route so refreshing on /jobs, /kanban, etc. works 100% offline
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//, /\.[a-zA-Z0-9]+$/],
});
registerRoute(navigationRoute);

// Cache Google Fonts stylesheets (Inter, Outfit)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache Google Fonts webfont files (woff2, etc.) for 1 year
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365,
        maxEntries: 30,
      }),
    ],
  })
);

// Cache images and icons
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Listen for message events (e.g. manual skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Listen for push events
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = { title: 'New Notification', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'BYD Fairfield';
  const options = {
    body: data.body || 'You have a new update.',
    icon: '/pwa-192x192.png',
    badge: '/favicon.svg',
    data: data.url || '/', // URL to open on click
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
