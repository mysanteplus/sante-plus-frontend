// ============================================================
// js/modules/map.js - MODULE CARTE COMPLET
// Version: 2.0
// Description: Gestion de la carte pour les 3 rôles
// ============================================================

import { secureFetch } from "../core/api.js";
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
// FONCTION PRINCIPALE - ROUTAGE PAR RÔLE
// ============================================================

export async function initLiveMap() {
    console.log("🗺️ Initialisation de la carte...");
    
    const userRole = localStorage.getItem("user_role");
    console.log("👤 Rôle utilisateur pour la carte:", userRole);
    
    // Appeler la bonne fonction selon le rôle
    if (userRole === "COORDINATEUR") {
        await initCoordinatorMap();
    } else if (userRole === "FAMILLE") {
        await initFamilyMap();
    } else if (userRole === "AIDANT") {
        await initAidantMap();
    } else {
        // Fallback si rôle non reconnu
        const container = document.getElementById("view-container");
        if (container) {
            container.innerHTML = `
                <div class="text-center py-20">
                    <i class="fa-solid fa-map-location-dot text-5xl text-slate-300 mb-4"></i>
                    <p class="text-slate-500">Vue carte non disponible pour ce rôle</p>
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
            
            <div id="info-panel" class="fixed right-4 top-24 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 hidden transition-all">
                <div class="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h4 id="panel-title" class="font-black text-slate-800">Détails</h4>
                    <button id="close-panel" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-times"></i></button>
                </div>
                <div id="panel-content" class="p-4 max-h-96 overflow-y-auto"></div>
            </div>
        </div>
    `;

    // ✅ Attendre que le DOM soit prêt
    await new Promise(r => setTimeout(r, 100));
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error("❌ Map element non trouvé");
        return;
    }
    
    // ✅ Nettoyer l'ancienne carte
    if (map) {
        map.remove();
        map = null;
        markers = {};
    }
    
    // ✅ Initialiser la carte AVEC un centre par défaut
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false, 
        zoomSnap: 0.5,
        center: [6.368, 2.401],  // ← Centre par défaut (Cotonou)
        zoom: 12                  // ← Zoom par défaut
    });
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(map);
    
    // ✅ Forcer l'invalidation de la taille
    setTimeout(() => {
        if (map) map.invalidateSize(true);
    }, 200);
    
    // ✅ Cacher le loader
    const mapLoading = document.getElementById('map-loading');
    if (mapLoading) {
        setTimeout(() => {
            mapLoading.style.opacity = '0';
            setTimeout(() => mapLoading.style.display = 'none', 300);
        }, 500);
    }


    
    // ✅ Événements
    document.getElementById('refresh-map-btn')?.addEventListener('click', () => loadCoordinatorData());
    document.getElementById('center-all-btn')?.addEventListener('click', () => centerAllMarkers());
    document.getElementById('show-alerts-btn')?.addEventListener('click', () => showAlertsPanel());
    document.getElementById('close-panel')?.addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');
    });
    
    document.getElementById('filter-aidant')?.addEventListener('change', () => applyFilters());
    document.getElementById('filter-patient')?.addEventListener('change', () => applyFilters());
    document.getElementById('filter-status')?.addEventListener('change', () => applyFilters());
    
    // ✅ Charger les données
    await loadCoordinatorData();
    await loadFiltersData();
    
    // ✅ Rafraîchissement automatique
    if (activeInterval) clearInterval(activeInterval);
    activeInterval = setInterval(() => loadCoordinatorData(), 10000);
}

async function loadCoordinatorData() {
    try {
        const aidants = await secureFetch('/visites/active-aidants');
        const patients = await secureFetch('/visites/patients-locations');
        activeAidants = aidants;
        updateCoordinatorMarkers(aidants, patients);
        updateCoordinatorStats(aidants);
    } catch (err) {
        console.error("❌ Erreur chargement données:", err);
    }
}

function updateCoordinatorMarkers(aidants, patients) {
    if (!map) return;
    
    // Supprimer les anciens marqueurs
    Object.keys(markers).forEach(key => {
        if (markers[key] && map) {
            try {
                map.removeLayer(markers[key]);
            } catch(e) {}
            delete markers[key];
        }
    });
    
    // Marqueurs patients - avec vérification de sécurité
    if (patients && Array.isArray(patients) && patients.length) {
        patients.forEach(patient => {
            // ✅ Vérification que patient existe et a des coordonnées
            if (!patient || !patient.lat || !patient.lng) return;
            try {
                const icon = createCoordinatorIcon('#3B82F6', 'home', false);
                const marker = L.marker([patient.lat, patient.lng], { icon }).addTo(map);
                marker.bindPopup(`
                    <div class="text-center p-2">
                        <p class="font-black text-slate-800">🏠 ${escapeHtml(patient.nom_complet || 'Patient')}</p>
                        <p class="text-[10px] text-slate-500">${escapeHtml(patient.adresse || 'Adresse non renseignée')}</p>
                    </div>
                `);
                markers[`patient_${patient.id}`] = marker;
            } catch(e) { console.warn("Erreur marqueur patient:", e); }
        });
    }
    
    // Marqueurs aidants - avec vérification de sécurité
    if (aidants && Array.isArray(aidants) && aidants.length) {
        aidants.forEach(aidant => {
            // ✅ Vérification que aidant existe et a une position
            if (!aidant || !aidant.last_position?.lat || !aidant.last_position?.lng) return;
            try {
                const isInside = aidant.is_inside_geofence === true;
                const color = isInside ? '#10B981' : '#F43F5E';
                const icon = createCoordinatorIcon(color, 'user-nurse', true);
                const marker = L.marker([aidant.last_position.lat, aidant.last_position.lng], { icon }).addTo(map);
                marker.bindPopup(`
                    <div class="text-center p-2 min-w-[200px]">
                        <p class="font-black text-slate-800">${escapeHtml(aidant.aidant?.nom || 'Aidant')}</p>
                        <p class="text-[10px] text-slate-500">Patient: ${escapeHtml(aidant.patient?.nom_complet || '?')}</p>
                        <p class="text-[9px] ${isInside ? 'text-emerald-600' : 'text-rose-600'} font-bold">${isInside ? '✅ Dans la zone' : '⚠️ Hors zone'}</p>
                        <button onclick="window.viewAidantHistory('${aidant.aidant?.id}')" class="mt-1 w-full py-1 bg-indigo-500 text-white rounded-lg text-[9px]">📜 Historique</button>
                    </div>
                `);
                markers[`aidant_${aidant.id}`] = marker;
            } catch(e) { console.warn("Erreur marqueur aidant:", e); }
        });
    }
}

function updateCoordinatorStats(aidants) {
    const total = aidants.length;
    const outside = aidants.filter(a => !a.is_inside_geofence).length;
    const badge = document.getElementById('active-count-badge');
    if (badge) {
        badge.innerHTML = `${total} AIDANT${total > 1 ? 'S' : ''} LIVE`;
        badge.classList.toggle('bg-amber-500', outside > 0);
        badge.classList.toggle('bg-emerald-500', outside === 0);
    }
    if (outside > 0) showToast(`${outside} aidant${outside > 1 ? 's' : ''} hors zone`, "warning", 5000);
}

async function loadFiltersData() {
    try {
        const aidants = await secureFetch('/visites/active-aidants');
        const patients = await secureFetch('/visites/patients-locations');
        const aidantSelect = document.getElementById('filter-aidant');
        const patientSelect = document.getElementById('filter-patient');
        if (aidantSelect) {
            aidantSelect.innerHTML = '<option value="">Tous les aidants</option>' +
                [...new Map(aidants.map(a => [a.aidant?.id, a.aidant])).values()]
                .filter(a => a).map(a => `<option value="${a.id}">${escapeHtml(a.nom)}</option>`).join('');
        }
        if (patientSelect) {
            patientSelect.innerHTML = '<option value="">Tous les patients</option>' +
                patients.map(p => `<option value="${p.id}">${escapeHtml(p.nom_complet)}</option>`).join('');
        }
    } catch (err) { console.error(err); }
}

function applyFilters() {
    const aidantFilter = document.getElementById('filter-aidant')?.value;
    const patientFilter = document.getElementById('filter-patient')?.value;
    const statusFilter = document.getElementById('filter-status')?.value;
    let filtered = [...activeAidants];
    if (aidantFilter) filtered = filtered.filter(a => a.aidant?.id === aidantFilter);
    if (patientFilter) filtered = filtered.filter(a => a.patient?.id === patientFilter);
    if (statusFilter === 'inside') filtered = filtered.filter(a => a.is_inside_geofence);
    if (statusFilter === 'outside') filtered = filtered.filter(a => !a.is_inside_geofence);
    
    Object.keys(markers).forEach(key => {
        if (key.startsWith('aidant_') && markers[key]) {
            map.removeLayer(markers[key]); delete markers[key];
        }
    });
    filtered.forEach(aidant => {
        if (!aidant.last_position?.lat || !aidant.last_position?.lng) return;
        const isInside = aidant.is_inside_geofence;
        const icon = createCoordinatorIcon(isInside ? '#10B981' : '#F43F5E', 'user-nurse', true);
        const marker = L.marker([aidant.last_position.lat, aidant.last_position.lng], { icon }).addTo(map);
        markers[`aidant_${aidant.id}`] = marker;
    });
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
        // ✅ Centre par défaut si aucun marqueur
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
// 👨‍👩‍👧 VUE FAMILLE
// ============================================================

async function initFamilyMap() {
    const container = document.getElementById('view-container');
    
    container.innerHTML = `
        <div class="animate-fadeIn flex flex-col h-[calc(100vh-120px)] pb-0">
            <div class="flex justify-between items-center mb-4 shrink-0 flex-wrap gap-3">
                <div>
                    <h3 class="text-xl font-black text-slate-800">👨‍👩‍👧 Suivi de votre proche</h3>
                    <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Localisation en temps réel</p>
                </div>
                <button id="refresh-family-btn" class="bg-white p-2 rounded-xl shadow-md border border-slate-100">
                    <i class="fa-solid fa-rotate-right text-slate-600"></i>
                </button>
            </div>
            
            <!-- Carte -->
            <div id="live-map-container" class="flex-1 w-full rounded-xl border-2 border-white shadow-lg relative overflow-hidden bg-slate-100" style="min-height: 50vh; height: auto;">
                <div id="map" class="absolute inset-0 z-10 w-full h-full"></div>
                <div id="map-loading" class="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div class="text-center">
                        <div class="relative w-8 h-8 mx-auto mb-2">
                            <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                        </div>
                        <p class="text-[9px] font-black text-slate-400">Chargement de la carte...</p>
                    </div>
                </div>
            </div>
            
            <!-- Informations -->
            <div class="mt-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">STATUT DE L'INTERVENTION</p>
                        <p id="family-status" class="font-black text-emerald-600 text-sm">---</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">DERNIÈRE MISE À JOUR</p>
                        <p id="family-last-update" class="text-[9px] text-slate-500">---</p>
                    </div>
                </div>
                <div id="family-distance" class="mt-3 pt-3 border-t border-slate-100 hidden">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">DISTANCE DE L'AIDANT</p>
                    <p id="family-distance-value" class="font-black text-lg text-emerald-600">---</p>
                </div>
            </div>
            
            <!-- Légende -->
            <div class="mt-3 bg-white/90 backdrop-blur-sm p-2 rounded-xl border border-slate-100">
                <div class="flex items-center justify-around text-[8px] font-bold">
                    <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-blue-500"></div><span>Domicile</span></div>
                    <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><span>Aidant</span></div>
                </div>
            </div>
        </div>
    `;

    setTimeout(async () => {
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
        
        // ✅ Initialisation de la carte AVEC centre par défaut
        map = L.map('map', { 
            zoomControl: false, 
            attributionControl: false,
            center: [6.368, 2.401],
            zoom: 12
        });
        
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        }).addTo(map);
        
        // ✅ Forcer la taille de la carte
        setTimeout(() => {
            if (map) {
                map.invalidateSize(true);
                setTimeout(() => {
                    if (map) map.invalidateSize(true);
                }, 500);
            }
        }, 300);
        
        // ✅ Cacher le loader (corrigé : suppression de la redéclaration)
        const loaderElement = document.getElementById('map-loading');
        if (loaderElement) {
            setTimeout(() => {
                loaderElement.style.opacity = '0';
                setTimeout(() => loaderElement.style.display = 'none', 500);
            }, 1000);
        }
        
        // ✅ Bouton rafraîchissement
        document.getElementById('refresh-family-btn')?.addEventListener('click', () => {
            loadFamilyData();
            showToast("Rafraîchissement...", "info", 1000);
        });
        
        // ✅ Charger les données
        await loadFamilyData();
        
        // ✅ Rafraîchissement automatique toutes les 15 secondes
        if (activeInterval) clearInterval(activeInterval);
        activeInterval = setInterval(() => loadFamilyData(), 15000);
        
    }, 200);
}


async function loadFamilyData() {
    try {
        console.log("📡 Chargement des données famille...");
        
        const patients = await secureFetch('/patients');
        console.log("📋 Patients reçus:", patients);
        
        const patient = patients?.[0];
        if (!patient) {
            console.warn("Aucun patient trouvé pour cette famille");
            // ✅ Vérifier que l'élément existe avant de modifier
            const statusEl = document.getElementById('family-status');
            if (statusEl) statusEl.innerHTML = '❌ Aucun patient associé';
            return;
        }
        
        // Afficher le domicile du patient
        if (patient.lat && patient.lng) {
            console.log("📍 Domicile patient:", patient.lat, patient.lng);
            
            if (markers['patient_home']) map.removeLayer(markers['patient_home']);
            const homeIcon = createCustomIcon('#3B82F6', false, 'lg', 'home');
            markers['patient_home'] = L.marker([patient.lat, patient.lng], { icon: homeIcon }).addTo(map);
            markers['patient_home'].bindPopup(`
                <div class="text-center p-2">
                    <p class="font-black text-slate-800">🏠 ${escapeHtml(patient.nom_complet)}</p>
                    <p class="text-[10px] text-slate-500">${escapeHtml(patient.adresse || 'Adresse non renseignée')}</p>
                </div>
            `);
            
            map.setView([patient.lat, patient.lng], 14);
        } else {
            console.warn("Patient sans coordonnées GPS");
        }
        
        // Récupérer la position de l'aidant
        try {
            const activeVisit = await secureFetch(`/visites/active/${patient.id}`);
            console.log("🩺 Visite active:", activeVisit);
            
            const statusEl = document.getElementById('family-status');
            const lastUpdateEl = document.getElementById('family-last-update');
            const distanceDiv = document.getElementById('family-distance');
            const distanceValueEl = document.getElementById('family-distance-value');
            
            // ✅ Vérifier que les éléments existent
            if (!statusEl || !lastUpdateEl) {
                console.warn("Éléments HTML non trouvés");
                return;
            }
            
            if (activeVisit && activeVisit.hasPosition === true && activeVisit.lat && activeVisit.lng) {
                console.log("📍 Position aidant:", activeVisit.lat, activeVisit.lng);
                
                if (markers['aidant']) map.removeLayer(markers['aidant']);
                const aidantIcon = createCustomIcon('#10B981', true, 'lg', 'user-nurse');
                markers['aidant'] = L.marker([activeVisit.lat, activeVisit.lng], { icon: aidantIcon }).addTo(map);
                markers['aidant'].bindPopup(`
                    <div class="text-center p-2">
                        <p class="font-black text-slate-800">👨‍⚕️ ${escapeHtml(activeVisit.aidant_nom || 'Aidant')}</p>
                        <p class="text-[10px] text-emerald-600">🚶 En déplacement vers votre proche</p>
                        <p class="text-[9px] text-slate-400">🕐 ${new Date(activeVisit.last_update).toLocaleTimeString()}</p>
                    </div>
                `);
                
                statusEl.innerHTML = '🟢 Intervention en cours';
                lastUpdateEl.innerHTML = new Date(activeVisit.last_update).toLocaleTimeString();
                
                if (patient.lat && patient.lng && distanceDiv && distanceValueEl) {
                    const distance = calculateDistance(activeVisit.lat, activeVisit.lng, patient.lat, patient.lng);
                    distanceDiv.classList.remove('hidden');
                    distanceValueEl.innerHTML = formatDistance(distance);
                    
                    const bounds = L.latLngBounds([patient.lat, patient.lng], [activeVisit.lat, activeVisit.lng]);
                    map.fitBounds(bounds, { padding: [50, 50] });
                }
            } else {
                console.log("Aucune visite active");
                statusEl.innerHTML = '⚪ Aucune intervention en cours';
                lastUpdateEl.innerHTML = '---';
                if (distanceDiv) distanceDiv.classList.add('hidden');
                
                if (patient.lat && patient.lng) {
                    map.setView([patient.lat, patient.lng], 14);
                }
            }
        } catch (err) {
            console.error("Erreur chargement visite active:", err);
            const statusEl = document.getElementById('family-status');
            if (statusEl) statusEl.innerHTML = '⚠️ Erreur de chargement';
        }
        
    } catch (err) {
        console.error("❌ Erreur loadFamilyData:", err);
        const statusEl = document.getElementById('family-status');
        if (statusEl) statusEl.innerHTML = '❌ Erreur de chargement';
        showToast("Erreur de chargement des données", "error");
    }
}
// ============================================================
// 🧭 VUE AIDANT
// ============================================================
async function initAidantMap() {
    const container = document.getElementById('view-container');
    
    // ✅ Utiliser toute la hauteur disponible
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
            
            <!-- Sélecteur patient compact -->
            <div class="mb-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                <label class="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                    <i class="fa-solid fa-hospital-user mr-1"></i> Destination
                </label>
                <select id="patient-selector" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium">
                    <option value="">-- Choisir un patient --</option>
                </select>
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
            
            <!-- ✅ CARTE PLEIN ÉCRAN -->
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
        
        // ============================================
        // ✅ CRÉATION DE LA CARTE
        // ============================================
        map = L.map('map', { zoomControl: false, attributionControl: false, zoomSnap: 0.5 });
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        
        // Option 1 : OpenStreetMap classique (précis, gratuit)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
            maxZoom: 20,
            subdomains: ['a', 'b', 'c']
        }).addTo(map);
        
        // Option 2 : Satellite (très précis pour les repères visuels)
        // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        //     attribution: 'Tiles &copy; Esri',
        //     maxZoom: 19
        // }).addTo(map);
        
        // Option 3 : Google Maps-like (gratuit, bonne précision)
        // L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        //     attribution: 'Google',
        //     maxZoom: 20,
        //     subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        // }).addTo(map);        
        // ============================================
        // ✅ FORCER LA TAILLE DE LA CARTE (AJOUTÉ ICI)
        // ============================================
        setTimeout(() => {
            if (map) {
                map.invalidateSize(true);
                setTimeout(() => {
                    if (map) map.invalidateSize(true);
                }, 500);
            }
        }, 300);
        
        // ============================================
        // ✅ BOUTONS ET ÉVÉNEMENTS
        // ============================================
        const enableGpsBtn = document.getElementById('enable-gps-btn');
        const gpsWarning = document.getElementById('gps-warning');
        
        // ✅ 3. FONCTION POUR DEMANDER LA POSITION
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
        
        // Centrage sur position actuelle
        document.getElementById('center-map-btn')?.addEventListener('click', () => {
            requestLocation();
        });
        
        // Effacer trajectoire
        document.getElementById('clear-trajectory-btn')?.addEventListener('click', () => { 
            clearTrajectory(); 
            showToast("Trajectoire effacée", "info"); 
        });
        
        // Activer GPS
        enableGpsBtn?.addEventListener('click', () => {
            requestLocation();
        });
        
        // Fixer domicile patient
        document.getElementById('fix-patient-gps')?.addEventListener('click', () => fixCurrentLocationAsPatientHome());
        
        // Arrêter navigation
        document.getElementById('stop-navigation-btn')?.addEventListener('click', () => stopNavigation());
        
        // Charger patients assignés
        await loadAssignedPatients();
        
        // Sélection patient
        document.getElementById('patient-selector')?.addEventListener('change', async (e) => {
            const patientId = e.target.value;
            if (patientId) { 
                await startNavigation(patientId); 
            } else { 
                stopNavigation(); 
            }
        });
        
        // Cacher loader
        const mapLoading = document.getElementById('map-loading');
        if (mapLoading) {
            setTimeout(() => {
                mapLoading.style.opacity = '0';
                setTimeout(() => mapLoading.style.display = 'none', 300);
            }, 500);
        }


// ✅ Ajoute l'écouteur du bouton "Améliorer la précision" ICI
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

// Démarrer la demande GPS
requestLocation();

        
    }, 100);
}






/**
 * 📍 AJOUTER UN CERCLE DE PRÉCISION SUR LA CARTE
 */
function addAccuracyCircle(lat, lng, accuracy, color = '#3B82F6') {
    // Supprimer l'ancien cercle s'il existe
    if (window._accuracyCircle) {
        map.removeLayer(window._accuracyCircle);
    }
    
    // Créer le cercle de précision
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
    // Supprimer l'ancien marqueur
    if (window._positionMarker) {
        map.removeLayer(window._positionMarker);
    }
    if (window._positionCircle) {
        map.removeLayer(window._positionCircle);
    }
    
    // Icône personnalisée
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
    
    // Popup avec infos
    window._positionMarker.bindPopup(`
        <div class="text-center p-1">
            <p class="font-black text-xs">${label}</p>
            <p class="text-[9px] text-slate-500">Précision: ${Math.round(accuracy)} mètres</p>
        </div>
    `);
}


/**
 * 🎯 AMÉLIORER LA PRÉCISION GPS (mode dédié)
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
                        
                        // Mettre à jour l'affichage
                        const percent = Math.min(100, (100 - accuracy) * 1.5);
                        document.getElementById('gps-accuracy-bar').style.width = `${Math.max(0, percent)}%`;
                        document.getElementById('gps-accuracy-value').innerHTML = `Précision: ${Math.round(accuracy)} mètres`;
                        
                        // Conseils selon la précision
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
                        
                        // Condition d'arrêt
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
 * 📍 LISSAGE DES POSITIONS GPS (filtre des positions aberrantes)
 */
let positionHistory = [];
let lastValidPosition = null;

function smoothPosition(lat, lng, accuracy, maxHistory = 5) {
    // Ignorer les positions trop imprécises
    if (accuracy > 100) {
        console.log(`📍 Position ignorée (précision: ${Math.round(accuracy)}m)`);
        return lastValidPosition || { lat, lng };
    }
    
    // Ignorer les sauts trop grands (> 50m)
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
    
    // Ajouter à l'historique
    positionHistory.push({ lat, lng, accuracy, timestamp: Date.now() });
    if (positionHistory.length > maxHistory) positionHistory.shift();
    
    // Calculer la moyenne des positions récentes
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

async function startNavigation(patientId) {
    try {
        const patient = await secureFetch(`/patients/${patientId}`);
        if (!patient.lat || !patient.lng) {
            UI.warning("Ce patient n'a pas de position GPS");
            document.getElementById('fix-patient-gps').classList.remove('hidden');
            return;
        }
        document.getElementById('fix-patient-gps').classList.add('hidden');
        
        currentPatient = patient;
        currentPatientCoords = { lat: patient.lat, lng: patient.lng };
        isNavigating = true;  // ← Vérifie que cette ligne est bien là
        
        console.log("🚗 Navigation démarrée vers:", currentPatientCoords);
        
        // Afficher le panneau
        document.getElementById('navigation-panel').classList.remove('hidden');
        document.getElementById('stop-navigation-btn').classList.remove('hidden');
        document.getElementById('dest-name').innerText = patient.nom_complet;
        
        // Ajouter marqueur patient
        if (markers['patient']) map.removeLayer(markers['patient']);
        const patientIcon = createCustomIcon('#3B82F6', false, 'lg', 'home');
        markers['patient'] = L.marker([patient.lat, patient.lng], { icon: patientIcon }).addTo(map);
        
        // Calculer l'itinéraire initial
        await calculateAndDisplayRoute();
        
        // Vérifier si déjà arrivé
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
                
                // ✅ Mettre à jour l'affichage
                const distanceDisplay = document.getElementById('distance-display');
                const timeDisplay = document.getElementById('time-display');
                
                if (distanceDisplay) distanceDisplay.innerHTML = formatDistance(distance);
                if (timeDisplay) timeDisplay.innerHTML = formatDuration(duration);
                
                console.log(`📍 Distance: ${formatDistance(distance)}, Temps: ${formatDuration(duration)}`);
                
                // Dessiner la route
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

    // Vérifier la permission
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
            
            // Message selon la précision
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
            
            // Si précision faible, proposer de réessayer
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
    
    // Options haute précision
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
            
            // ✅ Lissage de la position
            const smoothed = smoothPosition(rawLat, rawLng, accuracy);
            
            // ✅ Ajouter le cercle de précision
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

export { initCoordinatorMap, initFamilyMap, initAidantMap };
