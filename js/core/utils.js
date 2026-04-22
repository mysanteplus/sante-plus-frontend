
/**
 * Utilitaires partagés Santé Plus Services
 */

export const UI = {
    vibrate: (type = "success") => {
        haptic(type === "error" ? "error" : "success");
    },
    toast: showToast,
    success: showSuccessToast,
    error: showErrorToast,
    warning: showWarningToast,
    info: showInfoToast,
    formatDate: (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    },
    formatMoney: (amount) => {
        return new Intl.NumberFormat("fr-FR").format(amount) + " CFA";
    },
    getInitials: (name) => {
        return name
            ? name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)
            : "??";
    },
};

// Compression d'image avant envoi au serveur 
/**
 * 🖼️ COMPRESSION D'IMAGE AVANT UPLOAD
 * @param {File} file - Fichier image
 * @param {number} maxWidth - Largeur max (défaut: 1024)
 * @param {number} quality - Qualité JPEG (0.1 à 1, défaut: 0.7)
 * @returns {Promise<Blob>} Image compressée
 */
export async function compressImage(file, maxWidth = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
        // Si c'est déjà une image compressée ou trop petite, on garde
        if (file.size < 500 * 1024) { // moins de 500KB
            resolve(file);
            return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                
                // Redimensionner proportionnellement
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compression adaptative selon la taille
                let finalQuality = quality;
                const originalSizeMB = file.size / (1024 * 1024);
                if (originalSizeMB > 5) finalQuality = 0.5;
                if (originalSizeMB > 10) finalQuality = 0.4;
                
                canvas.toBlob(
                    (blob) => {
                        console.log(`📸 Compression: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB (${Math.round((1 - blob.size/file.size) * 100)}% gain)`);
                        resolve(blob);
                    },
                    "image/jpeg",
                    finalQuality
                );
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

/**
 * 🖼️ COMPRESSION D'IMAGE DEPUIS UNE URL (pour les téléchargements)
 */
export async function compressImageFromUrl(url, maxWidth = 1024, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
                (blob) => resolve(blob),
                "image/jpeg",
                quality
            );
        };
        img.onerror = reject;
    });
}
/**
 * 📦 Cache simplifié (plus léger)
 */
const apiCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes au lieu de 5

export async function cachedFetch(url, options = {}, ttl = CACHE_DURATION) {
    const cacheKey = url;
    const cached = apiCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
    }
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        // Ne pas cacher les grosses réponses
        if (JSON.stringify(data).length < 50000) { // Moins de 50KB
            apiCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
        }
        
        return data;
    } catch (err) {
        if (cached) return cached.data;
        throw err;
    }
}


/**
 * 🎨 MODALE DE SÉLECTION MODERNE (remplace select)
 * @param {Array} items - Liste d'objets {id, name, extra?}
 * @param {string} title - Titre de la modale
 * @param {string} placeholder - Texte de recherche
 * @returns {Promise<Object>} - Élément sélectionné
 */
export async function openModernSelector(items, title, placeholder = "Rechercher...") {
    return new Promise(async (resolve) => {
        let searchTerm = '';
        let filteredItems = [...items];
        
        const renderList = () => {
            const filtered = items.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            
            if (filtered.length === 0) {
                return `<div class="text-center py-8 text-slate-400 text-xs">Aucun résultat</div>`;
            }
            
            return filtered.map(item => `
                <div class="selector-item p-4 border-b border-slate-50 active:bg-slate-50 transition-colors cursor-pointer" data-id="${item.id}" data-name="${item.name.replace(/'/g, "\\'")}">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="font-bold text-slate-800 text-sm">${item.name}</p>
                            ${item.extra ? `<p class="text-[10px] text-slate-400 mt-0.5">${item.extra}</p>` : ''}
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                    </div>
                </div>
            `).join('');
        };
        
        const modalContent = `
            <div class="max-h-[60vh] flex flex-col">
                <div class="relative mb-4">
                    <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                    <input type="text" id="selector-search" 
                           class="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-emerald-300 transition"
                           placeholder="${placeholder}" 
                           autocomplete="off">
                </div>
                <div id="selector-list" class="overflow-y-auto max-h-[50vh]">
                    ${renderList()}
                </div>
            </div>
        `;
        
        const { value: confirmed } = await Swal.fire({
            title: `<span class="text-base font-black text-slate-800">${title}</span>`,
            html: modalContent,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: "Fermer",
            cancelButtonColor: "#94A3B8",
            customClass: {
                popup: 'rounded-2xl p-6',
                cancelButton: 'rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-wider'
            },
            didOpen: () => {
                const searchInput = document.getElementById('selector-search');
                const listContainer = document.getElementById('selector-list');
                
                searchInput.addEventListener('input', (e) => {
                    searchTerm = e.target.value;
                    listContainer.innerHTML = renderList();
                    attachItemEvents();
                });
                
                const attachItemEvents = () => {
                    document.querySelectorAll('.selector-item').forEach(el => {
                        el.addEventListener('click', () => {
                            const id = el.dataset.id;
                            const name = el.dataset.name;
                            const selectedItem = items.find(i => i.id == id);
                            Swal.close();
                            resolve(selectedItem);
                        });
                    });
                };
                attachItemEvents();
            }
        });
        
        if (!confirmed) resolve(null);
    });
}



/**
 * 💀 AFFICHER UN SQUELETTE DE CHARGEMENT
 * @param {string} type - Type de squelette ('patient-card', 'visit-card', 'aidant-card', 'default')
 * @returns {string} HTML du squelette
 */
export function getSkeletonHTML(type = 'default') {
    const skeletons = {
        'patient-card': `
            <div class="skeleton-card">
                <div class="flex items-center gap-3 mb-3">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="flex-1">
                        <div class="skeleton skeleton-text w-3/4"></div>
                        <div class="skeleton skeleton-text w-1/2"></div>
                    </div>
                </div>
                <div class="skeleton skeleton-text w-full"></div>
                <div class="skeleton skeleton-text w-2/3 mt-2"></div>
                <div class="flex gap-2 mt-3">
                    <div class="skeleton skeleton-button w-1/3"></div>
                    <div class="skeleton skeleton-button w-1/3"></div>
                </div>
            </div>
        `,
        'visit-card': `
            <div class="skeleton-card">
                <div class="flex justify-between mb-3">
                    <div class="skeleton skeleton-text w-1/3"></div>
                    <div class="skeleton skeleton-text w-1/4"></div>
                </div>
                <div class="skeleton skeleton-text w-full"></div>
                <div class="skeleton skeleton-text w-2/3 mt-2"></div>
                <div class="flex items-center gap-2 mt-3">
                    <div class="skeleton skeleton-avatar w-8 h-8"></div>
                    <div class="skeleton skeleton-text w-1/2"></div>
                </div>
            </div>
        `,
        'aidant-card': `
            <div class="skeleton-card">
                <div class="flex items-center gap-3">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="flex-1">
                        <div class="skeleton skeleton-text w-2/3"></div>
                        <div class="skeleton skeleton-text w-1/2 mt-1"></div>
                    </div>
                </div>
                <div class="flex gap-2 mt-3">
                    <div class="skeleton skeleton-button w-1/2"></div>
                    <div class="skeleton skeleton-button w-1/2"></div>
                </div>
            </div>
        `,
        'default': `
            <div class="space-y-4">
                <div class="skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text w-3/4"></div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text w-3/4"></div>
                </div>
            </div>
        `
    };
    
    return skeletons[type] || skeletons.default;
}

/**
 * 🌀 AFFICHER LE SQUELETTE DANS UN CONTENEUR
 * @param {HTMLElement} container - Élément cible
 * @param {string} type - Type de squelette
 */
export function showSkeleton(container, type = 'default') {
    if (!container) return;
    container.innerHTML = getSkeletonHTML(type);
}



/**
 * 📳 CONFIGURATION DES MICRO-INTERACTIONS
 */
const HAPTIC_CONFIG = {
    light: [10],
    medium: [30],
    heavy: [50, 30, 50],
    success: [30],
    error: [100, 50, 100],
    warning: [50, 30, 50, 30, 50],
    click: [5],
    long: [50]
};

/**
 * 📳 VIBRATION HAPTIQUE
 * @param {string} type - Type de vibration ('light', 'medium', 'heavy', 'success', 'error', 'warning', 'click')
 */
export function haptic(type = 'light') {
    if (!("vibrate" in navigator)) return;
    const pattern = HAPTIC_CONFIG[type] || HAPTIC_CONFIG.light;
    navigator.vibrate(pattern);
}

/**
 * 🔊 JOUER UN SON (optionnel, désactivé par défaut)
 * @param {string} type - Type de son ('click', 'success', 'error', 'notification')
 */
let soundsEnabled = false;

export function playSound(type = 'click') {
    if (!soundsEnabled) return;
    
    // Sons courts en Web Audio (plus légers que des fichiers audio)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'click':
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            oscillator.type = 'sine';
            break;
        case 'success':
            oscillator.frequency.value = 1200;
            gainNode.gain.value = 0.15;
            oscillator.type = 'sine';
            break;
        case 'error':
            oscillator.frequency.value = 400;
            gainNode.gain.value = 0.15;
            oscillator.type = 'sawtooth';
            break;
        case 'notification':
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.12;
            oscillator.type = 'sine';
            break;
        default:
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.08;
    }
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
    oscillator.stop(audioContext.currentTime + 0.2);
}

/**
 * 🎵 ACTIVER/DÉSACTIVER LES SONS
 */
export function setSoundsEnabled(enabled) {
    soundsEnabled = enabled;
    localStorage.setItem('sounds_enabled', enabled);
}

/**
 * 🎵 RÉCUPÉRER L'ÉTAT DES SONS
 */
export function getSoundsEnabled() {
    return soundsEnabled;
}



/**
 * 🔘 AJOUTER DES FEEDBACK À TOUS LES ÉLÉMENTS CLIQUABLES
 */
export function initMicroInteractions() {
    // Ajouter le feedback haptique à tous les boutons et cartes
    const clickableElements = document.querySelectorAll('button, .menu-tile, .patient-card, .nav-btn, .sidebar-link, [onclick]');
    
    clickableElements.forEach(el => {
        // Éviter les doublons
        if (el.hasAttribute('data-haptic-initialized')) return;
        el.setAttribute('data-haptic-initialized', 'true');
        
        el.addEventListener('click', (e) => {
            // Éviter les doubles feedbacks sur les éléments enfants
            if (e.defaultPrevented) return;
            
            // Vibration légère
            haptic('click');
            
            // Son optionnel
            if (soundsEnabled) {
                playSound('click');
            }
        });
        
        // Ajouter la classe de feedback visuel
        el.classList.add('haptic-feedback');
    });
}

/**
 * 🔄 REINITIALISER LES MICRO-INTERACTIONS (après chargement dynamique)
 */
export function refreshMicroInteractions() {
    const clickableElements = document.querySelectorAll('button, .menu-tile, .patient-card, .nav-btn, .sidebar-link, [onclick]');
    
    clickableElements.forEach(el => {
        if (el.hasAttribute('data-haptic-initialized')) return;
        el.setAttribute('data-haptic-initialized', 'true');
        
        el.addEventListener('click', () => {
            haptic('click');
            if (soundsEnabled) playSound('click');
        });
        el.classList.add('haptic-feedback');
    });
}



/**
 * 🍞 TOAST DE NOTIFICATION UNIFIÉ
 * @param {string} message - Message à afficher
 * @param {string} type - Type ('success', 'error', 'warning', 'info')
 * @param {number} duration - Durée d'affichage (ms)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // Supprimer les toasts existants
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    // Icône selon le type
    const icons = {
        success: '<i class="fa-solid fa-check-circle"></i>',
        error: '<i class="fa-solid fa-circle-exclamation"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
        info: '<i class="fa-solid fa-info-circle"></i>'
    };
    
    toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;
    document.body.appendChild(toast);
    
    // Animation d'entrée
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Animation de sortie
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * 🍞 TOAST DE SUCCÈS
 */
export function showSuccessToast(message, duration = 2500) {
    showToast(message, 'success', duration);
    haptic('success');
}

/**
 * 🍞 TOAST D'ERREUR
 */
export function showErrorToast(message, duration = 3000) {
    showToast(message, 'error', duration);
    haptic('error');
}

/**
 * 🍞 TOAST D'AVERTISSEMENT
 */
export function showWarningToast(message, duration = 3000) {
    showToast(message, 'warning', duration);
    haptic('warning');
}

/**
 * 🍞 TOAST D'INFORMATION
 */
export function showInfoToast(message, duration = 2000) {
    showToast(message, 'info', duration);
}



/**
 * 🌀 LOADER LOCAL (Uniquement dans le conteneur)
 * @param {HTMLElement} container - L'élément qui va afficher le loader
 * @param {string} message - Message optionnel
 */
export function showLocalLoader(container, message = 'Chargement...') {
    if (!container) return;
    
    if (!container.dataset.originalContent) {
        container.dataset.originalContent = container.innerHTML;
    }
    
    container.innerHTML = `
        <div class="local-loader flex flex-col items-center justify-center py-20 min-h-[200px]">
            <div class="relative w-12 h-12">
                <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                <img src="https://res.cloudinary.com/dglwrrvh3/image/upload/v1774974945/heart-beat_tjb16u.png" 
                     class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 animate-pulse">
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-3">${message}</p>
        </div>
    `;
}

export function hideLocalLoader(container) {
    if (!container) return;
    if (container.dataset.originalContent) {
        container.innerHTML = container.dataset.originalContent;
        delete container.dataset.originalContent;
    }
}



/**
 * 🖼️ LAZY LOADING DES IMAGES
 */
export function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px',
        threshold: 0.01
    });
    
    images.forEach(img => imageObserver.observe(img));
}

/**
 * 📊 NETTOYER LE CACHE (si besoin)
 */
export function clearApiCache() {
    apiCache.clear();
    console.log('🗑️ Cache API vidé');
}

/**
 * ⚡ VERSION OPTIMISÉE DE secureFetch AVEC CACHE
 */
export async function secureFetchWithCache(endpoint, options = {}, useCache = true) {
    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const fetchOptions = { ...options, headers };
    
    if (useCache && (!options.method || options.method === 'GET')) {
        return cachedFetch(`${window.CONFIG.API_URL}${endpoint}`, fetchOptions);
    }
    
    const response = await fetch(`${window.CONFIG.API_URL}${endpoint}`, fetchOptions);
    
    if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.reload();
        throw new Error("Session expirée");
    }
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur serveur");
    }
    
    return response.json();
}



/**
 * 🔒 VÉRIFICATION DES DROITS D'ACCÈS (Période de grâce + Paiement)
 * @returns {Object} { hasAccess, reason, daysUntilBlock }
 */
/**
 * 🔒 VÉRIFICATION DES DROITS D'ACCÈS (Version abonnement 1 mois + 5 jours)
 */
export function checkAccessRights() {
    const userRole = localStorage.getItem("user_role");
    const paymentStatus = localStorage.getItem("payment_status");
    const lastPaymentDate = localStorage.getItem("last_payment_date");
    const subscriptionEndDate = localStorage.getItem("subscription_end_date");
    
    // Coordinateurs et aidants : accès total
    if (userRole === "COORDINATEUR" || userRole === "AIDANT") {
        return { hasAccess: true, isExpiringSoon: false };
    }
    
    // Si pas de date de paiement, accès refusé
    if (!lastPaymentDate && paymentStatus !== "A jour") {
        return {
            hasAccess: false,
            isExpired: true,
            message: "Aucun abonnement actif. Veuillez souscrire un abonnement."
        };
    }
    
    // Calculer les jours restants
    let joursRestants = 0;
    let endDateObj = null;
    
    if (subscriptionEndDate) {
        endDateObj = new Date(subscriptionEndDate);
        const today = new Date();
        joursRestants = Math.ceil((endDateObj - today) / (1000 * 60 * 60 * 24));
    }
    
    // ✅ Abonnement valide
    if (paymentStatus === "A jour" && joursRestants > 0) {
        return {
            hasAccess: true,
            isExpiringSoon: joursRestants <= 5,
            joursRestants: joursRestants,
            endDate: endDateObj
        };
    }
    
    // 🔒 Abonnement expiré
    return {
        hasAccess: false,
        isExpired: true,
        message: "Votre abonnement a expiré. Veuillez renouveler pour continuer à suivre votre proche."
    };
}

/**
 * 🚪 VÉRIFICATION AVEC REDIRECTION AUTOMATIQUE
 * @param {string} viewName - Nom de la vue demandée
 * @returns {boolean} - true si autorisé, false sinon (avec redirection)
 */
export function requireAccess(viewName) {
    const restrictedViews = ["feed", "visits", "commandes", "map"];
    
    if (!restrictedViews.includes(viewName)) {
        return true;
    }
    
    const { hasAccess, reason, message, daysUntilBlock } = checkAccessRights();
    
    if (hasAccess) {
        // Afficher un avertissement subtil si période de grâce
        if (reason === "period_grace" && daysUntilBlock <= 2) {
            setTimeout(() => {
                showWarningToast(`⚠️ Période de grâce: plus que ${daysUntilBlock} jour(s) pour payer`, 5000);
            }, 1000);
        }
        return true;
    }
    
    // Bloquer et rediriger vers facturation
    UI.vibrate("error");
    Swal.fire({
        icon: "warning",
        title: `<span class="text-rose-600 font-black">Accès Suspendu</span>`,
        html: `
            <div class="text-center">
                <i class="fa-solid fa-lock text-rose-400 text-4xl mb-3"></i>
                <p class="text-sm text-slate-600 mb-4">${message}</p>
                <div class="bg-amber-50 p-3 rounded-xl text-left">
                    <p class="text-[10px] font-black text-amber-600 uppercase tracking-wider">📅 Prochain déblocage automatique</p>
                    <p class="text-sm font-bold text-amber-700">Le 1er du mois prochain</p>
                </div>
            </div>
        `,
        confirmButtonText: "💳 RÉGULARISER MON PAIEMENT",
        confirmButtonColor: "#0F172A",
        cancelButtonText: "Annuler",
        showCancelButton: true,
        cancelButtonColor: "#94A3B8",
        customClass: { popup: 'rounded-2xl' }
    }).then((result) => {
        if (result.isConfirmed) {
            window.switchView("billing");
        }
    });
    
    return false;
}




/**
 * 📅 CALCULER LA DATE DE FIN D'ABONNEMENT
 * @param {Date} paymentDate - Date du paiement
 * @returns {Date} Date de fin (1 mois + 5 jours)
 */
function calculateSubscriptionEndDate(paymentDate) {
    const endDate = new Date(paymentDate);
    endDate.setMonth(endDate.getMonth() + 1); // +1 mois
    endDate.setDate(endDate.getDate() + 5);   // +5 jours
    return endDate;
}

/**
 * 🔒 VÉRIFIER SI L'ABONNEMENT EST VALIDE
 * @param {string} lastPaymentDate - Dernière date de paiement
 * @returns {boolean} true si valide
 */
function isSubscriptionValid(lastPaymentDate) {
    if (!lastPaymentDate) return false;
    
    const paymentDate = new Date(lastPaymentDate);
    const endDate = calculateSubscriptionEndDate(paymentDate);
    const today = new Date();
    
    return today <= endDate;
}

/**
 * 📊 CALCULER LES JOURS RESTANTS
 */
function getDaysRemaining(lastPaymentDate) {
    if (!lastPaymentDate) return 0;
    
    const paymentDate = new Date(lastPaymentDate);
    const endDate = calculateSubscriptionEndDate(paymentDate);
    const today = new Date();
    
    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
}


