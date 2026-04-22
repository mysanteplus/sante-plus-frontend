import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";
import { loadRegistrations } from "../modules/admin.js";

/**
 * 🚀 DASHBOARD ÉLITE : Gestionnaire de Dossiers & KPIs
 */
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

/**
 * 📊 CARTE STATISTIQUE
 */
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

/**
 * 📈 RÉCUPÉRER LES STATISTIQUES
 */
async function fetchStats() {
    try {
        // ✅ Correction : secureFetch retourne déjà les données
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
/**
 * 📋 CHARGER LES VISITES À VALIDER
 */
async function loadVisitsToValidate() {
    const list = document.getElementById('pending-visits-list');
    if (!list) return;
    
    try {
        // ✅ Correction : secureFetch retourne déjà les données, pas besoin de .json()
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

/**
 * ✅ VALIDATION RAPIDE D'UNE VISITE
 */
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
    
    const loadingAlert = Swal.fire({
        title: "Validation...",
        html: "Veuillez patienter",
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        await secureFetch("/visites/validate", {
            method: "POST",
            body: JSON.stringify({ visite_id: visiteId, statut: statut })
        });
        
        // ✅ Fermer le loader
        Swal.close();
        
        // ✅ Afficher le succès
        await Swal.fire({
            icon: "success",
            title: "Succès !",
            text: `Visite ${statut === 'Validé' ? 'validée' : 'rejetée'} avec succès`,
            timer: 1500,
            showConfirmButton: false
        });
        
        // ✅ Rafraîchir les données
        await loadVisitsToValidate();
        await fetchStats();
        
    } catch (err) {
        // ✅ Fermer le loader
        Swal.close();
        
        // ✅ Afficher l'erreur
        await Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message,
            confirmButtonColor: "#F43F5E"
        });
    }
}

/**
 * 📋 CHARGER LES ASSIGNATIONS RH (Pour le planning)
 */
/**
 * 📋 CHARGER LES ASSIGNATIONS RH (Pour le planning)
 */
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
        
        // Grouper par patient
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

// Fonction escapeHtml si pas déjà présente
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
 * 📊 DASHBOARD SENIOR (pour les familles non-maman)
 */
export async function loadSeniorDashboard() {
    const container = document.getElementById("view-container");
    if (!container) return;

    const userName = localStorage.getItem("user_name") || "Utilisateur";
    
    container.innerHTML = `
        <div class="animate-fadeIn pb-32">
            <!-- Bienvenue -->
            <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-2xl p-6 mb-6 text-white">
                <p class="text-[10px] font-bold opacity-80">Bonjour</p>
                <h2 class="text-2xl font-black">${escapeHtml(userName)}</h2>
                <p class="text-sm opacity-90 mt-1">Suivi de votre proche</p>
            </div>
            
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
        </div>
    `;
    
    // Charger les données
    await loadSeniorStats();
}

async function loadSeniorStats() {
    try {
        // Récupérer le patient
        const { data: patients } = await supabase
            .from("patients")
            .select("id")
            .eq("famille_user_id", localStorage.getItem("user_id"))
            .maybeSingle();
        
        if (!patients) return;
        
        // Compter les visites du mois
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: visites } = await supabase
            .from("visites")
            .select("id")
            .eq("patient_id", patients.id)
            .gte("created_at", startOfMonth.toISOString());
        
        document.getElementById("senior-visits-count").innerText = visites?.length || 0;
        
        // Compter les commandes en cours
        const { data: commandes } = await supabase
            .from("commandes_meds")
            .select("id")
            .eq("patient_id", patients.id)
            .in("statut", ["En attente", "En cours", "En cours de livraison"]);
        
        document.getElementById("senior-orders-count").innerText = commandes?.length || 0;
        
        // Derniers messages
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

// ✅ Exposer la fonction globalement pour les appels HTML
window.quickValidate = quickValidate;
window.fetchStats = fetchStats;
window.loadRHAssignments = loadRHAssignments; 


// ✅ Exporter la fonction pour l'import dans main.js
export { quickValidate, fetchStats};

