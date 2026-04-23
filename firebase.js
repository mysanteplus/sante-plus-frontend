/**
 * 🔥 Firebase Configuration - Utilise CONFIG centralisé
 */

// Initialiser Firebase avec la config centralisée
if (!firebase.apps.length) {
  firebase.initializeApp(window.CONFIG.FIREBASE);
}

// 🔥 Demander la permission et enregistrer le token
async function initFirebaseNotifications() {
    try {
        // Vérifier si on est en HTTPS (obligatoire pour les SW)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.log('⚠️ HTTPS requis pour les notifications push');
            return;
        }
        
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('❌ Permission notifications refusée');
            return;
        }
        
        const messaging = firebase.messaging();
        
        // Attendre que le SW soit prêt
        const registration = await navigator.serviceWorker.ready;
        
        // Utiliser le SW existant
        const token = await messaging.getToken({
            vapidKey: window.CONFIG.FIREBASE.vapidKey,
            serviceWorkerRegistration: registration
        });
        
        console.log("🔥 Token FCM:", token);
        
        // Sauvegarder le token dans le backend
        const userId = localStorage.getItem("user_id");
        if (userId && token) {
            const response = await fetch(`${window.CONFIG.API_URL}/save-push-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, user_id: userId })
            });
            
            if (response.ok) {
                console.log("✅ Token FCM enregistré côté serveur");
            } else {
                console.error("❌ Erreur sauvegarde token");
            }
        }
        
        // Écouter les messages foreground
        messaging.onMessage((payload) => {
            console.log("📨 Notification foreground:", payload);
            if (window.showToast) {
                window.showToast(payload.notification?.body || "Nouvelle notification", "info", 5000);
            }
        });
        
    } catch (err) {
        console.error("❌ Erreur init Firebase:", err);
        if (err.code === 'messaging/failed-service-worker-registration') {
            console.warn("⚠️ Problème SW - Les notifications push peuvent être limitées");
        }
    }
}

// Exécuter au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseNotifications);
} else {
    setTimeout(initFirebaseNotifications, 1000);
}

// Export global
window.messaging = firebase.messaging();
