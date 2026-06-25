// ============================================================
// CONFIGURATION FRONTEND - PRODUCTION READY
// ============================================================

// Détection Capacitor (application mobile)
const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

// ✅ Fonction pour construire l'URL de l'API
function getApiUrl() {
    if (isCapacitor) {
        return "https://sante-plus-backend-main.onrender.com/api";
    }
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return "http://localhost:4000/api";
    }
    
    // Production
    return "https://sante-plus-backend-main.onrender.com/api";
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================

export const CONFIG = {
    // ============================================================
    // API
    // ============================================================
    API_URL: getApiUrl(),

    // ============================================================
    // SUPABASE - Clés ANON (publiques) pour le frontend
    // Ces clés sont visibles par le navigateur, c'est NORMAL.
    // La sécurité est assurée par les RLS (Row Level Security) dans Supabase.
    // ⚠️ Ne JAMAIS mettre la clé SERVICE_ROLE ici !
    // ============================================================
    SUPABASE_URL: "https://bcliieqhymeubmsdkqyn.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjbGlpZXFoeW1ldWJtc2RrcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTY1NDksImV4cCI6MjA5MjI5MjU0OX0.wohWAn4emeWqZicjYv7jDq8xzZFNVZlEhZRWr1xEog8",

    // ============================================================
    // FIREBASE - Configuration publique
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
    // FEDAPAY - Clé publique (visible par le navigateur)
    // ============================================================
    FEDAPAY: {
        PUBLIC_KEY: "pk_live_yUBTAv4LLN0V7WBMpfuXnPdD"
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

// ============================================================
// INITIALISATION GLOBALE
// ============================================================

if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    console.log('✅ [CONFIG] Chargé, API_URL:', CONFIG.API_URL);
}
