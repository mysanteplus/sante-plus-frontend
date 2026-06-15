// ============================================================
// SERVICE WORKER - SANTÉ PLUS SERVICES (OFFLINE-FIRST)
// ============================================================

const CACHE_NAME = 'sps-v11';
const STATIC_CACHE = 'sps-static-v11';
const IMAGE_CACHE = 'sps-images-v11';
const API_CACHE = 'sps-api-v11';

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
  apiKey: "AIzaSyBzLQLLWmRI7Nr-c-Ht9DKkJejMxh-5C4g",
  authDomain: "santeplus-service.firebaseapp.com",
  projectId: "santeplus-service",
  messagingSenderId: "706607823043",
  appId: "1:706607823043:web:0f1f6433cdc796d62b0a76"
});


// Créer un canal de notification avec priorité MAXIMALE
self.addEventListener('install', () => {
  if (self.registration && self.registration.showNotification) {
    console.log('✅ Notifications supportées');
  }
});

const messaging = firebase.messaging();

// ============================================================
// 🎯 CRÉER UN CANAL DE NOTIFICATION (POUR POPUP)
// ============================================================
self.addEventListener('install', (event) => {
  console.log('🔧 SW installation...');
  
  // Pour Android, créer un canal de notification avec priorité haute
  if (self.registration && self.registration.showNotification) {
    console.log('✅ Notifications supportées');
  }
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_URLS)),
      self.skipWaiting()
    ])
  );
});

// ============================================================
// 🔥 FCM Background (notifications en arrière-plan) - VERSION POPUP
// ============================================================
messaging.onBackgroundMessage((payload) => {
  console.log("🔥 FCM Background:", payload);

  const title = payload.notification?.title || "Santé Plus";
  
  // ✅ OPTIONS OPTIMISÉES POUR POPUP HEADS-UP DISPLAY
  const options = {
    body: payload.notification?.body || "Nouvelle notification",
    icon: "/assets/images/logo-general-icon.png",
    badge: "/assets/images/logo-general-icon.png",
    vibrate: [200, 100, 200],
    sound: "/sounds/notification1.mp3",
    silent: false,
    requireInteraction: true,        // Reste à l'écran jusqu'à interaction
    tag: "sante-plus-notif",
    renotify: true,                  // Sonne même si notification similaire existe
    data: { 
      url: payload.data?.url || "/",
      timestamp: Date.now()
    },
    // ⭐ POUR POPUP HEADS-UP DISPLAY (Android)
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: '/assets/images/logo-general-icon.png'
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/assets/images/logo-general-icon.png'
      }
    ]
  };

  self.registration.showNotification(title, options);
});

// ============================================================
// ✅ GESTION DES ACTIONS DE NOTIFICATION
// ============================================================
self.addEventListener("notificationclick", function (event) {
  console.log("🔔 Notification click:", event.action);
  
  event.notification.close();
  
  let url = "/";
  
  if (event.action === 'open') {
    url = event.notification.data?.url || "/";
  } else if (event.action === 'close') {
    // Ne rien ouvrir
    return;
  } else {
    url = event.notification.data?.url || "/";
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Vérifier si une fenêtre est déjà ouverte
        for (let client of windowClients) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
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
// SYNC BACKGROUND (pour les requêtes en attente)
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
