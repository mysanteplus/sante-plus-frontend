// firebase.js - Version corrigée

// Fallback si CONFIG n'est pas disponible
const getFirebaseConfig = () => {
  if (window.CONFIG && window.CONFIG.FIREBASE) {
    return window.CONFIG.FIREBASE;
  }
  
  // Fallback direct (à adapter avec tes vraies clés)
  return {
    apiKey: "AIzaSyDEHMUhAVtYXzQZuTNs3mYeq4Cag7IsUfI",
    authDomain: "santeplus-service-9ad08.firebaseapp.com",
    projectId: "santeplus-service-9ad08",
    storageBucket: "santeplus-service-9ad08.firebasestorage.app",
    messagingSenderId: "745872164641",
    appId: "1:745872164641:web:fcbc5bcee6ae4dbb2ca060",
    measurementId: "G-6Q72EHMPD8",
    vapidKey: "BNeY_I69yPNM2R-kjlAWMjghL21XVvG9-EPTet200rg6S4TEJvRDsbAeWO5TqODp9h1tZS5LtlLOBb5lDoQGz6M"
  };
};

// Initialiser Firebase
if (!firebase.apps.length) {
  const config = getFirebaseConfig();
  firebase.initializeApp(config);
  console.log("✅ Firebase initialisé");
}

// ✅ AJOUTER CECI - Créer l'instance messaging
const messaging = firebase.messaging();

// ✅ Exposer messaging globalement
window.messaging = messaging;

console.log("✅ Firebase Messaging initialisé");
