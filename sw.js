// ============================================================
// SERVICE WORKER - SANTÉ PLUS SERVICES (DYNAMIQUE)
// ============================================================

const CACHE_NAME = 'sps-v10';
const STATIC_CACHE = 'sps-static-v10';
const IMAGE_CACHE = 'sps-images-v10';
const API_CACHE = 'sps-api-v10';

// Déterminer le chemin de base dynamiquement
const getBasePath = () => {
  const swPath = self.location.pathname;
  return swPath.substring(0, swPath.lastIndexOf('/') + 1);
};

const BASE_PATH = getBasePath();

// Fichiers statiques à mettre en cache (chemins dynamiques)
const STATIC_URLS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'style.css',
  BASE_PATH + 'js/main.js',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'offline.html',
  BASE_PATH + 'assets/images/logo-general-icon.png',
  BASE_PATH + 'assets/images/logo-general-text.png',
  BASE_PATH + 'assets/images/logo-maman-icon.png',
  BASE_PATH + 'assets/images/logo-maman-text.png'
];

// ============================================================
// 🔥 FIREBASE (configuration dynamique)
// ============================================================
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// La config Firebase est injectée depuis l'index.html ou définie ici
firebase.initializeApp({
  apiKey: "AIzaSyBzLQLLWmRI7Nr-c-Ht9DKkJejMxh-5C4g",
  authDomain: "santeplus-service.firebaseapp.com",
  projectId: "santeplus-service",
  messagingSenderId: "706607823043",
  appId: "1:706607823043:web:0f1f6433cdc796d62b0a76"
});

const messaging = firebase.messaging();

// ============================================================
// 🔔 GESTION DES NOTIFICATIONS PUSH (DYNAMIQUE)
// ============================================================

// Déterminer l'URL de base pour les redirections
const getAppBaseUrl = () => {
  // Essayer de trouver l'URL de base à partir du scope du SW
  let baseUrl = self.location.origin + BASE_PATH;
  
  // Si c'est une sous-route, garder uniquement l'origine
  if (baseUrl.includes('/sante-plus-frontend')) {
    baseUrl = self.location.origin + '/sante-plus-frontend';
  }
  
  return baseUrl;
};

const APP_BASE_URL = getAppBaseUrl();

// Fonction pour obtenir l'icône selon le thème
const getNotificationIcon = (isMaman = false) => {
  if (isMaman) {
    return APP_BASE_URL + '/assets/images/logo-maman-icon.png';
  }
  return APP_BASE_URL + '/assets/images/logo-general-icon.png';
};

// Écouter les messages background
messaging.onBackgroundMessage((payload) => {
  console.log("🔥 FCM Background:", payload);
  
  const isMaman = payload.data?.isMaman === 'true';
  const title = payload.notification?.title || "Santé Plus";
  const body = payload.notification?.body || "Nouvelle notification";
  const url = payload.data?.url || "/";
  
  // Construire l'URL complète
  const fullUrl = url.startsWith('http') ? url : APP_BASE_URL + url;
  
  const options = {
    body: body,
    icon: getNotificationIcon(isMaman),
    badge: getNotificationIcon(isMaman),
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: true,
    tag: "sante-plus-notif",
    data: { 
      url: fullUrl,
      timestamp: Date.now()
    }
  };
  
  self.registration.showNotification(title, options);
});

// Gestionnaire de clic sur notification
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || APP_BASE_URL + "/";
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Vérifier si une fenêtre est déjà ouverte
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================================
// INSTALLATION
// ============================================================
self.addEventListener('install', (event) => {
  console.log('🔧 SW installation...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATION
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
// STRATÉGIE DE CACHE
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  
  // Ignorer les requêtes non-GET
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
        return new Response(JSON.stringify({ offline: true, message: "Mode hors-ligne" }), {
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
            const responseToCache = network.clone();
            caches.open(IMAGE_CACHE).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return network;
        });
      }).catch(() => {
        return caches.match(APP_BASE_URL + '/assets/images/logo-general-icon.png');
      })
    );
    return;
  }
  
  // Assets statiques
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && isSameOrigin) {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === './') {
          return caches.match(APP_BASE_URL + '/offline.html');
        }
        return new Response('Page non disponible hors-ligne', { status: 503 });
      });
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

console.log("🚀 Service Worker dynamique chargé - Base path:", BASE_PATH);
