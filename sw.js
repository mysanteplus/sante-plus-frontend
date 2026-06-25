// ============================================================
// SERVICE WORKER - SANTÉ PLUS SERVICES
// Version: 2.0 - Production Ready
// Description: Offline-first + Push Notifications + Auto-update
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const CACHE_VERSION = 'v2.0.1';
const CACHE_NAME = `sps-${CACHE_VERSION}`;
const STATIC_CACHE = `sps-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `sps-images-${CACHE_VERSION}`;
const API_CACHE = `sps-api-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `sps-dynamic-${CACHE_VERSION}`;

// Dernière modification du build (incrémenter à chaque déploiement)
const BUILD_TIMESTAMP = Date.now();

// ============================================================
// FICHIERS STATIQUES À METTRE EN CACHE
// ============================================================

const STATIC_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/offline.html',
  '/assets/images/logo-general-icon.png',
  '/assets/images/logo-general-text.png',
  '/assets/images/logo-maman-icon.png',
  '/assets/images/logo-maman-text.png',
  '/assets/images/logo-general-white-bg.png',
  '/assets/images/logo-maman-white-bg.png',
  '/assets/fontawesome/css/all.min.css',
  '/assets/fontawesome/webfonts/fa-solid-900.woff2',
  '/assets/fontawesome/webfonts/fa-regular-400.woff2',
  '/assets/fontawesome/webfonts/fa-brands-400.woff2'
];

// URLs à ne PAS mettre en cache
const NO_CACHE_URLS = [
  '/api/',
  '/auth/',
  '/billing/webhook',
  '/visites/track',
  '/visites/active',
  '/visites/live'
];

// ============================================================
// FIREBASE MESSAGING
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDEHMUhAVtYXzQZuTNs3mYeq4Cag7IsUfI",
  authDomain: "santeplus-service-9ad08.firebaseapp.com",
  projectId: "santeplus-service-9ad08",
  storageBucket: "santeplus-service-9ad08.firebasestorage.app",
  messagingSenderId: "745872164641",
  appId: "1:745872164641:web:fcbc5bcee6ae4dbb2ca060",
  measurementId: "G-6Q72EHMPD8"
});

const messaging = firebase.messaging();

// ============================================================
// INSTALLATION - CACHE DES RESSOURCES STATIQUES
// ============================================================

self.addEventListener('install', (event) => {
  console.log(`🔧 [SW] Installation - ${CACHE_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Cache des ressources statiques
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 [SW] Mise en cache des ressources statiques...');
        return cache.addAll(STATIC_URLS).catch((err) => {
          console.warn('⚠️ [SW] Erreur cache statique:', err.message);
        });
      }),
      // Cache de la page d'accueil dynamique
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.add('/').catch(() => {});
      }),
      // Forcer l'activation immédiate
      self.skipWaiting()
    ])
  );
});

// ============================================================
// ACTIVATION - NETTOYAGE ET PRISE DE CONTRÔLE
// ============================================================

self.addEventListener('activate', (event) => {
  console.log(`✨ [SW] Activation - ${CACHE_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // 1. Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Garder uniquement les caches de la version actuelle
            const isCurrentVersion = cacheName.includes(CACHE_VERSION);
            const isStatic = cacheName.includes('sps-static');
            const isImages = cacheName.includes('sps-images');
            const isApi = cacheName.includes('sps-api');
            const isDynamic = cacheName.includes('sps-dynamic');
            
            // Supprimer les caches qui ne correspondent pas à la version actuelle
            if (!isCurrentVersion && (isStatic || isImages || isApi || isDynamic)) {
              console.log(`🗑️ [SW] Suppression ancien cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      }),
      // 2. Prendre le contrôle de tous les clients
      self.clients.claim(),
      // 3. Notifier les clients de la mise à jour
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION,
            timestamp: BUILD_TIMESTAMP
          });
        });
      })
    ])
  );
});

// ============================================================
// FONCTION : VÉRIFIER SI UNE URL DOIT ÊTRE CACHÉE
// ============================================================

function shouldCache(url) {
  // Ne pas cacher les URLs sensibles
  for (const pattern of NO_CACHE_URLS) {
    if (url.pathname.includes(pattern)) {
      return false;
    }
  }
  
  // Ne pas cacher les requêtes avec paramètres de timestamp (pour éviter le cache stale)
  if (url.search.includes('_=') || url.search.includes('t=')) {
    return false;
  }
  
  return true;
}

// ============================================================
// FONCTION : NETTOYER LE CACHE API (pour éviter le remplissage)
// ============================================================

async function cleanApiCache() {
  try {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    const now = Date.now();
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 heures
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const date = response.headers.get('date');
        if (date) {
          const age = now - new Date(date).getTime();
          if (age > MAX_AGE) {
            await cache.delete(request);
            console.log(`🗑️ [SW] Cache API expiré: ${request.url}`);
          }
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [SW] Erreur nettoyage cache API:', err.message);
  }
}

// ============================================================
// INTERCEPTION DES REQUÊTES - STRATÉGIE INTELLIGENTE
// ============================================================

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Ignorer les requêtes non-HTTP
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Ignorer les requêtes vers les extensions
  if (url.pathname.startsWith('/chrome-extension')) {
    return;
  }
  
  // ============================================================
  // STRATÉGIE 1: REQUÊTES API - Network First avec fallback cache
  // ============================================================
  
  if (url.pathname.includes('/api/')) {
    // Ne pas mettre en cache les endpoints sensibles
    if (!shouldCache(url)) {
      event.respondWith(fetch(request));
      return;
    }
    
    event.respondWith(
      fetch(request, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Authorization': request.headers.get('Authorization') || ''
        }
      })
      .then((response) => {
        // Mettre en cache UNIQUEMENT les réponses 200
        if (response && response.status === 200) {
          try {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache).catch(() => {});
            });
          } catch (e) {
            // Ignorer les erreurs de clonage
          }
        }
        return response;
      })
      .catch(async () => {
        // Fallback: récupérer depuis le cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Si pas de cache, retourner une réponse hors-ligne
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'Mode hors-ligne',
            timestamp: Date.now()
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }
  
  // ============================================================
  // STRATÉGIE 2: IMAGES - Cache First avec fallback réseau
  // ============================================================
  
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              try {
                const responseToCache = response.clone();
                caches.open(IMAGE_CACHE).then((cache) => {
                  cache.put(request, responseToCache).catch(() => {});
                });
              } catch (e) {}
            }
            return response;
          });
        })
        .catch(() => {
          // Fallback: image par défaut
          return caches.match('/assets/images/logo-general-icon.png');
        })
    );
    return;
  }
  
  // ============================================================
  // STRATÉGIE 3: PAGES HTML - Network First avec fallback cache
  // ============================================================
  
  if (request.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            try {
              const responseToCache = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, responseToCache).catch(() => {});
              });
            } catch (e) {}
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match('/offline.html');
        })
    );
    return;
  }
  
  // ============================================================
  // STRATÉGIE 4: FICHIERS STATIQUES - Cache First
  // ============================================================
  
  const isStatic = STATIC_URLS.some(url => request.url.includes(url));
  
  if (isStatic || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              try {
                const responseToCache = response.clone();
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put(request, responseToCache).catch(() => {});
                });
              } catch (e) {}
            }
            return response;
          });
        })
    );
    return;
  }
  
  // ============================================================
  // STRATÉGIE 5: AUTRES - Network First
  // ============================================================
  
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// ============================================================
// NOTIFICATIONS PUSH (Background)
// ============================================================

messaging.onBackgroundMessage((payload) => {
  console.log('🔥 [SW] Notification background:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'Santé Plus';
  const body = payload.notification?.body || payload.data?.body || 'Nouvelle notification';
  const url = payload.data?.url || payload.fcmOptions?.link || '/';
  const type = payload.data?.type || 'push';
  
  const options = {
    body: body,
    icon: '/assets/images/logo-general-icon.png',
    badge: '/assets/images/logo-general-icon.png',
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: true,
    renotify: true,
    tag: `sante-plus-${type}-${Date.now()}`,
    data: {
      url: url,
      type: type,
      title: title,
      body: body,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };
  
  return self.registration.showNotification(title, options);
});

// ============================================================
// CLIC SUR NOTIFICATION
// ============================================================

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification click:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const url = event.notification.data?.url || '/';
  const finalUrl = new URL(url, self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Si une fenêtre est déjà ouverte, la focus
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(finalUrl);
          }
          return;
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(finalUrl);
      }
    })
  );
});

// ============================================================
// FERMETURE DE NOTIFICATION
// ============================================================

self.addEventListener('notificationclose', (event) => {
  console.log('🔕 [SW] Notification fermée');
});

// ============================================================
// MISE À JOUR AUTOMATIQUE - VÉRIFICATION PÉRIODIQUE
// ============================================================

// Vérifier les mises à jour toutes les heures
setInterval(() => {
  self.registration.update();
  console.log('🔄 [SW] Vérification automatique des mises à jour');
}, 60 * 60 * 1000); // 1 heure

// Vérifier les mises à jour au retour en ligne
self.addEventListener('online', () => {
  console.log('📶 [SW] Connexion rétablie - vérification des mises à jour');
  self.registration.update();
  
  // Notifier les clients
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'ONLINE',
        timestamp: Date.now()
      });
    });
  });
});

// ============================================================
// BACKGROUND SYNC
// ============================================================

self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-queued-requests') {
    event.waitUntil(
      clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_REQUIRED',
            timestamp: Date.now()
          });
        });
      })
    );
  }
});

// ============================================================
// MESSAGES DEPUIS L'APPLICATION
// ============================================================

self.addEventListener('message', (event) => {
  console.log('📩 [SW] Message reçu:', event.data);
  
  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(cacheNames.map((cache) => caches.delete(cache)));
        })
      );
      break;
      
    case 'CHECK_UPDATE':
      event.waitUntil(self.registration.update());
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        version: CACHE_VERSION,
        timestamp: BUILD_TIMESTAMP
      });
      break;
      
    default:
      console.log('📩 [SW] Message ignoré:', event.data?.type);
  }
});

// ============================================================
// NETTOYAGE AUTOMATIQUE DU CACHE (exécution périodique)
// ============================================================

// Nettoyer le cache API toutes les 6 heures
setInterval(() => {
  cleanApiCache();
}, 6 * 60 * 60 * 1000);

// Nettoyer le cache au démarrage
cleanApiCache();

// ============================================================
// LOGS DE DÉMARRAGE
// ============================================================

console.log(`✅ [SW] Service Worker chargé - ${CACHE_VERSION}`);
console.log(`📅 [SW] Build: ${new Date(BUILD_TIMESTAMP).toLocaleString()}`);
console.log('📡 [SW] Prêt pour les notifications push');
