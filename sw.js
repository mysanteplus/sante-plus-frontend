// ============================================================
// SERVICE WORKER - SANTÉ PLUS SERVICES (OFFLINE-FIRST)
// ============================================================

const CACHE_NAME = 'sps-v10';
const STATIC_CACHE = 'sps-static-v10';
const IMAGE_CACHE = 'sps-images-v10';
const API_CACHE = 'sps-api-v10';

// Fichiers statiques à mettre en cache immédiatement
const STATIC_URLS = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './manifest.json',
  './offline.html',
  '/assets/images/logo-general-icon.png',
  '/assets/images/logo-general-text.png',
  '/assets/images/logo-maman-icon.png',
  '/assets/images/logo-maman-text.png'
];

// ============================================================
// 🔥 FIREBASE - Version unique 10.7.0
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBzLQLLWmRI7Nr-c-Ht9DKkJejMxh-5C4g",  // ← apiKey (camelCase)
  authDomain: "santeplus-service.firebaseapp.com",
  projectId: "santeplus-service",
  messagingSenderId: "706607823043",
  appId: "1:706607823043:web:0f1f6433cdc796d62b0a76"
});

const messaging = firebase.messaging();

// 🔥 FCM Background (notifications en arrière-plan) - CORRIGÉ
messaging.onBackgroundMessage((payload) => {
  console.log("🔥 FCM Background:", payload);

  // ✅ Les variables sont maintenant à l'intérieur de la fonction
  const title = payload.notification?.title || "Santé Plus";
  const options = {
    body: payload.notification?.body || "Nouvelle notification",
    icon: "/assets/images/logo-general-icon.png",
    badge: "/assets/images/logo-general-icon.png",
    vibrate: [200, 100, 200],
    sound: "/sounds/notification1.mp3",
    silent: false,
    requireInteraction: true,
    tag: "sante-plus-notif",
    data: { 
      url: payload.data?.url || "/",
      timestamp: Date.now()
    }
  };

  self.registration.showNotification(title, options);
});

// ============================================================
// INSTALLATION
// ============================================================
self.addEventListener('install', (event) => {
  console.log('🔧 SW installation...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_URLS)),
      self.skipWaiting()
    ])
  );
});

// ============================================================
// ACTIVATION - Nettoyage
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('✨ SW activation...');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (![STATIC_CACHE, IMAGE_CACHE, API_CACHE, CACHE_NAME].includes(cache)) {
              console.log(`🗑️ Suppression: ${cache}`);
              return caches.delete(cache);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// ============================================================
// STRATÉGIE DE CACHE: OFFLINE-FIRST
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Requêtes API
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request, {
        credentials: 'include',
        headers: {
          'Authorization': event.request.headers.get('Authorization') || '',
          'Cache-Control': 'no-cache'
        }
      })
      .then(response => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(API_CACHE).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        return new Response(JSON.stringify({
          offline: true,
          message: "Mode hors-ligne",
          timestamp: Date.now()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // Images
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(network => {
          if (network && network.status === 200) {
            caches.open(IMAGE_CACHE).then(cache => cache.put(event.request, network.clone()));
          }
          return network;
        });
      }).catch(() => caches.match('/assets/images/logo-general-icon.png'))
    );
    return;
  }
  
  // Assets statiques
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === './') {
          return caches.match('./offline.html');
        }
        return new Response('Page non disponible hors-ligne', { status: 503 });
      });
    })
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (let client of windowClients) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ============================================================
// SYNC BACKGROUND
// ============================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-requests') {
    event.waitUntil(
      clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_REQUIRED' });
        });
      })
    );
  }
});
