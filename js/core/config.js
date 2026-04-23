// Détection Capacitor
const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

export const CONFIG = {
  API_URL: isCapacitor 
    ? "https://sante-plus-backend-main.onrender.com/api"
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000/api"
      : "https://sante-plus-backend-main.onrender.com/api"),

  SUPABASE_URL: "https://bcliieqhymeubmsdkqyn.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjbGlpZXFoeW1ldWJtc2RrcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTY1NDksImV4cCI6MjA5MjI5MjU0OX0.wohWAn4emeWqZicjYv7jDq8xzZFNVZlEhZRWr1xEog8",

  // Firebase Configuration
  FIREBASE: {
    apiKey: "AIzaSyDXQkxs90j9IQ_MxYOKsDyehMWguBsSwoQ",
    authDomain: "santeplus-service-50ec2.firebaseapp.com",
    projectId: "santeplus-service-50ec2",
    storageBucket: "santeplus-service-50ec2.firebasestorage.app",
    messagingSenderId: "682827861094",
    appId: "1:682827861094:web:bbea5ff46932a8acdbf1a7",
    measurementId: "G-FBELVQMD00",
    vapidKey: "BEHVyXI23ebDvRG90FlTvbWzvHlhV7hD_ec_Y3_VuP2o_dX2tHqP_ar2WVw1CRpf8PfSyQXKahVGmPknuco8JRA"
  },

  APP_NAME: "Santé Plus Services",
  THEME_COLOR: "#16a34a",
  
  LOGO_GENERAL_TEXT: "/sante-plus-frontend/assets/images/logo-general-text.png",
  LOGO_MAMAN_TEXT: "/sante-plus-frontend/assets/images/logo-maman-text.png",
  LOGO_GENERAL_ICON: "/sante-plus-frontend/assets/images/logo-general-icon.png",
  LOGO_MAMAN_ICON: "/sante-plus-frontend/assets/images/logo-maman-icon.png"
};

// Exposer la configuration globalement
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
