// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Configuration Firebase (à vérifier avec tes vraies clés)
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

// 🔥 Important : Gestion des messages en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || 'Santé Plus';
  const notificationOptions = {
    body: payload.notification?.body || 'Nouvelle notification',
    icon: '/assets/images/logo-general-icon.png',
    badge: '/assets/images/logo-general-icon.png',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      click_action: payload.data?.click_action || '/'
    },
    requireInteraction: true
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestion du clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (let client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
