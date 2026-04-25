import { CONFIG } from "./config.js";
import ErrorHandler from './errorHandler.js';
import db from './db.js';

const isCapacitor = typeof window !== 'undefined' && window.hasOwnProperty('Capacitor');

// 🔥 DÉSACTIVER LE CACHE MÉMOIRE
// const apiCache = new Map(); // ← COMMENTÉ - Plus de cache mémoire
// const CACHE_DURATION = 30 * 1000; // ← COMMENTÉ

// 🔥 TOUS LES ENDPOINTS SONT EXCLUS DU CACHE
const NO_CACHE_ENDPOINTS = [
  '/visites/active', 
  '/notifications', 
  '/visites', 
  '/commandes', 
  '/patients', 
  '/planning', 
  '/messages',
  '/aidants',
  '/dashboard/stats',
  '/billing'
];

// ============================================================
// UTILITAIRE : FORCER LE FORMAT TABLEAU
// ============================================================
function ensureArray(data, endpoint) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray(data.data)) {
        console.log(`📦 [api.js] Conversion: ${endpoint} → utilisation de data.data`);
        return data.data;
    }
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
        console.log(`📦 [api.js] Conversion: ${endpoint} → utilisation de data.results`);
        return data.results;
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        console.log(`📦 [api.js] Conversion: ${endpoint} → objet unique converti en tableau`);
        return [data];
    }
    console.warn(`⚠️ [api.js] Données invalides pour ${endpoint}:`, data);
    return [];
}

// ============================================================
// 🔥 FONCTION POUR AJOUTER UN TIMESTAMP ANTI-CACHE
// ============================================================
function addNoCacheParam(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${Date.now()}`;
}

// ============================================================
// SECURE FETCH - VERSION SANS CACHE
// ============================================================
export async function secureFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const method = options.method || 'GET';
  
  console.log(`📡 [FRAIS] Appel API : ${method} ${endpoint} - ${new Date().toLocaleTimeString()}`);

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 🔥 DÉSACTIVER LA VÉRIFICATION DU CACHE INDEXEDDB
  // Plus de cache du tout !
  const isMessagesEndpoint = endpoint.includes('/messages');
  
  // ⚠️ On n'utilise plus jamais le cache IndexedDB
  // if (shouldUseIndexedDB && db.isReady) { ... } ← SUPPRIMÉ

  const executeRequest = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // 🔥 AJOUTER UN TIMESTAMP POUR FORCER L'ACTUALISATION
      let url = `${CONFIG.API_URL}${endpoint}`;
      url = addNoCacheParam(url);
      
      console.log(`🌐 [FRAIS] Requête vers: ${url}`);
      
      const fetchOptions = {
        method: options.method || 'GET',
        headers: headers,
        signal: controller.signal,
        cache: 'no-store'  // 🔥 Forcer le navigateur à ignorer son cache
      };
      
      // Ajouter le body si présent
      if (options.body) {
        fetchOptions.body = options.body;
      }
      
      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);
      
      console.log(`📥 [FRAIS] Réponse API [${response.status}] : ${endpoint}`);

      if (response.status === 503) {
        throw new Error("Le serveur se réveille... Veuillez patienter 30 secondes.");
      }

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_name");
        localStorage.removeItem("user_email");
        window.location.reload();
        throw new Error("Session expirée");
      }

      if (!response.ok) {
        let errorMessage = `Erreur ${response.status}`;
        try {
          const errData = await response.json();
          errorMessage = errData.error || errData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      let responseData;
      if (method === 'GET') {
        responseData = await response.json();
        
        // FORCER LE FORMAT TABLEAU POUR CERTAINS ENDPOINTS
        const arrayEndpoints = ['/visites', '/commandes', '/notifications', '/messages', '/patients', '/planning', '/aidants', '/baby_metrics', '/mama_moods'];
        const shouldBeArray = arrayEndpoints.some(e => endpoint.includes(e));
        
        if (shouldBeArray) {
          responseData = ensureArray(responseData, endpoint);
        }
        
        // 🔥 PLUS AUCUN CACHE MÉMOIRE
        // On ne stocke plus rien du tout
        
      } else {
        responseData = await response.json();
      }

      // 🔥 Invalider les caches après modification (POST/PUT/DELETE)
      if (method !== 'GET') {
        console.log(`🗑️ [FRAIS] Modification détectée, nettoyage des références pour: ${endpoint}`);
        
        // Déclencher un événement pour rafraîchir l'UI
        if (typeof window !== 'undefined') {
          let resourceType = 'unknown';
          if (endpoint.includes('/messages')) resourceType = 'message_sent';
          else if (endpoint.includes('/commandes')) resourceType = 'commande_updated';
          else if (endpoint.includes('/visites/start')) resourceType = 'visit_started';
          else if (endpoint.includes('/visites/end')) resourceType = 'visit_ended';
          else if (endpoint.includes('/visites')) resourceType = 'visites';
          else if (endpoint.includes('/patients')) resourceType = 'patients';
          else if (endpoint.includes('/planning')) resourceType = 'planning';
          
          window.dispatchEvent(new CustomEvent('app-data-updated', { 
            detail: { 
              endpoint: endpoint,
              method: method,
              resourceType: resourceType,
              timestamp: Date.now()
            } 
          }));
        }
      }

      console.log(`✅ [FRAIS] Données reçues: ${responseData?.length || Object.keys(responseData || {}).length} éléments`);
      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error("Le serveur ne répond pas. Vérifiez votre connexion.");
      }
      throw error;
    }
  };

  try {
    // 🔥 PLUS DE CACHE MÉMOIRE DU TOUT
    // On exécute directement la requête réseau
    return await ErrorHandler.retry(executeRequest, 2); // 2 essais max au lieu de 3
    
  } catch (err) {
    console.error(`❌ [FRAIS] Erreur API ${method} ${endpoint}:`, err.message);
    throw err;
  }
}

// ============================================================
// VIDER TOUS LES CACHES (appel manuel si besoin)
// ============================================================
export function clearApiCache() {
  console.log('🗑️ [FRAIS] Nettoyage des caches...');
  
  // Vider le cache mémoire (si jamais il reste quelque chose)
  // apiCache.clear(); ← Plus utilisé
  
  // Vider IndexedDB
  if (db.isReady) {
    db.clear('api_cache').then(() => {
      console.log('🗑️ [FRAIS] Cache IndexedDB vidé');
    }).catch(err => {
      console.warn('⚠️ [FRAIS] Erreur nettoyage IndexedDB:', err);
    });
  }
  
  // Vider le cache navigateur via Service Worker
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        if (cacheName.includes('sps')) {
          caches.delete(cacheName);
          console.log(`🗑️ [FRAIS] Cache SW supprimé: ${cacheName}`);
        }
      });
    });
  }
  
  console.log('✅ [FRAIS] Tous les caches ont été vidés');
}

// ============================================================
// VÉRIFIER LA CONNEXION
// ============================================================
export function isOnline() {
    return navigator.onLine;
}

// ============================================================
// ÉVÉNEMENTS RÉSEAU
// ============================================================
window.addEventListener('online', () => {
    console.log('📶 [FRAIS] Connexion rétablie');
    if (window.showToast) {
        window.showToast("Connexion rétablie", "success", 2000);
    }
    // 🔥 Forcer le rechargement des données
    window.dispatchEvent(new CustomEvent('connection-restored'));
    window.dispatchEvent(new CustomEvent('app-data-updated', { 
      detail: { resourceType: 'connection_restored', timestamp: Date.now() } 
    }));
});

window.addEventListener('offline', () => {
    console.log('📶 [FRAIS] Connexion perdue');
    if (window.showToast) {
        window.showToast("Connexion perdue - Mode dégradé", "warning", 3000);
    }
    window.dispatchEvent(new CustomEvent('connection-lost'));
});

// ============================================================
// REPRENDRE LES REQUÊTES EN FILE D'ATTENTE
// ============================================================
export async function retryQueuedRequests() {
  await ErrorHandler.processRetryQueue();
}

// ============================================================
// FONCTION DE FORCE REFRESH POUR TOUTES LES DONNÉES
// ============================================================
export async function forceRefreshAllData() {
  console.log('🔄 [FRAIS] Force refresh de toutes les données...');
  
  // Vider les caches
  clearApiCache();
  
  // Déclencher un événement global
  window.dispatchEvent(new CustomEvent('app-data-updated', { 
    detail: { 
      resourceType: 'force_refresh', 
      timestamp: Date.now(),
      force: true
    } 
  }));
  
  // Recharger la vue courante si possible
  if (window.AppState && window.AppState.currentView && window.switchView) {
    const currentView = window.AppState.currentView;
    console.log(`🔄 [FRAIS] Rechargement de la vue: ${currentView}`);
    await window.switchView(currentView);
  }
  
  console.log('✅ [FRAIS] Force refresh terminé');
}

// Exposer la fonction globalement
if (typeof window !== 'undefined') {
  window.forceRefreshAllData = forceRefreshAllData;
}
