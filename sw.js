// ============================================================
// SERVICE WORKER - SANTÉ PLUS SERVICES (VERSION FRAÎCHEUR)
// Stratégie: Network First + cache minimal
// ============================================================

// 🔥 VERSION - Incrémente à chaque déploiement
const APP_VERSION = '20250425-v3';
const CACHE_NAME = `sps-static-${APP_VERSION}`;
const IMAGE_CACHE = `sps-images-${APP_VERSION}`;

// ⚠️ Fichiers statiques MINIMAUX à mettre en cache (urgence seulement)
const STATIC_URLS = [
  './offline.html',
  '/assets/images/logo-general-icon.png',
  '/assets/images/logo-general-text.png',
  '/assets/images/logo-maman-icon.png',
  '/assets/images/logo-maman-text.png'
  // ⚠️ NE PAS mettre index.html, style.css, main.js en cache
];

// ============================================================
// 🔥 FIREBASE
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

const messaging = firebase.messaging();

// 🔥 FCM Background (notifications en arrière-plan)
messaging.onBackgroundMessage((payload) => {
  console.log("🔥 FCM Background:", payload);

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
// INSTALLATION - Supprimer les anciens caches
// ============================================================
self.addEventListener('install', (event) => {
  console.log(`🔧 SW installation - Version ${APP_VERSION}`);
  event.waitUntil(
    Promise.all([
      // Nettoyer tous les anciens caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME && cache !== IMAGE_CACHE) {
              console.log(`🗑️ Suppression ancien cache: ${cache}`);
              return caches.delete(cache);
            }
          })
        );
      }),
      // Cache uniquement les fichiers essentiels
      caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_URLS)),
      self.skipWaiting()
    ])
  );
});

// ============================================================
// ACTIVATION - Prendre le contrôle immédiatement
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('✨ SW activation - Prise de contrôle immédiate');
  event.waitUntil(
    Promise.all([
      // Nettoyage final
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME && cache !== IMAGE_CACHE) {
              console.log(`🗑️ Suppression définitive: ${cache}`);
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
// STRATÉGIE DE CACHE: NETWORK FIRST TOUJOURS
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. IGNORER LES REQUÊTES NON-GET
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // 2. REQUÊTES API (Network only - PAS DE CACHE)
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Authorization': event.request.headers.get('Authorization') || '',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }).catch(() => {
        // ⚠️ En cas d'erreur réseau, retourner une erreur (pas de cache)
        return new Response(JSON.stringify({
          offline: true,
          message: "Mode hors-ligne - Veuillez vérifier votre connexion",
          timestamp: Date.now()
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // 3. IMAGES (Network first, cache fallback uniquement)
  if (event.request.destination === 'image') {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) {
          console.log(`📦 [SW] Image fallback cache: ${url.pathname}`);
          return cached;
        }
        return caches.match('/assets/images/logo-general-icon.png');
      })
    );
    return;
  }
  
  // 4. PAGES HTML / JS / CSS (Network first, JAMAIS de cache)
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname === '/' ||
      url.pathname === './') {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      }).catch(() => {
        // Fallback offline uniquement pour les pages HTML
        if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === './') {
          return caches.match('./offline.html');
        }
        return new Response('Ressource non disponible - Veuillez rafraîchir', { status: 503 });
      })
    );
    return;
  }
  
  // 5. AUTRES (fichiers statiques) - Network first
  event.respondWith(
    fetch(event.request, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) {
        console.log(`📦 [SW] Fallback cache: ${url.pathname}`);
        return cached;
      }
      return new Response('Ressource non disponible', { status: 404 });
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

// ============================================================
// MESSAGE CONTROLLER (pour communication avec main.js)
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
