import { secureFetch } from "../core/api.js";
import { UI, compressImage } from "../core/utils.js";
import ImageUploader from '../core/imageUploader.js';


/**
 * 📱 PAGE PROFIL UTILISATEUR
 */

export async function renderProfilePage() {
    const container = document.getElementById("view-container");
    const userRole = localStorage.getItem("user_role");
    const userId = localStorage.getItem("user_id");
    const userName = localStorage.getItem("user_name");
    const userEmail = localStorage.getItem("user_email");
    const userPhoto = localStorage.getItem("user_photo");
    
    // Récupérer les infos complètes depuis le backend
    let profile = null;
    let patient = null;
    
    try {
        const profileRes = await secureFetch(`/auth/profile/${userId}`);
        profile = profileRes;
        
        if (userRole === "FAMILLE") {
            const patients = await secureFetch("/patients");
            if (patients && patients.length > 0) {
                patient = patients[0];
            }
        }
    } catch (e) {
        console.error("Erreur chargement profil:", e);
    }
    
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    const themeBgClass = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
    const themeTextClass = isMaman ? 'text-pink-600' : 'text-emerald-600';
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <!-- Header -->
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('home')" 
                        class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-95">
                    <i class="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">Mon Profil</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gérez vos informations personnelles</p>
                </div>
            </div>
            
            <!-- Photo de profil -->
            <div class="flex flex-col items-center mb-8">
                <div class="relative">
                    <div id="profile-photo-container" 
                         class="w-32 h-32 rounded-2xl ${themeBgClass} border-4 border-white shadow-xl flex items-center justify-center cursor-pointer overflow-hidden"
                         onclick="document.getElementById('profile-photo-input').click()">
                        ${userPhoto ? 
                            `<img src="${userPhoto}" class="w-full h-full object-cover">` : 
                            `<i class="fa-solid fa-camera text-4xl ${themeTextClass}"></i>`
                        }
                    </div>
                    <button onclick="document.getElementById('profile-photo-input').click()" 
                            class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <input type="file" id="profile-photo-input" accept="image/*" class="hidden" onchange="window.updateProfilePhoto(this.files[0])">
                </div>
                <h2 class="text-xl font-black text-slate-800 mt-4">${escapeHtml(profile?.prenom || '')} ${escapeHtml(profile?.nom || userName)}</h2>
                <p class="text-xs font-bold ${themeTextClass} uppercase tracking-wider mt-1">${userRole}</p>
            </div>
            
            <!-- UN SEUL BLOC - Informations personnelles enrichies -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-100">
                    <h4 class="font-black text-slate-800">Informations personnelles</h4>
                    <p class="text-[10px] text-slate-400 mt-1">Modifiez vos informations ci-dessous</p>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Prénom</label>
                            <input type="text" id="profile-prenom" value="${escapeHtml(profile?.prenom || '')}" 
                                   class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Nom</label>
                            <input type="text" id="profile-nom" value="${escapeHtml(profile?.nom || userName)}" 
                                   class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Email</label>
                        <input type="email" id="profile-email" value="${escapeHtml(profile?.email || userEmail)}" 
                               class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Téléphone</label>
                        <input type="tel" id="profile-telephone" value="${escapeHtml(profile?.telephone || '')}" 
                               class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                               placeholder="+229 XX XXX XXX">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Adresse</label>
                        <input type="text" id="profile-adresse" value="${escapeHtml(profile?.adresse || '')}" 
                               class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                               placeholder="Votre adresse complète">
                    </div>
                    
                    <button onclick="window.updateProfileFull()" 
                            class="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-save mr-2"></i> Enregistrer les modifications
                    </button>
                </div>
            </div>
            
            ${userRole === "FAMILLE" && patient ? `
            <!-- Section Patient enrichie -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
                <div class="p-6 border-b border-slate-100">
                    <h4 class="font-black text-slate-800">Dossier de votre proche</h4>
                    <p class="text-[10px] text-slate-400 mt-1">Informations personnelles et médicales</p>
                </div>
                
                <div class="p-6 space-y-4">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="relative">
                            <div id="patient-photo-container" 
                                 class="w-16 h-16 rounded-xl ${themeBgClass} border-2 border-white shadow-md flex items-center justify-center cursor-pointer overflow-hidden"
                                 onclick="document.getElementById('patient-photo-input').click()">
                                ${patient?.photo_url ? 
                                    `<img src="${patient.photo_url}" class="w-full h-full object-cover">` : 
                                    `<i class="fa-solid fa-user text-2xl ${themeTextClass}"></i>`
                                }
                            </div>
                            <button onclick="document.getElementById('patient-photo-input').click()" 
                                    class="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg">
                                <i class="fa-solid fa-pen text-[8px]"></i>
                            </button>
                            <input type="file" id="patient-photo-input" accept="image/*" class="hidden" onchange="window.updatePatientPhoto(this.files[0])">
                        </div>
                        <div>
                            <p class="font-black text-slate-800">${escapeHtml(patient.prenom || '')} ${escapeHtml(patient.nom || '')}</p>
                            <p class="text-[10px] text-slate-400">${patient.formule || 'Standard'}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Prénom</label>
                            <input type="text" id="patient-prenom" value="${escapeHtml(patient.prenom || '')}" 
                                   class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Nom</label>
                            <input type="text" id="patient-nom" value="${escapeHtml(patient.nom || '')}" 
                                   class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Âge</label>
                            <input type="number" id="patient-age" value="${patient.age || ''}" 
                                   class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Sexe</label>
                            <select id="patient-sexe" class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                                <option value="">Sélectionner</option>
                                <option value="Homme" ${patient.sexe === 'Homme' ? 'selected' : ''}>Homme</option>
                                <option value="Femme" ${patient.sexe === 'Femme' ? 'selected' : ''}>Femme</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Téléphone</label>
                        <input type="tel" id="patient-tel" value="${escapeHtml(patient.telephone || '')}" 
                               class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Adresse</label>
                        <input type="text" id="patient-adresse" value="${escapeHtml(patient.adresse || '')}" 
                               class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Contact urgence</label>
                        <input type="text" id="patient-urgence" value="${escapeHtml(patient.contact_urgence || '')}" 
                               class="w-full p-3 bg-slate-50 rounded-xl text-sm">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Traitements en cours</label>
                        <textarea id="patient-traitements" rows="2" 
                                  class="w-full p-3 bg-slate-50 rounded-xl text-sm"
                                  placeholder="Médicaments, posologies...">${escapeHtml(patient.traitements || '')}</textarea>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Allergies</label>
                        <textarea id="patient-allergies" rows="2" 
                                  class="w-full p-3 bg-slate-50 rounded-xl text-sm"
                                  placeholder="Médicaments, aliments...">${escapeHtml(patient.allergies || '')}</textarea>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Notes médicales</label>
                        <textarea id="patient-notes" rows="3" 
                                  class="w-full p-3 bg-slate-50 rounded-xl text-sm"
                                  placeholder="Mobilité, précautions...">${escapeHtml(patient.notes_medicales || '')}</textarea>
                    </div>
                    
                    <button onclick="window.updatePatientFullInfo()" 
                            class="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-save mr-2"></i> Enregistrer toutes les infos
                    </button>
                </div>
            </div>
            ` : ''}
            
            ${userRole === "AIDANT" ? `
            <!-- Section Aidant enrichie -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
                <div class="p-6 border-b border-slate-100">
                    <h4 class="font-black text-slate-800">Informations professionnelles</h4>
                    <p class="text-[10px] text-slate-400 mt-1">Compétences et disponibilités</p>
                </div>
                
                <div class="p-6 space-y-4">
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Adresse</label>
                        <input type="text" id="aidant-adresse" value="${escapeHtml(profile?.adresse || '')}" 
                               class="w-full p-3 bg-slate-50 rounded-xl text-sm"
                               placeholder="Votre adresse">
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Compétences</label>
                        <div class="flex flex-wrap gap-2">
                            ${['Soins de base', 'Aide à la mobilité', 'Préparation repas', 'Accompagnement', 'Premiers secours'].map(skill => `
                                <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs">
                                    <input type="checkbox" class="skill-check" value="${skill}" ${profile?.competences?.includes(skill) ? 'checked' : ''}>
                                    ${skill}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Disponibilités</label>
                        <textarea id="aidant-disponibilites" rows="2" 
                                  class="w-full p-3 bg-slate-50 rounded-xl text-sm"
                                  placeholder="Lundis et mercredis après-midi, week-ends...">${escapeHtml(profile?.disponibilites || '')}</textarea>
                    </div>
                    
                    <button onclick="window.updateAidantFullInfo()" 
                            class="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-md active:scale-95 transition-all">
                        <i class="fa-solid fa-save mr-2"></i> Enregistrer
                    </button>
                </div>
            </div>
            ` : ''}
            
            <!-- Statistiques -->
            <div class="bg-slate-50 rounded-2xl p-6 mt-6">
                <h4 class="font-black text-slate-800 mb-4">Statistiques</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div class="text-center">
                        <p class="text-2xl font-black text-emerald-600" id="stat-missions">0</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${userRole === 'AIDANT' ? 'Missions' : 'Visites'}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-black text-emerald-600" id="stat-rating">0</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fiabilité</p>
                    </div>
                </div>
            </div>
            
            <!-- Bouton déconnexion -->
            <button onclick="window.logout()" class="w-full mt-6 py-4 bg-rose-50 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-wider active:scale-95 transition-all">
                <i class="fa-solid fa-power-off mr-2"></i> Déconnexion
            </button>
        </div>
    `;
    
    loadUserStats(userRole, userId);
}

/**
 * 💾 Mettre à jour le profil complet (avec prénom, nom, adresse)
 */
window.updateProfileFull = async () => {
    const prenom = document.getElementById("profile-prenom")?.value;
    const nom = document.getElementById("profile-nom")?.value;
    const email = document.getElementById("profile-email")?.value;
    const telephone = document.getElementById("profile-telephone")?.value;
    const adresse = document.getElementById("profile-adresse")?.value;
    
    Swal.fire({ 
        title: "Mise à jour...", 
        didOpen: () => Swal.showLoading(), 
        allowOutsideClick: false 
    });
    
    try {
        const response = await secureFetch("/auth/update-profile-full", {
            method: "PUT",
            body: JSON.stringify({ prenom, nom, email, telephone, adresse })
        });
        
        if (response.status === "success") {
            // ✅ 1. Mettre à jour le localStorage
            const nomComplet = `${prenom || ''} ${nom || ''}`.trim();
            localStorage.setItem("user_name", nomComplet);
            localStorage.setItem("user_email", email);
            
            // ✅ 2. Mettre à jour l'affichage DANS LA PAGE PROFIL
            // Le nom dans l'en-tête de la page profil
            const profileName = document.querySelector("#view-container h2.text-xl.font-black");
            if (profileName) profileName.textContent = nomComplet;
            
            // ✅ 3. Mettre à jour le header (en haut)
            const headerName = document.querySelector("header .font-black.truncate");
            if (headerName) headerName.textContent = nomComplet;
            
            const headerSmallName = document.querySelector("header .text-xs.font-black");
            if (headerSmallName) headerSmallName.textContent = nomComplet.split(' ')[0];
            
            // ✅ 4. Mettre à jour la sidebar
            const sidebarName = document.querySelector("aside .text-xs.font-black.truncate");
            if (sidebarName) sidebarName.textContent = nomComplet;
            
            // ✅ 5. Recharger les données du profil depuis le serveur
            // Pour être sûr d'avoir les dernières infos
            const userId = localStorage.getItem("user_id");
            const freshProfile = await secureFetch(`/auth/profile/${userId}`);
            
            // Mettre à jour les champs du formulaire avec les nouvelles valeurs
            if (freshProfile) {
                if (document.getElementById("profile-prenom")) 
                    document.getElementById("profile-prenom").value = freshProfile.prenom || '';
                if (document.getElementById("profile-nom")) 
                    document.getElementById("profile-nom").value = freshProfile.nom || '';
                if (document.getElementById("profile-email")) 
                    document.getElementById("profile-email").value = freshProfile.email || '';
                if (document.getElementById("profile-telephone")) 
                    document.getElementById("profile-telephone").value = freshProfile.telephone || '';
                if (document.getElementById("profile-adresse")) 
                    document.getElementById("profile-adresse").value = freshProfile.adresse || '';
            }
            
            Swal.fire({
                icon: "success",
                title: "Profil mis à jour",
                timer: 1500,
                showConfirmButton: false
            });
        }
        
    } catch (err) {
        Swal.close();
        UI.error(err.message);
    }
};

/**
 * 💾 Mettre à jour toutes les infos du patient
 */
window.updatePatientFullInfo = async () => {
    const data = {
        prenom: document.getElementById("patient-prenom")?.value,
        nom: document.getElementById("patient-nom")?.value,
        age: document.getElementById("patient-age")?.value,
        sexe: document.getElementById("patient-sexe")?.value,
        telephone: document.getElementById("patient-tel")?.value,
        adresse: document.getElementById("patient-adresse")?.value,
        contact_urgence: document.getElementById("patient-urgence")?.value,
        traitements: document.getElementById("patient-traitements")?.value,
        allergies: document.getElementById("patient-allergies")?.value,
        notes_medicales: document.getElementById("patient-notes")?.value
    };
    
    Swal.fire({ 
        title: "Mise à jour...", 
        didOpen: () => Swal.showLoading(), 
        allowOutsideClick: false 
    });
    
    try {
        const response = await secureFetch("/patients/update-full-info", {
            method: "PUT",
            body: JSON.stringify(data)
        });
        
        if (response.status === "success") {
            Swal.fire({
                icon: "success",
                title: "Informations patient mises à jour",
                text: "Les modifications ont été enregistrées",
                timer: 2000,
                showConfirmButton: false
            });
            
            // ✅ Ne pas recharger la page
            // window.location.reload(); ← SUPPRIME ou COMMENTE
        }
        
    } catch (err) {
        Swal.close();
        UI.error(err.message);
    }
};

/**
 * 💾 Mettre à jour toutes les infos aidant
 */
window.updateAidantFullInfo = async () => {
    const competences = Array.from(document.querySelectorAll('.skill-check:checked')).map(cb => cb.value);
    const disponibilites = document.getElementById("aidant-disponibilites")?.value;
    const adresse = document.getElementById("aidant-adresse")?.value;
    
    Swal.fire({ title: "Mise à jour...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        await secureFetch("/auth/update-aidant-full-info", {
            method: "PUT",
            body: JSON.stringify({ competences, disponibilites, adresse })
        });
        
        UI.success("Informations professionnelles mises à jour");
        Swal.close();
    } catch (err) {
        UI.error(err.message);
    }
};

/**
 * 📊 Charger les statistiques utilisateur
 */
async function loadUserStats(role, userId) {
    try {
        if (role === "AIDANT") {
            const stats = await secureFetch(`/aidants/stats/${userId}`);
            document.getElementById("stat-missions").innerText = stats.total_visites || 0;
            document.getElementById("stat-rating").innerText = `${stats.taux_validation || 0}%`;
        } else {
            const visits = await secureFetch("/visites");
            document.getElementById("stat-missions").innerText = visits?.length || 0;
            document.getElementById("stat-rating").innerText = "100%";
        }
    } catch (e) {
        console.error("Erreur chargement stats:", e);
    }
}

/**
 * 📸 Mettre à jour la photo de profil
 */
window.updateProfilePhoto = async (file) => {
    if (!file) return;
    
    Swal.fire({ 
        title: "Upload...", 
        didOpen: () => Swal.showLoading(), 
        allowOutsideClick: false 
    });
    
    try {
        const result = await ImageUploader.upload(file, '/auth/update-photo', 'photo');
        
        if (result && result.photo_url) {
            const imageUrl = `${result.photo_url}?t=${Date.now()}`;
            
            // ✅ Mettre à jour l'affichage dans la page profil
            const container = document.getElementById("profile-photo-container");
            if (container) {
                container.innerHTML = `<img src="${imageUrl}" class="w-full h-full object-cover">`;
            }
            
            // ✅ Mettre à jour le localStorage
            localStorage.setItem("user_photo", result.photo_url);
            
            // ✅ Mettre à jour le header (photo)
            const headerAvatar = document.querySelector("header .rounded-xl img");
            if (headerAvatar) headerAvatar.src = imageUrl;
            
            // ✅ Mettre à jour la sidebar (photo)
            const sidebarAvatar = document.querySelector("aside .rounded-full img");
            if (sidebarAvatar) sidebarAvatar.src = imageUrl;
            
            // ✅ Mettre à jour le footer mobile (photo)
            const mobileAvatar = document.querySelector("footer .rounded-full img");
            if (mobileAvatar) mobileAvatar.src = imageUrl;
            
            Swal.fire({
                icon: "success",
                title: "Photo mise à jour",
                timer: 1500,
                showConfirmButton: false
            });
        }
    } catch (err) {
        UI.error(err.message);
    } finally {
        Swal.close();
    }
};
/**
 * 📸 Mettre à jour la photo du patient
 */
window.updatePatientPhoto = async (file) => {
    if (!file) return;
    
    // Compression de l'image avant envoi
    const maxSize = 500 * 1024; // 500KB
    
    let fileToUpload = file;
    if (file.size > maxSize) {
        Swal.fire({ title: "Compression...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        try {
            fileToUpload = await compressImage(file, 800, 0.7);
        } catch (err) {
            Swal.close();
            UI.error("Impossible de compresser l'image");
            return;
        }
        Swal.close();
    }
    
    if (fileToUpload.size > maxSize) {
        UI.error("L'image est trop lourde (max 500KB)");
        return;
    }
    
    Swal.fire({ title: "Upload...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        const formData = new FormData();
        formData.append("photo", fileToUpload);
        
        // Récupérer l'ID du patient
        let patientId = null;
        const patients = await secureFetch('/patients');
        if (patients && patients.length > 0) {
            patientId = patients[0].id;
        }
        
        if (patientId) {
            formData.append("patient_id", patientId);
        }
        
        // ✅ Utiliser fetch au lieu de secureFetch pour FormData
        const response = await fetch(`${CONFIG.API_URL}/patients/update-photo`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
                // ⚠️ NE PAS mettre Content-Type, laisser le navigateur le gérer
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erreur lors de l'upload");
        }
        
        const result = await response.json();
        
        if (result.photo_url) {
            const container = document.getElementById("patient-photo-container");
            if (container) {
                container.innerHTML = `<img src="${result.photo_url}?t=${Date.now()}" class="w-full h-full object-cover">`;
            }
            UI.success("Photo mise à jour");
        }
        Swal.close();
    } catch (err) {
        Swal.close();
        console.error("❌ Erreur:", err);
        UI.error(err.message || "Erreur lors de l'upload");
    }
};
/**
 * 💾 Mettre à jour le profil
 */
window.updateProfile = async () => {
    const nom = document.getElementById("profile-nom")?.value;
    const email = document.getElementById("profile-email")?.value;
    const telephone = document.getElementById("profile-telephone")?.value;
    
    Swal.fire({ title: "Mise à jour...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        await secureFetch("/auth/update-profile", {
            method: "PUT",
            body: JSON.stringify({ nom, email, telephone })
        });
        
        localStorage.setItem("user_name", nom);
        UI.success("Profil mis à jour");
        Swal.close();
    } catch (err) {
        UI.error(err.message);
    }
};

/**
 * 💾 Mettre à jour les infos du patient
 */
window.updatePatientInfo = async () => {
    const adresse = document.getElementById("patient-adresse")?.value;
    const notes_medicales = document.getElementById("patient-notes")?.value;
    
    Swal.fire({ title: "Mise à jour...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        await secureFetch("/patients/update-info", {
            method: "PUT",
            body: JSON.stringify({ adresse, notes_medicales })
        });
        
        UI.success("Informations patient mises à jour");
        Swal.close();
    } catch (err) {
        UI.error(err.message);
    }
};

/**
 * 💾 Mettre à jour les infos aidant
 */
window.updateAidantInfo = async () => {
    const competences = Array.from(document.querySelectorAll('.skill-check:checked')).map(cb => cb.value);
    const disponibilites = document.getElementById("aidant-disponibilites")?.value;
    
    Swal.fire({ title: "Mise à jour...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        await secureFetch("/auth/update-aidant-info", {
            method: "PUT",
            body: JSON.stringify({ competences, disponibilites })
        });
        
        UI.success("Informations professionnelles mises à jour");
        Swal.close();
    } catch (err) {
        UI.error(err.message);
    }
};

/**
 * 🔧 Échapper les caractères HTML
 */
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
 * Rafraîchit toutes les zones qui affichent le nom/photo de l'utilisateur
 */
function refreshUserDisplay() {
    const userName = localStorage.getItem("user_name");
    const userPhoto = localStorage.getItem("user_photo");
    const userEmail = localStorage.getItem("user_email");
    
    // Header
    const headerName = document.querySelector("header .font-black.truncate");
    if (headerName) headerName.textContent = userName;
    
    const headerSmall = document.querySelector("header .text-xs.font-black");
    if (headerSmall) headerSmall.textContent = userName?.split(' ')[0] || 'Profil';
    
    const headerAvatar = document.querySelector("header .rounded-xl img");
    if (headerAvatar && userPhoto) headerAvatar.src = `${userPhoto}?t=${Date.now()}`;
    
    // Sidebar
    const sidebarName = document.querySelector("aside .text-xs.font-black.truncate");
    if (sidebarName) sidebarName.textContent = userName;
    
    const sidebarAvatar = document.querySelector("aside .rounded-full img");
    if (sidebarAvatar && userPhoto) sidebarAvatar.src = `${userPhoto}?t=${Date.now()}`;
    
    // Footer mobile
    const mobileAvatar = document.querySelector("footer .rounded-full img");
    if (mobileAvatar && userPhoto) mobileAvatar.src = `${userPhoto}?t=${Date.now()}`;
}
