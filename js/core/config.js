// ============================================================
// CONFIGURATION FRONTEND
// ============================================================

// Détection Capacitor
const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

// ✅ Récupérer les variables d'environnement depuis le window (injectées par le backend)
if (typeof window !== 'undefined') {
    window._env_ = window._env_ || {};
}

// ✅ Fonction pour obtenir les variables d'environnement
function getEnv(key, defaultValue = '') {
    if (typeof window !== 'undefined' && window._env_ && window._env_[key]) {
        return window._env_[key];
    }
    // En développement, on peut utiliser des valeurs par défaut
    if (process.env.NODE_ENV === 'development') {
        return defaultValue;
    }
    // En production, on force l'utilisation de window._env_
    if (typeof window !== 'undefined' && window._env_) {
        console.warn(`⚠️ Variable ${key} non trouvée dans window._env_, utilisation du fallback`);
    }
    return defaultValue;
}

export const CONFIG = {
    // ============================================================
    // API
    // ============================================================
    API_URL: isCapacitor 
        ? "https://sante-plus-backend-main.onrender.com/api"
        : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:4000/api"
            : "https://sante-plus-backend-main.onrender.com/api"),

    // ============================================================
    // SUPABASE - UNIQUEMENT depuis les variables d'environnement
    // ============================================================
    SUPABASE_URL: getEnv('SUPABASE_URL'),
    SUPABASE_KEY: getEnv('SUPABASE_KEY'),

    // ============================================================
    // FIREBASE
    // ============================================================
    FIREBASE: {
        apiKey: "AIzaSyDEHMUhAVtYXzQZuTNs3mYeq4Cag7IsUfI",
        authDomain: "santeplus-service-9ad08.firebaseapp.com",
        projectId: "santeplus-service-9ad08",
        storageBucket: "santeplus-service-9ad08.firebasestorage.app",
        messagingSenderId: "745872164641",
        appId: "1:745872164641:web:fcbc5bcee6ae4dbb2ca060",
        measurementId: "G-6Q72EHMPD8",
        vapidKey: "BNeY_I69yPNM2R-kjlAWMjghL21XVvG9-EPTet200rg6S4TEJvRDsbAeWO5TqODp9h1tZS5LtlLOBb5lDoQGz6M"
    },

    // ============================================================
    // BRANDING
    // ============================================================
    APP_NAME: "Santé Plus Services",
    THEME_COLOR: "#16a34a",
    
    LOGO_GENERAL_TEXT: "/assets/images/logo-general-text.png",
    LOGO_MAMAN_TEXT: "/assets/images/logo-maman-text.png",
    LOGO_GENERAL_ICON: "/assets/images/logo-general-icon.png",
    LOGO_MAMAN_ICON: "/assets/images/logo-maman-icon.png"
};

// ✅ Vérification au chargement
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    
    // ⚠️ Avertir si les variables Supabase sont manquantes
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
        console.warn('⚠️ [CONFIG] Variables Supabase manquantes. Vérifiez que /api/config est accessible.');
        console.warn('   SUPABASE_URL:', CONFIG.SUPABASE_URL ? '✅ présent' : '❌ manquant');
        console.warn('   SUPABASE_KEY:', CONFIG.SUPABASE_KEY ? '✅ présent' : '❌ manquant');
    } else {
        console.log('✅ [CONFIG] Supabase configuré');
    }
}
