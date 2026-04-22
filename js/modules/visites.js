import { secureFetch } from "../core/api.js";
import { CONFIG } from "../core/config.js";
import { AppState } from "../core/state.js";
import { UI, compressImage, showSkeleton } from "../core/utils.js";
import supabase from "../core/supabaseClient.js";


// Canal Realtime PERSISTANT pour les visites
let realtimeChannel = null;

function getRealtimeChannel() {
    if (!realtimeChannel) {
        realtimeChannel = supabase.channel('visites-updates', {
            config: {
                broadcast: { ack: false, self: false }
            }
        });
        realtimeChannel.subscribe((status) => {
            console.log(`📡 [REALTIME] Canal visites: ${status}`);
        });
    }
    return realtimeChannel;
}


// Au tout début de visites.js, après les imports
console.log("🔍 [visites.js] Début du chargement du module");
console.log("🔍 [visites.js] UI importé:", typeof UI);
console.log("🔍 [visites.js] secureFetch importé:", typeof secureFetch);

// Variables globales pour le tracking GPS
let geoWatchId = null;
let lastSentPosition = null;
let trackingInterval = null;


export async function startVisit(patientId) {
  try {
    UI.vibrate();
    
    // Vérifier si une visite est déjà en cours
    const existingVisit = localStorage.getItem("active_visit_id");
    if (existingVisit) {
      const confirm = await Swal.fire({
        title: "Visite en cours",
        text: "Une visite est déjà active. Voulez-vous la terminer avant d'en démarrer une nouvelle ?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Terminer la visite",
        cancelButtonText: "Annuler",
        customClass: { popup: 'rounded-[2.5rem]' }
      });
      if (confirm.isConfirmed) {
        window.switchView("end-visit");
        return;
      }
      throw new Error("Une visite est déjà en cours");
    }

    Swal.fire({
      title: '<i class="fa-solid fa-satellite-dish fa-beat text-emerald-500 mb-2"></i><br><span class="text-xl font-black">Initialisation du Suivi</span>',
      html: '<p class="text-xs text-slate-400 uppercase tracking-widest font-bold">Couplage GPS et vérification du périmètre de sécurité...</p>',
      allowOutsideClick: false,
      showConfirmButton: false,
      customClass: { popup: 'rounded-[2.5rem]' },
      didOpen: () => Swal.showLoading(),
    });

    // 1. Capturer la position d'entrée
    const coords = await getCurrentLocation();
    const gpsString = `${coords.lat},${coords.lon}`;

    // 2. ✅ CORRECTION ICI : secureFetch retourne déjà les données
    const data = await secureFetch("/visites/start", {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        gps_start: gpsString,
      }),
    
    });

    console.log("✅ Données reçues:", data);  

    // ✅ Plus besoin de res.json() et res.ok
    // if (!res.ok) throw new Error(data.error); ← À SUPPRIMER

    // 3. Stockage des identifiants de session
    localStorage.setItem("active_visit_id", data.visite_id);
    localStorage.setItem("active_patient_id", patientId);

    //----------------------------
    //------------------------------

    try {
    const { data: patient } = await supabase
        .from("patients")
        .select("famille_user_id, nom_complet")
        .eq("id", patientId)
        .single();
    
    if (patient && patient.famille_user_id) {
        // Notification push
        await fetch(`${CONFIG.API_URL}/notifications/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: patient.famille_user_id,
                title: "🔔 Début d'intervention",
                message: `L'aidant est arrivé au domicile de ${patient.nom_complet}`,
                type: "visit",
                url: "/#feed"
            })
        });
    }
} catch (err) {
    console.warn("Erreur notification famille:", err);
}

    // 4. LANCEMENT DU TRACKER GPS
    startBackgroundTracking(data.visite_id);

    // 5. Rafraîchir l'UI pour cacher le bouton "Démarrer"
    refreshAidantUI(patientId);

    Swal.fire({
      icon: "success",
      title: '<span class="text-emerald-600 font-black">Protocole Activé</span>',
      html: `
        <div class="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-4">
            <p class="text-[10px] text-slate-400 font-black uppercase mb-1">Système de sécurité</p>
            <p class="text-xs font-bold text-slate-600 leading-relaxed">📍 Position de départ: ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}<br>🛰️ Tracking GPS Live : <span class="text-emerald-500">ACTIF</span><br>📡 Rapport automatique : <span class="text-emerald-500">EN COURS</span></p>
        </div>`,
      timer: 4000,
      showConfirmButton: false,
      customClass: { popup: 'rounded-[2.5rem]' }
    });

        // ✅ FORCER LE RAFRAÎCHISSEMENT
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('app-data-updated', {
            detail: { endpoint: '/visites/start', method: 'POST', resourceType: 'visit_started' }
        }));
    }, 500);

    // Rediriger vers la page de visite en cours
    window.switchView("visits");
    

  } catch (err) {
    UI.vibrate("error");
    Swal.fire({
        title: "Erreur Visite",
        text: err.message, 
        icon: "error",
        confirmButtonColor: "#0F172A",
        customClass: { popup: 'rounded-[2.5rem]' }
    });
  }
}




/**
 * 📥 CHARGER LES VISITES
 */
export async function loadVisits() {
    const container = document.getElementById("visits-list");
    if (!container) return;

    // Afficher le squelette
    showSkeleton(container, 'visit-card');

    try {
        const data = await secureFetch("/visites");

        AppState.visites = Array.isArray(data) ? data : [];
        renderVisits();
    } catch (err) {
        console.error("❌ Erreur loadVisits:", err.message);
        container.innerHTML = `<p class="text-rose-500 text-center p-10 font-bold">Erreur: ${err.message}</p>`;
        throw err;
    }
}

/**
 * Affiche les visites sous forme de Timeline
 */
export function renderVisits() {
    const container = document.getElementById("visits-list");
    if (!container) return;

    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const isCoordinateur = userRole === "COORDINATEUR";
    const themeColor = isMaman ? 'pink' : 'emerald';
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    const primaryLight = isMaman ? '#FFF1F2' : '#ECFDF5';

    if (AppState.visites.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <i class="fa-solid fa-calendar-check text-4xl text-slate-300 mb-3"></i>
                <p class="text-slate-400 font-medium">Aucune visite enregistrée</p>
                <p class="text-[10px] text-slate-300 mt-1">Les visites apparaîtront ici</p>
            </div>`;
        return;
    }

    container.innerHTML = AppState.visites
        .map((v, index) => {
            // Statut avec badge dynamique
            const statusConfig = {
                'Validé': { icon: 'fa-circle-check', text: 'Validé', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                'Rejeté': { icon: 'fa-circle-xmark', text: 'Rejeté', color: 'text-rose-500', bg: 'bg-rose-50' },
                'En attente': { icon: 'fa-clock', text: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50' }
            };
            const status = statusConfig[v.statut] || statusConfig['En attente'];

            return `
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm mb-3 overflow-hidden hover:shadow-md transition-all" 
                     style="animation: fadeInUp 0.25s ease ${index * 0.05}s forwards; opacity: 0;">
                    
                    <!-- En-tête coloré selon le statut -->
                    <div class="px-4 py-3 ${status.bg} border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h4 class="font-black text-slate-800 text-sm">${v.patient?.nom_complet || 'Patient inconnu'}</h4>
                            <p class="text-[10px] text-slate-500 mt-0.5">
                                <i class="fa-regular fa-calendar mr-1"></i>${UI.formatDate(v.heure_debut)}
                            </p>
                        </div>
                        <span class="badge-dynamic ${status.bg} ${status.color}">
                            <i class="fa-regular ${status.icon} mr-1"></i>
                            ${status.text}
                        </span>
                    </div>
                    
                    <!-- Corps de la carte -->
                    <div class="p-4">
                        ${v.photo_url ? `
                            <div class="relative mb-3 rounded-xl overflow-hidden">
                                <img src="${v.photo_url}" class="w-full h-40 object-cover cursor-pointer" onclick="window.open('${v.photo_url}')">
                                <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-lg">
                                    <span class="text-[8px] text-white font-bold">📸 Preuve</span>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${v.activites_faites && v.activites_faites.length ? `
                            <div class="mb-3">
                                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Activités réalisées</p>
                                <div class="flex flex-wrap gap-1">
                                    ${v.activites_faites.map(act => `
                                        <span class="text-[9px] px-2 py-1 rounded-full" style="background: ${primaryLight}; color: ${primaryColor};">✓ ${escapeHtml(act)}</span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${v.notes ? `
                            <div class="mb-3 p-3 bg-slate-50 rounded-xl">
                                <p class="text-[9px] font-bold text-slate-400 mb-1">📝 Note de l'aidant</p>
                                <p class="text-xs text-slate-600 italic">"${escapeHtml(v.notes)}"</p>
                            </div>
                        ` : ''}
                        
                        <!-- Aidant -->
                        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                                    ${v.aidant?.photo_url ? 
                                        `<img src="${v.aidant.photo_url}" class="w-full h-full object-cover">` : 
                                        `<i class="fa-solid fa-user-nurse text-slate-400 text-xs"></i>`
                                    }
                                </div>
                                <div>
                                    <p class="text-[11px] font-bold text-slate-700">${escapeHtml(v.aidant?.nom || 'Aidant')}</p>
                                    <p class="text-[9px] text-slate-400">Intervenant</p>
                                </div>
                            </div>
                            <!-- 🔒 BOUTON VALIDER : UNIQUEMENT POUR LE COORDINATEUR -->
                            ${isCoordinateur && v.statut === "En attente" ? `
                                <button onclick="window.quickValidate('${v.id}', 'Validé')" 
                                        class="px-3 py-1.5 rounded-lg text-[9px] font-bold text-white transition-all active:scale-95"
                                        style="background: ${primaryColor};">
                                    <i class="fa-solid fa-check mr-1"></i> Valider
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
}


function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}



export async function submitEndVisit() {
    const visiteId = localStorage.getItem("active_visit_id");
    const photoInput = document.getElementById("visit-photo");
    
    if (!photoInput.files || !photoInput.files[0]) {
        UI.vibrate('error');
        return Swal.fire("Photo Manquante", "La photo est obligatoire pour clôturer l'intervention.", "warning");
    }

    try {
        Swal.fire({
            title: '<i class="fa-solid fa-cloud-arrow-up fa-bounce text-blue-500 mb-4 text-4xl"></i><br><span class="text-xl font-black">Transmission...</span>',
            html: '<p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Envoi du bilan certifié en cours...</p>',
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: { popup: 'rounded-[3rem] p-8' },
            didOpen: () => Swal.showLoading(),
        });

        // 📍 Récupération silencieuse du GPS final
        let gpsEnd = "0,0";
        try {
            if(navigator.geolocation) {
                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:5000}));
                gpsEnd = `${pos.coords.latitude},${pos.coords.longitude}`;
            }
        } catch (e) { console.warn("GPS final ignoré"); }

        // Récupération des données
        const notes = document.getElementById("visit-notes").value;
        const humeur = document.getElementById("visit-humeur").value;
        const activites = JSON.stringify(Array.from(document.querySelectorAll('.task-check:checked')).map(el => el.value));

        let fileToUpload = photoInput.files[0];
        if (fileToUpload.size > 1024 * 1024) { // plus de 1MB
            fileToUpload = await compressImage(fileToUpload, 1024, 0.7);
            console.log(`📸 Photo compressée: ${(photoInput.files[0].size / 1024).toFixed(1)}KB → ${(fileToUpload.size / 1024).toFixed(1)}KB`);
        }
        
        const fd = new FormData();
        fd.append("visite_id", visiteId);
        fd.append("notes", notes);
        fd.append("humeur", humeur);
        fd.append("activites_faites", activites);
        fd.append("gps_end", gpsEnd);
        fd.append("photo_visite", compressedPhoto);

        const response = await fetch(`${CONFIG.API_URL}/visites/end`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            body: fd,
        });

        if (!response.ok) throw new Error("Erreur de transmission réseau.");

        // 🛑 DÉCOUPLAGE DU TRACKER GPS
        const watchId = localStorage.getItem("geo_watch_id");
        if (watchId) {
            navigator.geolocation.clearWatch(parseInt(watchId));
            localStorage.removeItem("geo_watch_id");
        }
        localStorage.removeItem("active_visit_id");
        
        UI.vibrate("success");
        await Swal.fire({
            icon: "success",
            title: '<span class="text-emerald-500 font-black">Mission Accomplie</span>',
            html: `<div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2 mt-2">
                    <i class="fa-solid fa-shield-check text-emerald-500"></i>
                    <span class="text-[10px] font-black text-emerald-600 uppercase">Données Sécurisées</span>
                   </div>`,
            confirmButtonColor: "#0F172A",
            confirmButtonText: "RETOUR AU PLANNING",
            customClass: { popup: 'rounded-[3rem]' }
        });


          // ✅ APRÈS AVOIR CRÉÉ LE MESSAGE DANS LE FEED
    // Envoyer une notification à la famille
    try {
        const { data: patient } = await supabase
            .from("patients")
            .select("famille_user_id, nom_complet")
            .eq("id", visite.patient_id)
            .single();
        
              if (patient && patient.famille_user_id) {
                  await fetch(`${CONFIG.API_URL}/notifications/send`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                          userId: patient.famille_user_id,
                          title: "📋 Nouveau rapport de visite",
                          message: `Le rapport de visite pour ${patient.nom_complet} est disponible`,
                          type: "visit",
                          url: "/#feed"
                      })
                  });
              }
          } catch (err) {
              console.warn("Erreur notification:", err);
          }
      
      // ✅ FORCER LE RAFRAÎCHISSEMENT
      window.dispatchEvent(new CustomEvent('app-data-updated', {
          detail: { endpoint: '/visites/end', method: 'POST', resourceType: 'visit_ended' }
      }));
      
        window.viewPatientFeed(AppState.currentPatient); 
        window.switchView("visits");

    } catch (err) {
        UI.vibrate("error");
        Swal.fire("Échec", err.message, "error");
    }
}

//--------------------------------------------------
//-----------------------------------------------------

/**
 * 📄 VUE : PAGE DE CLÔTURE DE VISITE (PLEIN ÉCRAN MOBILE)
 */
// js/modules/visites.js - Remplacer renderEndVisitView()

export async function renderEndVisitView() {
    const container = document.getElementById("view-container");
    
    // Récupérer le patient
    let patient = null;
    try {
        const patients = await secureFetch("/patients");
        if (Array.isArray(patients) && patients.length > 0) {
            patient = patients[0];
        } else if (patients?.data) {
            patient = patients.data[0];
        }
        
        if (!patient) {
            container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">Patient non trouvé</p></div>`;
            return;
        }
    } catch (err) {
        console.error("Erreur récupération patient:", err);
        container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">Erreur de chargement</p></div>`;
        return;
    }
    
    // 🔥 DÉTECTION DU TYPE DE DOSSIER
    const isMaman = patient.categorie_service === 'MAMAN_BEBE' || 
                    patient.formule === 'MATERNITE' ||
                    localStorage.getItem("user_is_maman") === "true";
    
    const themeColor = isMaman ? 'pink' : 'emerald';
    const themeBgClass = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
    const themeTextClass = isMaman ? 'text-pink-600' : 'text-emerald-600';
    const themeBorderClass = isMaman ? 'border-pink-200' : 'border-emerald-200';
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-lg mx-auto pb-24">
            <!-- Header -->
            <div class="flex items-center gap-4 mb-6">
                <button onclick="window.switchView('visits')" class="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 active:scale-95">
                    <i class="fa-solid fa-arrow-left text-sm"></i>
                </button>
                <div>
                    <h3 class="font-bold text-xl text-slate-800 tracking-tight">
                        ${isMaman ? '👶 Bilan visite Maman & Bébé' : '📋 Rapport d\'Intervention'}
                    </h3>
                    <p class="text-[10px] font-black uppercase tracking-wider ${themeTextClass} mt-0.5">
                        <i class="fa-solid fa-circle-dot animate-pulse mr-1"></i> 
                        ${isMaman ? 'Suivi personnalisé post-partum' : 'Tracking actif'}
                    </p>
                </div>
            </div>

            <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-6">
                
                <!-- 📋 SECTION ACTIVITÉS (ADAPTÉE SELON LE TYPE) -->
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-3 block">
                        <i class="fa-regular fa-circle-check mr-1"></i> 
                        ${isMaman ? 'Soins & accompagnement réalisés' : 'Tâches réalisées'}
                    </label>
                    <div class="grid grid-cols-1 gap-2">
                        ${getChecklistHTML(isMaman)}
                    </div>
                </div>

                <!-- 🌸 SECTION BÉBÉ (UNIQUEMENT POUR LES DOSSIERS MAMAN) -->
                ${isMaman ? `
                <div class="border-t ${themeBorderClass} pt-4">
                    <label class="text-[10px] font-black ${themeTextClass} uppercase tracking-wider ml-1 mb-3 block flex items-center gap-2">
                        <i class="fa-solid fa-baby-carriage"></i> Métriques bébé
                    </label>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-medium text-slate-500 block mb-1">
                                🍼 Dernière tétée
                            </label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="baby-feeding" step="0.5" class="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="heures">
                                <span class="text-xs text-slate-400">heures</span>
                            </div>
                            <p class="text-[7px] text-slate-400 mt-1">Depuis la dernière tétée</p>
                        </div>
                        <div>
                            <label class="text-[9px] font-medium text-slate-500 block mb-1">
                                😴 Sommeil
                            </label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="baby-sleep" step="0.5" class="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="heures">
                                <span class="text-xs text-slate-400">heures</span>
                            </div>
                            <p class="text-[7px] text-slate-400 mt-1">Aujourd'hui</p>
                        </div>
                        <div>
                            <label class="text-[9px] font-medium text-slate-500 block mb-1">
                                🧷 Couches
                            </label>
                            <input type="number" id="baby-diapers" step="1" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="nombre">
                            <p class="text-[7px] text-slate-400 mt-1">Nombre de changes aujourd'hui</p>
                        </div>
                        <div>
                            <label class="text-[9px] font-medium text-slate-500 block mb-1">
                                ⚖️ Poids
                            </label>
                            <div class="flex items-center gap-2">
                                <input type="number" id="baby-weight" step="10" class="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="grammes">
                                <span class="text-xs text-slate-400">grammes</span>
                            </div>
                            <p class="text-[7px] text-slate-400 mt-1">Dernière mesure</p>
                        </div>
                    </div>
                    <p class="text-[8px] text-slate-400 text-center mt-3 italic">
                        Ces données alimenteront le tableau de bord de la maman
                    </p>
                </div>
                ` : ''}

                <!-- 💊 SECTION TRAITEMENTS (UNIQUEMENT POUR SENIOR) -->
                ${!isMaman ? `
                <div class="border-t border-slate-100 pt-4">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-3 block">
                        <i class="fa-solid fa-pills mr-1"></i> Traitements & Médicaments
                    </label>
                    <textarea id="visit-traitements" rows="2" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                              placeholder="Médicaments pris, posologies, rappels..."></textarea>
                </div>
                ` : ''}

                <!-- 😊 HUMEUR DU PATIENT -->
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-3 block">
                        <i class="fa-regular fa-face-smile mr-1"></i> 
                        ${isMaman ? 'Humeur de la maman' : 'Humeur du patient'}
                    </label>
                    <select id="visit-humeur" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium">
                        <option value="Très Joyeux">😊 Très Joyeux / En forme</option>
                        <option value="Calme">😐 Calme / Stable</option>
                        <option value="Fatigué">😴 Fatigué</option>
                        <option value="Triste">😔 Triste / Nostalgique</option>
                    </select>
                </div>

                <!-- 📝 NOTES / MESSAGE À LA FAMILLE -->
                <div>
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 mb-3 block">
                        <i class="fa-regular fa-message mr-1"></i> 
                        ${isMaman ? 'Message pour la maman' : 'Message à la famille'}
                    </label>
                    <textarea id="visit-notes" rows="3" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none" 
                              placeholder="${isMaman ? 'État général, conseils, observations sur bébé...' : 'Déroulement de la visite, observations...'}"></textarea>
                </div>

                <!-- 📸 PHOTO OBLIGATOIRE -->
                <div>
                    <label class="text-[10px] font-black ${themeTextClass} uppercase tracking-wider ml-1 mb-3 block">
                        <i class="fa-solid fa-camera mr-1"></i> Preuve photo requise
                    </label>
                    <div class="relative w-full h-32 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:${themeBorderClass} hover:${themeBgClass} transition-all flex flex-col items-center justify-center overflow-hidden cursor-pointer">
                        <input type="file" id="visit-photo" accept="image/*" capture="environment" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                        <i class="fa-solid fa-cloud-upload-alt text-3xl text-slate-300 mb-2"></i>
                        <p id="photo-label" class="text-xs font-medium text-slate-500">Prendre ou choisir une photo</p>
                        <p class="text-[8px] text-slate-400 mt-1">JPG, PNG - Max 5MB</p>
                    </div>
                </div>

                <!-- BOUTON DE VALIDATION -->
                <div class="pt-4">
                    <button onclick="window.submitEndVisitWithContext(${isMaman})" 
                            class="w-full py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            style="background: ${isMaman ? '#E11D48' : '#0F172A'}; color: white;">
                        <i class="fa-solid fa-paper-plane"></i> 
                        ${isMaman ? 'Transmettre le bilan maman & bébé' : 'Transmettre le rapport'}
                    </button>
                </div>
            </div>
        </div>
    `;

    // Afficher le nom du fichier quand une photo est sélectionnée
    const photoInput = document.getElementById('visit-photo');
    const photoLabel = document.getElementById('photo-label');
    if (photoInput && photoLabel) {
        photoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                photoLabel.innerHTML = `📸 ${e.target.files[0].name.substring(0, 30)}`;
                photoLabel.classList.add('text-emerald-600', 'font-bold');
            } else {
                photoLabel.innerHTML = 'Prendre ou choisir une photo';
                photoLabel.classList.remove('text-emerald-600', 'font-bold');
            }
        });
    }
}

/**
 * ✅ CHECKLIST ADAPTÉE SELON LE TYPE DE DOSSIER
 */
function getChecklistHTML(isMaman) {
    if (isMaman) {
        // 🌸 Tâches spécifiques Maman & Bébé
        return `
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-pink-500" value="Aide à l'allaitement"> 
                <span class="text-sm font-medium text-slate-700">🍼 Aide à l'allaitement / Tétée</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-pink-500" value="Soins du nourrisson (bain, change)"> 
                <span class="text-sm font-medium text-slate-700">🛁 Soins du nourrisson (bain, change)</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-pink-500" value="Surveillance poids / température"> 
                <span class="text-sm font-medium text-slate-700">📊 Surveillance poids / température</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-pink-500" value="Conseils post-partum"> 
                <span class="text-sm font-medium text-slate-700">💬 Conseils post-partum</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-pink-500" value="Aide ménagère légère"> 
                <span class="text-sm font-medium text-slate-700">🧺 Aide ménagère légère</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-pink-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-pink-500" value="Soutien psychologique / écoute"> 
                <span class="text-sm font-medium text-slate-700">🤝 Soutien psychologique / écoute</span>
            </label>
        `;
    } else {
        // 👴 Tâches spécifiques Senior
        return `
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-emerald-500" value="Aide à la mobilité / Promenade"> 
                <span class="text-sm font-medium text-slate-700">🚶 Aide à la mobilité / Promenade</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-emerald-500" value="Rappel des médicaments"> 
                <span class="text-sm font-medium text-slate-700">💊 Rappel des médicaments</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-emerald-500" value="Préparation des repas"> 
                <span class="text-sm font-medium text-slate-700">🍲 Préparation des repas</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-emerald-500" value="Courses / accompagnement RDV"> 
                <span class="text-sm font-medium text-slate-700">🛒 Courses / accompagnement RDV</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-emerald-500" value="Toilette / hygiène"> 
                <span class="text-sm font-medium text-slate-700">🚿 Toilette / hygiène</span>
            </label>
            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-emerald-50 transition-colors">
                <input type="checkbox" class="task-check w-5 h-5 accent-emerald-500" value="Présence rassurante / écoute"> 
                <span class="text-sm font-medium text-slate-700">💬 Présence rassurante / écoute</span>
            </label>
        `;
    }
}

/**
 * 📤 SOUMISSION DU BILAN AVEC CONTEXTE (Maman ou Senior)
 */
window.submitEndVisitWithContext = async (isMaman) => {
    const visiteId = localStorage.getItem("active_visit_id");
    const photoInput = document.getElementById("visit-photo");
    
    if (!photoInput.files || !photoInput.files[0]) {
        UI.vibrate('error');
        return Swal.fire("Photo Manquante", "La photo est obligatoire pour clôturer l'intervention.", "warning");
    }

    // Récupérer les données communes
    const notes = document.getElementById("visit-notes")?.value || "";
    const humeur = document.getElementById("visit-humeur")?.value || "Calme";
    const activites = JSON.stringify(Array.from(document.querySelectorAll('.task-check:checked')).map(el => el.value));
    
    // Récupérer les métriques bébé (si dossier Maman)
    let babyFeeding, babySleep, babyDiapers, babyWeight;
    if (isMaman) {
        babyFeeding = document.getElementById("baby-feeding")?.value;
        babySleep = document.getElementById("baby-sleep")?.value;
        babyDiapers = document.getElementById("baby-diapers")?.value;
        babyWeight = document.getElementById("baby-weight")?.value;
    }
    
    // Récupérer les traitements (si dossier Senior)
    const traitements = !isMaman ? document.getElementById("visit-traitements")?.value : null;

    try {
        Swal.fire({
            title: '<i class="fa-solid fa-cloud-arrow-up fa-bounce text-blue-500 mb-4 text-4xl"></i><br><span class="text-xl font-black">Transmission...</span>',
            html: '<p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Envoi du bilan en cours...</p>',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading(),
        });

        // 📍 Récupération GPS finale
        let gpsEnd = "0,0";
        try {
            if (navigator.geolocation) {
                const pos = await new Promise((res, rej) => {
                    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 });
                });
                gpsEnd = `${pos.coords.latitude},${pos.coords.longitude}`;
            }
        } catch (e) {
            console.warn("GPS final ignoré");
        }

        // Compression photo
        let fileToUpload = photoInput.files[0];
        if (fileToUpload.size > 2 * 1024 * 1024) {
            fileToUpload = await compressImage(fileToUpload, 1024, 0.8);
        }

        // 1. Envoyer la visite
        const fd = new FormData();
        fd.append("visite_id", visiteId);
        fd.append("notes", notes);
        fd.append("humeur", humeur);
        fd.append("activites_faites", activites);
        fd.append("gps_end", gpsEnd);
        fd.append("photo_visite", fileToUpload);

        const response = await fetch(`${CONFIG.API_URL}/visites/end`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            body: fd,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erreur de transmission");
        }

        // 2. Envoyer les métriques bébé (si dossier Maman)
        if (isMaman && (babyFeeding || babySleep || babyDiapers || babyWeight)) {
            const patientId = localStorage.getItem("active_patient_id");
            
            const metrics = [];
            if (babyFeeding && parseFloat(babyFeeding) > 0) {
                metrics.push({ metric_type: 'feeding', value: parseFloat(babyFeeding) });
            }
            if (babySleep && parseFloat(babySleep) > 0) {
                metrics.push({ metric_type: 'sleep', value: parseFloat(babySleep) });
            }
            if (babyDiapers && parseInt(babyDiapers) > 0) {
                metrics.push({ metric_type: 'diapers', value: parseInt(babyDiapers) });
            }
            if (babyWeight && parseInt(babyWeight) > 0) {
                metrics.push({ metric_type: 'weight', value: parseInt(babyWeight) });
            }
            
            for (const metric of metrics) {
                await secureFetch('/educational/baby-metric', {
                    method: 'POST',
                    body: JSON.stringify({
                        patient_id: patientId,
                        metric_type: metric.metric_type,
                        value: metric.value,
                        source: 'aidant_visite'
                    })
                });
            }
            console.log(`✅ ${metrics.length} métriques bébé enregistrées`);
        }

        // 3. Nettoyage
        const watchId = localStorage.getItem("geo_watch_id");
        if (watchId) {
            navigator.geolocation.clearWatch(parseInt(watchId));
            localStorage.removeItem("geo_watch_id");
        }
        localStorage.removeItem("active_visit_id");
        localStorage.removeItem("active_patient_id");
        
        UI.vibrate("success");
        
        const successMessage = isMaman 
            ? "Bilan maman & bébé transmis avec succès !"
            : "Rapport d'intervention transmis avec succès !";
        
        await Swal.fire({
            icon: "success",
            title: '<span class="text-emerald-500 font-black">Mission Accomplie</span>',
            html: `<div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2 mt-2">
                    <i class="fa-solid fa-shield-check text-emerald-500"></i>
                    <span class="text-[10px] font-black text-emerald-600 uppercase">${successMessage}</span>
                   </div>`,
            confirmButtonColor: "#0F172A",
            confirmButtonText: "RETOUR",
            customClass: { popup: 'rounded-3xl' }
        });

        // Rafraîchir les vues
        if (isMaman && typeof window.loadMamanDashboard === 'function') {
            await window.loadMamanDashboard();
        }
        window.switchView("visits");

    } catch (err) {
        UI.vibrate("error");
        console.error("❌ Erreur:", err);
        Swal.fire("Échec", err.message, "error");
    }
};


/**
 * 📤 SOUMISSION DU BILAN AVEC MÉTRIQUES BÉBÉ (pour dossiers Maman)
 */
window.submitEndVisitWithBabyMetrics = async () => {
    const visiteId = localStorage.getItem("active_visit_id");
    const photoInput = document.getElementById("visit-photo");
    
    if (!photoInput.files || !photoInput.files[0]) {
        UI.vibrate('error');
        return Swal.fire("Photo Manquante", "La photo est obligatoire pour clôturer l'intervention.", "warning");
    }

    // Récupérer les métriques bébé si présentes
    const babyFeeding = document.getElementById("baby-feeding")?.value;
    const babySleep = document.getElementById("baby-sleep")?.value;
    const babyDiapers = document.getElementById("baby-diapers")?.value;
    const babyWeight = document.getElementById("baby-weight")?.value;

    try {
        Swal.fire({
            title: '<i class="fa-solid fa-cloud-arrow-up fa-bounce text-blue-500 mb-4 text-4xl"></i><br><span class="text-xl font-black">Transmission...</span>',
            html: '<p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Envoi du bilan certifié en cours...</p>',
            allowOutsideClick: false,
            showConfirmButton: false,
            customClass: { popup: 'rounded-[3rem] p-8' },
            didOpen: () => Swal.showLoading(),
        });

        // Récupération GPS
        let gpsEnd = "0,0";
        try {
            if(navigator.geolocation) {
                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:5000}));
                gpsEnd = `${pos.coords.latitude},${pos.coords.longitude}`;
            }
        } catch (e) { console.warn("GPS final ignoré"); }

        // Récupération des données
        const notes = document.getElementById("visit-notes").value;
        const humeur = document.getElementById("visit-humeur").value;
        const activites = JSON.stringify(Array.from(document.querySelectorAll('.task-check:checked')).map(el => el.value));
        
        // Compression photo
        let fileToUpload = photoInput.files[0];
        if (fileToUpload.size > 1024 * 1024) {
            fileToUpload = await compressImage(fileToUpload, 1024, 0.7);
        }

        // 1. Envoyer la visite
        const fd = new FormData();
        fd.append("visite_id", visiteId);
        fd.append("notes", notes);
        fd.append("humeur", humeur);
        fd.append("activites_faites", activites);
        fd.append("gps_end", gpsEnd);
        fd.append("photo_visite", fileToUpload);

        const response = await fetch(`${CONFIG.API_URL}/visites/end`, {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            body: fd,
        });

        if (!response.ok) throw new Error("Erreur de transmission réseau.");

        // 2. Envoyer les métriques bébé si présentes
        if (babyFeeding || babySleep || babyDiapers || babyWeight) {
            const patientId = localStorage.getItem("active_patient_id");
            
            const metrics = [];
            if (babyFeeding) metrics.push({ metric_type: 'feeding', value: parseFloat(babyFeeding) });
            if (babySleep) metrics.push({ metric_type: 'sleep', value: parseFloat(babySleep) });
            if (babyDiapers) metrics.push({ metric_type: 'diapers', value: parseInt(babyDiapers) });
            if (babyWeight) metrics.push({ metric_type: 'weight', value: parseInt(babyWeight) });
            
            for (const metric of metrics) {
                await secureFetch('/educational/baby-metric', {
                    method: 'POST',
                    body: JSON.stringify({
                        patient_id: patientId,
                        metric_type: metric.metric_type,
                        value: metric.value,
                        source: 'aidant_visite'
                    })
                });
            }
            console.log(`✅ ${metrics.length} métriques bébé enregistrées`);
        }

        // Nettoyage
        const watchId = localStorage.getItem("geo_watch_id");
        if (watchId) {
            navigator.geolocation.clearWatch(parseInt(watchId));
            localStorage.removeItem("geo_watch_id");
        }
        localStorage.removeItem("active_visit_id");
        
        UI.vibrate("success");
        await Swal.fire({
            icon: "success",
            title: '<span class="text-emerald-500 font-black">Mission Accomplie</span>',
            html: `<div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-center gap-2 mt-2">
                    <i class="fa-solid fa-shield-check text-emerald-500"></i>
                    <span class="text-[10px] font-black text-emerald-600 uppercase">Données Sécurisées</span>
                   </div>`,
            confirmButtonColor: "#0F172A",
            confirmButtonText: "RETOUR AU PLANNING",
            customClass: { popup: 'rounded-[3rem]' }
        });

        window.viewPatientFeed(AppState.currentPatient); 
        window.switchView("visits");

    } catch (err) {
        UI.vibrate("error");
        Swal.fire("Échec", err.message, "error");
    }
};

//----------------------------------------------------------
//----------------------------------------------------------

export async function renderStartVisitView(patientId) {
    if (!patientId) {
        console.error("❌ renderStartVisitView: patientId manquant");
        UI.error("Patient non sélectionné");
        window.switchView('patients');
        return;
    }
    
    const container = document.getElementById("view-container");
    
    try {
        const p = await secureFetch(`/patients/${patientId}`);
        
        container.innerHTML = `
            <div class="animate-slideIn max-w-lg mx-auto pb-32">
                <div class="flex items-center gap-4 mb-8">
                    <button onclick="window.switchView('patients')" class="w-12 h-12 bg-white rounded-2xl border shadow-sm flex items-center justify-center text-slate-400">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h3 class="font-black text-2xl text-slate-800 tracking-tight">Mission : ${p.nom_complet}</h3>
                        <p class="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Prêt pour l'intervention ?</p>
                    </div>
                </div>

                <div class="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div class="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Localisation</p>
                        <p class="text-xs font-bold text-slate-800">${p.adresse || 'Adresse non renseignée'}</p>
                    </div>

                    <div class="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                        <p class="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Instructions</p>
                        <p class="text-xs font-medium text-slate-700 leading-relaxed italic">"${p.notes_medicales || 'Aucune consigne.'}"</p>
                    </div>

                    <button onclick="window.startVisit('${p.id}')" class="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all active:scale-95">
                        DÉMARRER LA VISITE (GPS)
                    </button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("❌ Erreur renderStartVisitView:", err);
        UI.error("Patient introuvable");
        window.switchView('patients');
    }
}

//--------------------------------------------------------------------
//-------------------------------------------------------------------

export async function checkActiveVisitOnStart() {
    try {
        console.log("🔍 Vérification des visites actives au démarrage...");
        const visits = await secureFetch("/visites");
        const activeVisit = visits.find(v => v.statut === "En cours");
        
        if (activeVisit) {
            console.log("🔄 Visite active trouvée en base:", activeVisit.id);
            localStorage.setItem("active_visit_id", activeVisit.id);
            localStorage.setItem("active_patient_id", activeVisit.patient_id);
            
            // ✅ Attendre que la vue patient soit chargée
            const currentPatientId = localStorage.getItem("active_patient_id");
            if (currentPatientId) {
                setTimeout(() => {
                    // Vérifier si on est sur la vue patient
                    const container = document.getElementById("aidant-active-area");
                    if (container) {
                        refreshAidantUI(currentPatientId);
                    }
                }, 500);
            }
        } else {
            console.log("✅ Aucune visite active trouvée");
            localStorage.removeItem("active_visit_id");
            localStorage.removeItem("active_patient_id");
            localStorage.removeItem("geo_watch_id");
        }
    } catch (err) {
        console.error("Erreur vérification visite active:", err);
    }
}
//-------------------------------------------------------------------------
//------------------------------------------------------------

/**
 * 🔄 REPRISE AUTOMATIQUE DU TRACKING
 * À appeler dans main.js au démarrage pour éviter de perdre le suivi en cas de refresh
 */
export function resumeTrackingIfActive() {
    const activeVisitId = localStorage.getItem("active_visit_id");
    if (activeVisitId && !geoWatchId) {
        console.log("🛰️ [GPS] Reprise du suivi pour la visite :", activeVisitId);
        startBackgroundTracking(activeVisitId);
    }
}


//-----------------------------------------------------------------------------
//------------------------------------------------------------------------

let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 20;

export function refreshAidantUI(patientId) {
    const tryRefresh = () => {
        const container = document.getElementById("aidant-active-area");
        
        if (!container) {
            refreshAttempts++;
            if (refreshAttempts < MAX_REFRESH_ATTEMPTS) {
                console.log(`⏳ En attente de l'élément... (${refreshAttempts}/${MAX_REFRESH_ATTEMPTS})`);
                setTimeout(tryRefresh, 300);
            } else {
                console.warn("⚠️ Élément non trouvé, abandon");
                refreshAttempts = 0;
            }
            return;
        }
        
        // Réinitialiser le compteur
        refreshAttempts = 0;
        
        const activeVisitId = localStorage.getItem("active_visit_id");
        
        if (!activeVisitId) {
            container.innerHTML = `
                <div class="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-lg border-t border-slate-100 z-40">
                    <button onclick="window.startVisit('${patientId}')" 
                            class="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                        <i class="fa-solid fa-play"></i> Démarrer la visite
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-lg border-t border-slate-100 z-40">
                    <button onclick="window.openEndVisit()" 
                            class="w-full py-5 bg-rose-500 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                        <i class="fa-solid fa-camera"></i> Clôturer la visite
                    </button>
                </div>
            `;
        }
    };
    
    tryRefresh();
}


/**
 * ⭐ NOTATION DE LA VISITE (Famille)
 */
window.rateVisit = async (visiteId) => {
    const { value: rating } = await Swal.fire({
        title: 'Noter l\'intervention',
        html: `
            <div class="text-center">
                <p class="text-sm text-slate-600 mb-3">Comment s'est passée la visite ?</p>
                <div class="flex justify-center gap-2 text-3xl" id="star-rating">
                    ${[1,2,3,4,5].map(i => `<i class="fa-regular fa-star text-slate-300 cursor-pointer hover:text-amber-400 transition" data-rating="${i}"></i>`).join('')}
                </div>
                <textarea id="rating-comment" class="w-full mt-4 p-3 bg-slate-50 rounded-xl text-sm" rows="2" placeholder="Votre commentaire (optionnel)..."></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '✓ Envoyer',
        cancelButtonText: 'Plus tard',
        confirmButtonColor: '#10B981',
        didOpen: () => {
            let selectedRating = 0;
            document.querySelectorAll('#star-rating i').forEach(star => {
                star.addEventListener('click', () => {
                    selectedRating = parseInt(star.dataset.rating);
                    document.querySelectorAll('#star-rating i').forEach((s, idx) => {
                        if (idx < selectedRating) {
                            s.className = 'fa-solid fa-star text-amber-400';
                        } else {
                            s.className = 'fa-regular fa-star text-slate-300';
                        }
                    });
                });
            });
            window.selectedRating = () => selectedRating;
        },
        preConfirm: () => {
            const rating = window.selectedRating ? window.selectedRating() : 0;
            if (rating === 0) {
                Swal.showValidationMessage('Veuillez sélectionner une note');
                return false;
            }
            const comment = document.getElementById('rating-comment')?.value || '';
            return { rating, comment };
        }
    });
    
    if (rating && rating.rating) {
        try {
            await secureFetch("/visites/rate", {
                method: "POST",
                body: JSON.stringify({
                    visite_id: visiteId,
                    note: rating.rating,
                    commentaire: rating.comment
                })
            });
            UI.success("Merci pour votre évaluation !");
        } catch (err) {
            UI.error(err.message);
        }
    }
};


/**
 * 📡 MOTEUR DE SURVEILLANCE LIVE
 * Envoie des signaux "ping" au serveur avec la position actuelle
 */
function startBackgroundTracking(visiteId) {
    if (!navigator.geolocation) {
        console.warn("⚠️ GPS non supporté sur ce navigateur");
        return;
    }

    // Nettoyer l'ancien watcher s'il existe
    if (geoWatchId) {
        navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = null;
    }

    // Envoyer la position toutes les 10 secondes même sans mouvement
    if (trackingInterval) clearInterval(trackingInterval);
    
    trackingInterval = setInterval(async () => {
        if (!localStorage.getItem("active_visit_id")) {
            clearInterval(trackingInterval);
            return;
        }
        
        // Demander une position à jour
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    await sendPosition(position, visiteId);
                },
                (err) => console.warn("⚠️ Erreur position périodique:", err.message),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, 10000); // Toutes les 10 secondes

    // Watcher en continu pour les mouvements
    geoWatchId = navigator.geolocation.watchPosition(
        async (position) => {
            await sendPosition(position, visiteId);
        },
        (error) => {
            console.error("❌ Erreur Watcher GPS:", error.message);
            if (error.code === 1) {
                // Permission refusée
                Swal.fire({
                    title: "GPS requis",
                    text: "Veuillez autoriser la localisation pour le suivi des visites",
                    icon: "warning",
                    confirmButtonColor: "#0F172A"
                });
            }
        },
        { 
            enableHighAccuracy: true, 
            maximumAge: 5000, // 5 secondes max
            timeout: 15000 
        }
    );

    localStorage.setItem("geo_watch_id", geoWatchId);
    console.log("🛰️ [GPS] Tracking démarré avec ID:", geoWatchId);
}

// Fonction helper pour envoyer une position
async function sendPosition(position, visiteId) {
    const { latitude, longitude, accuracy } = position.coords;
    
    // ✅ Assouplir le seuil de précision (100m -> 150m)
    if (accuracy > 150) {
        console.warn(`🛰️ [GPS] Point ignoré : précision trop faible (${Math.round(accuracy)}m)`);
        return;
    }

    // Vérifier si la position a changé de façon significative (> 10m au lieu de 5m)
    if (lastSentPosition) {
        const lastLat = lastSentPosition.lat;
        const lastLng = lastSentPosition.lng;
        const distance = calculateDistance(latitude, longitude, lastLat, lastLng);
        
        if (distance < 10) {
            // Position trop proche de la précédente, on ignore
            return;
        }
    }
    
    console.log(`🛰️ [GPS] Point envoyé : ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Précision: ${Math.round(accuracy)}m)`);
    
    lastSentPosition = { lat: latitude, lng: longitude };

    try {
        await fetch(`${CONFIG.API_URL}/visites/track`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                visite_id: visiteId, 
                lat: latitude, 
                lng: longitude,
                accuracy: accuracy 
            })
        });
    } catch(e) {
        console.warn("❌ Erreur envoi position:", e);
    }
}




function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Rayon de la Terre en mètres
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

/**
 * 📍 UTILITAIRE : RÉCUPÉRER LA POSITION GPS ACTUELLE
 */
async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("GPS non supporté par ce téléphone"));
        }

        // ✅ Options pour une meilleure précision
        const options = {
            enableHighAccuracy: true,  // Forcer la haute précision
            timeout: 30000,            // 30 secondes
            maximumAge: 0              // Pas de cache
        };

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const accuracy = pos.coords.accuracy;
                console.log(`📍 Position obtenue avec précision: ${Math.round(accuracy)}m`);
                
                // ✅ Accepter même avec précision moyenne (moins de 100m)
                if (accuracy > 150) {
                    console.warn(`⚠️ Précision faible (${Math.round(accuracy)}m), mais on accepte`);
                }
                
                resolve({ 
                    lat: pos.coords.latitude, 
                    lon: pos.coords.longitude,
                    accuracy: accuracy 
                });
            },
            (err) => {
                let msg = "Erreur GPS";
                if (err.code === 1) msg = "Merci d'autoriser le partage de position";
                if (err.code === 2) msg = "Position indisponible, réessayez";
                if (err.code === 3) msg = "Délai dépassé, vérifiez votre connexion";
                reject(new Error(msg));
            },
            options
        );
    });
}



/**
 * 🏠 FIXER LE DOMICILE DU PATIENT (Elite Feature)
 * Permet à l'aidant, lors de sa première visite, d'enregistrer 
 * l'emplacement exact de la maison pour le Geofencing futur.
 */
window.savePatientHomeGPS = async (patientId) => {
    const confirm = await Swal.fire({
        title: 'Fixer le domicile ?',
        text: "Voulez-vous enregistrer votre position actuelle comme l'adresse officielle de ce patient ?",
        icon: 'location-dot',
        showCancelButton: true,
        confirmButtonText: 'OUI, ENREGISTRER',
        confirmButtonColor: '#10B981',
        customClass: { popup: 'rounded-[2.5rem]' }
    });

    if (confirm.isConfirmed) {
        try {
            Swal.fire({ title: 'Localisation...', didOpen: () => Swal.showLoading() });
            const coords = await getCurrentLocation();
            
            await secureFetch(`/patients/update-gps`, {
                method: 'POST',
                body: JSON.stringify({
                    patient_id: patientId,
                    lat: coords.lat,
                    lng: coords.lon
                })
            });

            UI.vibrate();
            Swal.fire("Succès", "Le périmètre de sécurité est désormais actif pour ce domicile.", "success");
        } catch (err) {
            Swal.fire("Erreur", err.message, "error");
        }
    }
};


