// ============================================================
// js/modules/map.js - MODULE CARTE COMPLET
// Version: 2.0
// Description: Gestion de la carte pour les 3 rôles
// ============================================================

import { secureFetch } from "../core/api.js";
import { AppState } from "../core/state.js";
import { UI, showToast } from "../core/utils.js";

// ============================================================
// VARIABLES GLOBALES
// ============================================================

let map = null;
let markers = {};
let routeLayer = null;
let trajectoryLayer = null;
let watchId = null;
let trajectoryPoints = [];
let activeInterval = null;
let replayInterval = null;
let currentReplayIndex = 0;
let selectedAidantId = null;
let isSatelliteView = true; // Pour le toggle entre modes

// Coordonnées du siège SPS (Cotonou)
const SPS_HQ = {
    lat: 6.368,
    lng: 2.401,
    name: "Siège Santé Plus"
};

// Seuils
const OFF_ROUTE_THRESHOLD = 50;
let offRouteAlertShown = false;
let isNavigating = false;
let currentPatient = null;
let currentPatientCoords = null;
let lastRouteCalculation = null;

// Stockage des données
let activeAidants = [];

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatDistance(meters) {
    if (!meters) return '---';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    if (!seconds) return '---';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    if (minutes > 0) return `${minutes} min`;
    return `Moins d'une minute`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
}

function getSavedPatientId() {
    return (
        AppState.currentPatient ||
        localStorage.getItem("current_patient_id") ||
        localStorage.getItem("active_patient_id")
    );
}

function setActivePatient(patientId) {
    AppState.currentPatient = patientId;
    localStorage.setItem("current_patient_id", patientId);
    localStorage.setItem("active_patient_id", patientId);
}

function safeLatLng(lat, lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);

    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
    if (nLat === 0 || nLng === 0) return null;

    return {
        lat: nLat,
        lng: nLng
    };
}

function isFreshPosition(item, maxMinutes = 10) {
    const date =
        item?.last_position?.created_at ||
        item?.last_position?.updated_at ||
        item?.updated_at ||
        item?.created_at ||
        null;

    if (!date) return false;

    const diffMs = Date.now() - new Date(date).getTime();
    const diffMinutes = diffMs / 60000;

    return diffMinutes <= maxMinutes;
}

function getPositionAgeText(item) {
    const date =
        item?.last_position?.created_at ||
        item?.last_position?.updated_at ||
        item?.updated_at ||
        item?.created_at ||
        null;

    if (!date) return "Position inconnue";

    const diffMs = Date.now() - new Date(date).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return "À l’instant";
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;

    const hours = Math.floor(diffMinutes / 60);
    return `Il y a ${hours}h`;
}

function clearMapRuntime() {
    if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
    }

    if (watchId) {
        try {
            navigator.geolocation.clearWatch(watchId);
        } catch (e) {}
        watchId = null;
    }

    if (map) {
        try {
            map.remove();
        } catch (e) {}
    }

    map = null;
    markers = {};

    if (routeLayer) {
        routeLayer = null;
    }

    if (trajectoryLayer) {
        trajectoryLayer = null;
    }
}

function hideMapLoading() {
    const loaderElement = document.getElementById("map-loading");
    if (loaderElement) {
        loaderElement.style.opacity = "0";
        setTimeout(() => {
            loaderElement.style.display = "none";
        }, 300);
    }
}

// ============================================================
// CRÉATION D'ICÔNES
// ============================================================

function createCustomIcon(color, isActive = true, size = 'md', icon = 'user-nurse') {
    const sizes = {
        sm: { w: 32, h: 32, dot: 10, ring: 28 },
        md: { w: 40, h: 40, dot: 14, ring: 36 },
        lg: { w: 48, h: 48, dot: 18, ring: 44 }
    };
    const s = sizes[size];
    
    return L.divIcon({
        className: 'custom-radar-icon',
        html: `
            <div class="relative flex items-center justify-center" style="width: ${s.w}px; height: ${s.h}px;">
                ${isActive ? `<div class="absolute rounded-full opacity-30 animate-ping" style="width: ${s.ring}px; height: ${s.ring}px; background: ${color};"></div>` : ''}
                <div class="relative rounded-full border-3 border-white shadow-xl flex items-center justify-center" style="width: ${s.dot}px; height: ${s.dot}px; background: ${color};">
                    <i class="fa-solid fa-${icon} text-white text-[${s.dot/2}px]"></i>
                </div>
            </div>`,
        iconSize: [s.w, s.h],
        iconAnchor: [s.w/2, s.w/2]
    });
}

function createCoordinatorIcon(color, iconName, isAnimated) {
    return L.divIcon({
        className: 'custom-coordinator-icon',
        html: `
            <div class="relative flex items-center justify-center" style="width: 36px; height: 36px;">
                ${isAnimated ? `<div class="absolute rounded-full opacity-30 animate-ping" style="width: 32px; height: 32px; background: ${color};"></div>` : ''}
                <div class="relative rounded-full border-2 border-white shadow-lg flex items-center justify-center" style="width: 28px; height: 28px; background: ${color};">
                    <i class="fa-solid fa-${iconName} text-white text-xs"></i>
                </div>
            </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
}

// ============================================================
// FONCTION D'AJOUT DU FOND DE CARTE
// ============================================================

function addTileLayer(mapInstance, style = 'satellite') {
    // ============================================================
    // 🗺️ CHOIX DU FOND DE CARTE - DÉCOMMENTER CELUI QUE TU VEUX
    // ============================================================
    
    // 🔴 OPTION 1: GOOGLE MAPS SATELLITE (Très réaliste - Recommandé)
    // https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}
    // 's' = satellite, 'y' = hybrid (satellite + routes), 'm' = plan, 'p' = terrain
    // ============================================================
    // L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    //     maxZoom: 20,
    //     attribution: 'Google'
    // }).addTo(mapInstance);

    // 🔴 OPTION 2: GOOGLE MAPS HYBRID (Satellite + Routes - Très bonne visibilité)
    // ============================================================
    // L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    //     maxZoom: 20,
    //     attribution: 'Google'
    // }).addTo(mapInstance);

    // 🔴 OPTION 3: GOOGLE MAPS PLAN (Comme Google Maps classique)
    // ============================================================
    // L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    //     maxZoom: 20,
    //     attribution: 'Google'
    // }).addTo(mapInstance);

    // 🔴 OPTION 4: GOOGLE MAPS TERRAIN (Avec relief)
    // ============================================================
    // L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    //     maxZoom: 20,
    //     attribution: 'Google'
    // }).addTo(mapInstance);

    // 🔴 OPTION 5: ESRI SATELLITE (Excellente qualité)
    // ============================================================
    // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    //     maxZoom: 19,
    //     attribution: 'Tiles &copy; Esri'
    // }).addTo(mapInstance);

    // 🔴 OPTION 6: OPENSTREETMAP (Classique, gratuit, détaillé)
    // ============================================================
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //     maxZoom: 20,
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    // }).addTo(mapInstance);

    // 🔴 OPTION 7: OPENSTREETMAP HUMANITARIAN (Détaillé, couleurs douces)
    // ============================================================
    // L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    //     maxZoom: 20,
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    // }).addTo(mapInstance);

    // 🔴 OPTION 8: CARTODB VOYAGER (Élégant, moderne)
    // ============================================================
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    //     maxZoom: 20,
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
    // }).addTo(mapInstance);

    // 🔴 OPTION 9: CARTODB DARK MATTER (Mode nuit)
    // ============================================================
    // L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    //     maxZoom: 20,
    //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
    // }).addTo(mapInstance);

    // 🔴 OPTION 10: GOOGLE MAPS SATELLITE AVEC ROUTES (Défaut - si rien n'est décommenté)
    // ============================================================
    if (style === 'satellite') {
        L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: 'Google'
        }).addTo(mapInstance);
    } else if (style === 'hybrid') {
        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: 'Google'
        }).addTo(mapInstance);
    } else if (style === 'street') {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(mapInstance);
    } else {
        // Défaut: Satellite
        L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: 'Google'
        }).addTo(mapInstance);
    }
}

// ============================================================
// FONCTION PRINCIPALE - ROUTAGE PAR RÔLE
// ============================================================

export async function initLiveMap() {
    const container = document.getElementById("view-container");

    try {
        console.log("🗺️ Initialisation de la carte...");

        const userRole = localStorage.getItem("user_role");
        console.log("👤 Rôle utilisateur pour la carte:", userRole);

        if (!container) {
            console.error("❌ view-container introuvable");
            return;
        }

        if (typeof L === "undefined") {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div class="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-map-location-dot text-3xl text-red-400"></i>
                    </div>
                    <h3 class="text-xl font-black text-slate-800">Carte indisponible</h3>
                    <p class="text-sm text-slate-500 mt-2 max-w-sm">
                        Le module Leaflet n’est pas chargé. Vérifiez le script Leaflet dans index.html.
                    </p>
                </div>
            `;
            return;
        }

        if (userRole === "COORDINATEUR") {
            await initCoordinatorMap();
            return;
        }

        if (userRole === "FAMILLE") {
            await initFamilyMap();
            return;
        }

        if (userRole === "AIDANT") {
            await initAidantMap();
            return;
        }

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <i class="fa-solid fa-map-location-dot text-3xl text-slate-300"></i>
                </div>
                <h3 class="text-xl font-black text-slate-800">Radar indisponible</h3>
                <p class="text-sm text-slate-500 mt-2">
                    Cette vue n’est pas disponible pour ce rôle.
                </p>
            </div>
        `;

    } catch (err) {
        console.error("❌ Erreur initLiveMap:", err);

        if (container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-white rounded-3xl border border-red-100 shadow-sm">
                    <div class="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <i class="fa-solid fa-triangle-exclamation text-3xl text-red-400"></i>
                    </div>
                    <h3 class="text-xl font-black text-slate-800">Erreur Radar</h3>
                    <p class="text-sm text-slate-500 mt-2 max-w-sm">
                        La carte n’a pas pu être chargée.
                    </p>
                    <p class="text-[10px] text-red-400 mt-3 font-mono break-all max-w-sm">
                        ${escapeHtml(err.message || "Erreur inconnue")}
                    </p>
                    <button onclick="window.switchView('map')" 
                            class="mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">
                        Réessayer
                    </button>
                </div>
            `;
        }
    }
}

// ============================================================
// 🗺️ VUE COORDINATEUR
// ============================================================

async function initCoordinatorMap() {
    const container = document.getElementById('view-container');
    
    container.innerHTML = `
        <div class="animate-fadeIn flex flex-col h-[85vh] pb-32">
            <div class="flex justify-between items-center mb-6 shrink-0 flex-wrap gap-3">
                <div>
                    <h3 class="text-2xl font-black text-slate-800">📡 Radar Supervision</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Suivi en temps réel des interventions</p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="refresh-map-btn" class="bg-white p-3 rounded-xl shadow-md border border-slate-100">
                        <i class="fa-solid fa-rotate-right text-slate-600"></i>
                    </button>
                    <button id="center-all-btn" class="bg-white p-3 rounded-xl shadow-md border border-slate-100">
                        <i class="fa-solid fa-globe text-slate-600"></i>
                    </button>
                    <button id="show-alerts-btn" class="bg-amber-500 text-white px-4 py-3 rounded-xl shadow-md text-[10px] font-black uppercase">
                        <i class="fa-solid fa-bell"></i> Alertes
                    </button>
                    <button id="toggle-map-style" class="bg-white p-3 rounded-xl shadow-md border border-slate-100" title="Changer le style de carte">
                        <i class="fa-solid fa-layer-group text-slate-600"></i>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Aidants live</p>
                    <p id="admin-live-count" class="text-2xl font-black text-emerald-600 mt-1">0</p>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Patients GPS</p>
                    <p id="admin-patient-count" class="text-2xl font-black text-blue-600 mt-1">0</p>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Hors zone</p>
                    <p id="admin-alert-count" class="text-2xl font-black text-rose-600 mt-1">0</p>
                </div>
                <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Positions anciennes</p>
                    <p id="admin-stale-count" class="text-2xl font-black text-amber-600 mt-1">0</p>
                </div>
            </div>
            
            <div class="mb-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Filtrer par aidant</label>
                        <select id="filter-aidant" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <option value="">Tous les aidants</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Filtrer par patient</label>
                        <select id="filter-patient" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <option value="">Tous les patients</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Statut</label>
                        <select id="filter-status" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <option value="all">Tous</option>
                            <option value="inside">Dans la zone ✅</option>
                            <option value="outside">Hors zone ⚠️</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div id="live-map-container" class="flex-1 w-full rounded-[2rem] border-4 border-white shadow-2xl relative overflow-hidden bg-slate-100 min-h-[500px]">
                <div id="map" class="absolute inset-0 z-10 w-full h-full"></div>
                <div id="map-loading" class="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div class="text-center">
                        <div class="relative w-10 h-10 mx-auto mb-3">
                            <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                        </div>
                        <p class="text-[10px] font-black text-slate-400">Chargement de la carte...</p>
                    </div>
                </div>
            </div>

            <div class="mt-3 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-100">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[8px] font-bold">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>Aidant actif</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>Domicile patient</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></div>
                        <span>Hors zone</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                        <span>Position ancienne</span>
                    </div>
                </div>
            </div>
            
            <div id="info-panel" class="fixed right-4 top-24 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 hidden transition-all">
                <div class="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h4 id="panel-title" class="font-black text-slate-800">Détails</h4>
                    <button id="close-panel" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-times"></i></button>
                </div>
                <div id="panel-content" class="p-4 max-h-96 overflow-y-auto"></div>
            </div>
        </div>
    `;

    await new Promise(r => setTimeout(r, 100));
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("❌ Map element non trouvé");
        return;
    }
    
    if (map) {
        map.remove();
        map = null;
        markers = {};
    }

    const existingMapElement = document.getElementById("map");
    if (existingMapElement && existingMapElement._leaflet_id) {
        existingMapElement._leaflet_id = null;
    }
    
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false, 
        zoomSnap: 0.5,
        center: [6.368, 2.401],
        zoom: 14
    });
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    // ✅ AJOUT DU FOND DE CARTE AVEC LES OPTIONS
    addTileLayer(map, 'satellite'); // Change 'satellite' par 'hybrid', 'street', etc.
    
    setTimeout(() => {
        if (map) map.invalidateSize(true);
    }, 200);
    
    // ✅ BOUTON POUR CHANGER LE STYLE DE CARTE
    document.getElementById('toggle-map-style')?.addEventListener('click', () => {
        // Supprimer les anciennes couches
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        
        // Alterner entre Satellite et Plan
        isSatelliteView = !isSatelliteView;
        if (isSatelliteView) {
            addTileLayer(map, 'satellite');
            showToast("🌍 Mode Satellite", "info", 1500);
        } else {
            addTileLayer(map, 'street');
            showToast("🗺️ Mode Plan", "info", 1500);
        }
    });
    
    // Événements
    document.getElementById('refresh-map-btn')?.addEventListener('click', () => loadCoordinatorData());
    document.getElementById('center-all-btn')?.addEventListener('click', () => centerAllMarkers());
    document.getElementById('show-alerts-btn')?.addEventListener('click', () => showAlertsPanel());
    document.getElementById('close-panel')?.addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');
    });
    
    document.getElementById('filter-aidant')?.addEventListener('change', () => applyFilters());
    document.getElementById('filter-patient')?.addEventListener('change', () => applyFilters());
    document.getElementById('filter-status')?.addEventListener('change', () => applyFilters());
    
    await loadCoordinatorData();
    await loadFiltersData();
    
    if (activeInterval) clearInterval(activeInterval);
    activeInterval = setInterval(() => loadCoordinatorData(), 10000);
}

async function loadCoordinatorData() {
    try {
        const aidantsRaw = await secureFetch("/visites/active-aidants");
        const patientsRaw = await secureFetch("/visites/patients-locations");

        const aidants = normalizeArray(aidantsRaw);
        const patients = normalizeArray(patientsRaw);

        activeAidants = aidants;

        const outside = aidants.filter(a => a.is_inside_geofence === false).length;
        const stale = aidants.filter(a => a.last_position && !isFreshPosition(a, 10)).length;

        updateCoordinatorCounters({
            aidants,
            patients,
            outside,
            stale
        });

        updateCoordinatorMarkers(aidants, patients);
        updateCoordinatorStats(aidants);

        if (!aidants.length && !patients.length) {
            renderCoordinatorEmptyNotice("Aucune donnée GPS disponible pour le moment.");
        } else if (!aidants.length) {
            renderCoordinatorEmptyNotice("Aucun aidant actif actuellement. Les patients géolocalisés restent visibles.");
        } else {
            hideCoordinatorEmptyNotice();
        }

        hideMapLoading();

    } catch (err) {
        console.error("❌ Erreur chargement données:", err);
        renderCoordinatorEmptyNotice("Impossible de charger les données terrain. Vérifiez la connexion ou le backend.");
        hideMapLoading();
        showToast("Erreur de chargement Radar Admin", "error");
    }
}

function updateCoordinatorMarkers(aidants, patients) {
    if (!map) return;

    Object.keys(markers).forEach(key => {
        if (markers[key] && map) {
            try {
                map.removeLayer(markers[key]);
            } catch (e) {}
            delete markers[key];
        }
    });

    const bounds = [];

    if (Array.isArray(patients) && patients.length) {
        patients.forEach(patient => {
            const coords = safeLatLng(patient?.lat, patient?.lng);
            if (!coords) return;

            try {
                const icon = createCoordinatorIcon("#3B82F6", "home", false);
                const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(map);

                marker.bindPopup(`
                    <div class="text-center p-2 min-w-[180px]">
                        <p class="font-black text-slate-800">🏠 ${escapeHtml(patient.nom_complet || "Patient")}</p>
                        <p class="text-[10px] text-slate-500 mt-1">${escapeHtml(patient.adresse || "Adresse non renseignée")}</p>
                        <button onclick="window.centerOnPatient(${coords.lat}, ${coords.lng})"
                                class="mt-2 w-full py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black">
                            Centrer
                        </button>
                    </div>
                `);

                markers[`patient_${patient.id}`] = marker;
                bounds.push([coords.lat, coords.lng]);

            } catch (e) {
                console.warn("Erreur marqueur patient:", e);
            }
        });
    }

    if (Array.isArray(aidants) && aidants.length) {
        aidants.forEach(aidant => {
            const coords = safeLatLng(
                aidant?.last_position?.lat,
                aidant?.last_position?.lng
            );

            if (!coords) return;

            try {
                const isInside = aidant.is_inside_geofence === true;
                const isStale = !isFreshPosition(aidant, 10);

                let color = "#10B981";
                let label = "✅ Dans la zone";
                let iconName = "user-nurse";

                if (!isInside) {
                    color = "#F43F5E";
                    label = "⚠️ Hors zone";
                } else if (isStale) {
                    color = "#F59E0B";
                    label = "🟠 Position ancienne";
                }

                const icon = createCoordinatorIcon(color, iconName, !isStale);
                const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(map);

                marker.bindPopup(`
                    <div class="text-center p-2 min-w-[220px]">
                        <p class="font-black text-slate-800">${escapeHtml(aidant.aidant?.nom || aidant.aidant_nom || "Aidant")}</p>
                        <p class="text-[10px] text-slate-500 mt-1">
                            Patient : ${escapeHtml(aidant.patient?.nom_complet || aidant.patient_nom || "?")}
                        </p>
                        <p class="text-[9px] font-bold mt-1" style="color:${color};">
                            ${label}
                        </p>
                        <p class="text-[9px] text-slate-400 mt-1">
                            Dernière position : ${escapeHtml(getPositionAgeText(aidant))}
                        </p>
                        <div class="grid grid-cols-2 gap-2 mt-2">
                            <button onclick="window.centerOnAidant(${coords.lat}, ${coords.lng})"
                                    class="py-1.5 bg-slate-800 text-white rounded-lg text-[9px] font-black">
                                Centrer
                            </button>
                            <button onclick="window.viewAidantHistory('${aidant.aidant?.id || aidant.aidant_id}')"
                                    class="py-1.5 bg-indigo-500 text-white rounded-lg text-[9px] font-black">
                                Historique
                            </button>
                        </div>
                    </div>
                `);

                markers[`aidant_${aidant.id}`] = marker;
                bounds.push([coords.lat, coords.lng]);

            } catch (e) {
                console.warn("Erreur marqueur aidant:", e);
            }
        });
    }

    if (bounds.length > 0) {
        try {
            map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
            map.setView([SPS_HQ.lat, SPS_HQ.lng], 12);
        }
    } else {
        map.setView([SPS_HQ.lat, SPS_HQ.lng], 12);
    }
}

function renderCoordinatorEmptyNotice(message) {
    const container = document.getElementById("live-map-container");
    if (!container) return;

    let notice = document.getElementById("coordinator-empty-notice");
    if (!notice) {
        notice = document.createElement("div");
        notice.id = "coordinator-empty-notice";
        notice.className = "absolute top-4 left-4 right-4 z-30 bg-white/95 backdrop-blur-sm border border-slate-100 rounded-2xl p-4 shadow-lg text-center";
        container.appendChild(notice);
    }

    notice.innerHTML = `
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">État du terrain</p>
        <p class="text-sm font-bold text-slate-700 mt-1">${escapeHtml(message)}</p>
    `;
}

function hideCoordinatorEmptyNotice() {
    const notice = document.getElementById("coordinator-empty-notice");
    if (notice) notice.remove();
}

function updateCoordinatorCounters({ aidants = [], patients = [], outside = 0, stale = 0 }) {
    const liveEl = document.getElementById("admin-live-count");
    const patientEl = document.getElementById("admin-patient-count");
    const alertEl = document.getElementById("admin-alert-count");
    const staleEl = document.getElementById("admin-stale-count");

    if (liveEl) liveEl.innerHTML = String(aidants.length);
    if (patientEl) patientEl.innerHTML = String(patients.length);
    if (alertEl) alertEl.innerHTML = String(outside);
    if (staleEl) staleEl.innerHTML = String(stale);
}

let lastOutsideAlertCount = 0;

function updateCoordinatorStats(aidants) {
    const total = aidants.length;
    const outside = aidants.filter(a => a.is_inside_geofence === false).length;

    const badge = document.getElementById("active-count-badge");
    if (badge) {
        badge.innerHTML = `${total} AIDANT${total > 1 ? "S" : ""} LIVE`;
        badge.classList.toggle("bg-amber-500", outside > 0);
        badge.classList.toggle("bg-emerald-500", outside === 0);
    }

    if (outside > 0 && outside !== lastOutsideAlertCount) {
        showToast(`${outside} aidant${outside > 1 ? "s" : ""} hors zone`, "warning", 5000);
    }

    lastOutsideAlertCount = outside;
}

async function loadFiltersData() {
    try {
        const aidants = normalizeArray(await secureFetch("/visites/active-aidants"));
        const patients = normalizeArray(await secureFetch("/visites/patients-locations"));

        const aidantSelect = document.getElementById("filter-aidant");
        const patientSelect = document.getElementById("filter-patient");

        if (aidantSelect) {
            const uniqueAidants = [
                ...new Map(
                    aidants
                        .map(a => [
                            a.aidant?.id || a.aidant_id,
                            a.aidant || {
                                id: a.aidant_id,
                                nom: a.aidant_nom || "Aidant"
                            }
                        ])
                        .filter(([id]) => id)
                ).values()
            ];

            aidantSelect.innerHTML =
                '<option value="">Tous les aidants</option>' +
                uniqueAidants
                    .map(a => `<option value="${a.id}">${escapeHtml(a.nom || "Aidant")}</option>`)
                    .join("");
        }

        if (patientSelect) {
            patientSelect.innerHTML =
                '<option value="">Tous les patients</option>' +
                patients
                    .filter(p => p?.id)
                    .map(p => `<option value="${p.id}">${escapeHtml(p.nom_complet || "Patient")}</option>`)
                    .join("");
        }

    } catch (err) {
        console.error("Erreur filtres Radar Admin:", err);
    }
}

function applyFilters() {
    const aidantFilter = document.getElementById("filter-aidant")?.value;
    const patientFilter = document.getElementById("filter-patient")?.value;
    const statusFilter = document.getElementById("filter-status")?.value;

    let filtered = [...activeAidants];

    if (aidantFilter) {
        filtered = filtered.filter(a =>
            String(a.aidant?.id || a.aidant_id) === String(aidantFilter)
        );
    }

    if (patientFilter) {
        filtered = filtered.filter(a =>
            String(a.patient?.id || a.patient_id) === String(patientFilter)
        );
    }

    if (statusFilter === "inside") {
        filtered = filtered.filter(a => a.is_inside_geofence === true);
    }

    if (statusFilter === "outside") {
        filtered = filtered.filter(a => a.is_inside_geofence === false);
    }

    const existingPatients = Object.keys(markers)
        .filter(key => key.startsWith("patient_"))
        .map(key => markers[key]);

    Object.keys(markers).forEach(key => {
        if (key.startsWith("aidant_") && markers[key]) {
            try {
                map.removeLayer(markers[key]);
            } catch (e) {}
            delete markers[key];
        }
    });

    filtered.forEach(aidant => {
        const coords = safeLatLng(
            aidant?.last_position?.lat,
            aidant?.last_position?.lng
        );

        if (!coords) return;

        const isInside = aidant.is_inside_geofence === true;
        const isStale = !isFreshPosition(aidant, 10);

        let color = "#10B981";
        let label = "✅ Dans la zone";

        if (!isInside) {
            color = "#F43F5E";
            label = "⚠️ Hors zone";
        } else if (isStale) {
            color = "#F59E0B";
            label = "🟠 Position ancienne";
        }

        const icon = createCoordinatorIcon(color, "user-nurse", !isStale);
        const marker = L.marker([coords.lat, coords.lng], { icon }).addTo(map);

        marker.bindPopup(`
            <div class="text-center p-2 min-w-[200px]">
                <p class="font-black text-slate-800">${escapeHtml(aidant.aidant?.nom || aidant.aidant_nom || "Aidant")}</p>
                <p class="text-[10px] text-slate-500">
                    Patient : ${escapeHtml(aidant.patient?.nom_complet || aidant.patient_nom || "?")}
                </p>
                <p class="text-[9px] font-bold mt-1" style="color:${color};">${label}</p>
            </div>
        `);

        markers[`aidant_${aidant.id}`] = marker;
    });

    const bounds = [];

    existingPatients.forEach(marker => {
        if (marker?.getLatLng) bounds.push(marker.getLatLng());
    });

    Object.keys(markers).forEach(key => {
        if (key.startsWith("aidant_") && markers[key]?.getLatLng) {
            bounds.push(markers[key].getLatLng());
        }
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function centerAllMarkers() {
    if (!map) return;
    
    const bounds = [];
    Object.values(markers).forEach(marker => {
        if (marker && marker.getLatLng) {
            try {
                bounds.push(marker.getLatLng());
            } catch(e) {}
        }
    });
    
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    } else {
        map.setView([6.368, 2.401], 12);
    }
}

async function showAlertsPanel() {
    try {
        const alerts = await secureFetch('/visites/geofence-alerts');
        const panel = document.getElementById('info-panel');
        const panelTitle = document.getElementById('panel-title');
        const panelContent = document.getElementById('panel-content');
        panelTitle.innerHTML = '<i class="fa-solid fa-bell text-amber-500 mr-2"></i> Alertes Géofence';
        if (!alerts.length) {
            panelContent.innerHTML = `<div class="text-center py-8"><i class="fa-solid fa-check-circle text-emerald-500 text-3xl mb-3"></i><p class="text-sm font-bold">Aucune alerte</p></div>`;
        } else {
            panelContent.innerHTML = alerts.map(alert => `
                <div class="mb-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p class="font-black text-amber-800">${escapeHtml(alert.aidant?.nom)}</p>
                    <p class="text-[10px] text-slate-600">Patient: ${escapeHtml(alert.patient?.nom_complet)}</p>
                    <button onclick="window.centerOnAidantFromAlert('${alert.aidant?.id}')" class="mt-2 w-full py-1.5 bg-amber-600 text-white rounded-lg text-[9px] font-black">Localiser</button>
                </div>
            `).join('');
        }
        panel.classList.remove('hidden');
    } catch (err) { UI.error("Impossible de charger les alertes"); }
}

window.viewAidantHistory = async (aidantId) => {
    const { value: date } = await Swal.fire({
        title: "Historique des déplacements",
        html: `<input type="date" id="history-date" class="w-full p-3 bg-slate-50 rounded-xl" value="${new Date().toISOString().split('T')[0]}">`,
        confirmButtonText: "Voir",
        preConfirm: () => document.getElementById('history-date').value
    });
    if (!date) return;
    try {
        const history = await secureFetch(`/visites/aidant-history/${aidantId}?date=${date}`);
        if (!history.length) return Swal.fire({ icon: "info", title: "Aucune donnée", text: "Aucun déplacement pour cette date" });
        showTrajectory(history, aidantId);
    } catch (err) { UI.error(err.message); }
};

function showTrajectory(history, aidantId) {
    const panel = document.getElementById('info-panel');
    const panelTitle = document.getElementById('panel-title');
    const panelContent = document.getElementById('panel-content');
    panelTitle.innerHTML = '<i class="fa-solid fa-route text-indigo-500 mr-2"></i> Trajectoire';
    const points = history.map(h => [h.lat, h.lng]);
    if (trajectoryLayer) map.removeLayer(trajectoryLayer);
    trajectoryLayer = L.polyline(points, { color: '#8B5CF6', weight: 4, opacity: 0.8 }).addTo(map);
    map.fitBounds(trajectoryLayer.getBounds(), { padding: [50, 50] });
    panelContent.innerHTML = `
        <div class="space-y-4">
            <div class="bg-indigo-50 p-3 rounded-xl">
                <p class="text-[9px] font-black text-indigo-600">📊 ${history.length} points GPS</p>
                <p class="text-[10px] text-slate-500">${new Date(history[0]?.created_at).toLocaleString()}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.replayTrajectory(${JSON.stringify(history).replace(/"/g, '&quot;')})" class="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black">▶ Rejouer</button>
                <button onclick="window.clearTrajectory()" class="flex-1 py-2 bg-slate-200 rounded-lg text-[10px] font-black">Effacer</button>
            </div>
        </div>
    `;
    panel.classList.remove('hidden');
}

window.replayTrajectory = (history) => {
    if (replayInterval) clearInterval(replayInterval);
    currentReplayIndex = 0;
    const points = history.map(h => [h.lat, h.lng]);
    const replayIcon = createCoordinatorIcon('#F59E0B', 'location-dot', true);
    const replayMarker = L.marker(points[0], { icon: replayIcon }).addTo(map);
    replayInterval = setInterval(() => {
        if (currentReplayIndex >= points.length) {
            clearInterval(replayInterval);
            map.removeLayer(replayMarker);
            replayInterval = null;
            showToast("Replay terminé", "success");
            return;
        }
        replayMarker.setLatLng(points[currentReplayIndex]);
        map.setView(points[currentReplayIndex], 16);
        currentReplayIndex++;
    }, 500);
};

window.clearTrajectory = () => {
    if (trajectoryLayer) { map.removeLayer(trajectoryLayer); trajectoryLayer = null; }
    if (replayInterval) { clearInterval(replayInterval); replayInterval = null; }
    document.getElementById('info-panel')?.classList.add('hidden');
    showToast("Trajectoire effacée", "info");
};

window.centerOnPatient = (lat, lng) => map?.setView([lat, lng], 16);
window.centerOnAidant = (lat, lng) => map?.setView([lat, lng], 16);
window.centerOnAidantFromAlert = async (aidantId) => {
    const aidants = await secureFetch('/visites/active-aidants');
    const aidant = aidants.find(a => a.aidant?.id === aidantId);
    if (aidant?.last_position) map?.setView([aidant.last_position.lat, aidant.last_position.lng], 16);
    document.getElementById('info-panel')?.classList.add('hidden');
};

// ============================================================
// 🏠 VUE FAMILLE - SUIVI DE L'AIDANT
// ============================================================

async function getFamilyPatientForRadar() {
    let patients = normalizeArray(await secureFetch("/patients"));
    const userId = localStorage.getItem("user_id");

    if (userId) {
        patients = patients.filter(p => !p.famille_user_id || String(p.famille_user_id) === String(userId));
    }

    if (!patients.length) {
        return {
            patient: null,
            reason: "NO_PATIENT"
        };
    }

    const savedPatientId = getSavedPatientId();

    if (savedPatientId) {
        const found = patients.find(p => String(p.id) === String(savedPatientId));
        if (found) {
            setActivePatient(found.id);
            return {
                patient: found,
                reason: "FOUND"
            };
        }
    }

    if (patients.length === 1) {
        setActivePatient(patients[0].id);
        return {
            patient: patients[0],
            reason: "ONLY_ONE"
        };
    }

    return {
        patient: null,
        reason: "MULTIPLE_PATIENTS"
    };
}

function renderRadarMessage({ icon, title, text, buttonText, buttonAction, color = "slate" }) {
    const container = document.getElementById("view-container");
    if (!container) return;

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[55vh] p-8 text-center">
            <div class="w-20 h-20 rounded-full bg-${color}-50 flex items-center justify-center mb-4">
                <i class="fa-solid ${icon} text-3xl text-${color}-400"></i>
            </div>
            <h3 class="text-xl font-black text-slate-800">${title}</h3>
            <p class="text-sm text-slate-500 mt-2 max-w-sm">${text}</p>
            ${buttonText ? `
                <button onclick="${buttonAction}" 
                        class="mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                    ${buttonText}
                </button>
            ` : ""}
        </div>
    `;
}

function getVisitAidantLatLng(activeVisit) {
    if (!activeVisit) return null;

    const lat =
        activeVisit.lat ||
        activeVisit.last_position?.lat ||
        activeVisit.position?.lat ||
        activeVisit.aidant_position?.lat;

    const lng =
        activeVisit.lng ||
        activeVisit.last_position?.lng ||
        activeVisit.position?.lng ||
        activeVisit.aidant_position?.lng;

    if (!lat || !lng) return null;

    return {
        lat: Number(lat),
        lng: Number(lng)
    };
}

function getVisitLastUpdate(activeVisit) {
    return (
        activeVisit?.last_update ||
        activeVisit?.last_position?.created_at ||
        activeVisit?.updated_at ||
        activeVisit?.heure_debut ||
        null
    );
}

async function initSansPatientRadar() {
    const container = document.getElementById("view-container");
    clearMapRuntime();

    container.innerHTML = `
        <div class="animate-fadeIn flex flex-col h-[calc(100vh-120px)] pb-0">
            <div class="flex justify-between items-center mb-4 shrink-0 flex-wrap gap-3">
                <div>
                    <h3 class="text-xl font-black text-slate-800">📦 Radar Livraison</h3>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Suivi de vos commandes personnelles
                    </p>
                </div>
                <button id="refresh-delivery-btn" class="bg-white p-2 rounded-xl shadow-md border border-slate-100">
                    <i class="fa-solid fa-rotate-right text-slate-600"></i>
                </button>
            </div>

            <div class="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center p-8 text-center">
                <div class="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                    <i class="fa-solid fa-truck-fast text-3xl text-emerald-500"></i>
                </div>
                <h3 class="text-xl font-black text-slate-800">Aucune livraison active</h3>
                <p class="text-sm text-slate-500 mt-2 max-w-sm">
                    Vos commandes en cours de livraison apparaîtront ici dès qu’un livreur sera assigné.
                </p>
                <button onclick="window.switchView('commandes')" 
                        class="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                    Voir mes commandes
                </button>
            </div>
        </div>
    `;

    document.getElementById("refresh-delivery-btn")?.addEventListener("click", () => {
        showToast("Aucune livraison active pour le moment", "info", 1500);
    });
}

export async function initFamilyMap() {
    const container = document.getElementById("view-container");
    const typeCompte = localStorage.getItem("user_type_compte") || "AVEC_PATIENT";
    const isSansPatient = typeCompte === "SANS_PATIENT";

    clearMapRuntime();

    if (isSansPatient) {
        await initSansPatientRadar();
        return;
    }

    const result = await getFamilyPatientForRadar();

    if (result.reason === "MULTIPLE_PATIENTS") {
        renderRadarMessage({
            icon: "fa-users",
            title: "Choisissez un dossier",
            text: "Vous avez plusieurs dossiers patients. Sélectionnez d'abord le patient concerné.",
            buttonText: "Choisir un dossier",
            buttonAction: "window.switchView('patients')",
            color: "amber"
        });
        return;
    }

    if (result.reason === "NO_PATIENT" || !result.patient) {
        renderRadarMessage({
            icon: "fa-user-slash",
            title: "Aucun dossier patient",
            text: "Le Radar s'active lorsqu'un dossier patient est associé à votre compte.",
            buttonText: "Retour à l'accueil",
            buttonAction: "window.switchView('home')",
            color: "slate"
        });
        return;
    }

    currentPatient = result.patient;

    container.innerHTML = `
        <div class="animate-fadeIn flex flex-col h-[calc(100vh-120px)] pb-0">
            <div class="flex justify-between items-center mb-4 shrink-0 flex-wrap gap-3">
                <div>
                    <h3 class="text-xl font-black text-slate-800">👨‍👩‍👧 Suivi de votre proche</h3>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        ${escapeHtml(currentPatient.nom_complet || "Dossier patient")}
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="refresh-family-btn" class="bg-white p-2 rounded-xl shadow-md border border-slate-100">
                        <i class="fa-solid fa-rotate-right text-slate-600"></i>
                    </button>
                    <button id="history-family-btn" class="bg-indigo-500 text-white px-3 py-2 rounded-xl shadow-md text-[9px] font-black uppercase">
                        <i class="fa-solid fa-clock-rotate-left"></i> Historique
                    </button>
                    <button id="toggle-family-map-style" class="bg-white p-2 rounded-xl shadow-md border border-slate-100" title="Changer le style de carte">
                        <i class="fa-solid fa-layer-group text-slate-600"></i>
                    </button>
                </div>
            </div>

            <div id="family-status-bar" class="mb-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">STATUT</p>
                        <p id="family-status" class="font-black text-emerald-600 text-sm">Chargement...</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">MISE À JOUR</p>
                        <p id="family-last-update" class="text-[9px] text-slate-500">---</p>
                    </div>
                </div>
                <div id="family-distance" class="mt-2 pt-2 border-t border-slate-100 hidden">
                    <div class="flex justify-between items-center">
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">DISTANCE DE L'AIDANT</p>
                        <p id="family-distance-value" class="font-black text-lg text-emerald-600">---</p>
                    </div>
                </div>
            </div>

            <div id="live-map-container" class="flex-1 w-full rounded-xl border-2 border-white shadow-lg relative overflow-hidden bg-slate-100" style="min-height: 50vh; height: auto;">
                <div id="map" class="absolute inset-0 z-10 w-full h-full"></div>
                <div id="map-loading" class="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div class="text-center">
                        <div class="relative w-8 h-8 mx-auto mb-2">
                            <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                        </div>
                        <p class="text-[9px] font-black text-slate-400">Chargement du Radar...</p>
                    </div>
                </div>
            </div>

            <div class="mt-3 bg-white/90 backdrop-blur-sm p-2 rounded-xl border border-slate-100">
                <div class="flex items-center justify-around text-[8px] font-bold">
                    <div class="flex items-center gap-1">
                        <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Domicile</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>Aidant actif</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-2 h-2 rounded-full bg-rose-500"></div>
                        <span>Hors zone</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span>Inactif</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    await new Promise(r => setTimeout(r, 100));

    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    if (mapElement._leaflet_id) {
        mapElement._leaflet_id = null;
    }

    map = L.map("map", {
        zoomControl: false,
        attributionControl: false,
        center: [6.368, 2.401],
        zoom: 14
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // ✅ AJOUT DU FOND DE CARTE
    addTileLayer(map, 'satellite');

    // ✅ BOUTON POUR CHANGER LE STYLE DE CARTE (FAMILLE)
    document.getElementById('toggle-family-map-style')?.addEventListener('click', () => {
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        
        isSatelliteView = !isSatelliteView;
        if (isSatelliteView) {
            addTileLayer(map, 'satellite');
            showToast("🌍 Mode Satellite", "info", 1500);
        } else {
            addTileLayer(map, 'street');
            showToast("🗺️ Mode Plan", "info", 1500);
        }
    });

    setTimeout(() => {
        if (map) map.invalidateSize(true);
    }, 300);

    document.getElementById("refresh-family-btn")?.addEventListener("click", async () => {
        await loadFamilyData();
        showToast("Radar actualisé", "info", 1000);
    });

    document.getElementById("history-family-btn")?.addEventListener("click", () => {
        window.viewVisitHistory(currentPatient.id);
    });

    await loadFamilyData();

    if (activeInterval) clearInterval(activeInterval);
    activeInterval = setInterval(() => loadFamilyData(), 15000);
}

async function loadFamilyData() {
    try {
        if (!map) return;

        const statusEl = document.getElementById("family-status");
        const lastUpdateEl = document.getElementById("family-last-update");
        const distanceDiv = document.getElementById("family-distance");
        const distanceValueEl = document.getElementById("family-distance-value");

        if (!currentPatient) {
            const result = await getFamilyPatientForRadar();
            if (!result.patient) {
                if (statusEl) statusEl.innerHTML = "❌ Aucun patient actif";
                return;
            }
            currentPatient = result.patient;
        }

        Object.keys(markers).forEach(key => {
            if (markers[key] && map) {
                try {
                    map.removeLayer(markers[key]);
                } catch (e) {}
                delete markers[key];
            }
        });

        const patientLat = Number(currentPatient.lat);
        const patientLng = Number(currentPatient.lng);

        if (!patientLat || !patientLng) {
            if (statusEl) statusEl.innerHTML = "⚠️ Adresse GPS non renseignée";
            if (lastUpdateEl) lastUpdateEl.innerHTML = "---";
            if (distanceDiv) distanceDiv.classList.add("hidden");
            renderMapNoticeOnTop("Le domicile du patient n’a pas encore de position GPS enregistrée.");
            map.setView([6.368, 2.401], 12);
            return;
        }

        const homeIcon = createCustomIcon("#3B82F6", false, "lg", "home");
        markers["patient_home"] = L.marker([patientLat, patientLng], { icon: homeIcon }).addTo(map);
        markers["patient_home"].bindPopup(`
            <div class="text-center p-2">
                <p class="font-black text-slate-800">🏠 ${escapeHtml(currentPatient.nom_complet || "Patient")}</p>
                <p class="text-[10px] text-slate-500">${escapeHtml(currentPatient.adresse || "Adresse non renseignée")}</p>
            </div>
        `);

        let activeVisit = null;
        try {
            activeVisit = await secureFetch(`/visites/active/${currentPatient.id}`);
        } catch (err) {
            console.warn("Aucune visite active:", err.message);
            activeVisit = null;
        }

        const aidantPosition = getVisitAidantLatLng(activeVisit);

        if (!activeVisit || activeVisit.hasActiveVisit === false || activeVisit.active === false) {
            if (statusEl) statusEl.innerHTML = "⚪ Aucune intervention en cours";
            if (lastUpdateEl) lastUpdateEl.innerHTML = "---";
            if (distanceDiv) distanceDiv.classList.add("hidden");
            map.setView([patientLat, patientLng], 15);
            hideMapLoading();
            return;
        }

        if (!aidantPosition) {
            if (statusEl) statusEl.innerHTML = "🟡 Intervention active, position aidant indisponible";
            if (lastUpdateEl) {
                lastUpdateEl.innerHTML = getVisitLastUpdate(activeVisit)
                    ? new Date(getVisitLastUpdate(activeVisit)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                    : "---";
            }
            if (distanceDiv) distanceDiv.classList.add("hidden");
            map.setView([patientLat, patientLng], 15);
            hideMapLoading();
            return;
        }

        const aidantIcon = createCustomIcon("#10B981", true, "lg", "user-nurse");
        markers["aidant_active"] = L.marker([aidantPosition.lat, aidantPosition.lng], { icon: aidantIcon }).addTo(map);
        markers["aidant_active"].bindPopup(`
            <div class="text-center p-2">
                <p class="font-black text-slate-800">👩‍⚕️ ${escapeHtml(activeVisit.aidant_nom || activeVisit.aidant?.nom || "Intervenant")}</p>
                <p class="text-[10px] text-emerald-600 font-bold">Intervention en cours</p>
            </div>
        `);

        const distance = calculateDistance(
            aidantPosition.lat,
            aidantPosition.lng,
            patientLat,
            patientLng
        );

        if (statusEl) statusEl.innerHTML = "🟢 Intervention en cours";
        if (lastUpdateEl) {
            const lastUpdate = getVisitLastUpdate(activeVisit);
            lastUpdateEl.innerHTML = lastUpdate
                ? new Date(lastUpdate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                : "À l'instant";
        }

        if (distanceDiv) {
            distanceDiv.classList.remove("hidden");
            if (distanceValueEl) {
                distanceValueEl.innerHTML = formatDistance(distance);
            }
        }

        const bounds = L.latLngBounds(
            [patientLat, patientLng],
            [aidantPosition.lat, aidantPosition.lng]
        );
        map.fitBounds(bounds, { padding: [60, 60] });

        hideMapLoading();

    } catch (err) {
        console.error("❌ Erreur loadFamilyData:", err);
        const statusEl = document.getElementById("family-status");
        if (statusEl) statusEl.innerHTML = "❌ Erreur de chargement";
        hideMapLoading();
        showToast("Erreur de chargement du Radar", "error");
    }
}

function renderMapNoticeOnTop(message) {
    const container = document.getElementById("live-map-container");
    if (!container || document.getElementById("map-notice")) return;

    const notice = document.createElement("div");
    notice.id = "map-notice";
    notice.className = "absolute top-4 left-4 right-4 z-30 bg-white/95 backdrop-blur-sm border border-amber-100 rounded-2xl p-3 shadow-lg text-center";
    notice.innerHTML = `
        <p class="text-[10px] font-black text-amber-600 uppercase tracking-wider">Information Radar</p>
        <p class="text-xs text-slate-600 mt-1">${escapeHtml(message)}</p>
    `;

    container.appendChild(notice);
}

// ============================================================
// 📜 VOIR L'HISTORIQUE DES VISITES (FAMILLE)
// ============================================================

window.viewVisitHistory = async (patientId) => {
    try {
        const history = await secureFetch(`/visites/history/${patientId}?limit=30`);
        
        if (!history || history.length === 0) {
            Swal.fire({
                title: "Aucun historique",
                text: "Aucune visite enregistrée pour le moment.",
                icon: "info",
                confirmButtonColor: "#10B981"
            });
            return;
        }

        const html = history.map(v => `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                    <p class="font-bold text-slate-800 text-xs">${escapeHtml(v.patient?.nom_complet || 'Patient')}</p>
                    <p class="text-[9px] text-slate-400">${v.heure_debut_formatted || 'Date inconnue'}</p>
                    <p class="text-[9px] font-bold ${v.statut === 'Validé' ? 'text-emerald-600' : v.statut === 'En attente' ? 'text-amber-600' : 'text-slate-400'}">
                        ${v.statut}
                    </p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-slate-400">${escapeHtml(v.aidant?.nom || 'Aidant inconnu')}</p>
                    ${v.photo_url ? `<button onclick="window.open('${v.photo_url}')" class="text-[8px] text-blue-500">📸 Voir photo</button>` : ''}
                </div>
            </div>
        `).join('');

        Swal.fire({
            title: "📋 Historique des visites",
            html: `<div class="space-y-2 max-h-96 overflow-y-auto">${html}</div>`,
            confirmButtonText: "Fermer",
            confirmButtonColor: "#10B981",
            width: '90%',
            maxWidth: '500px',
            customClass: { popup: 'rounded-2xl p-4' }
        });

    } catch (err) {
        console.error(err);
        UI.error("Impossible de charger l'historique");
    }
};

// ============================================================
// 🧭 VUE AIDANT
// ============================================================

async function getAidantActiveMission() {
    try {
        const visits = normalizeArray(await secureFetch("/visites"));
        const active = visits.find(v =>
            v.statut === "En cours" ||
            v.statut === "Démarrée" ||
            v.statut === "En route"
        );

        if (!active) {
            return null;
        }

        return active;
    } catch (err) {
        console.warn("Impossible de charger la mission active aidant:", err.message);
        return null;
    }
}

function getPatientFromVisit(visit) {
    if (!visit) return null;

    return (
        visit.patient ||
        visit.patients ||
        {
            id: visit.patient_id,
            nom_complet: visit.patient_nom || visit.nom_patient || "Patient",
            adresse: visit.patient_adresse || visit.adresse || "",
            lat: visit.patient_lat || visit.lat_patient || visit.lat,
            lng: visit.patient_lng || visit.lng_patient || visit.lng
        }
    );
}

function getPatientLatLng(patient) {
    if (!patient) return null;

    const lat = patient.lat || patient.latitude || patient.gps_lat;
    const lng = patient.lng || patient.longitude || patient.gps_lng;

    if (!lat || !lng) return null;

    return {
        lat: Number(lat),
        lng: Number(lng)
    };
}

function renderAidantNoMission() {
    renderRadarMessage({
        icon: "fa-route",
        title: "Aucune mission active",
        text: "Le Radar s’active lorsqu’une visite ou une mission vous est assignée. Vous pouvez consulter vos patients ou attendre une nouvelle intervention.",
        buttonText: "Voir mes patients",
        buttonAction: "window.switchView('patients')",
        color: "slate"
    });
}

async function initAidantMap() {
    const container = document.getElementById('view-container');
    clearMapRuntime();

    const activeMission = await getAidantActiveMission();

    if (!activeMission) {
        renderAidantNoMission();
        return;
    }

    const activePatient = getPatientFromVisit(activeMission);

    if (!activePatient || !activePatient.id) {
        renderRadarMessage({
            icon: "fa-triangle-exclamation",
            title: "Mission incomplète",
            text: "Une mission semble active, mais le patient associé est introuvable.",
            buttonText: "Voir mes visites",
            buttonAction: "window.switchView('visits')",
            color: "amber"
        });
        return;
    }
    
    container.innerHTML = `
        <div class="animate-fadeIn flex flex-col h-[calc(100vh-120px)] pb-0">
            <div class="flex justify-between items-center mb-4 shrink-0 flex-wrap gap-3">
                <div>
                    <h3 class="text-xl font-black text-slate-800">🧭 Navigation GPS</h3>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Guidage vers le domicile du patient</p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="center-map-btn" class="bg-white p-2 rounded-xl shadow-md border border-slate-100">
                        <i class="fa-solid fa-location-crosshairs text-slate-600"></i>
                    </button>
                    <button id="improve-gps-btn" 
                            class="bg-blue-500 text-white p-2 rounded-xl shadow-md border border-slate-100 active:scale-95 transition-all"
                            title="Améliorer la précision GPS">
                        <i class="fa-solid fa-satellite-dish text-sm"></i>
                    </button>
                    <button id="clear-trajectory-btn" class="bg-slate-100 p-2 rounded-xl shadow-md border border-slate-100">
                        <i class="fa-solid fa-eraser text-slate-600"></i>
                    </button>
                    <button id="stop-navigation-btn" class="bg-rose-500 text-white px-3 py-2 rounded-xl shadow-md text-[9px] font-black uppercase hidden">
                        <i class="fa-solid fa-stop"></i> Arrêter
                    </button>
                    <button id="toggle-aidant-map-style" class="bg-white p-2 rounded-xl shadow-md border border-slate-100" title="Changer le style de carte">
                        <i class="fa-solid fa-layer-group text-slate-600"></i>
                    </button>
                </div>
            </div>
            
            <!-- Bandeau GPS -->
            <div id="gps-warning" class="mb-3 bg-amber-50 border border-amber-200 p-3 rounded-xl hidden">
                <div class="flex items-center gap-3">
                    <i class="fa-solid fa-location-dot text-amber-500 text-lg"></i>
                    <div class="flex-1">
                        <p class="text-sm font-black text-amber-800">GPS non activé</p>
                        <p class="text-[9px] text-amber-700">Activez votre position pour utiliser la navigation</p>
                    </div>
                    <button id="enable-gps-btn" class="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">
                        Activer GPS
                    </button>
                </div>
            </div>
            
            <div class="mb-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <label class="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    <i class="fa-solid fa-hospital-user mr-1"></i> Mission active
                </label>
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="font-black text-slate-800 text-sm">${escapeHtml(activePatient.nom_complet || "Patient")}</p>
                        <p class="text-[9px] text-slate-400">${escapeHtml(activePatient.adresse || "Adresse non renseignée")}</p>
                    </div>
                    <span class="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase">
                        En cours
                    </span>
                </div>
            </div>
            
            <!-- Panneau de navigation compact -->
            <div id="navigation-panel" class="mb-3 bg-emerald-500 text-white p-3 rounded-xl shadow-lg hidden">
                <div class="flex items-center justify-between">
                    <div><p class="text-[7px] font-black uppercase opacity-80">DESTINATION</p><p id="dest-name" class="font-black text-sm">---</p></div>
                    <i class="fa-solid fa-route text-xl opacity-80"></i>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-white/20">
                    <div><p class="text-[7px] font-black uppercase opacity-80">DISTANCE</p><p id="distance-display" class="font-black text-base">---</p></div>
                    <div><p class="text-[7px] font-black uppercase opacity-80">TEMPS</p><p id="time-display" class="font-black text-base">---</p></div>
                </div>
                <div id="direction-arrow" class="mt-2 text-center text-[9px]">
                    <i class="fa-solid fa-location-arrow text-lg animate-pulse"></i>
                    <span id="direction-text" class="ml-1">Suivez l'itinéraire</span>
                </div>
            </div>
            
            <div id="live-map-container" class="flex-1 w-full rounded-xl border-2 border-white shadow-lg relative overflow-hidden bg-slate-100" style="min-height: 50vh; height: auto;">
                <div id="map" class="absolute inset-0 z-10 w-full h-full"></div>
                <div id="map-loading" class="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div class="text-center">
                        <div class="relative w-8 h-8 mx-auto mb-2">
                            <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                        </div>
                        <p class="text-[9px] font-black text-slate-400">Chargement...</p>
                    </div>
                </div>
            </div>
            
            <!-- Légende compacte -->
            <div class="mt-3 bg-white/90 backdrop-blur-sm p-2 rounded-xl border border-slate-100">
                <div class="flex items-center justify-around text-[8px] font-bold">
                    <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><span>Ma position</span></div>
                    <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-blue-500"></div><span>Patient</span></div>
                    <div class="flex items-center gap-1"><div class="w-2 h-2 bg-emerald-400"></div><span>Itinéraire</span></div>
                    <div class="flex items-center gap-1"><div class="w-2 h-2 bg-amber-500 rounded-full"></div><span>Trajectoire</span></div>
                </div>
            </div>
            
            <button id="fix-patient-gps" class="mt-2 w-full py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase hidden">
                📍 Fixer ce lieu comme domicile du patient
            </button>
        </div>
    `;
    
    setTimeout(async () => {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;
        if (map) { map.remove(); map = null; markers = {}; }
        
        map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.5 });
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        
        // ✅ AJOUT DU FOND DE CARTE
        addTileLayer(map, 'satellite');

        // ✅ BOUTON POUR CHANGER LE STYLE DE CARTE (AIDANT)
        document.getElementById('toggle-aidant-map-style')?.addEventListener('click', () => {
            map.eachLayer(layer => {
                if (layer instanceof L.TileLayer) {
                    map.removeLayer(layer);
                }
            });
            
            isSatelliteView = !isSatelliteView;
            if (isSatelliteView) {
                addTileLayer(map, 'satellite');
                showToast("🌍 Mode Satellite", "info", 1500);
            } else {
                addTileLayer(map, 'street');
                showToast("🗺️ Mode Plan", "info", 1500);
            }
        });
        
        setTimeout(() => {
            if (map) {
                map.invalidateSize(true);
                setTimeout(() => {
                    if (map) map.invalidateSize(true);
                }, 500);
            }
        }, 300);
        
        const enableGpsBtn = document.getElementById('enable-gps-btn');
        const gpsWarning = document.getElementById('gps-warning');
        
        const requestLocation = () => {
            if (!navigator.geolocation) {
                showToast("GPS non supporté par votre navigateur", "error");
                gpsWarning?.classList.remove('hidden');
                return false;
            }
            
            showToast("📍 Recherche de votre position...", "info", 2000);
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log("✅ Position obtenue:", position.coords);
                    gpsWarning?.classList.add('hidden');
                    showToast("GPS activé !", "success");
                    
                    const aidantIcon = createCustomIcon('#10B981', true, 'lg', 'user-nurse');
                    if (markers['aidant']) map.removeLayer(markers['aidant']);
                    markers['aidant'] = L.marker([position.coords.latitude, position.coords.longitude], { icon: aidantIcon }).addTo(map);
                    map.setView([position.coords.latitude, position.coords.longitude], 16);
                    
                    startAidantTracking();
                    return true;
                },
                (error) => {
                    console.error("Erreur GPS:", error);
                    let message = "Impossible d'obtenir votre position";
                    if (error.code === 1) {
                        message = "❌ Vous devez autoriser l'accès à votre position";
                        if (error.message && error.message.includes("denied")) {
                            message = "❌ Accès refusé. Autorisez dans les paramètres puis rafraîchissez.";
                        }
                    }
                    if (error.code === 2) message = "📍 Position indisponible, réessayez";
                    if (error.code === 3) message = "⏱️ Délai dépassé, vérifiez votre connexion";
                    
                    showToast(message, "error", 5000);
                    gpsWarning?.classList.remove('hidden');
                    
                    const warningText = document.querySelector('#gps-warning .text-amber-700');
                    if (warningText) warningText.innerHTML = message;
                    
                    return false;
                },
                { 
                    enableHighAccuracy: true, 
                    timeout: 15000,
                    maximumAge: 0
                }
            );
        };
        
        document.getElementById('center-map-btn')?.addEventListener('click', () => {
            requestLocation();
        });
        
        document.getElementById('clear-trajectory-btn')?.addEventListener('click', () => { 
            clearTrajectory(); 
            showToast("Trajectoire effacée", "info"); 
        });
        
        enableGpsBtn?.addEventListener('click', () => {
            requestLocation();
        });
        
        document.getElementById('fix-patient-gps')?.addEventListener('click', () => fixCurrentLocationAsPatientHome());
        
        document.getElementById('stop-navigation-btn')?.addEventListener('click', () => stopNavigation());
        
        AppState.currentPatient = activePatient.id;
        localStorage.setItem("current_patient_id", activePatient.id);
        localStorage.setItem("active_patient_id", activePatient.id);
        
        await startNavigation(activePatient.id, activePatient);
        
        const mapLoading = document.getElementById('map-loading');
        if (mapLoading) {
            setTimeout(() => {
                mapLoading.style.opacity = '0';
                setTimeout(() => mapLoading.style.display = 'none', 300);
            }, 500);
        }

        const improveGpsBtn = document.getElementById('improve-gps-btn');
        if (improveGpsBtn) {
            improveGpsBtn.addEventListener('click', async () => {
                try {
                    const result = await improveGPSAccuracy();
                    if (result && result.position) {
                        const { latitude, longitude } = result.position.coords;
                        if (markers['aidant']) {
                            markers['aidant'].setLatLng([latitude, longitude]);
                            map.setView([latitude, longitude], 18);
                        }
                        showToast(`🎯 Précision optimisée à ${Math.round(result.accuracy)} mètres`, "success");
                    }
                } catch (err) {
                    showToast("Impossible d'améliorer la précision", "error");
                }
            });
        }

        requestLocation();
        
    }, 100);
}

// ============================================================
// FONCTIONS GPS ET NAVIGATION (AIDANT)
// ============================================================

/**
 * 📍 AJOUTER UN CERCLE DE PRÉCISION SUR LA CARTE
 */
function addAccuracyCircle(lat, lng, accuracy, color = '#3B82F6') {
    if (window._accuracyCircle) {
        map.removeLayer(window._accuracyCircle);
    }
    
    const circle = L.circle([lat, lng], {
        radius: accuracy,
        color: color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2,
        opacity: 0.6
    }).addTo(map);
    
    window._accuracyCircle = circle;
    return circle;
}

/**
 * 📍 AJOUTER UN MARQUEUR DE POSITION AVEC CERCLE DE PRÉCISION
 */
function addPositionMarkerWithAccuracy(lat, lng, accuracy, label = "Ma position") {
    if (window._positionMarker) {
        map.removeLayer(window._positionMarker);
    }
    if (window._positionCircle) {
        map.removeLayer(window._positionCircle);
    }
    
    const icon = L.divIcon({
        className: 'position-marker',
        html: `
            <div class="relative">
                <div class="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full opacity-30 animate-ping"></div>
            </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    window._positionMarker = L.marker([lat, lng], { icon }).addTo(map);
    window._positionCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#3B82F6',
        fillColor: '#60A5FA',
        fillOpacity: 0.15,
        weight: 2
    }).addTo(map);
    
    window._positionMarker.bindPopup(`
        <div class="text-center p-1">
            <p class="font-black text-xs">${label}</p>
            <p class="text-[9px] text-slate-500">Précision: ${Math.round(accuracy)} mètres</p>
        </div>
    `);
}

/**
 * 🎯 AMÉLIORER LA PRÉCISION GPS
 */
async function improveGPSAccuracy() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            Swal.fire("Erreur", "GPS non supporté", "error");
            reject();
            return;
        }
        
        let bestAccuracy = Infinity;
        let bestPosition = null;
        let attempts = 0;
        let watchId = null;
        
        Swal.fire({
            title: "📍 Amélioration de la précision",
            html: `
                <div class="text-center">
                    <div class="relative w-20 h-20 mx-auto mb-4">
                        <div class="absolute inset-0 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                        <i class="fa-solid fa-satellite-dish absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 text-2xl"></i>
                    </div>
                    <p class="text-sm font-bold">Recherche du signal GPS...</p>
                    <p class="text-xs text-slate-500 mt-2">Déplacez-vous lentement</p>
                    <div class="mt-4 w-full bg-slate-200 rounded-full h-2">
                        <div id="gps-accuracy-bar" class="bg-emerald-500 h-2 rounded-full transition-all" style="width: 0%"></div>
                    </div>
                    <p id="gps-accuracy-value" class="text-[10px] text-slate-400 mt-2">En attente...</p>
                    <p id="gps-advice" class="text-[9px] text-amber-500 mt-3">⚡ Déplacez-vous vers un espace dégagé</p>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                watchId = navigator.geolocation.watchPosition(
                    (position) => {
                        const accuracy = position.coords.accuracy;
                        attempts++;
                        
                        const percent = Math.min(100, (100 - accuracy) * 1.5);
                        document.getElementById('gps-accuracy-bar').style.width = `${Math.max(0, percent)}%`;
                        document.getElementById('gps-accuracy-value').innerHTML = `Précision: ${Math.round(accuracy)} mètres`;
                        
                        const adviceEl = document.getElementById('gps-advice');
                        if (accuracy > 100) {
                            adviceEl.innerHTML = '⚠️ Précision faible - Déplacez-vous vers un espace dégagé';
                            adviceEl.className = 'text-[9px] text-amber-500 mt-3';
                        } else if (accuracy > 50) {
                            adviceEl.innerHTML = '👍 Précision moyenne - Encore un peu...';
                            adviceEl.className = 'text-[9px] text-blue-500 mt-3';
                        } else if (accuracy > 20) {
                            adviceEl.innerHTML = '✅ Bonne précision - Attendez la stabilisation';
                            adviceEl.className = 'text-[9px] text-emerald-500 mt-3';
                        } else {
                            adviceEl.innerHTML = '🎯 Précision excellente ! Position prête';
                            adviceEl.className = 'text-[9px] text-emerald-600 font-bold mt-3';
                        }
                        
                        if (accuracy < bestAccuracy) {
                            bestAccuracy = accuracy;
                            bestPosition = position;
                        }
                        
                        if (accuracy < 20 && attempts > 5) {
                            navigator.geolocation.clearWatch(watchId);
                            Swal.close();
                            resolve({ position: bestPosition, accuracy: bestAccuracy });
                        } else if (attempts > 30) {
                            navigator.geolocation.clearWatch(watchId);
                            Swal.close();
                            if (bestPosition) {
                                resolve({ position: bestPosition, accuracy: bestAccuracy });
                            } else {
                                reject();
                            }
                        }
                    },
                    (error) => {
                        console.error("Erreur GPS:", error);
                        navigator.geolocation.clearWatch(watchId);
                        Swal.close();
                        reject();
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
            }
        }).then(() => {
            if (bestPosition) {
                Swal.fire({
                    title: "✅ Précision optimisée !",
                    html: `Précision finale: <b>${Math.round(bestAccuracy)} mètres</b>`,
                    icon: bestAccuracy < 50 ? "success" : "warning",
                    confirmButtonText: "OK"
                });
            }
        });
    });
}

/**
 * 📍 LISSAGE DES POSITIONS GPS
 */
let positionHistory = [];
let lastValidPosition = null;

function smoothPosition(lat, lng, accuracy, maxHistory = 5) {
    if (accuracy > 100) {
        console.log(`📍 Position ignorée (précision: ${Math.round(accuracy)}m)`);
        return lastValidPosition || { lat, lng };
    }
    
    if (lastValidPosition) {
        const distance = calculateDistance(
            lat, lng, 
            lastValidPosition.lat, lastValidPosition.lng
        );
        if (distance > 50) {
            console.log(`📍 Saut de position détecté (${Math.round(distance)}m), ignoré`);
            return lastValidPosition;
        }
    }
    
    positionHistory.push({ lat, lng, accuracy, timestamp: Date.now() });
    if (positionHistory.length > maxHistory) positionHistory.shift();
    
    if (positionHistory.length >= 3) {
        const recent = positionHistory.slice(-3);
        const avgLat = recent.reduce((sum, p) => sum + p.lat, 0) / 3;
        const avgLng = recent.reduce((sum, p) => sum + p.lng, 0) / 3;
        lastValidPosition = { lat: avgLat, lng: avgLng };
        return lastValidPosition;
    }
    
    lastValidPosition = { lat, lng };
    return lastValidPosition;
}

async function loadAssignedPatients() {
    try {
        const patients = await secureFetch('/patients');
        const selector = document.getElementById('patient-selector');
        if (selector && patients?.length) {
            selector.innerHTML = '<option value="">-- Choisir un patient --</option>' +
                patients.map(p => `<option value="${p.id}" data-lat="${p.lat || ''}" data-lng="${p.lng || ''}">🏠 ${p.nom_complet} - ${p.adresse?.substring(0, 40) || 'Adresse non renseignée'}</option>`).join('');
        }
    } catch (err) { console.error(err); }
}

async function startNavigation(patientId, fallbackPatient = null) {
    try {
        let patient = fallbackPatient;

        if (!patient) {
            patient = await secureFetch(`/patients/${patientId}`);
        }

        const patientCoords = getPatientLatLng(patient);

        if (!patientCoords) {
            UI.warning("Le domicile du patient n’a pas encore de position GPS.");
            document.getElementById('fix-patient-gps')?.classList.remove('hidden');
        
            const navPanel = document.getElementById("navigation-panel");
            if (navPanel) navPanel.classList.add("hidden");
        
            map.setView([6.368, 2.401], 12);
            return;
        }

        document.getElementById('fix-patient-gps').classList.add('hidden');
        
        currentPatient = patient;
        currentPatientCoords = patientCoords;
        isNavigating = true;
        
        console.log("🚗 Navigation démarrée vers:", currentPatientCoords);
        
        document.getElementById('navigation-panel').classList.remove('hidden');
        document.getElementById('stop-navigation-btn').classList.remove('hidden');
        document.getElementById('dest-name').innerText = patient.nom_complet;
        
        if (markers['patient']) map.removeLayer(markers['patient']);
        const patientIcon = createCustomIcon('#3B82F6', false, 'lg', 'home');
        markers['patient'] = L.marker([patientCoords.lat, patientCoords.lng], { icon: patientIcon }).addTo(map);
        
        await calculateAndDisplayRoute();
        checkIfArrived();
        
    } catch (err) { 
        console.error("Erreur startNavigation:", err);
        UI.error("Impossible de démarrer la navigation"); 
    }
}

function stopNavigation() {
    isNavigating = false;
    currentPatient = null;
    currentPatientCoords = null;
    offRouteAlertShown = false;
    document.getElementById('navigation-panel').classList.add('hidden');
    document.getElementById('stop-navigation-btn').classList.add('hidden');
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (markers['patient']) { map.removeLayer(markers['patient']); delete markers['patient']; }
}

async function calculateAndDisplayRoute() {
    if (!isNavigating || !currentPatientCoords) return;
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(async (position) => {
        const startLat = position.coords.latitude;
        const startLng = position.coords.longitude;
        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${currentPatientCoords.lng},${currentPatientCoords.lat}?overview=full&geometries=geojson&steps=true`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.routes?.length) {
                const route = data.routes[0];
                const distance = route.distance;
                const duration = route.duration;
                
                const distanceDisplay = document.getElementById('distance-display');
                const timeDisplay = document.getElementById('time-display');
                
                if (distanceDisplay) distanceDisplay.innerHTML = formatDistance(distance);
                if (timeDisplay) timeDisplay.innerHTML = formatDuration(duration);
                
                console.log(`📍 Distance: ${formatDistance(distance)}, Temps: ${formatDuration(duration)}`);
                
                if (routeLayer) map.removeLayer(routeLayer);
                routeLayer = L.geoJSON(route.geometry, { 
                    style: { color: '#10B981', weight: 5, opacity: 0.9 } 
                }).addTo(map);
                
                lastRouteCalculation = Date.now();
            } else {
                console.warn("Aucun itinéraire trouvé");
            }
        } catch (err) { 
            console.error("Erreur calcul itinéraire:", err);
        }
    }, (err) => { 
        console.warn("Erreur GPS:", err.message);
    });
}

function checkIfOffRoute(currentLat, currentLng, route) {
    if (!route?.geometry?.coordinates) return;
    let minDistance = Infinity;
    for (const point of route.geometry.coordinates) {
        const distance = calculateDistance(currentLat, currentLng, point[1], point[0]);
        if (distance < minDistance) minDistance = distance;
    }
    const directionText = document.getElementById('direction-text');
    if (minDistance > OFF_ROUTE_THRESHOLD && !offRouteAlertShown) {
        offRouteAlertShown = true;
        directionText.innerHTML = '⚠️ Vous vous êtes écarté de l\'itinéraire ! Recalcul...';
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showToast("⚠️ Vous vous êtes écarté de l'itinéraire", "warning", 5000);
        setTimeout(() => { offRouteAlertShown = false; calculateAndDisplayRoute(); setTimeout(() => directionText.innerHTML = 'Suivez l\'itinéraire tracé', 3000); }, 3000);
    } else if (minDistance <= OFF_ROUTE_THRESHOLD) {
        offRouteAlertShown = false;
        directionText.innerHTML = '✅ Suivez l\'itinéraire tracé';
    }
}

function checkIfArrived() {
    if (!isNavigating || !currentPatientCoords) return;
    navigator.geolocation.getCurrentPosition((position) => {
        const distance = calculateDistance(position.coords.latitude, position.coords.longitude, currentPatientCoords.lat, currentPatientCoords.lng);
        if (distance < 50) {
            if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
            showToast("🎉 Vous êtes arrivé à destination !", "success", 5000);
            Swal.fire({ icon: "success", title: "Arrivé à destination !", text: `Vous êtes au domicile de ${currentPatient.nom_complet}`, confirmButtonText: "Démarrer la visite", confirmButtonColor: "#10B981", showCancelButton: true, cancelButtonText: "Plus tard" }).then((result) => { if (result.isConfirmed) window.startVisit(currentPatient.id); });
        }
    });
}

async function fixCurrentLocationAsPatientHome() {
    const selector = document.getElementById('patient-selector');
    const patientId = selector?.value;
    const patientName = selector?.options[selector.selectedIndex]?.text?.split(' -')[0];
    
    if (!patientId) {
        UI.warning("Sélectionnez d'abord un patient");
        return;
    }

    if (!navigator.geolocation) {
        return Swal.fire({
            title: "GPS non supporté",
            text: "Votre navigateur ne supporte pas la géolocalisation.",
            icon: "error"
        });
    }

    let permissionStatus = null;
    if (navigator.permissions && navigator.permissions.query) {
        try {
            permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
            console.log("État permission GPS :", permissionStatus.state);
        } catch (e) {
            console.warn("Erreur permission", e);
        }
    }

    if (permissionStatus && permissionStatus.state === 'denied') {
        Swal.fire({
            title: "📍 Accès GPS refusé",
            html: `
                <div class="text-left">
                    <p class="mb-2">Vous avez refusé l'accès à votre position.</p>
                    <p class="text-xs text-slate-500">Pour réactiver :</p>
                    <ul class="text-xs text-left mt-2 space-y-1">
                        <li>• <strong>Android (Chrome)</strong> : 🔒 Cadenas → Autorisations → Position → Autoriser</li>
                        <li>• <strong>iPhone (Safari)</strong> : ⚙️ Réglages → Confidentialité → Localisation → Safari → Autoriser</li>
                    </ul>
                </div>
            `,
            icon: "warning",
            confirmButtonText: "OK"
        });
        return;
    }

    const confirm = await Swal.fire({
        title: "📍 Enregistrer le domicile",
        text: `Voulez-vous utiliser votre position actuelle comme domicile de ${patientName} ?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "OUI, ENREGISTRER",
        confirmButtonColor: "#10B981",
        cancelButtonText: "Annuler"
    });
    
    if (!confirm.isConfirmed) return;

    Swal.fire({
        title: "Recherche GPS...",
        html: `
            <div class="text-center">
                <div class="relative w-12 h-12 mx-auto mb-3">
                    <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                    <i class="fa-solid fa-location-dot absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500"></i>
                </div>
                <p class="text-xs text-slate-600">Recherche du signal GPS...</p>
                <p class="text-[9px] text-slate-400 mt-2">Déplacez-vous dans un espace dégagé</p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
    });

    const options = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const accuracy = position.coords.accuracy;
            console.log(`✅ Position: ${position.coords.latitude}, ${position.coords.longitude} (précision: ${Math.round(accuracy)}m)`);
            
            let precisionText = "";
            let precisionColor = "";
            
            if (accuracy < 20) {
                precisionText = "Précision excellente ! 🎯";
                precisionColor = "text-emerald-600";
            } else if (accuracy < 50) {
                precisionText = "Bonne précision 👍";
                precisionColor = "text-blue-600";
            } else if (accuracy < 100) {
                precisionText = "Précision moyenne ⚠️";
                precisionColor = "text-amber-600";
            } else {
                precisionText = "Précision faible 📡";
                precisionColor = "text-rose-600";
            }
            
            if (accuracy > 100) {
                const retry = await Swal.fire({
                    title: "📍 Signal GPS faible",
                    html: `
                        <div class="text-center">
                            <p class="text-sm font-bold ${precisionColor}">${precisionText}</p>
                            <p class="text-xs text-slate-500 mt-2">Précision: ${Math.round(accuracy)} mètres</p>
                            <p class="text-[10px] text-slate-400 mt-3">Déplacez-vous dans un espace dégagé.</p>
                        </div>
                    `,
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "🔄 Réessayer",
                    cancelButtonText: "✅ Enregistrer quand même",
                    confirmButtonColor: "#F59E0B",
                    cancelButtonColor: "#10B981"
                });
                
                if (retry.isConfirmed) {
                    Swal.fire({ title: "Nouvelle recherche...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
                    return fixCurrentLocationAsPatientHome();
                }
            }
            
            await Swal.fire({
                title: "📍 Position capturée",
                html: `<div class="text-center"><p class="text-sm font-bold ${precisionColor}">${precisionText}</p><p class="text-xs text-slate-500">Précision: ${Math.round(accuracy)} mètres</p></div>`,
                icon: accuracy < 100 ? "success" : "warning",
                timer: 1500,
                showConfirmButton: false
            });
            
            try {
                await secureFetch('/patients/update-gps', {
                    method: 'POST',
                    body: JSON.stringify({
                        patient_id: patientId,
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    })
                });
                
                Swal.fire({ icon: "success", title: "✅ Domicile enregistré !", timer: 2000, showConfirmButton: false });
                await loadPatientLocation(patientId);
                await calculateAndDisplayRoute();
                
            } catch (err) {
                console.error(err);
                Swal.fire("Erreur", err.message, "error");
            }
        },
        (error) => {
            console.error("Erreur GPS:", error);
            let message = "Impossible d'obtenir votre position";
            let title = "Erreur GPS";
            switch(error.code) {
                case 1: title = "❌ Accès refusé"; message = "Autorisez l'accès à votre position.";
                    break;
                case 2: title = "📍 Position indisponible"; message = "Activez votre GPS.";
                    break;
                case 3: title = "⏱️ Délai dépassé"; message = "Vérifiez votre connexion.";
                    break;
            }
            Swal.fire({ title: title, text: message, icon: "error" });
        },
        options
    );
}

async function loadPatientLocation(patientId) {
    try {
        const patient = await secureFetch(`/patients/${patientId}`);
        if (patient?.lat && patient?.lng) {
            if (markers['patient']) map.removeLayer(markers['patient']);
            const patientIcon = createCustomIcon('#3B82F6', false, 'lg', 'home');
            markers['patient'] = L.marker([patient.lat, patient.lng], { icon: patientIcon }).addTo(map);
            return { lat: patient.lat, lng: patient.lng };
        } else { UI.warning("Ce patient n'a pas de position GPS enregistrée"); return null; }
    } catch (err) { return null; }
}

function startAidantTracking() {
    if (!navigator.geolocation) return;
    const aidantIcon = createCustomIcon('#10B981', true, 'lg', 'user-nurse');
    
    const options = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    };
    
    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const rawLat = position.coords.latitude;
            const rawLng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            const smoothed = smoothPosition(rawLat, rawLng, accuracy);
            
            addPositionMarkerWithAccuracy(smoothed.lat, smoothed.lng, accuracy, "Votre position");
            
            if (markers['aidant']) {
                markers['aidant'].setLatLng([smoothed.lat, smoothed.lng]);
            } else {
                markers['aidant'] = L.marker([smoothed.lat, smoothed.lng], { icon: aidantIcon }).addTo(map);
            }
            
            trajectoryPoints.push([smoothed.lat, smoothed.lng]);
            updateTrajectoryLine();
            
            const selector = document.getElementById('patient-selector');
            if (selector && selector.value && isNavigating) {
                calculateAndDisplayRoute();
            }
        },
        (error) => console.warn("Erreur tracking:", error.message),
        options
    );
}

function updateTrajectoryLine() {
    if (trajectoryPoints.length < 2) return;
    if (trajectoryLayer) map.removeLayer(trajectoryLayer);
    trajectoryLayer = L.polyline(trajectoryPoints, { color: '#F59E0B', weight: 3, opacity: 0.6 }).addTo(map);
}

function clearTrajectory() {
    trajectoryPoints = [];
    if (trajectoryLayer) { map.removeLayer(trajectoryLayer); trajectoryLayer = null; }
}

function clearRoute() {
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    document.getElementById('distance-display').innerHTML = '---';
    document.getElementById('time-display').innerHTML = '---';
}

// Fonctions globales supplémentaires
window.copyAddressToClipboard = (address) => { if (address) { navigator.clipboard.writeText(address); showToast("Adresse copiée !", "success"); } };
window.zoomToLocation = (lat, lng) => map?.setView([lat, lng], 16);
window.openGoogleMaps = (lat, lng) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("GPS non supporté par ce téléphone"));
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const accuracy = pos.coords.accuracy;
                console.log(`📍 Position obtenue avec précision: ${Math.round(accuracy)}m`);
                resolve({ 
                    lat: pos.coords.latitude, 
                    lon: pos.coords.longitude,
                    accuracy: accuracy 
                });
            },
            (err) => {
                console.error("❌ Erreur GPS:", err);
                let msg = "Impossible d'obtenir votre position";
                if (err.code === 1) msg = "📍 Autorisez l'accès à votre position";
                if (err.code === 2) msg = "📍 Position indisponible - Activez le GPS";
                if (err.code === 3) msg = "⏱️ Délai dépassé - Vérifiez votre connexion GPS";
                reject(new Error(msg));
            },
            options
        );
    });
}

// ============================================================
// EXPORTS
// ============================================================

export { initCoordinatorMap, initFamilyMap, initAidantMap };
