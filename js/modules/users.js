import { secureFetch } from "../core/api.js";
import { UI, showToast } from "../core/utils.js";

let allProfiles = [];
let allPatients = [];

export async function renderUsersPage() {
    const container = document.getElementById("view-container");
    const userRole = localStorage.getItem("user_role");

    if (userRole !== "COORDINATEUR") {
        container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">Accès non autorisé</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="animate-fadeIn max-w-6xl mx-auto pb-32">
            <!-- En-tête -->
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h3 class="font-black text-2xl text-slate-800">👥 Dictionnaire des utilisateurs</h3>
                    <p class="text-[10px] text-slate-400 mt-1">Consultez et gérez tous les comptes</p>
                </div>
                <button id="refresh-users-btn" class="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                    <i class="fa-solid fa-rotate-right"></i> Rafraîchir
                </button>
            </div>

            <!-- Onglets -->
            <div class="flex gap-2 mb-6 border-b border-slate-200">
                <button id="tab-profiles" class="px-6 py-3 text-sm font-bold ${!window._usersTab || window._usersTab === 'profiles' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'}">
                    <i class="fa-solid fa-users mr-2"></i> Tous les comptes
                </button>
                <button id="tab-patients" class="px-6 py-3 text-sm font-bold ${window._usersTab === 'patients' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500'}">
                    <i class="fa-solid fa-hospital-user mr-2"></i> Patients
                </button>
            </div>

            <!-- Filtres -->
            <div class="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
                <div class="flex flex-wrap gap-3 items-center">
                    <select id="role-filter" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                        <option value="">Tous les rôles</option>
                        <option value="COORDINATEUR">👑 Coordinateurs</option>
                        <option value="AIDANT">🩺 Aidants</option>
                        <option value="FAMILLE">👨‍👩‍👧 Familles</option>
                    </select>
                    <input type="text" id="search-input" placeholder="Rechercher..." class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                </div>
            </div>

            <!-- Liste -->
            <div id="users-list" class="space-y-3">
                <div class="text-center py-10">Chargement...</div>
            </div>
        </div>
    `;

    await loadAllData();

    document.getElementById('refresh-users-btn').onclick = () => loadAllData();
    document.getElementById('role-filter').onchange = () => filterAndRender();
    document.getElementById('search-input').oninput = () => filterAndRender();
    document.getElementById('tab-profiles').onclick = () => switchTab('profiles');
    document.getElementById('tab-patients').onclick = () => switchTab('patients');
}

function switchTab(tab) {
    window._usersTab = tab;
    filterAndRender();
    // Mettre à jour l'apparence des onglets
    const tabProfiles = document.getElementById('tab-profiles');
    const tabPatients = document.getElementById('tab-patients');
    if (tab === 'profiles') {
        tabProfiles.className = 'px-6 py-3 text-sm font-bold text-emerald-600 border-b-2 border-emerald-600';
        tabPatients.className = 'px-6 py-3 text-sm font-bold text-slate-500';
    } else {
        tabProfiles.className = 'px-6 py-3 text-sm font-bold text-slate-500';
        tabPatients.className = 'px-6 py-3 text-sm font-bold text-emerald-600 border-b-2 border-emerald-600';
    }
}

async function loadAllData() {
    showLoading();
    try {
        const [profiles, patients] = await Promise.all([
            secureFetch('/admin-users/all-profiles'),
            secureFetch('/admin-users/all-patients')
        ]);
        allProfiles = profiles || [];
        allPatients = patients || [];
        filterAndRender();
    } catch (err) {
        document.getElementById('users-list').innerHTML = `<div class="text-center py-10 text-red-500">Erreur: ${err.message}</div>`;
    }
}

function showLoading() {
    document.getElementById('users-list').innerHTML = `
        <div class="text-center py-10">
            <div class="inline-block w-8 h-8 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
            <p class="text-[10px] text-slate-400 mt-2">Chargement...</p>
        </div>
    `;
}

function filterAndRender() {
    const activeTab = window._usersTab || 'profiles';
    if (activeTab === 'patients') {
        renderPatientsList();
    } else {
        renderProfilesList();
    }
}

function renderProfilesList() {
    const roleFilter = document.getElementById('role-filter').value;
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    let filtered = [...allProfiles];
    
    if (roleFilter) {
        filtered = filtered.filter(p => p.role === roleFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            (p.nom?.toLowerCase().includes(searchTerm) ||
             p.email?.toLowerCase().includes(searchTerm) ||
             p.prenom?.toLowerCase().includes(searchTerm))
        );
    }
    
    const listDiv = document.getElementById('users-list');
    
    if (filtered.length === 0) {
        listDiv.innerHTML = '<div class="text-center py-20"><p class="text-slate-400">Aucun utilisateur trouvé</p></div>';
        return;
    }
    
    listDiv.innerHTML = filtered.map(user => `
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div class="p-5">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl ${getRoleBgColor(user.role)} flex items-center justify-center overflow-hidden">
                            ${user.photo_url ? 
                                `<img src="${user.photo_url}" class="w-full h-full object-cover">` : 
                                `<i class="fa-solid ${getRoleIcon(user.role)} text-2xl text-white"></i>`
                            }
                        </div>
                        <div>
                            <h4 class="font-black text-slate-800 text-lg">${user.prenom || ''} ${user.nom || ''}</h4>
                            <p class="text-sm text-slate-500">${user.email}</p>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${getRoleBadgeClass(user.role)}">
                                    ${getRoleLabel(user.role)}
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${user.statut_validation === 'ACTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${user.statut_validation === 'ACTIF' ? '✓ Actif' : '⏳ En attente'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.viewUserDetails('${user.id}')" 
                            class="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-white shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-eye mr-1"></i> Détails
                    </button>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">Téléphone</p>
                        <p class="text-xs font-medium">${user.telephone || 'Non renseigné'}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">Adresse</p>
                        <p class="text-xs font-medium">${user.adresse || 'Non renseignée'}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">Inscrit le</p>
                        <p class="text-xs font-medium">${formatDate(user.created_at)}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">ID</p>
                        <p class="text-xs font-mono text-slate-500">${user.id.substring(0, 8)}...</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPatientsList() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    let filtered = [...allPatients];
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.nom_complet?.toLowerCase().includes(searchTerm) ||
            p.adresse?.toLowerCase().includes(searchTerm)
        );
    }
    
    const listDiv = document.getElementById('users-list');
    
    if (filtered.length === 0) {
        listDiv.innerHTML = '<div class="text-center py-20"><p class="text-slate-400">Aucun patient trouvé</p></div>';
        return;
    }
    
    listDiv.innerHTML = filtered.map(patient => `
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div class="p-5">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center overflow-hidden">
                            ${patient.photo_url ? 
                                `<img src="${patient.photo_url}" class="w-full h-full object-cover">` : 
                                `<i class="fa-solid fa-user text-2xl text-emerald-600"></i>`
                            }
                        </div>
                        <div>
                            <h4 class="font-black text-slate-800 text-lg">${patient.nom_complet || 'Inconnu'}</h4>
                            <p class="text-sm text-slate-500">${patient.adresse || 'Adresse non renseignée'}</p>
                            <div class="flex items-center gap-2 mt-2">
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700">
                                    ${patient.formule || 'Standard'}
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${patient.statut_validation === 'ACTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${patient.statut_validation === 'ACTIF' ? '✓ Actif' : '⏳ En attente'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.viewPatientDetails('${patient.id}')" 
                            class="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-white shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-eye mr-1"></i> Détails
                    </button>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">Âge / Sexe</p>
                        <p class="text-xs font-medium">${patient.age || '?'} ans • ${patient.sexe || 'Non renseigné'}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">Téléphone</p>
                        <p class="text-xs font-medium">${patient.telephone || 'Non renseigné'}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">Famille</p>
                        <p class="text-xs font-medium">${patient.famille?.nom || 'Non lié'}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase">GPS</p>
                        <p class="text-xs font-medium">${patient.lat && patient.lng ? '✅ Localisé' : '❌ Non localisé'}</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================================
// VUE DÉTAILS D'UN PROFIL (USER)
// ============================================================
window.viewUserDetails = async (userId) => {
    try {
        Swal.fire({
            title: "Chargement...",
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });
        
        const user = await secureFetch(`/admin-users/profile/${userId}`);
        Swal.close();
        
        const isAidant = user.role === 'AIDANT';
        const isFamily = user.role === 'FAMILLE';
        
        Swal.fire({
            title: `<div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl ${getRoleBgColor(user.role)} flex items-center justify-center overflow-hidden">
                            ${user.photo_url ? 
                                `<img src="${user.photo_url}" class="w-full h-full object-cover">` : 
                                `<i class="fa-solid ${getRoleIcon(user.role)} text-xl text-white"></i>`
                            }
                        </div>
                        <span class="text-xl font-black">${user.prenom || ''} ${user.nom || ''}</span>
                    </div>`,
            html: `
                <div class="text-left space-y-4 max-h-[60vh] overflow-y-auto">
                    <!-- Informations personnelles -->
                    <div class="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Email</p>
                            <p class="text-sm font-medium break-all">${user.email}</p>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Téléphone</p>
                            <p class="text-sm">${user.telephone || 'Non renseigné'}</p>
                        </div>
                        <div class="col-span-2">
                            <p class="text-[9px] font-black text-slate-400 uppercase">Adresse</p>
                            <p class="text-sm">${user.adresse || 'Non renseignée'}</p>
                        </div>
                    </div>
                    
                    ${isAidant ? `
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Compétences</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${user.competences?.map(c => `<span class="px-2 py-1 bg-slate-100 rounded-full text-[10px]">${c}</span>`).join('') || '<span class="text-slate-400 text-sm">Aucune</span>'}
                            </div>
                        </div>
                        ${user.disponibilites ? `
                            <div>
                                <p class="text-[9px] font-black text-slate-400 uppercase">Disponibilités</p>
                                <p class="text-sm">${user.disponibilites}</p>
                            </div>
                        ` : ''}
                        ${user.stats ? `
                            <div class="bg-slate-50 p-3 rounded-xl">
                                <p class="text-[9px] font-black text-slate-400 uppercase mb-2">Statistiques</p>
                                <div class="flex justify-around text-center">
                                    <div><p class="text-xl font-black text-emerald-600">${user.stats.total}</p><p class="text-[8px]">Visites</p></div>
                                    <div><p class="text-xl font-black text-emerald-600">${user.stats.validees}</p><p class="text-[8px]">Validées</p></div>
                                    <div><p class="text-xl font-black text-amber-600">${user.stats.en_attente}</p><p class="text-[8px]">En attente</p></div>
                                </div>
                            </div>
                        ` : ''}
                        ${user.assignments?.length ? `
                            <div>
                                <p class="text-[9px] font-black text-slate-400 uppercase">Patients assignés</p>
                                <div class="space-y-1 mt-1">
                                    ${user.assignments.map(a => `
                                        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                            <span class="text-sm">${a.patient?.nom_complet || 'Patient inconnu'}</span>
                                            <span class="text-[9px] text-slate-500">${a.formule || 'Standard'}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    ` : ''}
                    
                    ${isFamily ? `
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Patients liés</p>
                            <div class="space-y-1 mt-1">
                                ${user.patients?.length ? user.patients.map(p => `
                                    <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                        <span class="text-sm">${p.nom_complet || 'Patient inconnu'}</span>
                                        <span class="text-[9px] text-emerald-600 font-medium">${p.formule || 'Standard'}</span>
                                    </div>
                                `).join('') : '<p class="text-sm text-slate-400">Aucun patient lié</p>'}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="pt-3 border-t border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase">ID utilisateur</p>
                        <p class="text-[10px] font-mono text-slate-500 break-all">${user.id}</p>
                        <p class="text-[9px] text-slate-400 mt-2">Inscrit le ${new Date(user.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                </div>
            `,
            confirmButtonText: "Fermer",
            confirmButtonColor: "#0F172A",
            showCancelButton: true,
            cancelButtonText: "Modifier",
            cancelButtonColor: "#10B981",
            customClass: { popup: 'rounded-2xl p-6' }
        }).then((result) => {
            if (result.dismiss === 'cancel') {
                openEditUserModal(user);
            }
        });
        
    } catch (err) {
        Swal.close();
        UI.error(err.message);
    }
};

// ============================================================
// MODIFICATION D'UN UTILISATEUR
// ============================================================
async function openEditUserModal(user) {
    const { value: formData } = await Swal.fire({
        title: `Modifier ${user.prenom || ''} ${user.nom || ''}`,
        html: `
            <div class="text-left space-y-3">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[10px] font-black text-slate-400">Prénom</label>
                        <input id="edit-prenom" class="w-full p-2 border rounded-lg text-sm" value="${user.prenom || ''}">
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-400">Nom</label>
                        <input id="edit-nom" class="w-full p-2 border rounded-lg text-sm" value="${user.nom || ''}">
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Email</label>
                    <input id="edit-email" class="w-full p-2 border rounded-lg text-sm" value="${user.email || ''}">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Téléphone</label>
                    <input id="edit-tel" class="w-full p-2 border rounded-lg text-sm" value="${user.telephone || ''}">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Adresse</label>
                    <input id="edit-adresse" class="w-full p-2 border rounded-lg text-sm" value="${user.adresse || ''}">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Statut</label>
                    <select id="edit-statut" class="w-full p-2 border rounded-lg text-sm">
                        <option value="ACTIF" ${user.statut_validation === 'ACTIF' ? 'selected' : ''}>Actif</option>
                        <option value="EN_ATTENTE" ${user.statut_validation === 'EN_ATTENTE' ? 'selected' : ''}>En attente</option>
                    </select>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "💾 Enregistrer",
        cancelButtonText: "Annuler",
        confirmButtonColor: "#10B981",
        preConfirm: () => ({
            nom: document.getElementById('edit-nom').value,
            prenom: document.getElementById('edit-prenom').value,
            email: document.getElementById('edit-email').value,
            telephone: document.getElementById('edit-tel').value,
            adresse: document.getElementById('edit-adresse').value,
            statut_validation: document.getElementById('edit-statut').value
        })
    });
    
    if (formData) {
        Swal.fire({ title: "Mise à jour...", didOpen: () => Swal.showLoading() });
        try {
            await secureFetch(`/admin-users/profile/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            UI.success("Profil mis à jour");
            await loadAllData();
        } catch (err) {
            UI.error(err.message);
        }
    }
}

// ============================================================
// VUE DÉTAILS D'UN PATIENT
// ============================================================
window.viewPatientDetails = async (patientId) => {
    try {
        Swal.fire({
            title: "Chargement...",
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });
        
        const patient = await secureFetch(`/admin-users/patient/${patientId}`);
        Swal.close();
        
        Swal.fire({
            title: `<div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center overflow-hidden">
                            ${patient.photo_url ? 
                                `<img src="${patient.photo_url}" class="w-full h-full object-cover">` : 
                                `<i class="fa-solid fa-user text-xl text-emerald-600"></i>`
                            }
                        </div>
                        <span class="text-xl font-black">${patient.nom_complet || 'Patient'}</span>
                    </div>`,
            html: `
                <div class="text-left space-y-3 max-h-[60vh] overflow-y-auto">
                    <div class="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Âge / Sexe</p>
                            <p class="text-sm">${patient.age || '?'} ans • ${patient.sexe || 'Non renseigné'}</p>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Téléphone</p>
                            <p class="text-sm">${patient.telephone || 'Non renseigné'}</p>
                        </div>
                        <div class="col-span-2">
                            <p class="text-[9px] font-black text-slate-400 uppercase">Adresse</p>
                            <p class="text-sm">${patient.adresse || 'Non renseignée'}</p>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Formule</p>
                            <p class="text-sm font-bold text-emerald-600">${patient.formule || 'Standard'}</p>
                        </div>
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Famille</p>
                            <p class="text-sm">${patient.famille?.nom || 'Non lié'}</p>
                        </div>
                    </div>
                    
                    ${patient.pathologies?.length ? `
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Pathologies</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${patient.pathologies.map(p => `<span class="px-2 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px]">${p}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${patient.traitements ? `
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Traitements</p>
                            <p class="text-sm">${patient.traitements}</p>
                        </div>
                    ` : ''}
                    
                    ${patient.allergies ? `
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Allergies</p>
                            <p class="text-sm">${patient.allergies}</p>
                        </div>
                    ` : ''}
                    
                    ${patient.notes_medicales ? `
                        <div>
                            <p class="text-[9px] font-black text-slate-400 uppercase">Notes médicales</p>
                            <p class="text-sm italic">${patient.notes_medicales}</p>
                        </div>
                    ` : ''}
                    
                    <div class="pt-3 border-t border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase">Contact urgence</p>
                        <p class="text-sm">${patient.contact_urgence || 'Non renseigné'}</p>
                        <p class="text-[9px] text-slate-400 mt-2">Inscrit le ${new Date(patient.created_at).toLocaleString('fr-FR')}</p>
                    </div>
                </div>
            `,
            confirmButtonText: "Fermer",
            confirmButtonColor: "#0F172A",
            customClass: { popup: 'rounded-2xl p-6' }
        });
        
    } catch (err) {
        Swal.close();
        UI.error(err.message);
    }
};

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function getInitials(nom, prenom) {
    const first = prenom?.charAt(0) || '';
    const last = nom?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
}

function getRoleLabel(role) {
    const labels = { 'COORDINATEUR': '👑 Coordinateur', 'AIDANT': '🩺 Aidant', 'FAMILLE': '👨‍👩‍👧 Famille' };
    return labels[role] || role;
}

function getRoleIcon(role) {
    const icons = { 'COORDINATEUR': 'fa-user-tie', 'AIDANT': 'fa-user-nurse', 'FAMILLE': 'fa-users' };
    return icons[role] || 'fa-user';
}

function getRoleBgColor(role) {
    const colors = { 'COORDINATEUR': 'bg-amber-600', 'AIDANT': 'bg-emerald-600', 'FAMILLE': 'bg-blue-600' };
    return colors[role] || 'bg-slate-600';
}

function getRoleBadgeClass(role) {
    const colors = { 'COORDINATEUR': 'bg-amber-100 text-amber-700', 'AIDANT': 'bg-emerald-100 text-emerald-700', 'FAMILLE': 'bg-blue-100 text-blue-700' };
    return colors[role] || 'bg-slate-100 text-slate-700';
}

function formatDate(dateStr) {
    if (!dateStr) return 'Inconnue';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}
