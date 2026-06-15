// ============================================================
// SERVICE WORKER - SANTÉ PLUS SERVICES (OFFLINE-FIRST + PUSH)
// ============================================================

const CACHE_NAME = "sps-v12";
const STATIC_CACHE = "sps-static-v12";
const IMAGE_CACHE = "sps-images-v12";
const API_CACHE = "sps-api-v12";

// Fichiers statiques à mettre en cache immédiatement
const STATIC_URLS = [
  "/",
  "/index.html",
  "/style.css",
  "/js/main.js",
  "/manifest.json",
  "/offline.html",
  "/assets/images/logo-general-icon.png",
  "/assets/images/logo-general-text.png",
  "/assets/images/logo-maman-icon.png",
  "/assets/images/logo-maman-text.png"
];

// ============================================================
// FIREBASE MESSAGING - Version unique 10.7.0
// ============================================================

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

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
// INSTALLATION DU SERVICE WORKER
// ============================================================

self.addEventListener("install", (event) => {
  console.log("🔧 SW installation...");

  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_URLS).catch((err) => {
          console.warn("⚠️ Certains fichiers statiques n'ont pas pu être mis en cache:", err.message);
        });
      }),
      self.skipWaiting()
    ])
  );
});

// ============================================================
// ACTIVATION - NETTOYAGE DES ANCIENS CACHES
// ============================================================

self.addEventListener("activate", (event) => {
  console.log("✨ SW activation...");

  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (![STATIC_CACHE, IMAGE_CACHE, API_CACHE, CACHE_NAME].includes(cache)) {
              console.log(`🗑️ Suppression ancien cache: ${cache}`);
              return caches.delete(cache);
            }
            return null;
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// ============================================================
// FCM BACKGROUND - NOTIFICATIONS QUAND APP FERMÉE / ARRIÈRE-PLAN
// ============================================================

messaging.onBackgroundMessage((payload) => {
  console.log("🔥 FCM Background:", payload);

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    "Santé Plus";

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    "Nouvelle notification";

  const url =
    payload.data?.url ||
    payload.fcmOptions?.link ||
    "/";

  const type =
    payload.data?.type ||
    "push";

  const options = {
    body,
    icon: "/assets/images/logo-general-icon.png",
    badge: "/assets/images/logo-general-icon.png",
    vibrate: [200, 100, 200],
    silent: false,
    requireInteraction: true,
    renotify: true,
    tag: `sante-plus-${type}-${Date.now()}`,
    data: {
      url,
      type,
      title,
      body,
      timestamp: Date.now()
    },
    actions: [
      {
        action: "open",
        title: "Ouvrir"
      }
    ]
  };

  return self.registration.showNotification(title, options);
});

// ============================================================
// CLIC SUR NOTIFICATION
// ============================================================

self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification click:", event.action);

  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const rawUrl = event.notification.data?.url || "/";
  const finalUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();

          if ("navigate" in client) {
            return client.navigate(finalUrl);
          }

          return;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(finalUrl);
      }
    })
  );
});

// ============================================================
// FERMETURE NOTIFICATION
// ============================================================

self.addEventListener("notificationclose", (event) => {
  console.log("🔕 Notification fermée:", event.notification?.data || {});
});

// ============================================================
// STRATÉGIE DE CACHE: OFFLINE-FIRST
// ============================================================

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ne gérer que les requêtes GET
  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  // Ignorer les extensions Chrome / requêtes non HTTP
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // ============================================================
  // REQUÊTES API
  // ============================================================

  if (url.pathname.includes("/api/")) {
    event.respondWith(
      fetch(request, {
        credentials: "include",
        headers: {
          Authorization: request.headers.get("Authorization") || "",
          "Cache-Control": "no-cache"
        }
      })
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();

            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache).catch((err) => {
                console.warn("⚠️ Cache API impossible:", err.message);
              });
            });
          }

          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);

          if (cachedResponse) {
            return cachedResponse;
          }

          return new Response(
            JSON.stringify({
              offline: true,
              message: "Mode hors-ligne",
              timestamp: Date.now()
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        })
    );

    return;
  }

  // ============================================================
  // IMAGES
  // ============================================================

  if (request.destination === "image") {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            return cached;
          }

          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(IMAGE_CACHE).then((cache) => {
                  cache.put(request, networkResponse.clone()).catch((err) => {
                    console.warn("⚠️ Cache image impossible:", err.message);
                  });
                });
              }

              return networkResponse;
            });
        })
        .catch(() => {
          return caches.match("/assets/images/logo-general-icon.png");
        })
    );

    return;
  }

  // ============================================================
  // FICHIERS STATIQUES / PAGES
  // ============================================================

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();

              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, responseToCache).catch((err) => {
                  console.warn("⚠️ Cache statique impossible:", err.message);
                });
              });
            }

            return networkResponse;
          });
      })
      .catch(async () => {
        if (
          url.pathname.endsWith(".html") ||
          url.pathname === "/" ||
          request.mode === "navigate"
        ) {
          const offlinePage = await caches.match("/offline.html");

          if (offlinePage) {
            return offlinePage;
          }
        }

        return new Response("Page non disponible hors-ligne", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      })
  );
});

// ============================================================
// BACKGROUND SYNC
// ============================================================

self.addEventListener("sync", (event) => {
  console.log("🔁 Background sync:", event.tag);

  if (event.tag === "sync-queued-requests") {
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: "SYNC_REQUIRED",
            timestamp: Date.now()
          });
        });
      })
    );
  }
});

// ============================================================
// MESSAGES DEPUIS L'APP PRINCIPALE
// ============================================================

self.addEventListener("message", (event) => {
  console.log("📩 Message reçu dans SW:", event.data);

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cache) => caches.delete(cache)));
      })
    );
  }
});
