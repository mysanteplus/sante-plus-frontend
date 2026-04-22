import { secureFetch } from "../core/api.js";
import { UI, showSkeleton } from "../core/utils.js";

/**
 * 📋 CHARGER LA LISTE DES COLLABORATEURS
 */
export async function loadAidants() {
    const container = document.getElementById('view-container');
    const userRole = localStorage.getItem('user_role');

    container.innerHTML = `
        <div class="flex justify-between items-center mb-8 animate-fadeIn">
            <div>
                <h3 class="font-black text-2xl text-slate-800 tracking-tight">Équipe & RH</h3>
                <p class="text-xs text-slate-400 font-bold uppercase mt-1">Gestion des collaborateurs</p>
            </div>
            ${userRole === 'COORDINATEUR' ? `
                <button onclick="window.switchView('add-aidant')" class="w-12 h-12 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center">
                    <i class="fa-solid fa-user-plus text-lg"></i>
                </button>
            ` : ''}
        </div>
        <div id="aidants-list" class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24"></div>
    `;

    const list = document.getElementById('aidants-list');
    showSkeleton(list, 'aidant-card');

    try {
        // ✅ CORRECTION : secureFetch retourne déjà les données
        let members = await secureFetch('/auth/profiles?role=AIDANT');
        
        const coords = await secureFetch('/auth/profiles?role=COORDINATEUR');
        members = [...coords, ...members];

        if (members.length === 0) {
            list.innerHTML = `<div class="col-span-full p-10 text-center bg-white rounded-2xl border border-slate-100 shadow-sm"><p class="text-xs font-bold text-slate-400 uppercase">Aucun membre trouvé.</p></div>`;
            return;
        }

        const cards = await Promise.all(members.map(async (m) => {
            let statsHtml = '';
            
            if (m.role === 'AIDANT') {
                try {
                    const stats = await secureFetch(`/aidants/stats/${m.id}`);
                    statsHtml = `
                        <div class="flex items-center gap-3 mt-5 pt-5 border-t border-slate-50">
                            <span class="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 uppercase tracking-widest">${stats.total_visites || 0} Visites</span>
                            <span class="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 uppercase tracking-widest">${stats.taux_validation || 0}% Fiabilité</span>
                        </div>
                    `;
                } catch(e) {
                    console.warn(`Erreur chargement stats pour ${m.nom}:`, e);
                }
            }

            return `
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow group animate-fadeIn">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-xl bg-gradient-to-br ${m.role === 'COORDINATEUR' ? 'from-slate-800 to-slate-900' : 'from-blue-500 to-cyan-400'} flex items-center justify-center text-white font-black text-xl shadow-lg">
                                ${m.nom?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 text-sm uppercase leading-none">${m.nom || 'Inconnu'}</h4>
                                <p class="text-[9px] font-black ${m.role === 'COORDINATEUR' ? 'text-slate-400' : 'text-blue-500'} uppercase tracking-[0.2em] mt-1.5">${m.role || 'AIDANT'}</p>
                            </div>
                        </div>
                        ${m.telephone ? `
                            <a href="tel:${m.telephone}" class="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 hover:bg-green-500 hover:text-white transition-colors shadow-sm">
                                <i class="fa-solid fa-phone text-xs"></i>
                            </a>
                        ` : `
                            <div class="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100">
                                <i class="fa-solid fa-phone text-xs"></i>
                            </div>
                        `}
                    </div>
                    ${statsHtml}
                </div>
            `;
        }));

        list.innerHTML = cards.join('');
    } catch (err) {
        console.error("Erreur chargement aidants:", err);
        list.innerHTML = `<p class="text-rose-500 text-center col-span-full p-10">Erreur de chargement</p>`;
    }
}

export async function renderAddAidantView() {
    const container = document.getElementById("view-container");
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('aidants')" class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors active:scale-95">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">Nouveau Collaborateur</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Création d'un compte aidant</p>
                </div>
            </div>

            <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div class="space-y-4">
                    <!-- Identité -->
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Prénom</label>
                            <input id="reg-prenom" class="app-input !py-3 !text-sm" placeholder="Prénom">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Nom</label>
                            <input id="reg-nom" class="app-input !py-3 !text-sm" placeholder="Nom">
                        </div>
                    </div>

                    <!-- Contact -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Email professionnel</label>
                        <div class="relative">
                            <i class="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="reg-email" type="email" class="app-input !pl-11 !py-3" placeholder="aidant@santeplus.bj">
                        </div>
                    </div>

                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Téléphone</label>
                        <div class="relative">
                            <i class="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="reg-tel" class="app-input !pl-11 !py-3" placeholder="+229 XX XXX XXX">
                        </div>
                    </div>

                    <!-- Adresse -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Adresse</label>
                        <div class="relative">
                            <i class="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="reg-adresse" class="app-input !pl-11 !py-3" placeholder="Quartier, ville...">
                        </div>
                    </div>

                    <!-- Compétences -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Compétences</label>
                        <div class="flex flex-wrap gap-2">
                            <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="skill-check" value="Soins de base"> Soins de base</label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="skill-check" value="Aide à la mobilité"> Aide mobilité</label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="skill-check" value="Préparation repas"> Préparation repas</label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="skill-check" value="Accompagnement"> Accompagnement</label>
                            <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="skill-check" value="Premiers secours"> Premiers secours</label>
                        </div>
                    </div>

                    <!-- Disponibilités -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Disponibilités</label>
                        <textarea id="reg-dispo" rows="2" class="app-input !py-3 !text-sm" placeholder="Ex: Lundis et mercredis après-midi, week-ends..."></textarea>
                    </div>

                    <!-- Mot de passe -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Mot de passe temporaire</label>
                        <div class="relative">
                            <i class="fa-solid fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
                            <input id="reg-pass" type="text" class="app-input !pl-11 !py-3 font-mono" placeholder="Mot de passe" value="SPS-${Math.floor(1000 + Math.random() * 9000)}!">
                        </div>
                    </div>

                    <!-- Rôle -->
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-2 mb-2 block">Rôle</label>
                        <select id="reg-role" class="app-input font-bold text-slate-800 cursor-pointer">
                            <option value="AIDANT">Aidant Terrain</option>
                            <option value="COORDINATEUR">Coordinateur</option>
                        </select>
                    </div>

                    <button id="submit-aidant-btn" class="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 mt-4">
                        <i class="fa-solid fa-user-plus"></i> Créer le collaborateur
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById("submit-aidant-btn").onclick = () => submitAddAidant();
}

export async function submitAddAidant() {
    const prenom = document.getElementById('reg-prenom')?.value;
    const nom = document.getElementById('reg-nom')?.value;
    const nomComplet = `${prenom} ${nom}`.trim();
    const email = document.getElementById('reg-email')?.value;
    const pass = document.getElementById('reg-pass')?.value;
    const tel = document.getElementById('reg-tel')?.value;
    const adresse = document.getElementById('reg-adresse')?.value;
    const role = document.getElementById('reg-role')?.value;
    const competences = Array.from(document.querySelectorAll('.skill-check:checked')).map(cb => cb.value);
    const disponibilites = document.getElementById('reg-dispo')?.value;

    if (!nomComplet || !email || !pass) {
        UI.vibrate('error');
        return Swal.fire({ title: "Champs manquants", text: "Nom, email et mot de passe sont requis", icon: "warning" });
    }

    Swal.fire({ title: 'Création...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        await secureFetch('/auth/create-member', {
            method: 'POST',
            body: JSON.stringify({ 
                nom: nomComplet, 
                email, 
                telephone: tel, 
                adresse,
                competences,
                disponibilites,
                password: pass, 
                role 
            })
        });
        
        UI.success("Collaborateur créé");
        Swal.fire({ icon: "success", title: "Succès", text: "Le collaborateur a été créé.", confirmButtonColor: "#10B981" });
        window.switchView("aidants");
    } catch (err) {
        UI.error(err.message);
    }
}
