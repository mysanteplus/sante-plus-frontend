
const firebaseConfig = {
  apiKey: "AIzaSyDXQkxs90j9IQ_MxYOKsDyehMWguBsSwoQ",
  authDomain: "santeplus-service-50ec2.firebaseapp.com",
  projectId: "santeplus-service-50ec2",
  storageBucket: "santeplus-service-50ec2.firebasestorage.app",
  messagingSenderId: "682827861094",
  appId: "1:682827861094:web:bbea5ff46932a8acdbf1a7",
  measurementId: "G-FBELVQMD00"
};




// Initialisation
firebase.initializeApp(firebaseConfig);

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
        
        // ✅ IMPORTANT: Spécifier explicitement le service worker existant
        // Attendre que le SW soit prêt
        const registration = await navigator.serviceWorker.ready;
        
        // Utiliser le SW existant au lieu d'en créer un nouveau
        const token = await messaging.getToken({
            vapidKey: "BEHVyXI23ebDvRG90FlTvbWzvHlhV7hD_ec_Y3_VuP2o_dX2tHqP_ar2WVw1CRpf8PfSyQXKahVGmPknuco8JRA",
            serviceWorkerRegistration: registration  // ← Clé magique !
        });
        
        console.log("🔥 Token FCM:", token);
        
        // Sauvegarder le token dans le backend
        const userId = localStorage.getItem("user_id");
        if (userId && token) {
            const response = await fetch(`${window.CONFIG?.API_URL || 'https://sante-plus-backend-main.onrender.com/api'}/save-push-token`, {
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
        // Afficher un message plus clair pour l'utilisateur
        if (err.code === 'messaging/failed-service-worker-registration') {
            console.warn("⚠️ Problème SW - Les notifications push peuvent être limitées");
        }
    }
}

// Exécuter au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseNotifications);
} else {
    // Attendre un peu que le SW soit enregistré
    setTimeout(initFirebaseNotifications, 1000);
}

// Export global
window.messaging = firebase.messaging();
