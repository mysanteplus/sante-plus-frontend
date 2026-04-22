import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";
import { CONFIG } from "../core/config.js"; 






/**
 * 🏷️ Formater l'affichage du créneau selon le type d'assignation
 * @param {Object} item - L'assignation
 * @returns {string} HTML formaté pour l'affichage du créneau
 */
function formatScheduleDisplay(item) {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    
    // CAS 1: Assignation ponctuelle avec heure définie
    if (item.type_assignation === 'ponctuelle' && item.heure_prevue) {
        const hour = item.heure_prevue.substring(0, 5);
        return `
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <i class="fa-regular fa-clock text-emerald-600 text-sm"></i>
                </div>
                <div>
                    <p class="text-xl font-black text-slate-800">${hour}</p>
                    <p class="text-[9px] text-slate-400">Heure prévue</p>
                </div>
            </div>
        `;
    }
    
    // CAS 2: Assignation temporelle (période définie)
    if (item.type_assignation === 'temporelle') {
        const startDate = new Date(item.date_prevue);
        const endDate = item.date_fin ? new Date(item.date_fin) : null;
        
        const startFormatted = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const endFormatted = endDate ? endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '...';
        
        // Calculer la durée en jours
        let durationText = '';
        if (endDate) {
            const diffTime = Math.abs(endDate - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
                durationText = `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
            } else if (diffDays <= 30) {
                const weeks = Math.floor(diffDays / 7);
                durationText = `${weeks} semaine${weeks > 1 ? 's' : ''}`;
            } else {
                const months = Math.floor(diffDays / 30);
                durationText = `${months} mois`;
            }
        }
        
        return `
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <i class="fa-solid fa-calendar-week text-blue-600 text-sm"></i>
                </div>
                <div>
                    <p class="text-sm font-black text-slate-800">${startFormatted} → ${endFormatted}</p>
                    ${durationText ? `<p class="text-[9px] text-slate-400">Durée: ${durationText}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    // CAS 3: Assignation permanente (DEFAULT)
    return `
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full ${isMaman ? 'bg-pink-100' : 'bg-emerald-100'} flex items-center justify-center">
                <i class="fa-solid fa-infinity ${isMaman ? 'text-pink-600' : 'text-emerald-600'} text-sm"></i>
            </div>
            <div>
                <p class="text-sm font-black ${isMaman ? 'text-pink-600' : 'text-emerald-600'} uppercase tracking-wider">Permanent</p>
                <p class="text-[9px] text-slate-400">Intervention régulière</p>
            </div>
        </div>
    `;
}


// js/modules/planning.js - AJOUTER CETTE FONCTION AU DÉBUT (après formatScheduleDisplay)

/**
 * 🏷️ Obtenir le texte du statut avec la bonne couleur
 */
function getStatusInfo(statut, typeAssignation, isMaman) {
    const statusMap = {
        'Terminé': { icon: 'fa-circle-check', text: 'Terminé', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        'Planifié': { icon: 'fa-calendar-check', text: 'Planifié', color: isMaman ? 'text-pink-600' : 'text-emerald-600', bg: isMaman ? 'bg-pink-50' : 'bg-emerald-50' },
        'En cours': { icon: 'fa-spinner fa-pulse', text: 'En cours', color: 'text-blue-600', bg: 'bg-blue-50' },
        'Annulé': { icon: 'fa-circle-xmark', text: 'Annulé', color: 'text-rose-600', bg: 'bg-rose-50' }
    };
    
    // Pour les assignations permanentes, on peut personnaliser l'affichage
    if (typeAssignation === 'permanente' && statut === 'Planifié') {
        return {
            icon: 'fa-infinity',
            text: 'Actif',
            color: isMaman ? 'text-pink-600' : 'text-emerald-600',
            bg: isMaman ? 'bg-pink-50' : 'bg-emerald-50'
        };
    }
    
    return statusMap[statut] || statusMap['Planifié'];
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

export async function loadPlanning() {
    const listContainer = document.getElementById("planning-list");
    if (!listContainer) return;

    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    const primaryLight = isMaman ? '#FFF1F2' : '#ECFDF5';

    try {
        const data = await secureFetch("/planning");

        if (!data?.length) {
            listContainer.innerHTML = `
                <div class="text-center py-20">
                    <i class="fa-solid fa-calendar-xmark text-4xl text-slate-300 mb-3"></i>
                    <p class="text-xs font-black uppercase text-slate-400">Agenda vide</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = data.map(item => {
            // 🔥 Utiliser la nouvelle fonction pour l'affichage du créneau
            const scheduleDisplay = formatScheduleDisplay(item);
            
            // 🔥 Utiliser la nouvelle fonction pour le statut
            const statusInfo = getStatusInfo(item.statut, item.type_assignation, isMaman);
            
            const borderColor = item.statut === 'Terminé' ? 'border-emerald-500' : 
                               (item.type_assignation === 'ponctuelle' ? 
                                (isMaman ? 'border-pink-500' : 'border-amber-500') : 
                                (isMaman ? 'border-pink-500' : 'border-emerald-500'));
            
            const buttonBg = isMaman ? 'bg-pink-600 hover:bg-pink-700' : 'bg-emerald-600 hover:bg-emerald-700';
            
            // Badge du type d'assignation (petit rappel visuel)
            let typeBadge = '';
            if (item.type_assignation === 'permanente') {
                typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isMaman ? 'bg-pink-50 text-pink-600' : 'bg-emerald-50 text-emerald-600'}">
                    <i class="fa-solid fa-infinity text-[8px]"></i> Permanent
                </span>`;
            } else if (item.type_assignation === 'temporelle') {
                typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-blue-50 text-blue-600">
                    <i class="fa-solid fa-calendar-week text-[8px]"></i> Temporaire
                </span>`;
            } else if (item.type_assignation === 'ponctuelle') {
                typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isMaman ? 'bg-pink-50 text-pink-600' : 'bg-amber-50 text-amber-600'}">
                    <i class="fa-solid fa-calendar-day text-[8px]"></i> Ponctuelle
                </span>`;
            }
            
            return `
                <div class="bg-white p-5 rounded-xl border-l-4 ${borderColor} shadow-sm animate-fadeIn mb-4 hover:shadow-md transition-all">
                    <!-- En-tête avec créneau et statut -->
                    <div class="flex justify-between items-start">
                        ${scheduleDisplay}
                        <div class="flex flex-col items-end gap-1">
                            <span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase ${statusInfo.bg} ${statusInfo.color}">
                                <i class="fa-solid ${statusInfo.icon} mr-1"></i>
                                ${statusInfo.text}
                            </span>
                            ${typeBadge}
                        </div>
                    </div>
                    
                    <!-- Date complète -->
                    <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-3">
                        📅 ${new Date(item.date_prevue).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    
                    <!-- Infos patient -->
                    <div class="mt-4">
                        <h4 class="font-black text-slate-800 text-base">${escapeHtml(item.patient?.nom_complet || 'Patient inconnu')}</h4>
                        <p class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            <i class="fa-solid fa-location-dot text-xs"></i>
                            <span>${escapeHtml(item.patient?.adresse || 'Adresse non renseignée')}</span>
                        </p>
                        ${item.patient?.telephone ? `
                            <p class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                <i class="fa-solid fa-phone text-xs"></i>
                                <span>${escapeHtml(item.patient.telephone)}</span>
                            </p>
                        ` : ''}
                    </div>

                    <!-- Consignes -->
                    ${item.notes_coordinateur ? `
                        <div class="mt-3 p-3 rounded-xl" style="background: ${primaryLight};">
                            <p class="text-[9px] font-black uppercase tracking-wider mb-1" style="color: ${primaryColor};">📋 Consignes :</p>
                            <p class="text-xs italic text-slate-600">"${escapeHtml(item.notes_coordinateur)}"</p>
                        </div>
                    ` : ''}
                    
                    <!-- Bouton d'action -->
                    ${userRole === "AIDANT" && item.statut !== 'Terminé' ? `
                        <button onclick="window.openMissionBriefing('${item.patient_id}', '${item.id}')" 
                                class="w-full mt-4 py-3 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all ${buttonBg}">
                            📋 Ouvrir le Briefing
                        </button>
                    ` : ''}
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Erreur chargement planning:", err);
        listContainer.innerHTML = `
            <div class="text-center py-20">
                <i class="fa-solid fa-circle-exclamation text-rose-400 text-3xl mb-3"></i>
                <p class="text-sm font-bold text-rose-500">Erreur de chargement</p>
                <p class="text-[10px] text-slate-400 mt-1">${err.message}</p>
            </div>`;
    }
}




/**
 * 🗓️ PAGE D'ASSIGNATION INDÉPENDANTE (Remplace la modale)
 */
export async function openAssignPage(patientId = null, aidantId = null) {

    // 🔥 Vider le cache pour éviter le flash
    if (typeof clearApiCache === 'function') {
        clearApiCache();
    }
    
    Swal.fire({ 
        title: '<i class="fa-solid fa-circle-notch fa-spin text-emerald-500"></i>',
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: { popup: 'bg-transparent shadow-none' }
    });
    
    try {
        const aidants = await secureFetch("/assignments/available-aidants");
        const patients = await secureFetch("/assignments/unassigned-patients");
        
        Swal.close();
        
        // Stocker les données et les pré-sélections
        window._assignData = { aidants, patients };
        window._preSelectedPatientId = patientId;
        window._preSelectedAidantId = aidantId;
        
        await renderAssignPage();
        
    } catch (err) {
        Swal.close();
        UI.error(err.message);
    }
}



/**
 * 🎨 RENDU DE LA PAGE D'ASSIGNATION
 */

/**
 * 🔧 CONFIGURATION DES FILTRES DE RECHERCHE
 */
function setupDropdownFilters() {
    // Filtre aidants
    const aidantSearch = document.getElementById('aidant-search');
    if (aidantSearch) {
        aidantSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.aidant-item').forEach(item => {
                const name = item.dataset.name?.toLowerCase() || '';
                const email = item.dataset.email?.toLowerCase() || '';
                item.style.display = name.includes(term) || email.includes(term) ? 'flex' : 'none';
            });
        });
    }
    
    // Filtre patients
    const patientSearch = document.getElementById('patient-search');
    if (patientSearch) {
        patientSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.patient-item').forEach(item => {
                const name = item.dataset.name?.toLowerCase() || '';
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

/**
 * 🔽 OUVERTURE/FERMETURE DROPDOWN AIDANT
 */
window.toggleAidantDropdown = () => {
    const dropdown = document.getElementById('aidant-dropdown');
    const chevron = document.getElementById('aidant-chevron');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (chevron) chevron.style.transform = dropdown.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        
        // Fermer l'autre dropdown
        const patientDropdown = document.getElementById('patient-dropdown');
        const patientChevron = document.getElementById('patient-chevron');
        if (patientDropdown && !patientDropdown.classList.contains('hidden')) {
            patientDropdown.classList.add('hidden');
            if (patientChevron) patientChevron.style.transform = 'rotate(0deg)';
        }
    }
};

/**
 * 🔽 OUVERTURE/FERMETURE DROPDOWN PATIENT
 */
window.togglePatientDropdown = () => {
    const dropdown = document.getElementById('patient-dropdown');
    const chevron = document.getElementById('patient-chevron');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (chevron) chevron.style.transform = dropdown.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        
        // Fermer l'autre dropdown
        const aidantDropdown = document.getElementById('aidant-dropdown');
        const aidantChevron = document.getElementById('aidant-chevron');
        if (aidantDropdown && !aidantDropdown.classList.contains('hidden')) {
            aidantDropdown.classList.add('hidden');
            if (aidantChevron) aidantChevron.style.transform = 'rotate(0deg)';
        }
    }
};




async function renderAssignPage() {
    const container = document.getElementById("view-container");
    const { aidants, patients } = window._assignData || { aidants: [], patients: [] };
    
    // 🔥 NOUVEAU : Récupérer les pré-sélections
    const preSelectedPatientId = window._preSelectedPatientId;
    const preSelectedAidantId = window._preSelectedAidantId;
    
    // 🔥 NOUVEAU : Trouver les éléments pré-sélectionnés
    let selectedAidant = null;
    let selectedPatient = null;
    
    if (preSelectedAidantId && aidants.length) {
        selectedAidant = aidants.find(a => a.id === preSelectedAidantId);
    }
    
    if (preSelectedPatientId && patients.length) {
        selectedPatient = patients.find(p => p.id === preSelectedPatientId);
    }
    
    // 🔥 NOUVEAU : Nettoyer les variables temporaires
    delete window._preSelectedPatientId;
    delete window._preSelectedAidantId;
    

    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    const themeBgClass = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
    const themeBorderClass = isMaman ? 'border-pink-200' : 'border-emerald-200';
    const themeTextClass = isMaman ? 'text-pink-600' : 'text-emerald-600';
    const themeButtonClass = isMaman ? 'bg-pink-500 hover:bg-pink-600' : 'bg-emerald-500 hover:bg-emerald-600';
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <!-- Header -->
            <div class="flex items-center gap-4 mb-6">
                <button onclick="window.switchView('rh-dashboard')" 
                        class="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-95">
                    <i class="fa-solid fa-arrow-left text-sm"></i>
                </button>
                <div>
                    <h3 class="font-bold text-xl text-slate-800 tracking-tight">Nouvelle assignation</h3>
                    <p class="text-[10px] text-slate-400 font-medium mt-0.5">Lier un aidant à un patient</p>
                </div>
            </div>

            <!-- Carte principale -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                
                <!-- Sélecteur Aidant -->
                <div class="p-5 border-b border-slate-100">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                        <i class="fa-solid fa-user-nurse mr-2 ${themeTextClass}"></i> Aidant
                    </label>
                    <div id="aidant-selector" class="relative">
                        <div onclick="window.toggleAidantDropdown()" 
                             class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:${themeBorderClass} transition-all">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl ${themeBgClass} flex items-center justify-center">
                                    <i class="fa-solid fa-user-nurse ${themeTextClass} text-base"></i>
                                </div>
                                <div>
                                    <p id="selected-aidant-name" class="font-semibold text-slate-800 text-sm">${selectedAidant ? selectedAidant.nom : 'Choisir un aidant'}</p>
                                    <p id="selected-aidant-email" class="text-[10px] text-slate-400">${selectedAidant ? (selectedAidant.email || 'Email non renseigné') : 'Sélectionnez dans la liste'}</p>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform" id="aidant-chevron"></i>
                        </div>
                        
                        <!-- Dropdown Aidant -->
                        <div id="aidant-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
                            <div class="sticky top-0 bg-white p-3 border-b border-slate-100">
                                <div class="relative">
                                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                                    <input type="text" id="aidant-search" placeholder="Rechercher un aidant..." 
                                           class="w-full pl-8 pr-3 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-${themeColor}-300">
                                </div>
                            </div>
                            <div id="aidant-list" class="divide-y divide-slate-50">
                                ${aidants.length === 0 ? 
                                    '<div class="p-6 text-center text-slate-400 text-xs">Aucun aidant disponible</div>' : 
                                    aidants.map(a => `
                                        <div class="aidant-item p-3 hover:${themeBgClass} cursor-pointer transition-colors" 
                                             data-id="${a.id}" data-name="${escapeHtml(a.nom)}" data-email="${a.email || ''}">
                                            <div class="flex items-center gap-3">
                                                <div class="w-8 h-8 rounded-lg ${themeBgClass} flex items-center justify-center text-xs font-bold ${themeTextClass}">
                                                    ${(a.nom?.charAt(0) || '?').toUpperCase()}
                                                </div>
                                                <div class="flex-1">
                                                    <p class="font-semibold text-slate-800 text-sm">${escapeHtml(a.nom)}</p>
                                                    <p class="text-[10px] text-slate-400">${a.email || 'Email non renseigné'}</p>
                                                </div>
                                                <i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                                            </div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sélecteur Patient -->
                <div class="p-5 border-b border-slate-100">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                        <i class="fa-solid fa-hospital-user mr-2 text-blue-500"></i> Patient
                    </label>
                    <div id="patient-selector" class="relative">
                        <div onclick="window.togglePatientDropdown()" 
                             class="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-300 transition-all">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <i class="fa-solid fa-user text-blue-500 text-base"></i>
                                </div>
                                <div>
                                        <p id="selected-patient-name" class="font-semibold text-slate-800 text-sm">${selectedPatient ? selectedPatient.nom_complet : 'Choisir un patient'}</p>
                                        <p id="selected-patient-formule" class="text-[10px] text-slate-400">${selectedPatient ? (selectedPatient.formule || 'Standard') : 'Sélectionnez dans la liste'}</p>
                                
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform" id="patient-chevron"></i>
                        </div>
                        
                        <!-- Dropdown Patient -->
                        <div id="patient-dropdown" class="hidden absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
                            <div class="sticky top-0 bg-white p-3 border-b border-slate-100">
                                <div class="relative">
                                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                                    <input type="text" id="patient-search" placeholder="Rechercher un patient..." 
                                           class="w-full pl-8 pr-3 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-300">
                                </div>
                            </div>
                            <div id="patient-list" class="divide-y divide-slate-50">
                                ${patients.length === 0 ? 
                                    '<div class="p-6 text-center text-slate-400 text-xs">Aucun patient non assigné</div>' : 
                                    patients.map(p => `
                                        <div class="patient-item p-3 hover:bg-blue-50 cursor-pointer transition-colors" 
                                             data-id="${p.id}" data-name="${escapeHtml(p.nom_complet)}" data-formule="${p.formule || 'Standard'}">
                                            <div class="flex items-center gap-3">
                                                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600">
                                                    ${(p.nom_complet?.charAt(0) || '?').toUpperCase()}
                                                </div>
                                                <div class="flex-1">
                                                    <p class="font-semibold text-slate-800 text-sm">${escapeHtml(p.nom_complet)}</p>
                                                    <div class="flex items-center gap-2 mt-0.5">
                                                        <p class="text-[9px] text-slate-400 truncate max-w-[150px]">${p.adresse?.substring(0, 30) || 'Adresse non renseignée'}</p>
                                                        <span class="text-[9px] font-bold ${p.formule === 'Premium' ? 'text-amber-500' : themeTextClass}">${p.formule || 'Standard'}</span>
                                                    </div>
                                                </div>
                                                <i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                                            </div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Type d'assignation -->
                <div class="p-5 border-b border-slate-100">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                        <i class="fa-regular fa-clock mr-2"></i> Type d'assignation
                    </label>
                    <div class="grid grid-cols-3 gap-2">
                        <button id="type-permanente" 
                                class="type-btn py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-${themeColor}-50 text-${themeColor}-600 border-2 border-${themeColor}-500">
                            <i class="fa-solid fa-infinity text-xs mr-1"></i> Permanente
                        </button>
                        <button id="type-temporelle" 
                                class="type-btn py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-slate-50 text-slate-500 border-2 border-slate-200">
                            <i class="fa-solid fa-calendar-week text-xs mr-1"></i> Temporaire
                        </button>
                        <button id="type-ponctuelle" 
                                class="type-btn py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-slate-50 text-slate-500 border-2 border-slate-200">
                            <i class="fa-solid fa-calendar-day text-xs mr-1"></i> Ponctuelle
                        </button>
                    </div>
                    <input type="hidden" id="assign-type" value="permanente">
                </div>

                <!-- Période (cachée par défaut) -->
                <div id="period-container" class="p-5 border-b border-slate-100 hidden">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                <i class="fa-regular fa-calendar mr-1"></i> Date de début
                            </label>
                            <input type="date" id="assign-date-debut" 
                                   class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                   value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div id="date-fin-container">
                            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                <i class="fa-regular fa-calendar-check mr-1"></i> Date de fin
                            </label>
                            <input type="date" id="assign-date-fin" 
                                   class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                        </div>
                    </div>
                    <div id="heure-container" class="mt-4 hidden">
                        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                            <i class="fa-regular fa-clock mr-1"></i> Heure de début
                        </label>
                        <input type="time" id="assign-heure" 
                               class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                               value="09:00">
                    </div>
                </div>

                <!-- Instructions -->
                <div class="p-5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">
                        <i class="fa-solid fa-pen mr-2"></i> Instructions pour l'aidant
                    </label>
                    <textarea id="assign-notes" rows="3" 
                              class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:ring-1 focus:ring-${themeColor}-300 focus:border-${themeColor}-300 outline-none"
                              placeholder="Consignes particulières pour cette intervention..."></textarea>
                </div>

                <!-- Actions -->
                <div class="p-5 bg-slate-50 flex gap-3">
                    <button onclick="window.switchView('rh-dashboard')" 
                            class="flex-1 py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 transition-all active:scale-95">
                        Annuler
                    </button>
                    <button onclick="window.submitAssignmentEnhanced()" 
                            class="flex-1 py-3 rounded-xl font-bold text-[11px] uppercase tracking-wider text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 ${themeButtonClass}">
                        <i class="fa-solid fa-link text-xs"></i> Assigner
                    </button>
                </div>
            </div>
        </div>
    `;

    // Initialiser les sélecteurs
    window._selectedAidant = null;
    window._selectedPatient = null;
    
    setupDropdownFilters();
    setupAssignTypeHandlers();
}




/**
 * 📤 SOUMISSION AVEC TYPE D'ASSIGNATION
 */
window.submitAssignmentEnhanced = async () => {
    if (!window._selectedAidant) {
        Swal.fire({
            title: "Aidant requis",
            text: "Veuillez sélectionner un aidant",
            icon: "warning",
            confirmButtonColor: "#0F172A",
            customClass: { popup: 'rounded-2xl' }
        });
        return;
    }
    if (!window._selectedPatient) {
        Swal.fire({
            title: "Patient requis",
            text: "Veuillez sélectionner un patient",
            icon: "warning",
            confirmButtonColor: "#0F172A",
            customClass: { popup: 'rounded-2xl' }
        });
        return;
    }
    
    const assignType = document.getElementById('assign-type')?.value || 'permanente';
    const dateDebut = document.getElementById("assign-date-debut")?.value;
    const dateFin = document.getElementById("assign-date-fin")?.value;
    const heure = document.getElementById("assign-heure")?.value;
    const notes = document.getElementById("assign-notes")?.value || "";
    
    if (assignType === 'temporelle' && !dateFin) {
        Swal.fire({
            title: "Date de fin requise",
            text: "Veuillez spécifier une date de fin",
            icon: "warning",
            confirmButtonColor: "#0F172A"
        });
        return;
    }
    if (assignType === 'ponctuelle' && !dateDebut) {
        Swal.fire({
            title: "Date requise",
            text: "Veuillez spécifier une date",
            icon: "warning",
            confirmButtonColor: "#0F172A"
        });
        return;
    }
    
    Swal.fire({ 
        title: "Assignation en cours...", 
        didOpen: () => Swal.showLoading(), 
        allowOutsideClick: false 
    });
    
    try {
        await secureFetch("/assignments/assign", {
            method: "POST",
            body: JSON.stringify({
                aidant_id: window._selectedAidant.id,
                patient_id: window._selectedPatient.id,
                type_assignation: assignType,
                date_debut: dateDebut || new Date().toISOString().split('T')[0],
                date_fin: assignType === 'temporelle' ? dateFin : null,
                heure_prevue: assignType === 'ponctuelle' ? heure : null,
                notes: notes
            })
        });
        
        Swal.fire({ 
            icon: "success", 
            title: "Assignation créée", 
            text: "L'aidant a été notifié",
            timer: 2000, 
            showConfirmButton: false 
        });
        window.switchView("rh-dashboard");
        
    } catch (err) {
        Swal.close();
        Swal.fire({ 
            title: "Erreur", 
            text: err.message, 
            icon: "error",
            confirmButtonColor: "#F43F5E"
        });
    }
};

/**
 * 🔧 Gestionnaire des types d'assignation
 */
// planning.js - Version corrigée de setupAssignTypeHandlers

function setupAssignTypeHandlers() {
    const typePermanente = document.getElementById('type-permanente');
    const typeTemporelle = document.getElementById('type-temporelle');
    const typePonctuelle = document.getElementById('type-ponctuelle');
    const periodContainer = document.getElementById('period-container');
    const dateFinContainer = document.getElementById('date-fin-container');
    const heureContainer = document.getElementById('heure-container');
    const assignTypeInput = document.getElementById('assign-type');
    
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const activeBgClass = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
    const activeTextClass = isMaman ? 'text-pink-600' : 'text-emerald-600';
    const activeBorderClass = isMaman ? 'border-pink-500' : 'border-emerald-500';
    const inactiveBgClass = 'bg-slate-50';
    const inactiveTextClass = 'text-slate-500';
    const inactiveBorderClass = 'border-slate-200';
    
    const setActiveStyle = (activeBtn, inactiveBtns) => {
        // Nettoyer les classes de l'élément actif
        activeBtn.classList.remove(inactiveBgClass, inactiveTextClass, inactiveBorderClass);
        activeBtn.classList.add(activeBgClass, activeTextClass, activeBorderClass);
        
        // Nettoyer les classes des éléments inactifs
        inactiveBtns.forEach(btn => {
            btn.classList.remove(activeBgClass, activeTextClass, activeBorderClass);
            btn.classList.add(inactiveBgClass, inactiveTextClass, inactiveBorderClass);
        });
    };
    
    typePermanente.addEventListener('click', () => {
        setActiveStyle(typePermanente, [typeTemporelle, typePonctuelle]);
        assignTypeInput.value = 'permanente';
        periodContainer.classList.add('hidden');
    });
    
    typeTemporelle.addEventListener('click', () => {
        setActiveStyle(typeTemporelle, [typePermanente, typePonctuelle]);
        assignTypeInput.value = 'temporelle';
        periodContainer.classList.remove('hidden');
        dateFinContainer.classList.remove('hidden');
        heureContainer.classList.add('hidden');
    });
    
    typePonctuelle.addEventListener('click', () => {
        setActiveStyle(typePonctuelle, [typePermanente, typeTemporelle]);
        assignTypeInput.value = 'ponctuelle';
        periodContainer.classList.remove('hidden');
        dateFinContainer.classList.add('hidden');
        heureContainer.classList.remove('hidden');
    });
}
/**
 * 💡 TRANSITION INTELLIGENTE - Briefing
 */
 

 export const openMissionBriefing = (patientId, planningId) => { 
    console.log("📋 openMissionBriefing appelée avec:", patientId, planningId);
    
    if (typeof UI !== 'undefined' && UI.vibrate) {
        UI.vibrate();
    }
    
    if (planningId) {
        localStorage.setItem("active_planning_id", planningId);
    }
    
    if (typeof window.viewPatientFeed === 'function') {
        window.viewPatientFeed(patientId);
    } else {
        console.error("❌ window.viewPatientFeed n'est pas définie");
        window.switchView('patients');
    }
};
// Fonction pour lier le planning au démarrage de la visite
window.startPlannedVisit = (patientId, planningId) => {
    localStorage.setItem("current_planning_id", planningId);
    window.startVisit(patientId);
};

/**
 * 🗑️ SUPPRIMER UNE ASSIGNATION (Délier aidant-patient)
 */
window.unassignAidant = async (planningId, patientName, aidantName) => {
    console.log("🔍 [DEBUG] unassignAidant appelée avec:", { planningId, patientName, aidantName });
    
    if (!planningId) {
        Swal.fire("Erreur", "ID d'assignation manquant", "error");
        return;
    }
    
    const result = await Swal.fire({
        title: "Confirmer",
        html: `Retirer <b>${escapeHtml(aidantName)}</b> de <b>${escapeHtml(patientName)}</b> ?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "OUI, SUPPRIMER",
        confirmButtonColor: "#F43F5E",
        cancelButtonText: "Annuler"
    });
    
    if (!result.isConfirmed) return;
    
    Swal.fire({ title: "Suppression...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/planning/${planningId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            }
        });
        
        console.log("📥 Réponse status:", response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur ${response.status}`);
        }
        
        Swal.fire({ 
            icon: "success", 
            title: "Assignation supprimée", 
            text: `${escapeHtml(aidantName)} n'est plus assigné à ${escapeHtml(patientName)}`,
            timer: 2000, 
            showConfirmButton: false 
        });
        
        // Recharger la vue RH
        if (typeof loadRHAssignments === 'function') {
            await loadRHAssignments();
        } else if (typeof window.loadRHAssignments === 'function') {
            await window.loadRHAssignments();
        } else {
            window.switchView('rh-dashboard');
        }
        
    } catch (err) {
        Swal.close();
        console.error("❌ Erreur suppression:", err);
        Swal.fire({ 
            title: "Erreur", 
            text: err.message || "Impossible de supprimer cette assignation", 
            icon: "error",
            confirmButtonText: "OK"
        });
    }
};




window.openMissionBriefing = openMissionBriefing;
window.unassignAidant = unassignAidant;
window.startPlannedVisit = startPlannedVisit;
window.submitAssignmentEnhanced = submitAssignmentEnhanced;
window.toggleAidantDropdown = toggleAidantDropdown;
window.togglePatientDropdown = togglePatientDropdown;
window.openAssignPage = openAssignPage;  
