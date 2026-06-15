// firebase.js

firebase.initializeApp({
  apiKey: "AIzaSyBzLQLLWmRI7Nr-c-Ht9DKkJejMxh-5C4g",
  authDomain: "santeplus-service.firebaseapp.com",
  projectId: "santeplus-service",
  storageBucket: "santeplus-service.appspot.com",
  messagingSenderId: "706607823043",
  appId: "1:706607823043:web:0f1f6433cdc796d62b0a76"
});

const messaging = firebase.messaging();
window.messaging = messaging;

// Notification quand l'app est ouverte
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
    payload.fcmOptions?.link ||
    "/";

  // Toast interne
  if (window.showToast) {
    window.showToast(body, "info", 4000);
  }

  // Notification système même quand l'app est ouverte
  if (Notification.permission === "granted" && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        icon: "/assets/images/logo-general-icon.png",
        badge: "/assets/images/logo-general-icon.png",
        vibrate: [200, 100, 200],
        requireInteraction: true,
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
