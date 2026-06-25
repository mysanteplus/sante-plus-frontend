// modules/dashboard.js - VERSION COMPLÈTE CORRIGÉE

import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";
import { loadRegistrations } from "../modules/admin.js";

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

/**
 * 🔍 VÉRIFIER ET AFFICHER LE STATUT D'ABONNEMENT
 */
export async function checkAndDisplaySubscriptionStatus() {
    try {
        const status = await secureFetch("/billing/subscription-status", { noCache: true });
        
        console.log("📊 Statut abonnement:", status);
        
        if (status) {
            localStorage.setItem("subscription_active", status.active ? "true" : "false");
            localStorage.setItem("subscription_type", status.type || "");
            localStorage.setItem("subscription_end_date", status.endDate || "");
            localStorage.setItem("subscription_days_remaining", String(status.daysRemaining || 0));
            localStorage.setItem("subscription_type_compte", status.type_compte || "AVEC_PATIENT");
        }
        
        return status;
    } catch (err) {
        console.error("❌ Erreur statut abonnement:", err);
        return null;
    }
}

/**
 * 🎨 CARTE DE STATUT D'ABONNEMENT POUR LE DASHBOARD FAMILLE
 */
export function renderSubscriptionStatusCard() {
    const isActive = localStorage.getItem("subscription_active") === "true";
    const daysRemaining = parseInt(localStorage.getItem("subscription_days_remaining") || "0");
    const endDate = localStorage.getItem("subscription_end_date");
    const type = localStorage.getItem("subscription_type") || "";
    const typeCompte = localStorage.getItem("subscription_type_compte") || "AVEC_PATIENT";
    const isSansPatient = typeCompte === "SANS_PATIENT";
    
    const endDateFormatted = endDate ? new Date(endDate).toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    }) : '';
    
    if (isActive) {
        let statusColor = 'text-emerald-600';
        let statusBg = 'bg-emerald-50';
        let statusIcon = '✅';
        let statusMessage = `Actif jusqu'au ${endDateFormatted}`;
        
        if (daysRemaining <= 5 && daysRemaining > 0) {
            statusColor = 'text-amber-600';
            statusBg = 'bg-amber-50';
            statusIcon = '⚠️';
            statusMessage = `Expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} (le ${endDateFormatted})`;
        } else if (daysRemaining <= 0) {
            statusColor = 'text-rose-600';
            statusBg = 'bg-rose-50';
            statusIcon = '🔴';
            statusMessage = 'Abonnement expiré';
        }
        
        return `
            <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl ${statusBg} flex items-center justify-center">
                            <span class="text-2xl">${statusIcon}</span>
                        </div>
                        <div>
                            <p class="font-black text-slate-800">${type || (isSansPatient ? 'Pack Confort 24/7' : 'Abonnement médical')}</p>
                            <p class="text-[10px] ${statusColor} font-bold">${statusMessage}</p>
                            ${isSansPatient ? `<p class="text-[8px] text-slate-400">Commandes illimitées • Support prioritaire</p>` : ''}
                        </div>
                    </div>
                    <button onclick="window.switchView('subscription')" 
                            class="text-[9px] font-bold ${statusColor} hover:underline">
                        Gérer →
                    </button>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                            <span class="text-2xl">⚠️</span>
                        </div>
                        <div>
                            <p class="font-black text-slate-800">Aucun abonnement actif</p>
                            <p class="text-[10px] text-amber-600 font-bold">Service limité</p>
                            ${isSansPatient ? `<p class="text-[8px] text-slate-400">Activez le Pack Confort pour des commandes illimitées</p>` : ''}
                        </div>
                    </div>
                    <button onclick="window.switchView('subscription')" 
                            class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                        Souscrire
                    </button>
                </div>
            </div>
        `;
    }
}

// ============================================================
// DASHBOARD ADMIN
// ============================================================

export async function loadAdminDashboard() {
    const container = document.getElementById('view-container');
    
    container.innerHTML = `
        <div class="animate-fadeIn pb-32">
            <!-- KPIs -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${renderStatCard('Dossiers', 'stat-patients', 'fa-hospital-user', 'bg-blue-500')}
                ${renderStatCard('Visites Jour', 'stat-visits', 'fa-calendar-check', 'bg-emerald-500')}
                ${renderStatCard('À Valider', 'stat-pending', 'fa-clipboard-check', 'bg-amber-500')}
                ${renderStatCard('CA Encaissé', 'stat-late', 'fa-hand-holding-dollar', 'bg-emerald-500')}
            </div>

            <!-- Inscriptions en attente -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
                <div class="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div class="section-title">
                            <i class="fa-solid fa-user-plus"></i>
                            <span>Inscriptions en attente</span>
                        </div>
                        <p class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Validation des accès & Activation Duo Pack</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3">
                            <i class="fa-solid fa-magnifying-glass text-slate-300 text-xs"></i>
                            <input type="text" id="pending-search" placeholder="Filtrer..." class="bg-transparent border-none outline-none text-sm font-medium w-full md:w-48">
                        </div>
                    </div>
                </div>

                <!-- Version Desktop -->
                <div class="hidden lg:block overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th class="px-6 py-4">Responsable</th>
                                <th class="px-6 py-4">Type</th>
                                <th class="px-6 py-4">Parent au Bénin</th>
                                <th class="px-6 py-4">Date</th>
                                <th class="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="pending-table-body" class="divide-y divide-slate-50"></tbody>
                    </table>
                </div>

                <!-- Version Mobile -->
                <div id="pending-mobile-list" class="lg:hidden divide-y divide-slate-100"></div>
            </div>

            <!-- Rapports de visite à valider -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-50">
                    <div class="section-title">
                        <i class="fa-solid fa-file-alt"></i>
                        <span>Derniers rapports de soins</span>
                    </div>
                    <p class="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Certification des interventions terrain</p>
                </div>
                <div id="pending-visits-list" class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4"></div>
            </div>
        </div>
    `;

    fetchStats();
    loadRegistrations();
    loadVisitsToValidate();
}

// ============================================================
// CARTE STATISTIQUE
// ============================================================

function renderStatCard(label, id, icon, color) {
    return `
        <div class="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center text-xl shadow-md">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${label}</p>
                <h3 id="${id}" class="text-2xl font-black text-slate-800 tracking-tight">...</h3>
            </div>
        </div>
    `;
}

// ============================================================
// STATISTIQUES
// ============================================================

async function fetchStats() {
    try {
        const stats = await secureFetch('/dashboard/stats');
        
        const patientsEl = document.getElementById('stat-patients');
        const visitsEl = document.getElementById('stat-visits');
        const pendingEl = document.getElementById('stat-pending');
        const revenueEl = document.getElementById('stat-late');
        
        if (patientsEl) patientsEl.innerText = stats.total_patients || 0;
        if (visitsEl) visitsEl.innerText = stats.visits_today || 0;
        if (pendingEl) pendingEl.innerText = stats.pending_validation || 0;
        if (revenueEl) revenueEl.innerText = UI.formatMoney(stats.revenue_total || 0);
        
    } catch (e) { 
        console.error("Stats Error:", e); 
    }
}

// ============================================================
// VISITES À VALIDER
// ============================================================

async function loadVisitsToValidate() {
    const list = document.getElementById('pending-visits-list');
    if (!list) return;
    
    try {
        const visits = await secureFetch('/visites?statut=En attente');
        const pending = Array.isArray(visits) ? visits.filter(v => v.statut === 'En attente') : [];

        if (pending.length === 0) {
            list.innerHTML = `<p class="col-span-2 text-center text-slate-400 italic text-sm py-10">Aucun rapport en attente.</p>`;
            return;
        }

        list.innerHTML = pending.map(v => `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    ${v.photo_url ? `<img src="${v.photo_url}" class="w-12 h-12 rounded-xl object-cover shadow-sm cursor-pointer" onclick="window.open('${v.photo_url}')">` : `
                        <div class="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center">
                            <i class="fa-solid fa-image text-slate-400"></i>
                        </div>
                    `}
                    <div>
                        <h5 class="font-black text-slate-800 text-xs uppercase">${v.patient?.nom_complet || 'Patient'}</h5>
                        <p class="text-[9px] text-slate-400 font-bold mt-0.5">${UI.formatDate(v.heure_debut)}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.quickValidate('${v.id}', 'Validé')" class="w-8 h-8 rounded-lg bg-emerald-500 text-white shadow-sm flex items-center justify-center active:scale-95 transition-all">
                        <i class="fa-solid fa-check text-xs"></i>
                    </button>
                    <button onclick="window.quickValidate('${v.id}', 'Rejeté')" class="w-8 h-8 rounded-lg bg-rose-500 text-white shadow-sm flex items-center justify-center active:scale-95 transition-all">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Erreur chargement visites:", e);
        list.innerHTML = `<p class="col-span-2 text-center text-rose-500 text-sm py-10">Erreur de chargement</p>`;
    }
}

// ============================================================
// VALIDATION RAPIDE D'UNE VISITE
// ============================================================

async function quickValidate(visiteId, statut) {
    const result = await Swal.fire({
        title: "Validation",
        text: `Confirmer la ${statut === 'Validé' ? 'validation' : 'invalidation'} de cette visite ?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: statut === 'Validé' ? "OUI, VALIDER" : "OUI, REJETER",
        confirmButtonColor: statut === 'Validé' ? "#10B981" : "#F43F5E",
        cancelButtonText: "Annuler",
        customClass: { popup: 'rounded-2xl' }
    });
    
    if (!result.isConfirmed) return;
    
    Swal.fire({
        title: "Validation...",
        html: "Veuillez patienter",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        await secureFetch("/visites/validate", {
            method: "POST",
            body: JSON.stringify({ visite_id: visiteId, statut: statut })
        });
        
        Swal.close();
        
        await Swal.fire({
            icon: "success",
            title: "Succès !",
            text: `Visite ${statut === 'Validé' ? 'validée' : 'rejetée'} avec succès`,
            timer: 1500,
            showConfirmButton: false
        });
        
        await loadVisitsToValidate();
        await fetchStats();
        
    } catch (err) {
        Swal.close();
        
        await Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message,
            confirmButtonColor: "#F43F5E"
        });
    }
}

// ============================================================
// ASSIGNATIONS RH
// ============================================================

export async function loadRHAssignments() {
    const container = document.getElementById('view-container');
    if (!container) return;
    
    try {
        const assignments = await secureFetch('/planning/active');
        
        if (!assignments?.length) {
            container.innerHTML = `
                <div class="text-center py-20">
                    <i class="fa-solid fa-handshake text-5xl text-slate-300 mb-4"></i>
                    <p class="text-xs font-black text-slate-400">Aucune assignation active</p>
                    <button onclick="window.openAssignPage()" 
                            class="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black">
                        + Nouvelle assignation
                    </button>
                </div>
            `;
            return;
        }
        
        const groupedByPatient = assignments.reduce((acc, a) => {
            const patientId = a.patient?.id;
            if (!acc[patientId]) {
                acc[patientId] = {
                    patient: a.patient,
                    assignments: []
                };
            }
            acc[patientId].assignments.push(a);
            return acc;
        }, {});
        
        container.innerHTML = `
            <div class="animate-fadeIn pb-32">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="font-black text-2xl text-slate-800 tracking-tight">👥 Assignations</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Aidants liés aux patients</p>
                    </div>
                    <button onclick="window.openAssignPage()" 
                            class="w-12 h-12 bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center justify-center active:scale-95 transition-all">
                        <i class="fa-solid fa-plus text-xl"></i>
                    </button>
                </div>
                
                <div class="space-y-6">
                    ${Object.values(groupedByPatient).map(group => `
                        <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div class="p-4 bg-slate-50 border-b border-slate-100">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-black text-slate-800">${escapeHtml(group.patient?.nom_complet || 'Patient inconnu')}</h4>
                                        <p class="text-[9px] text-slate-400 mt-0.5">${escapeHtml(group.patient?.adresse || 'Adresse non renseignée')}</p>
                                    </div>
                                    <span class="text-[9px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                        ${group.assignments.length} aidant(s)
                                    </span>
                                </div>
                            </div>
                            <div class="divide-y divide-slate-50">
                                ${group.assignments.map(assign => `
                                    <div class="p-4 flex items-center justify-between">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                                <i class="fa-solid fa-user-nurse text-emerald-600"></i>
                                            </div>
                                            <div>
                                                <p class="font-bold text-slate-800 text-sm">${escapeHtml(assign.aidant?.nom || 'Aidant inconnu')}</p>
                                                <p class="text-[9px] text-slate-400">
                                                    ${assign.type_assignation === 'permanente' ? '📌 Permanent' : 
                                                      assign.type_assignation === 'temporelle' ? '📅 Temporaire' : '📍 Ponctuel'}
                                                    ${assign.date_fin ? ` • Jusqu'au ${new Date(assign.date_fin).toLocaleDateString('fr-FR')}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <button onclick="window.unassignAidant('${assign.id}', '${escapeHtml(group.patient?.nom_complet)}', '${escapeHtml(assign.aidant?.nom)}')" 
                                                class="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center active:scale-95 transition-all">
                                            <i class="fa-solid fa-unlink text-xs"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
    } catch (err) {
        console.error("❌ Erreur chargement RH:", err);
        container.innerHTML = `<p class="text-rose-500 text-center p-10">Erreur : ${err.message}</p>`;
    }
}

// ============================================================
// DASHBOARD SENIOR (pour les familles non-maman)
// ============================================================

export async function loadSeniorDashboard() {
    const container = document.getElementById("view-container");
    if (!container) return;

    const userName = localStorage.getItem("user_name") || "Utilisateur";
    
    // ✅ Récupérer le statut d'abonnement
    const status = await checkAndDisplaySubscriptionStatus();
    const isActive = status?.active === true;
    
    container.innerHTML = `
        <div class="animate-fadeIn pb-32">
            <!-- Bienvenue -->
            <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-6 mb-6 text-white">
                <p class="text-[10px] font-bold opacity-80">Bonjour</p>
                <h2 class="text-2xl font-black">${escapeHtml(userName)}</h2>
                <p class="text-sm opacity-90 mt-1">Suivi de votre proche</p>
            </div>
            
            <!-- ✅ CARTE STATUT ABONNEMENT -->
            ${renderSubscriptionStatusCard()}
            
            <!-- Statistiques rapides -->
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase">Visites</span>
                        <i class="fa-solid fa-calendar-check text-emerald-500"></i>
                    </div>
                    <p class="text-2xl font-black text-slate-800" id="senior-visits-count">-</p>
                    <p class="text-[10px] text-slate-400">ce mois</p>
                </div>
                <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[9px] font-black text-slate-400 uppercase">Commandes</span>
                        <i class="fa-solid fa-box text-emerald-500"></i>
                    </div>
                    <p class="text-2xl font-black text-slate-800" id="senior-orders-count">-</p>
                    <p class="text-[10px] text-slate-400">en cours</p>
                </div>
            </div>
            
            <!-- Dernières activités -->
            <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 mb-6">
                <h3 class="font-black text-slate-800 mb-3">📋 Dernières activités</h3>
                <div id="senior-recent-activities" class="space-y-3">
                    <div class="text-center py-8 text-slate-400">Chargement...</div>
                </div>
            </div>
            
            <!-- Actions rapides -->
            <div class="grid grid-cols-2 gap-3">
                <button onclick="window.switchView('feed')" class="bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold text-sm active:scale-95 transition-all">
                    <i class="fa-solid fa-newspaper mr-2"></i> Journal
                </button>
                <button onclick="window.switchView('commandes')" class="bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold text-sm active:scale-95 transition-all">
                    <i class="fa-solid fa-box mr-2"></i> Commander
                </button>
            </div>
            
            ${!isActive ? `
                <div class="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p class="text-xs text-amber-700 font-medium">
                        ⚠️ Votre abonnement n'est pas actif. Certaines fonctionnalités sont limitées.
                    </p>
                    <button onclick="window.switchView('subscription')" 
                            class="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                        Activer mon abonnement
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    await loadSeniorStats();
}

// ============================================================
// STATS SENIOR
// ============================================================

async function loadSeniorStats() {
    try {
        const { data: patients } = await supabase
            .from("patients")
            .select("id")
            .eq("famille_user_id", localStorage.getItem("user_id"))
            .maybeSingle();
        
        if (!patients) return;
        
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: visites } = await supabase
            .from("visites")
            .select("id")
            .eq("patient_id", patients.id)
            .gte("created_at", startOfMonth.toISOString());
        
        document.getElementById("senior-visits-count").innerText = visites?.length || 0;
        
        const { data: commandes } = await supabase
            .from("commandes_meds")
            .select("id")
            .eq("patient_id", patients.id)
            .in("statut", ["En attente", "En cours", "En cours de livraison"]);
        
        document.getElementById("senior-orders-count").innerText = commandes?.length || 0;
        
        const { data: messages } = await supabase
            .from("messages")
            .select("content, created_at, sender:profiles!sender_id(nom)")
            .eq("patient_id", patients.id)
            .order("created_at", { ascending: false })
            .limit(5);
        
        const activitiesDiv = document.getElementById("senior-recent-activities");
        if (messages && messages.length > 0) {
            activitiesDiv.innerHTML = messages.map(msg => `
                <div class="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <i class="fa-solid fa-comment text-emerald-600 text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-xs text-slate-700 line-clamp-2">${escapeHtml(msg.content?.substring(0, 100) || 'Photo')}</p>
                        <p class="text-[9px] text-slate-400 mt-1">${new Date(msg.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                </div>
            `).join('');
        } else {
            activitiesDiv.innerHTML = '<div class="text-center py-8 text-slate-400">Aucune activité récente</div>';
        }
        
    } catch (err) {
        console.error("Erreur chargement stats senior:", err);
    }
}

// ============================================================
// DASHBOARD SANS PATIENT
// ============================================================

export async function renderSansPatientDashboard() {
    const container = document.getElementById("view-container");
    if (!container) return;
    
    const userName = localStorage.getItem("user_name") || "Utilisateur";
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    const themeBgClass = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
    const themeTextClass = isMaman ? 'text-pink-600' : 'text-emerald-600';
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    
    // ✅ Récupérer le statut du Pack Confort
    const status = await checkAndDisplaySubscriptionStatus();
    const isActive = status?.active === true;
    const daysRemaining = status?.daysRemaining || 0;
    
    let commandesEnCours = [];
    let commandesRecentes = [];
    
    try {
        const commandes = await secureFetch("/commandes/mes-commandes");
        commandesEnCours = commandes.filter(c => c.statut === "En attente" || c.statut === "En cours de livraison");
        commandesRecentes = commandes.slice(0, 3);
    } catch (err) {
        console.error("Erreur chargement dashboard:", err);
    }
    
    container.innerHTML = `
        <div class="animate-fadeIn pb-24">
            <!-- Bannière de bienvenue -->
            <div class="relative rounded-2xl overflow-hidden mb-6" style="background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%);">
                <div class="relative z-10 p-6 text-white">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-[10px] font-bold opacity-80">Bienvenue</p>
                            <h2 class="text-2xl font-black">${escapeHtml(userName.split(' ')[0])}</h2>
                            <p class="text-sm opacity-90 mt-1">Espace personnel</p>
                        </div>
                        <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                            <i class="fa-solid fa-user text-white text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- ✅ CARTE STATUT PACK CONFORT -->
            <div class="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-slate-100">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl ${isActive ? themeBgClass : 'bg-amber-50'} flex items-center justify-center">
                            <i class="fa-solid fa-crown ${isActive ? themeTextClass : 'text-amber-600'} text-xl"></i>
                        </div>
                        <div>
                            <p class="font-black text-slate-800">Pack Confort 24/7</p>
                            ${isActive ? `
                                <p class="text-[10px] text-emerald-600 font-bold">✅ Actif</p>
                                ${daysRemaining > 0 ? `<p class="text-[9px] text-slate-400">Plus que ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}</p>` : '<p class="text-[9px] text-rose-500">⚠️ Expiré</p>'}
                            ` : `
                                <p class="text-[10px] text-amber-600 font-bold">⚠️ Inactif</p>
                                <p class="text-[9px] text-slate-400">Souscrivez pour bénéficier des avantages</p>
                            `}
                        </div>
                    </div>
                    ${!isActive ? `
                        <button onclick="window.switchView('subscription')" 
                                class="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-${themeColor}-500 text-white shadow-md active:scale-95 transition-all">
                            Souscrire
                        </button>
                    ` : `
                        <button onclick="window.switchView('subscription')" 
                                class="text-[9px] font-bold ${themeTextClass} hover:underline">
                            Gérer →
                        </button>
                    `}
                </div>
                ${isActive ? `
                    <div class="mt-3 pt-3 border-t border-slate-100">
                        <p class="text-[8px] text-slate-400 flex items-center gap-2">
                            <i class="fa-solid fa-check-circle text-emerald-500"></i>
                            Commandes illimitées • Support prioritaire 24/7 • Historique conservé
                        </p>
                    </div>
                ` : `
                    <div class="mt-3 pt-3 border-t border-slate-100">
                        <p class="text-[8px] text-slate-400 flex items-center gap-2">
                            <i class="fa-solid fa-info-circle text-amber-500"></i>
                            Activez le Pack Confort pour des commandes illimitées et un support prioritaire
                        </p>
                    </div>
                `}
            </div>
            
            <!-- Commandes en cours -->
            <div class="mb-6">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-black text-slate-800 text-sm">
                        <i class="fa-solid fa-box mr-2 ${themeTextClass}"></i>
                        Commandes en cours
                    </h3>
                    <button onclick="window.switchView('commandes')" class="text-[9px] font-bold ${themeTextClass}">
                        Voir tout →
                    </button>
                </div>
                
                ${commandesEnCours.length === 0 ? `
                    <div class="bg-white rounded-2xl p-6 text-center border border-slate-100">
                        <i class="fa-solid fa-box-open text-3xl text-slate-300 mb-2"></i>
                        <p class="text-xs text-slate-400">Aucune commande en cours</p>
                        ${isActive ? `
                            <button onclick="window.openOrderModal()" 
                                    class="mt-3 px-4 py-2 rounded-xl text-[9px] font-black uppercase ${themeBgClass} ${themeTextClass} active:scale-95 transition-all">
                                + Nouvelle commande
                            </button>
                        ` : `
                            <p class="text-[8px] text-amber-500 mt-2">Activez le Pack Confort pour commander</p>
                        `}
                    </div>
                ` : `
                    <div class="space-y-2">
                        ${commandesEnCours.map(cmd => `
                            <div class="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <p class="font-bold text-slate-800 text-sm">#${cmd.id.substring(0, 8)}</p>
                                        <p class="text-[10px] text-slate-400 mt-0.5">${cmd.liste_medocs?.substring(0, 60)}${cmd.liste_medocs?.length > 60 ? '...' : ''}</p>
                                    </div>
                                    <span class="px-2 py-1 rounded-full text-[9px] font-bold ${
                                        cmd.statut === 'En attente' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                    }">
                                        ${cmd.statut === 'En attente' ? '⏳ En attente' : '🚚 En cours'}
                                    </span>
                                </div>
                                <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                                    <p class="text-[8px] text-slate-400">📅 ${new Date(cmd.created_at).toLocaleDateString('fr-FR')}</p>
                                    <button onclick="window.switchView('commandes')" class="text-[9px] font-bold ${themeTextClass}">
                                        Détails →
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
            
            <!-- Dernières commandes -->
            ${commandesRecentes.length > 0 && commandesEnCours.length !== commandesRecentes.length ? `
                <div class="mb-6">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-black text-slate-800 text-sm">
                            <i class="fa-solid fa-clock mr-2 ${themeTextClass}"></i>
                            Dernières commandes
                        </h3>
                    </div>
                    <div class="space-y-2">
                        ${commandesRecentes.filter(c => c.statut !== 'En attente' && c.statut !== 'En cours de livraison').slice(0, 3).map(cmd => `
                            <div class="bg-white rounded-xl p-3 border border-slate-100">
                                <div class="flex justify-between items-center">
                                    <div class="flex-1">
                                        <p class="text-[10px] font-bold text-slate-700">${cmd.liste_medocs?.substring(0, 50)}${cmd.liste_medocs?.length > 50 ? '...' : ''}</p>
                                        <p class="text-[8px] text-slate-400 mt-0.5">${new Date(cmd.created_at).toLocaleDateString('fr-FR')}</p>
                                    </div>
                                    <span class="px-2 py-1 rounded-full text-[8px] font-bold ${
                                        cmd.statut === 'Livrée' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                    }">
                                        ${cmd.statut === 'Livrée' ? '✅ Livrée' : cmd.statut}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Actions rapides -->
            <div class="grid grid-cols-2 gap-3 mb-6">
                <button onclick="window.openOrderModal()" 
                        class="flex flex-col items-center gap-2 py-4 bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all">
                    <i class="fa-solid fa-cart-plus text-2xl ${themeTextClass}"></i>
                    <span class="text-[10px] font-black text-slate-700">Nouvelle commande</span>
                </button>
                <button onclick="window.switchView('profile')" 
                        class="flex flex-col items-center gap-2 py-4 bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all">
                    <i class="fa-solid fa-user-circle text-2xl ${themeTextClass}"></i>
                    <span class="text-[10px] font-black text-slate-700">Mon profil</span>
                </button>
            </div>
            
            <!-- Section Ajouter un patient -->
            <div class="bg-gradient-to-r from-${themeColor}-50 to-white rounded-2xl p-5 border border-${themeColor}-100">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full ${themeBgClass} flex items-center justify-center">
                        <i class="fa-solid fa-user-plus ${themeTextClass} text-xl"></i>
                    </div>
                    <div class="flex-1">
                        <p class="font-bold text-slate-800 text-sm">Ajouter un patient</p>
                        <p class="text-[9px] text-slate-400">Vous pourrez bénéficier des visites à domicile</p>
                    </div>
                    <button onclick="window.addPatientAfterRegistration()" 
                            class="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-${themeColor}-500 text-white shadow-md active:scale-95 transition-all">
                        Ajouter
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================
// EXPORTS
// ============================================================

window.quickValidate = quickValidate;
window.fetchStats = fetchStats;
window.loadRHAssignments = loadRHAssignments;

export { 
    quickValidate, 
    fetchStats,
 };
