import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";

/**
 * 📚 PAGE CONTENUS ÉDUCATIFS (AVEC VRAIES DONNÉES)
 */
export async function loadEducationPage() {
    const container = document.getElementById("view-container");
    if (!container) return;

    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const userRole = localStorage.getItem("user_role");
    const isSenior = userRole === "FAMILLE" && !isMaman;
    const themeColor = isMaman ? 'pink' : 'emerald';
    const activeTab = window._educationTab || 'videos';

    // 🔥 Si c'est un senior (Famille non Maman), afficher un message personnalisé
    if (isSenior) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
                <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <i class="fa-solid fa-graduation-cap text-3xl text-slate-300"></i>
                </div>
                <h3 class="text-xl font-black text-slate-800">Contenu éducatif</h3>
                <p class="text-sm text-slate-500 mt-2 max-w-xs">
                    Cette section est actuellement dédiée aux mamans et futurs mamans.
                </p>
                <p class="text-xs text-slate-400 mt-4">
                    Des contenus adaptés aux seniors arrivent bientôt !
                </p>
                <button onclick="window.switchView('home')" 
                        class="mt-6 px-6 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                    Retour à l'accueil
                </button>
            </div>
        `;
        return;
    }

    // 🔥 Si ce n'est pas une maman (cas improbable), rediriger
    if (!isMaman) {
        window.switchView('home');
        return;
    }

    // Charger les contenus depuis la BDD
    const contents = await fetchEducationalContents();
    const checklist = await fetchBirthChecklist();

    container.innerHTML = `
        <div class="education-container">
            <div class="flex items-center gap-4 mb-6">
                <button onclick="window.switchView('home')" 
                        class="w-10 h-10 rounded-full bg-white shadow-sm border border-${themeColor}-100 flex items-center justify-center">
                    <i class="fa-solid fa-arrow-left text-${themeColor}-500"></i>
                </button>
                <div>
                    <h3 class="font-black text-xl text-slate-800">Espace Éducation</h3>
                    <p class="text-[10px] text-${themeColor}-500 font-bold uppercase tracking-wider">Pour vous et bébé</p>
                </div>
            </div>

            <!-- Tabs -->
            <div class="flex gap-2 mb-6 bg-white p-1 rounded-2xl border border-${themeColor}-100">
                <button onclick="window.switchEducationTab('videos')" 
                        id="tab-videos" 
                        class="flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'videos' ? `bg-${themeColor}-500 text-white shadow-md` : 'text-slate-400'}">
                    <i class="fa-solid fa-video mr-1"></i> Vidéos
                </button>
                <button onclick="window.switchEducationTab('articles')" 
                        id="tab-articles" 
                        class="flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'articles' ? `bg-${themeColor}-500 text-white shadow-md` : 'text-slate-400'}">
                    <i class="fa-solid fa-newspaper mr-1"></i> Articles
                </button>
                <button onclick="window.switchEducationTab('checklist')" 
                        id="tab-checklist" 
                        class="flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'checklist' ? `bg-${themeColor}-500 text-white shadow-md` : 'text-slate-400'}">
                    <i class="fa-solid fa-list-check mr-1"></i> Checklist
                </button>
            </div>

            <!-- Contenu dynamique -->
            <div id="education-content">
                ${activeTab === 'videos' ? renderVideos(contents.videos) : 
                  activeTab === 'articles' ? renderArticles(contents.articles) : 
                  renderChecklist(checklist, themeColor)}
            </div>
        </div>
    `;

    addEducationStyles();
}

/**
 * 📥 RÉCUPÉRER LES CONTENUS ÉDUCATIFS DEPUIS LA BDD
 */
async function fetchEducationalContents() {
    try {
        const data = await secureFetch("/educational/contents");
        return {
            videos: data.filter(c => c.type === 'video'),
            articles: data.filter(c => c.type === 'article')
        };
    } catch (err) {
        console.error("Erreur chargement contenus:", err);
        return { videos: [], articles: [] };
    }
}

/**
 * ✅ RÉCUPÉRER LA CHECKLIST DEPUIS LA BDD
 */
async function fetchBirthChecklist() {
    try {
        const patientId = AppState.currentPatient;
        if (!patientId) return [];
        
        const data = await secureFetch(`/birth-checklist/${patientId}`);
        return data || [];
    } catch (err) {
        console.error("Erreur chargement checklist:", err);
        return [];
    }
}

/**
 * 🎬 AFFICHER LES VIDÉOS (DEPUIS BDD)
 */
function renderVideos(videos) {
    if (!videos.length) {
        return `<div class="text-center py-16 bg-white rounded-2xl"><p class="text-slate-400">Aucune vidéo disponible</p></div>`;
    }
    
    return `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${videos.map(video => `
                    <div class="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                        <div class="relative">
                            <img src="${video.thumbnail_url || 'https://placehold.co/400x200'}" class="w-full h-40 object-cover" loading="lazy">
                            <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <button onclick="window.playVideo('${video.content}')" 
                                        class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                    <i class="fa-solid fa-play text-${localStorage.getItem('user_is_maman') === 'true' ? 'pink' : 'emerald'}-500 text-lg"></i>
                                </button>
                            </div>
                            <span class="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] px-2 py-0.5 rounded-full">${video.duration || '5:00'}</span>
                        </div>
                        <div class="p-3">
                            <p class="font-bold text-slate-800 text-sm">${video.title}</p>
                            <p class="text-[9px] text-${localStorage.getItem('user_is_maman') === 'true' ? 'pink' : 'emerald'}-500 mt-0.5 uppercase tracking-wider">${video.category}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 📄 AFFICHER LES ARTICLES (DEPUIS BDD)
 */
function renderArticles(articles) {
    if (!articles.length) {
        return `<div class="text-center py-16 bg-white rounded-2xl"><p class="text-slate-400">Aucun article disponible</p></div>`;
    }
    
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    
    return `
        <div class="space-y-3">
            ${articles.map(article => `
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <p class="text-[9px] font-bold text-${themeColor}-500 uppercase tracking-wider mb-1">${article.category}</p>
                            <h4 class="font-bold text-slate-800 text-sm">${article.title}</h4>
                            <p class="text-xs text-slate-500 mt-1 line-clamp-2">${article.description || article.content?.substring(0, 80)}...</p>
                            <div class="flex items-center gap-3 mt-3">
                                <span class="text-[9px] text-slate-400"><i class="fa-regular fa-clock mr-1"></i>${article.read_time || '5'} min</span>
                                <button onclick="window.readArticleFromDB(${JSON.stringify(article).replace(/"/g, '&quot;')})" 
                                        class="text-[9px] font-bold text-${themeColor}-500">Lire l'article →</button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * ✅ AFFICHER LA CHECKLIST (DEPUIS BDD)
 */
function renderChecklist(checklist, themeColor) {
    // Grouper par catégorie
    const mamanItems = checklist.filter(i => i.category === 'maman');
    const bebeItems = checklist.filter(i => i.category === 'bebe');
    const documentsItems = checklist.filter(i => i.category === 'documents');
    
    const total = checklist.length;
    const checked = checklist.filter(i => i.is_checked).length;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    return `
        <div class="space-y-4">
            <!-- Pour Maman -->
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-${themeColor}-100">
                <h4 class="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-female text-${themeColor}-500"></i> Pour Maman
                </h4>
                <div class="space-y-2" id="checklist-maman">
                    ${mamanItems.map(item => `
                        <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" class="checklist-item w-5 h-5 accent-${themeColor}-500" 
                                   data-id="${item.id}" ${item.is_checked ? 'checked' : ''}>
                            <span class="text-sm text-slate-700 ${item.is_checked ? 'line-through text-slate-400' : ''}">${item.item_text}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <!-- Pour Bébé -->
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-${themeColor}-100">
                <h4 class="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-baby text-${themeColor}-500"></i> Pour Bébé
                </h4>
                <div class="space-y-2" id="checklist-bebe">
                    ${bebeItems.map(item => `
                        <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" class="checklist-item w-5 h-5 accent-${themeColor}-500" 
                                   data-id="${item.id}" ${item.is_checked ? 'checked' : ''}>
                            <span class="text-sm text-slate-700 ${item.is_checked ? 'line-through text-slate-400' : ''}">${item.item_text}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <!-- Documents -->
            <div class="bg-white rounded-2xl p-4 shadow-sm border border-${themeColor}-100">
                <h4 class="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-folder-open text-${themeColor}-500"></i> Documents Importants
                </h4>
                <div class="space-y-2" id="checklist-documents">
                    ${documentsItems.map(item => `
                        <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" class="checklist-item w-5 h-5 accent-${themeColor}-500" 
                                   data-id="${item.id}" ${item.is_checked ? 'checked' : ''}>
                            <span class="text-sm text-slate-700 ${item.is_checked ? 'line-through text-slate-400' : ''}">${item.item_text}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <!-- Progression -->
            <div class="bg-${themeColor}-50 rounded-2xl p-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-${themeColor}-600">Progression</span>
                    <span id="checklist-progress" class="text-xs font-bold text-${themeColor}-600">${percent}%</span>
                </div>
                <div class="w-full bg-white rounded-full h-2">
                    <div id="checklist-progress-bar" class="bg-${themeColor}-500 h-2 rounded-full transition-all" style="width: ${percent}%"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 💾 SAUVEGARDER L'ÉTAT DE LA CHECKLIST EN BDD
 */
async function saveChecklistItem(itemId, isChecked) {
    try {
        const patientId = AppState.currentPatient;
        await secureFetch("/birth-checklist/update", {
            method: "POST",
            body: JSON.stringify({
                patient_id: patientId,
                item_id: itemId,
                is_checked: isChecked
            })
        });
    } catch (err) {
        console.error("Erreur sauvegarde checklist:", err);
    }
}

/**
 * 🎬 JOUER UNE VIDÉO
 */
window.playVideo = (url) => {
    Swal.fire({
        title: "Lecture vidéo",
        html: `
            <div class="relative" style="padding-bottom: 56.25%; height: 0;">
                <iframe src="${url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-2xl w-full max-w-2xl' }
    });
};

/**
 * 📖 LIRE UN ARTICLE DEPUIS BDD
 */
window.readArticleFromDB = (article) => {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    
    Swal.fire({
        title: `<span class="text-lg font-black text-slate-800">${article.title}</span>`,
        html: `
            <div class="text-left">
                <p class="text-[10px] text-${themeColor}-500 mb-3">${article.category} • ${article.read_time || '5'} min</p>
                <p class="text-sm text-slate-600 leading-relaxed">${article.content || article.description}</p>
                <div class="mt-4 p-3 bg-${themeColor}-50 rounded-xl">
                    <p class="text-xs font-medium text-slate-600">💡 À retenir :</p>
                    <p class="text-xs text-slate-500 mt-1">Cet article vous a été utile ? Partagez-le avec d'autres mamans !</p>
                </div>
            </div>
        `,
        confirmButtonText: "Fermer",
        confirmButtonColor: isMaman ? '#DB2777' : '#10B981',
        customClass: { popup: 'rounded-2xl' }
    });
};

/**
 * 🔄 CHANGER D'ONGLET
 */
window.switchEducationTab = (tab) => {
    window._educationTab = tab;
    loadEducationPage();
    localStorage.setItem('education_last_tab', tab);
};

/**
 * 🎨 AJOUTER LES STYLES
 */
function addEducationStyles() {
    if (document.getElementById('education-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'education-styles';
    style.textContent = `
        .education-container {
            padding: 20px;
            background: #F8FAFC;
            min-height: 100%;
        }
        .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
}

// Initialiser les événements de checklist
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('checklist-item')) {
        const itemId = e.target.dataset.id;
        const isChecked = e.target.checked;
        await saveChecklistItem(itemId, isChecked);
        
        // Mettre à jour l'apparence
        const span = e.target.nextElementSibling;
        if (span) {
            if (isChecked) {
                span.classList.add('line-through', 'text-slate-400');
            } else {
                span.classList.remove('line-through', 'text-slate-400');
            }
        }
        
        // Recharger pour mettre à jour la progression
        setTimeout(() => loadEducationPage(), 100);
    }
});


