 import { secureFetch } from "../core/api.js";
import { UI, openModernSelector } from "../core/utils.js";
import { CONFIG } from "../core/config.js";

// Variables globales pour le dashboard RH
let rhData = null;
let currentRHTab = 'aidants';

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

function formatDateSafe(dateString) {
    if (!dateString) return 'Date inconnue';
    try {
        if (dateString instanceof Date) {
            if (isNaN(dateString.getTime())) return 'Date inconnue';
            return dateString.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Date inconnue';
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch(e) {
        console.warn("Erreur format date:", dateString, e);
        return 'Date inconnue';
    }
}

// ============================================================
// INSCRIPTIONS EN ATTENTE
// ============================================================

export async function loadRegistrations() {
    const tableBody = document.getElementById('pending-table-body');
    const mobileList = document.getElementById('pending-mobile-list');
    
    if (!tableBody && !mobileList) return;

    try {
        const pending = await secureFetch('/admin/pending-registrations');

        if (pending.length === 0) {
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400 italic">Aucune inscription en attente.</td></tr>';
            }
            if (mobileList) {
                mobileList.innerHTML = '<div class="p-6 text-center text-slate-400 italic bg-white rounded-2xl border border-slate-100">Aucune inscription en attente.</div>';
            }
            return;
        }

        if (tableBody) {
            tableBody.innerHTML = pending.map(req => {
                const patient = req.patients && req.patients[0];
                return `
                    <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td class="p-4">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">
                                    ${req.nom?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p class="font-bold text-slate-800 text-sm">${req.nom || 'Inconnu'}</p>
                                    <p class="text-[10px] text-slate-400">${req.email || ''}</p>
                                </div>
                            </div>
                        </td>
                        <td class="p-4">
                            <span class="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase">${req.role || 'FAMILLE'}</span>
                        </td>
                        <td class="p-4">
                            ${patient ? `
                                <div>
                                    <p class="font-bold text-slate-800 text-xs">${patient.nom_complet || '-'}</p>
                                    <p class="text-[9px] text-green-600 font-bold mt-0.5">${patient.formule || 'Standard'}</p>
                                </div>
                            ` : '<span class="text-slate-300 text-xs">Aucun patient lié</span>'}
                        </td>
                        <td class="p-4 text-[11px] text-slate-400">
                            ${formatDateSafe(req.created_at)}
                        </td>
                        <td class="p-4 text-right">
                            <button onclick="window.openActivationPage('${req.id}', '${req.email}', '${req.nom}', '${req.role}')" 
                                    class="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all">
                                Activer
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        if (mobileList) {
            mobileList.innerHTML = pending.map(req => {
                const patient = req.patients && req.patients[0];
                return `
                    <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-3">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <p class="font-black text-slate-800 text-sm">${req.nom || 'Inconnu'}</p>
                                <p class="text-[10px] text-slate-400 mt-0.5">${req.email || ''}</p>
                            </div>
                            <span class="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase">${req.role || 'FAMILLE'}</span>
                        </div>
                        ${patient ? `
                            <div class="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="font-bold text-slate-700 text-xs">👤 Patient: ${patient.nom_complet || '-'}</p>
                                        <p class="text-[9px] text-green-600 font-bold mt-0.5">📦 Formule: ${patient.formule || 'Standard'}</p>
                                    </div>
                                    <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <i class="fa-solid fa-user text-emerald-600 text-xs"></i>
                                    </div>
                                </div>
                            </div>
                        ` : '<div class="bg-slate-50 p-3 rounded-xl mb-4 text-center text-slate-400 text-xs">Aucun patient lié</div>'}
                        <div class="flex items-center justify-between text-[10px] text-slate-400 mb-4">
                            <span><i class="fa-regular fa-calendar mr-1"></i> ${formatDateSafe(req.created_at)}</span>
                        </div>
                        <button onclick="window.openActivationPage('${req.id}', '${req.email}', '${req.nom}', '${req.role}')" 
                                class="w-full bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all">
                            ✅ Activer le dossier
                        </button>
                    </div>
                `;
            }).join('');
        }
    } catch (e) { 
        console.error("Erreur chargement admin:", e);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-rose-500">Erreur de chargement</td></tr>';
        }
        if (mobileList) {
            mobileList.innerHTML = '<div class="p-6 text-center text-rose-500 bg-white rounded-2xl border border-rose-100">Erreur de chargement</div>';
        }
    }
}

// ============================================================
// PAGE D'ACTIVATION
// ============================================================

export async function openActivationPage(id, email, nom, role) {
    const container = document.getElementById("view-container");
    
    container.innerHTML = `
        <div class="animate-slideIn max-w-lg mx-auto pb-24">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('dashboard')" class="w-12 h-12 bg-white rounded-2xl shadow-sm border flex items-center justify-center text-slate-400">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">Validation Dossier</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Activation & Accès</p>
                </div>
            </div>

            <div class="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div>
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidat</p>
                    <h2 class="text-xl font-black text-slate-800">${nom}</h2>
                    <p class="text-xs text-blue-600 font-bold">${email} • ${role}</p>
                </div>

                <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-[11px] font-black text-emerald-700">⚡ Activation rapide</p>
                            <p class="text-[9px] text-emerald-600">Envoie le message automatique par défaut</p>
                        </div>
                        <button onclick="window.activateWithDefaultEmail('${id}', '${email}', '${nom}', '${role}')" 
                                class="bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm">
                            Activer directement
                        </button>
                    </div>
                </div>

                <div class="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <p class="text-[11px] font-black text-amber-700 mb-2">✏️ Activation avec message personnalisé</p>
                    <p class="text-[9px] text-amber-600 mb-3">Le message ci-dessous sera AJOUTÉ dans l'email de bienvenue</p>
                    <textarea id="val-notes" rows="4" 
                              class="w-full p-3 bg-white border border-amber-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-300"
                              placeholder="Écrivez votre message personnalisé ici..."></textarea>
                    <button onclick="window.activateWithCustomEmail('${id}', '${email}', '${nom}', '${role}')" 
                            class="w-full mt-4 py-3 rounded-xl bg-amber-600 text-white font-black text-[10px] uppercase shadow-lg">
                        Activer avec message personnalisé
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.confirmActivation = (id, email, nom, role) => {
    openActivationPage(id, email, nom, role);
};

// ============================================================
// DASHBOARD RH
// ============================================================

export async function renderRHDashboard() {
    const container = document.getElementById("view-container");
    
    container.innerHTML = `
        <div class="animate-fadeIn pb-32">
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <div>
                    <h3 class="font-black text-2xl text-slate-900 tracking-tight">👥 Gestion de l'équipe</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Aidants • Patients • Assignations</p>
                </div>
                <button id="new-assign-btn" class="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all">
                    <i class="fa-solid fa-plus text-xs"></i> Nouvelle assignation
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex items-center justify-between">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Aidants</p>
                        <i class="fa-solid fa-user-nurse text-slate-300 text-sm"></i>
                    </div>
                    <h3 id="stat-aidants" class="text-2xl font-black text-slate-900 mt-1">-</h3>
                </div>
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex items-center justify-between">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Patients</p>
                        <i class="fa-solid fa-hospital-user text-slate-300 text-sm"></i>
                    </div>
                    <h3 id="stat-patients" class="text-2xl font-black text-slate-900 mt-1">-</h3>
                </div>
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex items-center justify-between">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Assignations</p>
                        <i class="fa-solid fa-link text-slate-300 text-sm"></i>
                    </div>
                    <h3 id="stat-assignments" class="text-2xl font-black text-emerald-600 mt-1">-</h3>
                </div>
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex items-center justify-between">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Non assignés</p>
                        <i class="fa-solid fa-user-slash text-slate-300 text-sm"></i>
                    </div>
                    <h3 id="stat-non-assignes" class="text-2xl font-black text-amber-600 mt-1">-</h3>
                </div>
            </div>

            <div class="bg-slate-100/80 p-1 rounded-xl flex items-center gap-1 mb-6 max-w-xs mx-auto sm:mx-0">
                <button id="tab-aidants" class="flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-white text-slate-900 shadow-sm">
                    👨‍⚕️ Aidants
                </button>
                <button id="tab-patients" class="flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-slate-400">
                    📋 Patients
                </button>
            </div>

            <div id="rh-content"></div>
        </div>
    `;

    await loadRHDashboardData();

    document.getElementById("tab-aidants").onclick = () => showRHTab('aidants');
    document.getElementById("tab-patients").onclick = () => showRHTab('patients');
    document.getElementById("new-assign-btn").onclick = () => window.openAssignModal();
}

async function loadRHDashboardData() {
    const contentDiv = document.getElementById("rh-content");
    contentDiv.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20">
            <div class="relative">
                <div class="w-10 h-10 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <p class="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-4">Chargement...</p>
        </div>
    `;

    try {
        rhData = await secureFetch("/assignments/full-dashboard");
        
        if (!rhData) {
            throw new Error("Aucune donnée reçue du serveur");
        }
        
        document.getElementById("stat-aidants").innerText = rhData.total_aidants || 0;
        document.getElementById("stat-patients").innerText = rhData.total_patients || 0;
        document.getElementById("stat-assignments").innerText = rhData.total_assignments || 0;
        document.getElementById("stat-non-assignes").innerText = rhData.patients_non_assignes || 0;

        showRHTab('aidants');
    } catch (err) {
        console.error("❌ Erreur chargement RH:", err);
        contentDiv.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center border border-rose-100">
                <i class="fa-solid fa-circle-exclamation text-rose-400 text-3xl mb-3"></i>
                <p class="text-sm font-bold text-rose-500">Erreur de chargement</p>
                <p class="text-[10px] text-slate-400 mt-1">${err.message}</p>
                <button onclick="renderRHDashboard()" class="mt-4 px-5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Réessayer</button>
            </div>
        `;
    }
}

function showRHTab(tab) {
    currentRHTab = tab;
    
    const tabAidants = document.getElementById("tab-aidants");
    const tabPatients = document.getElementById("tab-patients");
    
    if (tab === 'aidants') {
        tabAidants.classList.add("bg-white", "text-slate-900", "shadow-sm");
        tabAidants.classList.remove("text-slate-400");
        tabPatients.classList.remove("bg-white", "text-slate-900", "shadow-sm");
        tabPatients.classList.add("text-slate-400");
        renderAidantsList();
    } else {
        tabPatients.classList.add("bg-white", "text-slate-900", "shadow-sm");
        tabPatients.classList.remove("text-slate-400");
        tabAidants.classList.remove("bg-white", "text-slate-900", "shadow-sm");
        tabAidants.classList.add("text-slate-400");
        renderPatientsList();
    }
}

function renderAidantsList() {
    const container = document.getElementById("rh-content");
    
    if (!rhData?.aidants?.length) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center border border-slate-100">
                <i class="fa-solid fa-user-slash text-slate-300 text-4xl mb-3"></i>
                <p class="text-sm font-bold text-slate-500">Aucun aidant trouvé</p>
                <p class="text-[10px] text-slate-400 mt-1">Commencez par ajouter un aidant</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="space-y-4">
            ${rhData.aidants.map(aidant => `
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-900">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <i class="fa-solid fa-user-nurse text-white text-lg"></i>
                                </div>
                                <div>
                                    <h4 class="font-black text-white text-base">${aidant.nom}</h4>
                                    <p class="text-[10px] text-slate-300 mt-0.5">📧 ${aidant.email || 'Non renseigné'}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="bg-emerald-500/20 px-3 py-1 rounded-full">
                                    <span class="text-[10px] font-black text-emerald-300">${aidant.nb_patients} patient${aidant.nb_patients > 1 ? 's' : ''}</span>
                                </span>
                                ${aidant.telephone ? `
                                    <a href="tel:${aidant.telephone}" class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                                        <i class="fa-solid fa-phone text-white text-xs"></i>
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-4">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <i class="fa-solid fa-users text-[8px]"></i> Patients assignés
                        </p>
                        
                        ${aidant.patients_assignes.length === 0 ? `
                            <div class="text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
                                <i class="fa-solid fa-user-plus text-slate-300 text-2xl mb-2"></i>
                                <p class="text-xs text-slate-400">Aucun patient assigné</p>
                                <button onclick="window.openAssignModalWithAidant('${aidant.id}')" 
                                        class="mt-3 text-[10px] text-emerald-600 font-black uppercase hover:text-emerald-700 transition">
                                    + Assigner un patient
                                </button>
                            </div>
                        ` : `
                            <div class="space-y-2">
                                ${aidant.patients_assignes.map(assign => {
                                    const patient = rhData.patients.find(p => p.id === assign.patient_id);
                                    return `
                                        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div class="flex-1">
                                                <p class="font-bold text-slate-800 text-sm">${patient?.nom_complet || 'Patient inconnu'}</p>
                                                <div class="flex items-center gap-3 mt-1">
                                                    <span class="text-[9px] font-bold ${patient?.formule === 'Premium' ? 'text-gold-primary' : 'text-emerald-600'}">
                                                        ${patient?.formule || 'Standard'}
                                                    </span>
                                                    <span class="text-[9px] text-slate-400">📅 ${assign.date_prevue || 'Date non définie'}</span>
                                                </div>
                                            </div>
                                            <button onclick="window.unassignPatient('${assign.assignment_id}', '${aidant.nom}', '${patient?.nom_complet || ''}')" 
                                                    class="w-8 h-8 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 transition-colors flex items-center justify-center">
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPatientsList() {
    const container = document.getElementById("rh-content");
    
    if (!rhData?.patients?.length) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-10 text-center border border-slate-100">
                <i class="fa-solid fa-hospital-user text-slate-300 text-4xl mb-3"></i>
                <p class="text-sm font-bold text-slate-500">Aucun patient trouvé</p>
                <p class="text-[10px] text-slate-400 mt-1">Ajoutez des patients pour commencer</p>
            </div>
        `;
        return;
    }

    const assignmentMap = {};
    if (rhData.assignments && rhData.assignments.length) {
        rhData.assignments.forEach(assign => {
            assignmentMap[assign.patient_id] = assign.id;
        });
    } else if (rhData.aidants) {
        rhData.aidants.forEach(aidant => {
            if (aidant.patients_assignes) {
                aidant.patients_assignes.forEach(assign => {
                    assignmentMap[assign.patient_id] = assign.assignment_id;
                });
            }
        });
    }

    container.innerHTML = `
        <div class="space-y-4">
            ${rhData.patients.map(patient => {
                const assignmentId = assignmentMap[patient.id];
                return `
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="px-5 py-4 ${patient.aidant_assigne ? 'bg-gradient-to-r from-emerald-700 to-emerald-800' : 'bg-gradient-to-r from-slate-600 to-slate-700'}">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                    <i class="fa-solid fa-user text-white text-lg"></i>
                                </div>
                                <div>
                                    <h4 class="font-black text-white text-base">${patient.nom_complet}</h4>
                                    <div class="flex flex-wrap items-center gap-2 mt-0.5">
                                        <span class="text-[9px] text-white/70">📌 ${patient.adresse?.substring(0, 30) || 'Adresse non renseignée'}</span>
                                        <span class="text-[9px] font-bold ${patient.formule === 'Premium' ? 'text-gold-primary' : 'text-emerald-300'}">
                                            ${patient.formule || 'Standard'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-1 rounded-full ${patient.aidant_assigne ? 'bg-emerald-500/30 text-emerald-100' : 'bg-amber-500/30 text-amber-100'} text-[9px] font-bold">
                                    ${patient.aidant_assigne ? '✅ Assigné' : '⚠️ Non assigné'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-4">
                        ${patient.aidant_assigne && assignmentId ? `
                            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <i class="fa-solid fa-user-nurse text-emerald-600 text-sm"></i>
                                    </div>
                                    <div>
                                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Aidant assigné</p>
                                        <p class="font-bold text-slate-800 text-sm">${patient.aidant_assigne.nom}</p>
                                        <p class="text-[10px] text-slate-500">📞 ${patient.aidant_assigne.telephone || 'Non renseigné'}</p>
                                    </div>
                                </div>
                                <button onclick="window.unassignPatientFromPatient('${assignmentId}', '${patient.nom_complet}', '${patient.aidant_assigne.nom}')" 
                                        class="px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors text-xs font-bold flex items-center gap-1">
                                    <i class="fa-solid fa-link-slash"></i> Délier
                                </button>
                            </div>
                        ` : patient.aidant_assigne && !assignmentId ? `
                            <div class="text-center py-6 bg-amber-50 rounded-xl border border-amber-100">
                                <i class="fa-solid fa-triangle-exclamation text-amber-500 text-2xl mb-2"></i>
                                <p class="text-xs text-amber-600">Erreur de liaison - ID manquant</p>
                                <p class="text-[9px] text-amber-500">Veuillez contacter le support</p>
                            </div>
                        ` : `
                            <div class="text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
                                <i class="fa-solid fa-user-plus text-slate-300 text-2xl mb-2"></i>
                                <p class="text-xs text-slate-400 mb-3">Aucun aidant assigné</p>
                            <button onclick="window.redirectToAssignPageWithPatient('${patient.id}', '${patient.nom_complet.replace(/'/g, "\\'")}')" 
                                    class="bg-emerald-500 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition">
                                + Assigner un aidant
                            </button>
                            </div>
                        `}
                        ${patient.famille ? `
                            <div class="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div class="flex items-center gap-2 mb-2">
                                    <i class="fa-solid fa-family text-blue-500 text-xs"></i>
                                    <p class="text-[9px] font-black text-blue-600 uppercase tracking-wider">Famille / Payeur</p>
                                </div>
                                <p class="font-bold text-slate-800 text-sm">${patient.famille.nom || 'Inconnu'}</p>
                                <p class="text-[10px] text-slate-500 mt-0.5">📧 ${patient.famille.email || ''}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `}).join('')}
        </div>
    `;
}





window.redirectToAssignPageWithPatient = (patientId, patientNom) => {
    console.log("🔵 Redirection vers page d'assignation pour:", patientNom);
    
    // Stocker l'ID du patient pré-sélectionné
    localStorage.setItem("pre_selected_patient", patientId);
    localStorage.setItem("pre_selected_patient_name", patientNom);
    
    // Rediriger vers la page d'assignation
    window.switchView('rh-dashboard');
    
    // Attendre que la vue soit chargée puis ouvrir la modale d'assignation
    setTimeout(() => {
        if (typeof window.openAssignPage === 'function') {
            window.openAssignPage();
        } else {
            console.error("❌ openAssignPage non trouvée, import depuis planning");
            // Fallback: importer dynamiquement
            import('./planning.js').then(module => {
                if (module.openAssignPage) {
                    module.openAssignPage();
                }
            });
        }
    }, 300);
};
// ============================================================
// ASSIGNATIONS
// ============================================================

async function refreshPendingRegistrations() {
    try {
        const pending = await secureFetch('/admin/pending-registrations');
        const tableBody = document.getElementById('pending-table-body');
        const mobileList = document.getElementById('pending-mobile-list');
        
        if (tableBody) {
            if (pending.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-400 italic">Aucune inscription en attente.</td></tr>';
            } else {
                tableBody.innerHTML = pending.map(req => {
                    const patient = req.patients && req.patients[0];
                    return `
                        <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td class="p-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-600">
                                        ${req.nom?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p class="font-bold text-slate-800 text-sm">${req.nom || 'Inconnu'}</p>
                                        <p class="text-[10px] text-slate-400">${req.email || ''}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4">
                                <span class="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase">${req.role || 'FAMILLE'}</span>
                            </td>
                            <td class="p-4">
                                ${patient ? `
                                    <div>
                                        <p class="font-bold text-slate-800 text-xs">${patient.nom_complet || '-'}</p>
                                        <p class="text-[9px] text-green-600 font-bold mt-0.5">${patient.formule || 'Standard'}</p>
                                    </div>
                                ` : '<span class="text-slate-300 text-xs">Aucun patient lié</span>'}
                            </td>
                            <td class="p-4 text-[11px] text-slate-400">
                                ${formatDateSafe(req.created_at)}
                            </td>
                            <td class="p-4 text-right">
                                <button onclick="window.openActivationPage('${req.id}', '${req.email}', '${req.nom}', '${req.role}')" 
                                        class="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all">
                                    Activer
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
        
        if (mobileList) {
            if (pending.length === 0) {
                mobileList.innerHTML = '<div class="p-6 text-center text-slate-400 italic bg-white rounded-2xl border border-slate-100">Aucune inscription en attente.</div>';
            } else {
                mobileList.innerHTML = pending.map(req => {
                    const patient = req.patients && req.patients[0];
                    return `
                        <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-3">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="font-black text-slate-800 text-sm">${req.nom || 'Inconnu'}</p>
                                    <p class="text-[10px] text-slate-400 mt-0.5">${req.email || ''}</p>
                                </div>
                                <span class="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase">${req.role || 'FAMILLE'}</span>
                            </div>
                            ${patient ? `
                                <div class="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                                    <div class="flex justify-between items-center">
                                        <div>
                                            <p class="font-bold text-slate-700 text-xs">👤 Patient: ${patient.nom_complet || '-'}</p>
                                            <p class="text-[9px] text-green-600 font-bold mt-0.5">📦 Formule: ${patient.formule || 'Standard'}</p>
                                        </div>
                                        <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <i class="fa-solid fa-user text-emerald-600 text-xs"></i>
                                        </div>
                                    </div>
                                </div>
                            ` : '<div class="bg-slate-50 p-3 rounded-xl mb-4 text-center text-slate-400 text-xs">Aucun patient lié</div>'}
                            <div class="flex items-center justify-between text-[10px] text-slate-400 mb-4">
                                <span><i class="fa-regular fa-calendar mr-1"></i> ${formatDateSafe(req.created_at)}</span>
                            </div>
                            <button onclick="window.openActivationPage('${req.id}', '${req.email}', '${req.nom}', '${req.role}')" 
                                    class="w-full bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black uppercase shadow-sm active:scale-95 transition-all">
                                ✅ Activer le dossier
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }
        
        if (typeof window.fetchStats === 'function') {
            await window.fetchStats();
        }
    } catch(e) {
        console.error("Erreur rafraîchissement:", e);
    }
}



window.openAssignModalWithAidant = (aidantId) => {
    console.log("🔵 Assignation directe avec aidant:", aidantId);
    
    // ✅ Aller DIRECTEMENT à la page d'assignation sans recharger la RH
    if (typeof window.openAssignPage === 'function') {
        window.openAssignPage(null, aidantId);
    } else {
        import('./planning.js').then(module => {
            module.openAssignPage(null, aidantId);
        });
    }
};

window.openAssignModalWithPatient = (patientId, patientNom) => {
    console.log("🔵 openAssignModalWithPatient", patientId, patientNom);
    localStorage.setItem("pre_selected_patient", patientId);
    // Appel direct de la fonction d'assignation (sans passer par window)
    openAssignModalFunction();
};

// Fonction d'assignation unique et autonome
async function openAssignModalFunction() {
    console.log("🔵 [ASSIGN] Ouverture modale d'assignation");
    const aidants = await secureFetch("/assignments/available-aidants");
    const patients = await secureFetch("/assignments/unassigned-patients");
    
    const preSelectedAidant = localStorage.getItem("pre_selected_aidant");
    const preSelectedPatient = localStorage.getItem("pre_selected_patient");
    
    if (preSelectedAidant) localStorage.removeItem("pre_selected_aidant");
    if (preSelectedPatient) localStorage.removeItem("pre_selected_patient");
    
    let selectedAidant = preSelectedAidant ? aidants.find(a => a.id === preSelectedAidant) : null;
    let selectedPatient = preSelectedPatient ? patients.find(p => p.id === preSelectedPatient) : null;
    
    const renderModal = () => `
        <div class="space-y-5">
            <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    <i class="fa-solid fa-user-nurse mr-1"></i> Aidant
                </label>
                <div onclick="window.showAidantSelectorModal()" 
                     class="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between cursor-pointer active:bg-slate-100 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <i class="fa-solid fa-user-nurse text-emerald-600 text-sm"></i>
                        </div>
                        <div>
                            <p id="selected-aidant-name" class="font-bold text-slate-800 text-sm">${selectedAidant ? selectedAidant.nom : 'Choisir un aidant'}</p>
                            <p id="selected-aidant-email" class="text-[10px] text-slate-400">${selectedAidant?.email || ''}</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down text-slate-300 text-xs"></i>
                </div>
            </div>
            <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    <i class="fa-solid fa-hospital-user mr-1"></i> Patient
                </label>
                <div onclick="window.showPatientSelectorModal()" 
                     class="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between cursor-pointer active:bg-slate-100 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <i class="fa-solid fa-user text-blue-600 text-sm"></i>
                        </div>
                        <div>
                            <p id="selected-patient-name" class="font-bold text-slate-800 text-sm">${selectedPatient ? selectedPatient.nom_complet : 'Choisir un patient'}</p>
                            <p id="selected-patient-formule" class="text-[10px] text-slate-400">${selectedPatient?.formule || ''}</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down text-slate-300 text-xs"></i>
                </div>
            </div>
            <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    <i class="fa-solid fa-pen mr-1"></i> Instructions (optionnel)
                </label>
                <textarea id="assign-notes" rows="2" 
                          class="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-emerald-300 transition"
                          placeholder="Notes pour l'aidant..."></textarea>
            </div>
            <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    <i class="fa-regular fa-calendar mr-1"></i> Date de début (optionnel)
                </label>
                <input type="date" id="assign-date" 
                       class="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-emerald-300 transition"
                       value="${new Date().toISOString().split('T')[0]}">
            </div>
        </div>
    `;
    
    window._assignModalData = { aidants, patients, selectedAidant, selectedPatient };
    
    window.showAidantSelectorModal = async () => {
        const result = await openModernSelector(
            aidants.map(a => ({ id: a.id, name: a.nom, extra: a.email })),
            "Sélectionner un aidant",
            "Rechercher un aidant..."
        );
        if (result) {
            window._assignModalData.selectedAidant = result;
            const nameEl = document.getElementById("selected-aidant-name");
            const emailEl = document.getElementById("selected-aidant-email");
            if (nameEl) nameEl.innerText = result.name;
            if (emailEl) emailEl.innerText = result.extra || '';
        }
    };
    
    window.showPatientSelectorModal = async () => {
        const result = await openModernSelector(
            patients.map(p => ({ id: p.id, name: p.nom_complet, extra: p.formule })),
            "Sélectionner un patient",
            "Rechercher un patient..."
        );
        if (result) {
            window._assignModalData.selectedPatient = result;
            const nameEl = document.getElementById("selected-patient-name");
            const formuleEl = document.getElementById("selected-patient-formule");
            if (nameEl) nameEl.innerText = result.name;
            if (formuleEl) formuleEl.innerText = result.extra || '';
        }
    };
    
    const result = await Swal.fire({
        title: '<span class="text-base font-black text-slate-800">➕ Nouvelle assignation</span>',
        html: renderModal(),
        showCancelButton: true,
        confirmButtonText: "Assigner",
        confirmButtonColor: "#10B981",
        cancelButtonText: "Annuler",
        cancelButtonColor: "#94A3B8",
        customClass: {
            popup: 'rounded-2xl p-6',
            confirmButton: 'rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-wider',
            cancelButton: 'rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-wider'
        },
        preConfirm: () => {
            const data = window._assignModalData;
            if (!data.selectedAidant) {
                Swal.showValidationMessage("Veuillez sélectionner un aidant");
                return false;
            }
            if (!data.selectedPatient) {
                Swal.showValidationMessage("Veuillez sélectionner un patient");
                return false;
            }
            return {
                aidant_id: data.selectedAidant.id,
                patient_id: data.selectedPatient.id,
                notes: document.getElementById("assign-notes")?.value || "",
                date_prevue: document.getElementById("assign-date")?.value || null
            };
        }
    });
    
    if (result.isConfirmed && result.value) {
        Swal.fire({ title: "Assignation...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        try {
            await secureFetch("/assignments/assign", {
                method: "POST",
                body: JSON.stringify(result.value)
            });
            Swal.fire({ icon: "success", title: "Succès", text: "Patient assigné avec succès", timer: 2000, showConfirmButton: false });
            renderRHDashboard();
        } catch (err) {
            Swal.fire({ title: "Erreur", text: err.message, icon: "error", customClass: { popup: 'rounded-2xl' } });
        }
    }
}


window.unassignPatient = async (assignmentId, aidantNom, patientNom) => {
    const { value: raison } = await Swal.fire({
        title: "Délier le patient",
        text: `Retirer ${patientNom} de ${aidantNom} ?`,
        input: "textarea",
        inputPlaceholder: "Raison (optionnel)",
        showCancelButton: true,
        confirmButtonText: "Oui, délier",
        confirmButtonColor: "#F43F5E"
    });

    if (raison !== undefined) {
        Swal.fire({ title: "Traitement...", didOpen: () => Swal.showLoading() });
        try {
            await secureFetch("/assignments/unassign", {
                method: "POST",
                body: JSON.stringify({ assignment_id: assignmentId, raison: raison || "" })
            });
            Swal.fire("Succès", "Patient délié avec succès", "success");
            renderRHDashboard();
        } catch (err) {
            Swal.fire("Erreur", err.message, "error");
        }
    }
};

window.unassignPatientFromPatient = async (assignmentId, patientName, aidantName) => {
    if (!assignmentId) {
        Swal.fire("Erreur", "ID d'assignation manquant", "error");
        return;
    }
    
    const result = await Swal.fire({
        title: "Confirmer",
        html: `Retirer <b>${escapeHtml(aidantName)}</b> du dossier de <b>${escapeHtml(patientName)}</b> ?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "OUI, DÉLIER",
        confirmButtonColor: "#F43F5E",
        cancelButtonText: "Annuler"
    });
    
    if (!result.isConfirmed) return;
    
    Swal.fire({ title: "Suppression...", didOpen: () => Swal.showLoading() });
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/planning/${assignmentId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
                "Content-Type": "application/json"
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erreur");
        }
        
        Swal.fire({ icon: "success", title: "Assignation supprimée", timer: 1500, showConfirmButton: false });
        renderRHDashboard();
    } catch (err) {
        Swal.close();
        console.error("❌ Erreur:", err);
        Swal.fire("Erreur", err.message, "error");
    }
};

window.activateWithDefaultEmail = async (id, email, nom, role) => {
    Swal.fire({ title: 'Activation...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        await secureFetch('/admin/validate-member', {
            method: 'POST',
            body: JSON.stringify({ user_id: id, email: email, nom: nom, role: role, notes: null, use_default: true })
        });
        Swal.fire({ icon: "success", title: "✅ Activation réussie !", timer: 1500, showConfirmButton: false });
        await refreshPendingRegistrations();
        setTimeout(() => window.switchView('dashboard'), 500);
    } catch(error) {
        Swal.fire({ icon: "error", title: "Erreur", text: error.message });
    }
};

window.activateWithCustomEmail = async (id, email, nom, role) => {
    const notes = document.getElementById('val-notes')?.value;
    if (!notes || notes.trim() === '') {
        Swal.fire({ icon: "warning", title: "Message vide", text: "Veuillez écrire un message personnalisé" });
        return;
    }
    Swal.fire({ title: 'Activation...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        await secureFetch('/admin/validate-member', {
            method: 'POST',
            body: JSON.stringify({ user_id: id, email: email, nom: nom, role: role, notes: notes, use_default: false })
        });
        Swal.fire({ icon: "success", title: "✅ Activation réussie !", timer: 1500, showConfirmButton: false });
        await refreshPendingRegistrations();
        setTimeout(() => window.switchView('dashboard'), 500);
    } catch(error) {
        Swal.fire({ icon: "error", title: "Erreur", text: error.message });
    }
};


// Expositions globales
// Attendre que le DOM soit chargé pour exposer les fonctions
setTimeout(() => {
    window.openAssignModal = () => {
        console.log("🔵 Nouvelle assignation (vide)");
        if (typeof window.openAssignPage === 'function') {
            window.openAssignPage(null, null);
        } else {
            console.error("❌ window.openAssignPage non trouvée, chargement...");
            import('./planning.js').then(module => {
                window.openAssignPage = module.openAssignPage;
                window.openAssignPage(null, null);
            });
        }
    };

    window.openAssignModalWithAidant = (aidantId) => {
        console.log("🔵 Assignation avec aidant:", aidantId);
        if (typeof window.openAssignPage === 'function') {
            window.openAssignPage(null, aidantId);
        } else {
            import('./planning.js').then(module => {
                window.openAssignPage = module.openAssignPage;
                window.openAssignPage(null, aidantId);
            });
        }
    };

    window.openAssignModalWithPatient = (patientId, patientNom) => {
        console.log("🔵 Assignation avec patient:", patientId, patientNom);
        if (typeof window.openAssignPage === 'function') {
            window.openAssignPage(patientId, null);
        } else {
            import('./planning.js').then(module => {
                window.openAssignPage = module.openAssignPage;
                window.openAssignPage(patientId, null);
            });
        }
    };
}, 500);

window.unassignPatient = unassignPatient;
window.unassignPatientFromPatient = unassignPatientFromPatient;
window.activateWithDefaultEmail = activateWithDefaultEmail;
window.activateWithCustomEmail = activateWithCustomEmail;

console.log("✅ Module admin chargé - window.openAssignModal:", typeof window.openAssignModal);
console.log("✅ window.openAssignModalWithPatient:", typeof window.openAssignModalWithPatient);
