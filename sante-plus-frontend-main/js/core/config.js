// Détection Capacitor
const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

export const CONFIG = {
  API_URL: isCapacitor 
    ? "https://sante-plus-backend-ux1n.onrender.com/api"
    : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000/api"
      : "https://sante-plus-backend-ux1n.onrender.com/api"),

  APP_NAME: "Santé Plus Services",
  THEME_COLOR: "#16a34a",
  
  LOGO_GENERAL_TEXT: "/sante-plus-frontend/assets/images/logo-general-text.png",
  LOGO_MAMAN_TEXT: "/sante-plus-frontend/assets/images/logo-maman-text.png",
  LOGO_GENERAL_ICON: "/sante-plus-frontend/assets/images/logo-general-icon.png",
  LOGO_MAMAN_ICON: "/sante-plus-frontend/assets/images/logo-maman-icon.png"
};
