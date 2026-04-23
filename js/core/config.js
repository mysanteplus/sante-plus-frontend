// Détection Capacitor
const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

export const CONFIG = {
  API_URL: isCapacitor 
    ? "https://sante-plus-backend-main.onrender.com/api"
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000/api"
      : "https://sante-plus-backend-main.onrender.com/api"),

    SUPABASE_URL: "https://tagqwwfbpfzluahboczh.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZ3F3d2ZicGZ6bHVhaGJvY3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDYxMDYsImV4cCI6MjA5MDM4MjEwNn0.I0HqBYPTrxPOg41sEWm_hU7YY3f9ZXCekUX5NlgIBWw",

  APP_NAME: "Santé Plus Services",
  THEME_COLOR: "#16a34a",
  
  LOGO_GENERAL_TEXT: "/assets/images/logo-general-text.png",
  LOGO_MAMAN_TEXT: "/assets/images/logo-maman-text.png",
  LOGO_GENERAL_ICON: "/assets/images/logo-general-icon.png",
  LOGO_MAMAN_ICON: "/assets/images/logo-maman-icon.png"
};
