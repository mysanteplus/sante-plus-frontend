self.addEventListener("push", function (event) {
  const data = event.data.json();

  const options = {
    body: data.message,
    // Utilisation du logo officiel harmonisé
    icon: "https://res.cloudinary.com/dglwrrvh3/image/upload/v1774974945/heart-beat_tjb16u.png",
    badge: "https://res.cloudinary.com/dglwrrvh3/image/upload/v1774974945/heart-beat_tjb16u.png",
    vibrate: [100, 50, 100],
    data: { url: data.url },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Quand on clique sur la notif, on ouvre l'app au bon endroit
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
