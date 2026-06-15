// firebase.js

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
window.messaging = messaging;

// Notifications reçues quand l'app est ouverte
messaging.onMessage((payload) => {
  console.log("🔔 FCM foreground:", payload);

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
    "/";

  if (window.showToast) {
    window.showToast(body, "info", 4000);
  }

  if (Notification.permission === "granted" && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: "/assets/images/logo-general-icon.png",
        badge: "/assets/images/logo-general-icon.png",
        vibrate: [200, 100, 200],
        requireInteraction: true,
        renotify: true,
        tag: `sante-plus-${Date.now()}`,
        data: { url }
      });
    });
  }

  window.dispatchEvent(new CustomEvent("new-notification", {
    detail: {
      title,
      message: body,
      type: payload.data?.type || "push",
      url
    }
  }));
});
