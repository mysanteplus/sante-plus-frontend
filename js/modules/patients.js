// modules/patients.js 

import { secureFetch } from "../core/api.js";
import { AppState } from "../core/state.js";
import { UI, showSkeleton } from "../core/utils.js";
import * as Visites from "./visites.js";

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setActivePatient(patientId) {
    if (!patientId) {
        console.warn("patientId manquant dans setActivePatient");
        return false;
    }

    AppState.currentPatient = patientId;
    localStorage.setItem("current_patient_id", patientId);
    localStorage.setItem("active_patient_id", patientId);

    console.log("✅ Patient actif sélectionné:", patientId);
    return true;
}

function updatePatientBadges() {
    document.querySelectorAll(".patient-card-modern").forEach(el => {
        const patientId = el.dataset.patientId;
        const badge = el.querySelector(".patient-badge");

        if (!badge) return;

        const count = AppState.unreadByPatient?.[patientId] || 0;

        if (count > 0) {
            badge.textContent = count > 99 ? "99+" : count;
            badge.classList.remove("hidden");
            badge.classList.add("inline-flex");
        } else {
            badge.classList.add("hidden");
            badge.classList.remove("inline-flex");
        }
    });
}

// ============================================================
// 1. CHARGER LA LISTE DES PATIENTS
// ============================================================

export async function loadPatients() {
    const container = document.getElementById("patients-list");
    if (!container) return;

    showSkeleton(container, 'patient-card');

    try {
        const patients = await secureFetch("/patients");
        
        let allPatients = Array.isArray(patients) ? patients : (patients?.data || []);
        
        const userRole = localStorage.getItem("user_role");
        const userId = localStorage.getItem("user_id");
        
        let filteredPatients = allPatients;
        
        if (userRole === "FAMILLE") {
            filteredPatients = allPatients.filter(patient => patient.famille_user_id === userId);
            console.log(`👨‍👩‍👧 Famille ${userId}: ${filteredPatients.length} patient(s) visible(s) sur ${allPatients.length} total`);
        }
        
        AppState.patients = filteredPatients;
        
        if (filteredPatients && filteredPatients.length === 1) {
            AppState.currentPatient = filteredPatients[0].id;
            localStorage.setItem("current_patient_id", filteredPatients[0].id);
            localStorage.setItem("active_patient_id", filteredPatients[0].id);
            console.log("✅ Patient unique chargé:", AppState.currentPatient);
        } else if (filteredPatients && filteredPatients.length > 1) {
            const savedPatientId =
                localStorage.getItem("current_patient_id") ||
                localStorage.getItem("active_patient_id");
        
            const savedStillExists = filteredPatients.some(p => String(p.id) === String(savedPatientId));
        
            if (savedPatientId && savedStillExists) {
                AppState.currentPatient = savedPatientId;
                console.log("✅ Patient actif conservé:", savedPatientId);
            } else {
                AppState.currentPatient = null;
                localStorage.removeItem("current_patient_id");
                localStorage.removeItem("active_patient_id");
                console.log("ℹ️ Plusieurs patients disponibles, sélection nécessaire");
            }
        }
        
        renderPatients();
        
    } catch (err) {
        console.error("Erreur loadPatients:", err);
        container.innerHTML = `<p class="text-rose-500 text-center p-10 font-bold">Erreur: ${err.message}</p>`;
        throw err;
    }
}

// ============================================================
// 2. RENDU DE LA LISTE DES PATIENTS (CORRIGÉ)
// ============================================================

export function renderPatients() {
    const container = document.getElementById("patients-list");
    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    const primaryLight = isMaman ? '#FFF1F2' : '#ECFDF5';
    
    if (!container) return;

    if (!AppState.patients?.length) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16">
                <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <i class="fa-solid fa-users-slash text-slate-300 text-xl"></i>
                </div>
                <p class="text-slate-400 text-sm font-medium">Aucun dossier</p>
            </div>`;
        return;
    }

    container.innerHTML = AppState.patients.map((p, index) => {
        const isPremium = p.formule === 'Premium';
        const initials = p.nom_complet?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??';
        const hasGps = p.lat && p.lng;
        const isVisitActive = localStorage.getItem("active_visit_id") !== null;
        
        // ============================================================
        // ✅ ACTIONS ADAPTÉES À CHAQUE RÔLE
        // ============================================================
        let actionButtons = '';

        if (userRole === "AIDANT") {
            actionButtons = `
                <div class="grid grid-cols-3 gap-2 mt-3">
                    ${isVisitActive ? `
                        <button onclick="event.stopPropagation(); window.openEndVisit()"
                                class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                                style="background: #FEE2E2; color: #DC2626;">
                            <i class="fa-solid fa-stop-circle mr-1"></i> Clôturer
                        </button>
                    ` : `
                        <button onclick="event.stopPropagation(); window.viewPatientDetails('${p.id}')"
                                class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                                style="background: ${primaryLight}; color: ${primaryColor};">
                            <i class="fa-solid fa-eye mr-1"></i> Briefing
                        </button>
                    `}
                    <button onclick="event.stopPropagation(); window.viewPatientFeed('${p.id}')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #EEF2FF; color: #4F46E5;">
                        <i class="fa-solid fa-newspaper mr-1"></i> Journal
                    </button>
                    <button onclick="event.stopPropagation(); window.switchView('planning')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #F3E8FF; color: #7C3AED;">
                        <i class="fa-solid fa-calendar-days mr-1"></i> Planning
                    </button>
                </div>
            `;
        } else if (userRole === "COORDINATEUR") {
            actionButtons = `
                <div class="grid grid-cols-3 gap-2 mt-3">
                    <button onclick="event.stopPropagation(); window.viewPatientDetails('${p.id}')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: ${primaryLight}; color: ${primaryColor};">
                        <i class="fa-solid fa-folder-open mr-1"></i> Dossier
                    </button>
                    <button onclick="event.stopPropagation(); window.viewPatientFeed('${p.id}')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #EEF2FF; color: #4F46E5;">
                        <i class="fa-solid fa-newspaper mr-1"></i> Journal
                    </button>
                    <button onclick="event.stopPropagation(); window.switchView('map')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #FEF3C7; color: #D97706;">
                        <i class="fa-solid fa-location-dot mr-1"></i> Radar
                    </button>
                </div>
            `;
        } else if (userRole === "FAMILLE") {
            actionButtons = `
                <div class="grid grid-cols-4 gap-2 mt-3">
                    <button onclick="event.stopPropagation(); window.viewPatientFeed('${p.id}')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: ${primaryLight}; color: ${primaryColor};">
                        <i class="fa-solid fa-newspaper mr-1"></i> Journal
                    </button>
                    <button onclick="event.stopPropagation(); window.switchView('map')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #FEF3C7; color: #D97706;">
                        <i class="fa-solid fa-location-dot mr-1"></i> Suivre
                    </button>
                    <button onclick="event.stopPropagation(); window.viewVisitHistory('${p.id}')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #F3E8FF; color: #7C3AED;">
                        <i class="fa-solid fa-clock-rotate-left mr-1"></i> Historique
                    </button>
                    <button onclick="event.stopPropagation(); window.switchView('billing')"
                            class="py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            style="background: #FEF3C7; color: #B45309;">
                        <i class="fa-solid fa-file-invoice mr-1"></i> Factures
                    </button>
                </div>
            `;
        }

        return `
            <div class="patient-card-modern" 
                 data-patient-id="${p.id}"
                 style="animation: fadeInUp 0.25s ease ${index * 0.03}s forwards; opacity: 0;">
                
                <div class="flex items-center gap-3" onclick="window.viewPatientDetails('${p.id}')" style="cursor: pointer;">
                    <div class="patient-avatar" style="background: ${primaryLight}; color: ${primaryColor};">
                        ${initials}
                    </div>
                    
                    <div class="flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-bold text-slate-800 text-base">${escapeHtml(p.nom_complet || 'Inconnu')}</h4>
                            <span class="patient-badge hidden min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black items-center justify-center"></span>
                            ${isPremium ? '<i class="fa-solid fa-crown text-amber-500 text-xs"></i>' : ''}
                        </div>
                        <div class="flex items-center gap-1 mt-0.5">
                            <i class="fa-solid fa-location-dot text-slate-300 text-[10px]"></i>
                            <span class="text-[11px] text-slate-500">${escapeHtml(p.adresse?.split(',')[0] || 'Adresse non renseignée')}</span>
                        </div>
                    </div>
                    
                    <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background: ${primaryLight};">
                        <i class="fa-solid fa-chevron-right" style="color: ${primaryColor}; font-size: 12px;"></i>
                    </div>
                </div>
                
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <div class="flex items-center gap-2">
                        <span class="badge-dynamic">
                            ${p.formule === 'Basic' || p.formule === 'Essentiel' ? '<i class="fa-solid fa-leaf mr-1"></i>' : 
                              p.formule === 'Standard' || p.formule === 'Confort' ? '<i class="fa-solid fa-chart-line mr-1"></i>' :
                              p.formule === 'Premium' || p.formule === 'Sérénité' ? '<i class="fa-solid fa-crown mr-1"></i>' :
                              '<i class="fa-solid fa-tag mr-1"></i>'}
                            ${escapeHtml(p.formule || 'Standard')}
                        </span>
                        ${hasGps ? `
                            <span class="badge-dynamic" style="background: #ECFDF5; color: #059669;">
                                <i class="fa-solid fa-location-dot"></i> Géolocalisé
                            </span>
                        ` : ''}
                    </div>
                    <span class="text-[10px] text-slate-400">
                        <i class="fa-regular fa-clock"></i> ID: ${p.id?.substring(0, 6)}
                    </span>
                </div>

                ${actionButtons}
                
                ${userRole === "COORDINATEUR" && !p.famille_user_id ? `
                    <div class="mt-3">
                        <button onclick="event.stopPropagation(); window.openLinkFamilyModal('${p.id}', '${escapeHtml(p.nom_complet || '')}')" 
                                class="w-full py-2 rounded-xl text-[10px] font-bold transition-all" 
                                style="background: ${primaryLight}; color: ${primaryColor};">
                            <i class="fa-solid fa-link"></i> Lier une famille
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join("");
    
    setTimeout(() => {
        updatePatientBadges();
    }, 50);
}

// ============================================================
// 3. PAGE D'AJOUT D'UN PATIENT
// ============================================================

export async function renderAddPatientView() {
    const container = document.getElementById("view-container");
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('patients')" class="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 active:scale-95">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">Nouveau Patient</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Création de dossier médical</p>
                </div>
            </div>

            <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Prénom</label>
                            <input id="form-pat-prenom" class="app-input !py-3 !text-sm" placeholder="Prénom">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Nom</label>
                            <input id="form-pat-nom" class="app-input !py-3 !text-sm" placeholder="Nom">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Âge</label>
                            <input id="form-pat-age" type="number" class="app-input !py-3 !text-sm" placeholder="Âge">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Sexe</label>
                            <select id="form-pat-sex" class="app-input !py-3 !text-sm">
                                <option value="">Sélectionner</option>
                                <option value="Homme">Homme</option>
                                <option value="Femme">Femme</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Téléphone</label>
                        <div class="relative">
                            <i class="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="form-pat-tel" class="app-input !pl-11 !py-3" placeholder="+229 XX XXX XXX">
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Adresse</label>
                        <div class="relative">
                            <i class="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="form-pat-addr" class="app-input !pl-11 !py-3" placeholder="Quartier, rue, repères...">
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Contact urgence</label>
                        <div class="relative">
                            <i class="fa-solid fa-address-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="form-pat-urgence" class="app-input !pl-11 !py-3" placeholder="Nom et téléphone">
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Formule d'accompagnement</label>
                        <div id="formule-selector-trigger" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between cursor-pointer">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <i class="fa-solid fa-tag text-emerald-600 text-base"></i>
                                </div>
                                <div>
                                    <p id="selected-formule-name" class="font-bold text-slate-800 text-sm">Choisir une formule</p>
                                    <p id="selected-formule-desc" class="text-[10px] text-slate-400 mt-0.5">Sélectionnez le niveau d'accompagnement</p>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-down text-slate-300 text-xs"></i>
                        </div>
                        <input type="hidden" id="form-pat-formule" value="">
                    </div>

                    <button id="submit-patient-btn" class="w-full bg-slate-800 text-white py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                        <i class="fa-solid fa-check"></i> Enregistrer le patient
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("formule-selector-trigger").onclick = () => openFormuleSelector();
    document.getElementById("submit-patient-btn").onclick = () => submitAddPatient();
}

// ============================================================
// 4. SOUMISSION D'AJOUT DE PATIENT
// ============================================================

async function submitAddPatient() {
    const prenom = document.getElementById("form-pat-prenom")?.value;
    const nom = document.getElementById("form-pat-nom")?.value;
    const nomComplet = `${prenom} ${nom}`.trim();
    const age = document.getElementById("form-pat-age")?.value;
    const sexe = document.getElementById("form-pat-sex")?.value;
    const tel = document.getElementById("form-pat-tel")?.value;
    const addr = document.getElementById("form-pat-addr")?.value;
    const contactUrgence = document.getElementById("form-pat-urgence")?.value;
    const formule = document.getElementById("form-pat-formule")?.value;

    if (!nomComplet) {
        UI.vibrate('error');
        Swal.fire({ title: "Champ manquant", text: "Le nom est requis", icon: "warning" });
        return;
    }
    if (!formule) {
        UI.vibrate('error');
        Swal.fire({ title: "Formule manquante", text: "Sélectionnez une formule", icon: "warning" });
        return;
    }

    Swal.fire({ title: 'Création...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        await secureFetch("/patients/add", {
            method: "POST",
            body: JSON.stringify({ 
                nom_complet: nomComplet, 
                age, 
                sexe,
                telephone: tel, 
                adresse: addr, 
                contact_urgence: contactUrgence,
                formule 
            })
        });
        UI.success("Patient ajouté");
        window.switchView("patients");
    } catch (err) {
        Swal.fire({ title: "Erreur", text: err.message, icon: "error" });
    }
}

// ============================================================
// 5. SÉLECTEUR DE FORMULE
// ============================================================

const FORMULES = [
    { id: "Basic", name: "Formule Basic", desc: "1 visite par semaine", price: "50.000 CFA", icon: "fa-seedling", color: "text-emerald-600" },
    { id: "Standard", name: "Formule Standard", desc: "3 visites par semaine", price: "75.000 CFA", icon: "fa-chart-line", color: "text-blue-600" },
    { id: "Premium", name: "Formule Premium", desc: "7 jours sur 7", price: "100.000 CFA", icon: "fa-crown", color: "text-gold-primary" }
];

async function openFormuleSelector() {
    const modalContent = `
        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
            ${FORMULES.map(f => `
                <div class="formule-item p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer transition-all hover:border-emerald-200 active:scale-98" data-id="${f.id}">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
                            <i class="fa-solid ${f.icon} ${f.color} text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-center">
                                <p class="font-black text-slate-800 text-sm">${f.name}</p>
                                <p class="text-[11px] font-black text-emerald-600">${f.price}</p>
                            </div>
                            <p class="text-[10px] text-slate-400 mt-0.5">${f.desc}</p>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    await Swal.fire({
        title: '<span class="text-base font-black text-slate-800">🎁 Choisir une formule</span>',
        html: modalContent,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: "Fermer",
        cancelButtonColor: "#94A3B8",
        customClass: { popup: 'rounded-2xl p-5', cancelButton: 'rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-wider' },
        didOpen: () => {
            document.querySelectorAll('.formule-item').forEach(el => {
                el.addEventListener('click', () => {
                    Swal.close();
                    const formule = FORMULES.find(f => f.id === el.dataset.id);
                    if (formule) {
                        document.getElementById("selected-formule-name").innerText = formule.name;
                        document.getElementById("selected-formule-desc").innerHTML = `${formule.desc} • ${formule.price}`;
                        document.getElementById("form-pat-formule").value = formule.id;
                        const trigger = document.getElementById("formule-selector-trigger");
                        const icon = trigger?.querySelector('.w-10.h-10 i');
                        if (icon) icon.className = `fa-solid ${formule.icon} ${formule.color} text-base`;
                    }
                });
            });
        }
    });
}

// ============================================================
// 6. VUE : FICHE PATIENT (DÉTAIL) - CORRIGÉE
// ============================================================

export async function renderPatientDetailsView(patientId) {
    const container = document.getElementById("view-container");
    
    if (!patientId) {
        console.error("❌ patientId manquant");
        container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">ID patient manquant</p></div>`;
        return;
    }
    
    try {
        let p = await secureFetch(`/patients/${patientId}`);
        
        console.log("📋 Patient reçu (brut):", p);
        
        if (Array.isArray(p) && p.length > 0) {
            p = p[0];
            console.log("📋 Patient après extraction:", p);
        }
        
        if (!p || typeof p !== 'object' || !p.id) {
            console.error("❌ Patient invalide:", p);
            throw new Error("Patient non trouvé ou format invalide");
        }
        
        const userRole = localStorage.getItem("user_role");
        const isMaman = p.categorie_service === 'MAMAN_BEBE';
        const isPremium = p.formule === 'Premium' || p.type_pack === 'Premium';
        const initials = p.nom_complet?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '??';
        
        // ============================================================
        // ✅ ACTIONS SPÉCIFIQUES AU RÔLE DANS LA FICHE PATIENT
        // ============================================================
        let actionButtons = '';
        
        if (userRole === "AIDANT") {
            const isVisitActive = localStorage.getItem("active_visit_id") !== null;
            actionButtons = `
                <div class="grid grid-cols-2 gap-2 mt-4">
                    ${isVisitActive ? `
                        <button onclick="window.openEndVisit()" 
                                class="w-full py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                            <i class="fa-solid fa-stop-circle mr-2"></i> Clôturer la visite
                        </button>
                    ` : `
                        <button onclick="window.startVisit('${p.id}')" 
                                class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                            <i class="fa-solid fa-play mr-2"></i> Démarrer la visite
                        </button>
                    `}
                    <button onclick="window.switchView('planning')" 
                            class="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-calendar-days mr-2"></i> Planning
                    </button>
                </div>
            `;
        } else if (userRole === "COORDINATEUR") {
            actionButtons = `
                <div class="grid grid-cols-3 gap-2 mt-4">
                    <button onclick="window.viewPatientFeed('${p.id}')" 
                            class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-newspaper mr-2"></i> Journal
                    </button>
                    <button onclick="window.switchView('planning')" 
                            class="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-calendar-days mr-2"></i> Planning
                    </button>
                    <button onclick="window.switchView('map')" 
                            class="w-full py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-location-dot mr-2"></i> Radar
                    </button>
                </div>
            `;
        } else if (userRole === "FAMILLE") {
            actionButtons = `
                <div class="grid grid-cols-2 gap-2 mt-4">
                    <button onclick="window.viewPatientFeed('${p.id}')" 
                            class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-newspaper mr-2"></i> Journal
                    </button>
                    <button onclick="window.switchView('map')" 
                            class="w-full py-3 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-location-dot mr-2"></i> Suivre l'aidant
                    </button>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick="window.viewVisitHistory('${p.id}')" 
                            class="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-clock-rotate-left mr-2"></i> Historique
                    </button>
                    <button onclick="window.switchView('billing')" 
                            class="w-full py-3 bg-slate-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-file-invoice mr-2"></i> Factures
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="animate-fadeIn max-w-lg mx-auto pb-32">
                <div class="flex flex-col items-center text-center mb-6">
                    <div class="relative">
                        <div class="w-24 h-24 bg-white rounded-2xl flex items-center justify-center text-3xl font-black text-slate-300 shadow-xl border-4 border-white mb-4">
                            ${initials}
                        </div>
                        ${isPremium ? `<div class="absolute -top-2 -right-2 bg-gold-primary w-8 h-8 rounded-full flex items-center justify-center shadow-md"><i class="fa-solid fa-crown text-xs text-white"></i></div>` : ''}
                    </div>
                    <h3 class="text-xl font-black text-slate-800">${escapeHtml(p.nom_complet)}</h3>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${isMaman ? `<span class="badge-pink px-3 py-1 rounded-full text-[10px] font-bold"><i class="fa-solid fa-baby-carriage mr-1"></i> Maman & Bébé</span>` : `<span class="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold"><i class="fa-solid fa-user-plus mr-1"></i> Dossier Sénior</span>`}
                        ${isPremium ? `<span class="badge-gold px-3 py-1 rounded-full text-[10px] font-bold"><i class="fa-solid fa-crown mr-1"></i> Premium</span>` : ''}
                    </div>
                </div>

                <div class="${isMaman ? 'maman-banner' : 'premium-banner'} p-4 rounded-xl mb-6 text-center">
                    <p class="text-[10px] font-black uppercase tracking-wider">${isMaman ? '👶 Programme Maman & Bébé' : '⭐ Programme Premium'}</p>
                    <p class="text-sm font-bold mt-1 ${isMaman ? 'text-rose-primary' : 'text-slate-800'}">${isMaman ? 'Accompagnement personnalisé post-maternité' : 'Accès prioritaire et services exclusifs'}</p>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-6">
                    <div class="bg-white p-4 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider"><i class="fa-solid fa-phone mr-1"></i> Urgence</p>
                        <p class="text-xs font-semibold text-slate-700 mt-1">${escapeHtml(p.contact_urgence || 'Non renseigné')}</p>
                    </div>
                    <div class="bg-white p-4 rounded-xl border border-slate-100">
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider"><i class="fa-solid fa-box mr-1"></i> Pack</p>
                        <p class="text-xs font-semibold text-slate-700 mt-1">${escapeHtml(p.type_pack || p.formule || 'Standard')}</p>
                    </div>
                    <div class="col-span-2 ${isMaman ? 'bg-pink-50 border-pink-100' : 'bg-amber-50 border-amber-100'} p-4 rounded-xl border">
                        <p class="text-[9px] font-black ${isMaman ? 'text-pink-500' : 'text-amber-600'} uppercase tracking-wider"><i class="fa-solid fa-heartbeat mr-1"></i> Points d'attention</p>
                        <p class="text-sm text-slate-700 mt-1">"${escapeHtml(p.notes_medicales || 'Aucune consigne')}"</p>
                    </div>
                </div>

                <div id="aidant-active-area" class="mt-4"></div>

                ${actionButtons}

                <button onclick="window.switchView('patients')" class="w-full mt-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 flex items-center justify-center gap-2">
                    <i class="fa-solid fa-arrow-left text-xs"></i> Retour
                </button>
            </div>
        `;

        setTimeout(() => {
            if (typeof Visites !== 'undefined' && Visites.refreshAidantUI) {
                Visites.refreshAidantUI(p.id);
            }
        }, 100);
        
    } catch (err) {
        console.error("❌ Erreur renderPatientDetailsView:", err);
        container.innerHTML = `
            <div class="text-center py-20">
                <i class="fa-solid fa-circle-exclamation text-rose-500 text-3xl mb-3"></i>
                <p class="text-sm font-bold text-rose-500">Erreur de chargement</p>
                <p class="text-xs text-slate-400 mt-1">${escapeHtml(err.message)}</p>
                <button onclick="window.switchView('patients')" class="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl">Retour</button>
            </div>
        `;
    }
}

// ============================================================
// 7. VUE : LIAISON FAMILLE
// ============================================================

export async function renderLinkFamilyView() {
    const container = document.getElementById("view-container");
    const { patientId, patientName } = window.AppState.tempData || {};

    try {
        const families = await secureFetch("/auth/profiles?role=FAMILLE");

        if (!families?.length) {
            container.innerHTML = `
                <div class="max-w-2xl mx-auto text-center py-20 bg-white rounded-2xl">
                    <p class="text-sm font-bold text-slate-500">Aucun compte famille trouvé</p>
                    <button onclick="window.switchView('patients')" class="mt-4 text-[10px] font-black text-blue-500">Retour</button>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
                <div class="flex items-center gap-4 mb-8">
                    <button onclick="window.switchView('patients')" class="w-10 h-10 rounded-xl bg-white shadow-sm border flex items-center justify-center">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h3 class="font-black text-2xl text-slate-800">Lier une Famille</h3>
                        <p class="text-[10px] text-slate-400 mt-1">Dossier : ${escapeHtml(patientName)}</p>
                    </div>
                </div>
                <div class="bg-white rounded-2xl p-6 shadow-sm border">
                    <p class="text-sm font-bold text-slate-500 mb-4">Sélectionnez le responsable :</p>
                    <div class="space-y-2 max-h-96 overflow-y-auto mb-6">
                        ${families.map(f => `
                            <label class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border cursor-pointer hover:border-blue-300">
                                <div>
                                    <p class="font-bold text-slate-800">${escapeHtml(f.nom)}</p>
                                    <p class="text-[10px] text-slate-500">${escapeHtml(f.email)}</p>
                                </div>
                                <input type="radio" name="family_select" value="${f.id}" class="w-5 h-5 accent-blue-500">
                            </label>
                        `).join('')}
                    </div>
                    <button onclick="window.submitLinkFamily('${patientId}')" class="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-md">
                        Confirmer la liaison
                    </button>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p class="text-center text-rose-500 p-10">Erreur : ${escapeHtml(err.message)}</p>`;
    }
}

window.submitLinkFamily = async (patientId) => {
    const selected = document.querySelector('input[name="family_select"]:checked');
    if (!selected) return UI.vibrate('error');

    Swal.fire({ title: 'Liaison...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        await secureFetch("/patients/link-family", {
            method: "POST",
            body: JSON.stringify({ patient_id: patientId, famille_user_id: selected.value })
        });
        UI.success("Famille liée avec succès");
        window.switchView("patients");
    } catch (err) {
        Swal.fire("Erreur", err.message, "error");
    }
};

// ============================================================
// 8. FIXATION GPS DU DOMICILE
// ============================================================

export async function setPatientHomeDirect(patientId) {
    try {
        UI.vibrate();

        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });

        Toast.fire({
            icon: 'info',
            title: 'Calcul de la position...'
        });

        const pos = await new Promise((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
                enableHighAccuracy: true,
                timeout: 10000
            });
        });

        await secureFetch("/patients/update-gps", {
            method: "POST",
            body: JSON.stringify({
                patient_id: patientId,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            })
        });

        UI.success("Domicile enregistré !");
        loadPatients();

    } catch (err) {
        console.error("Erreur GPS:", err);
        UI.error("Erreur GPS");
        Swal.fire("Erreur GPS", "Veuillez autoriser la localisation", "error");
    }
}

// ============================================================
// 9. OUVRIR LE JOURNAL D'UN PATIENT
// ============================================================

window.viewPatientFeed = async (patientId) => {
    if (!setActivePatient(patientId)) return;

    if (window.switchView) {
        await window.switchView("feed");
    }
};

// ============================================================
// 10. OUVRIR LA FICHE DÉTAIL D'UN PATIENT
// ============================================================

window.viewPatientDetails = async (patientId) => {
    if (!setActivePatient(patientId)) return;

    await renderPatientDetailsView(patientId);
};

// ============================================================
// 11. HISTORIQUE DES VISITES POUR LA FAMILLE
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
