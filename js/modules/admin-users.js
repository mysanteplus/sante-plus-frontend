import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";

export async function renderAdminUsersPage() {
  const container = document.getElementById("view-container");
  const userRole = localStorage.getItem("user_role");

  if (userRole !== "COORDINATEUR") {
    container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">Accès non autorisé</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-fadeIn max-w-6xl mx-auto pb-32">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h3 class="font-black text-2xl text-slate-800">👥 Gestion des utilisateurs</h3>
          <p class="text-[10px] text-slate-400 mt-1">Création et gestion des comptes</p>
        </div>
        <button id="create-user-btn" class="bg-emerald-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
          <i class="fa-solid fa-user-plus mr-2"></i> Nouvel utilisateur
        </button>
      </div>

      <!-- Filtres -->
      <div class="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
        <div class="flex flex-wrap gap-3 items-center">
          <select id="filter-role" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            <option value="">Tous les rôles</option>
            <option value="COORDINATEUR">Coordinateur</option>
            <option value="AIDANT">Aidant</option>
            <option value="FAMILLE">Famille</option>
          </select>
          <input type="text" id="filter-search" placeholder="Rechercher..." class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <button id="refresh-users" class="px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase">
            <i class="fa-solid fa-rotate-right"></i> Rafraîchir
          </button>
        </div>
      </div>

      <!-- Liste des utilisateurs -->
      <div id="users-list" class="space-y-3">
        <div class="text-center py-10">Chargement...</div>
      </div>
    </div>
  `;

  // Modal de création d'utilisateur
  const modalHtml = `
    <div id="create-user-modal" class="fixed inset-0 bg-black/50 z-[1000] hidden items-center justify-center">
      <div class="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-white p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-black text-slate-800">➕ Nouvel utilisateur</h3>
          <button id="close-modal" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500">&times;</button>
        </div>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] font-black text-slate-400">Prénom</label>
              <input type="text" id="user-prenom" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
            </div>
            <div>
              <label class="text-[10px] font-black text-slate-400">Nom</label>
              <input type="text" id="user-nom" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
            </div>
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400">Email</label>
            <input type="email" id="user-email" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400">Téléphone</label>
            <input type="tel" id="user-tel" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400">Adresse</label>
            <input type="text" id="user-adresse" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400">Rôle</label>
            <select id="user-role" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
              <option value="COORDINATEUR">👑 Coordinateur</option>
              <option value="AIDANT">🩺 Aidant</option>
              <option value="FAMILLE">👨‍👩‍👧 Famille</option>
            </select>
          </div>
          <div id="aidant-fields" class="hidden space-y-3">
            <div>
              <label class="text-[10px] font-black text-slate-400">Compétences</label>
              <div class="flex flex-wrap gap-2 mt-1">
                <label><input type="checkbox" value="Soins de base" class="skill-cb"> Soins de base</label>
                <label><input type="checkbox" value="Aide à la mobilité" class="skill-cb"> Aide mobilité</label>
                <label><input type="checkbox" value="Préparation repas" class="skill-cb"> Préparation repas</label>
                <label><input type="checkbox" value="Premiers secours" class="skill-cb"> Premiers secours</label>
              </div>
            </div>
            <div>
              <label class="text-[10px] font-black text-slate-400">Disponibilités</label>
              <textarea id="user-dispo" rows="2" class="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm" placeholder="Lundis et mercredis après-midi..."></textarea>
            </div>
          </div>
          <button id="submit-user" class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase">Créer le compte</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  await loadUsers();

  document.getElementById('create-user-btn').onclick = () => openCreateModal();
  document.getElementById('close-modal').onclick = () => closeCreateModal();
  document.getElementById('submit-user').onclick = () => createUser();
  document.getElementById('filter-role').onchange = () => filterUsers();
  document.getElementById('filter-search').oninput = () => filterUsers();
  document.getElementById('refresh-users').onclick = () => loadUsers();

  document.getElementById('user-role').onchange = (e) => {
    const aidantFields = document.getElementById('aidant-fields');
    aidantFields.classList.toggle('hidden', e.target.value !== 'AIDANT');
  };
}

let allUsers = [];

async function loadUsers() {
  const listDiv = document.getElementById('users-list');
  listDiv.innerHTML = '<div class="text-center py-10">Chargement...</div>';
  
  try {
    allUsers = await secureFetch('/admin-users/users');
    filterUsers();
  } catch (err) {
    listDiv.innerHTML = `<div class="text-center py-10 text-red-500">Erreur: ${err.message}</div>`;
  }
}

function filterUsers() {
  const roleFilter = document.getElementById('filter-role').value;
  const searchTerm = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = [...allUsers];
  
  if (roleFilter) {
    filtered = filtered.filter(u => u.role === roleFilter);
  }
  
  if (searchTerm) {
    filtered = filtered.filter(u => 
      (u.nom?.toLowerCase().includes(searchTerm) || 
       u.email?.toLowerCase().includes(searchTerm) ||
       u.prenom?.toLowerCase().includes(searchTerm))
    );
  }
  
  renderUsers(filtered);
}

function renderUsers(users) {
  const listDiv = document.getElementById('users-list');
  
  if (users.length === 0) {
    listDiv.innerHTML = '<div class="text-center py-20"><p class="text-slate-400">Aucun utilisateur trouvé</p></div>';
    return;
  }
  
  listDiv.innerHTML = users.map(user => `
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl ${getRoleColor(user.role)} text-white flex items-center justify-center text-lg font-black">
            ${user.nom?.charAt(0) || '?'}
          </div>
          <div>
            <p class="font-bold text-slate-800">${user.prenom || ''} ${user.nom || ''}</p>
            <p class="text-[10px] text-slate-400">${user.email}</p>
            <p class="text-[9px] font-bold ${getRoleTextColor(user.role)} mt-0.5">${getRoleLabel(user.role)}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="window.resetUserPassword('${user.id}')" class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center" title="Réinitialiser mot de passe">
            <i class="fa-solid fa-key text-xs"></i>
          </button>
          <button onclick="window.deleteUser('${user.id}', '${user.nom}')" class="w-8 h-8 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center" title="Supprimer">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function getRoleLabel(role) {
  const labels = {
    'COORDINATEUR': '👑 Coordinateur',
    'AIDANT': '🩺 Aidant',
    'FAMILLE': '👨‍👩‍👧 Famille'
  };
  return labels[role] || role;
}

function getRoleColor(role) {
  const colors = {
    'COORDINATEUR': 'bg-purple-600',
    'AIDANT': 'bg-emerald-600',
    'FAMILLE': 'bg-blue-600'
  };
  return colors[role] || 'bg-slate-600';
}

function getRoleTextColor(role) {
  const colors = {
    'COORDINATEUR': 'text-purple-600',
    'AIDANT': 'text-emerald-600',
    'FAMILLE': 'text-blue-600'
  };
  return colors[role] || 'text-slate-600';
}

function openCreateModal() {
  document.getElementById('create-user-modal').classList.remove('hidden');
  document.getElementById('create-user-modal').style.display = 'flex';
  document.getElementById('user-prenom').value = '';
  document.getElementById('user-nom').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-tel').value = '';
  document.getElementById('user-adresse').value = '';
  document.getElementById('user-role').value = 'AIDANT';
  document.getElementById('aidant-fields').classList.remove('hidden');
  document.querySelectorAll('.skill-cb').forEach(cb => cb.checked = false);
  document.getElementById('user-dispo').value = '';
}

function closeCreateModal() {
  document.getElementById('create-user-modal').classList.add('hidden');
  document.getElementById('create-user-modal').style.display = 'none';
}

async function createUser() {
  const prenom = document.getElementById('user-prenom').value.trim();
  const nom = document.getElementById('user-nom').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const telephone = document.getElementById('user-tel').value.trim();
  const adresse = document.getElementById('user-adresse').value.trim();
  const role = document.getElementById('user-role').value;
  
  if (!email || !nom) {
    UI.error('Email et nom sont requis');
    return;
  }
  
  let competences = [];
  let disponibilites = '';
  
  if (role === 'AIDANT') {
    competences = Array.from(document.querySelectorAll('.skill-cb:checked')).map(cb => cb.value);
    disponibilites = document.getElementById('user-dispo').value;
  }
  
  Swal.fire({ title: 'Création...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  
  try {
    await secureFetch('/admin-users/create-user', {
      method: 'POST',
      body: JSON.stringify({ email, nom, prenom, telephone, adresse, role, competences, disponibilites })
    });
    
    Swal.close();
    UI.success(`Compte ${role} créé avec succès ! Un email a été envoyé.`);
    closeCreateModal();
    loadUsers();
  } catch (err) {
    Swal.close();
    UI.error(err.message);
  }
}

window.resetUserPassword = async (userId) => {
  const confirm = await Swal.fire({
    title: 'Réinitialiser le mot de passe ?',
    text: 'Un nouveau mot de passe sera généré et envoyé par email.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'OUI',
    cancelButtonText: 'Annuler'
  });
  
  if (!confirm.isConfirmed) return;
  
  Swal.fire({ title: 'Envoi...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  
  try {
    await secureFetch('/admin-users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    
    Swal.close();
    UI.success('Mot de passe réinitialisé et envoyé par email');
  } catch (err) {
    Swal.close();
    UI.error(err.message);
  }
};

window.deleteUser = async (userId, userName) => {
  const confirm = await Swal.fire({
    title: `Supprimer ${userName} ?`,
    text: 'Cette action est irréversible.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'OUI, SUPPRIMER',
    confirmButtonColor: '#ef4444'
  });
  
  if (!confirm.isConfirmed) return;
  
  Swal.fire({ title: 'Suppression...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  
  try {
    await secureFetch(`/admin-users/user/${userId}`, { method: 'DELETE' });
    Swal.close();
    UI.success('Utilisateur supprimé');
    loadUsers();
  } catch (err) {
    Swal.close();
    UI.error(err.message);
  }
};
