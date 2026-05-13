 // ============================================================
// SANTÉ PLUS SERVICES - APPLICATION PRINCIPALE
// ============================================================
// Version: 1.0
// Description: Application de coordination de soins à domicile
// Auteur: Santé Plus Services
// ============================================================

// ============================================================
// IMPORTS DES MODULES
// ============================================================
import * as Maman from "./modules/maman.js";
import * as Education from "./modules/education.js";
import { secureFetch } from "./core/api.js";
import { CONFIG } from "./core/config.js";
import { AppState } from "./core/state.js";
import * as Auth from "./modules/auth.js";
import * as Patients from "./modules/patients.js";
import * as Billing from "./modules/billing.js";
import * as Dashboard from "./modules/dashboard.js";
import * as Aidants from "./modules/aidants.js";
import * as Commandes from "./modules/commandes.js";
import * as Visites from "./modules/visites.js";
import * as Messages from "./modules/message.js";
import * as MapModule from "./modules/map.js";
import * as Planning from "./modules/planning.js";
import { quickValidate } from "./modules/dashboard.js";
import * as Admin from "./modules/admin.js";
import { 
    UI, showToast, showSuccessToast, showErrorToast, 
    showWarningToast, showInfoToast, openModernSelector, 
    initMicroInteractions, setSoundsEnabled, getSoundsEnabled, 
    refreshMicroInteractions, playSound, initLazyLoading
} from "./core/utils.js";
import * as Subscription from "./modules/subscription.js";
import { syncService } from "./core/syncService.js";
import * as Profile from "./modules/profile.js";
import ErrorHandler from './core/errorHandler.js';
import { startKeepAlive } from './core/keepAlive.js';
import * as Notifications from "./modules/notifications.js";
import db from './core/db.js';
window.db = db;

const messaging = window.messaging;

async function initPushNotifications() {
    try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("❌ Permission refusée");
            return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        
        const token = await window.messaging.getToken({
            vapidKey: "BNeY_I69yPNM2R-kjlAWMjghL21XVvG9-EPTet200rg6S4TEJvRDsbAeWO5TqODp9h1tZS5LtlLOBb5lDoQGz6M",
            serviceWorkerRegistration: registration
        });

        console.log("🔥 PUSH TOKEN:", token);
        console.log("📱 Appareil enregistré pour les notifications push");

        await secureFetch('/save-push-token', {
            method: 'POST',
            body: JSON.stringify({
                token,
                user_id: localStorage.getItem("user_id")
            })      
        });

    } catch (err) {
        console.error("❌ Erreur push:", err);
    }
}




console.log("🔍 [main.js] Imports vérifiés:");
console.log("🔍 Visites module:", Visites);
console.log("🔍 Visites.startVisit:", Visites?.startVisit);
console.log("🔍 Visites.submitEndVisit:", Visites?.submitEndVisit);
const { updateNotificationBadge } = Notifications;

let realtimeSubscribed = false;

function resetRealtimeMessages() {
    realtimeSubscribed = false;
}

function handleRealtimeUpdate() {
    console.log("⚡ Mise à jour globale realtime");

    // Refresh feed
    if (AppState.currentView === 'feed' && window.renderFeed) {
        window.renderFeed();
    }

    // Refresh visites
    if (AppState.currentView === 'visits' && window.loadVisits) {
        window.loadVisits();
    }

    // Refresh commandes
    if (window.loadCommandes) {
        window.loadCommandes();
    }

    // Refresh badges
    if (window.refreshMenuBadges) {
        setTimeout(() => window.refreshMenuBadges(), 300);
    }

    // Refresh notifications
    if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
    }
}





// Met à jour l'icône PWA selon le thème (Maman ou général)
function updatePWAIcon(isMaman) {
    const iconUrl = isMaman 
        ? CONFIG.LOGO_MAMAN_ICON
        : CONFIG.LOGO_GENERAL_ICON;
    
    // Mettre à jour l'icône apple-touch-icon
    let appleIcon = document.getElementById('apple-touch-icon');
    if (appleIcon) {
        appleIcon.href = iconUrl;
    }
    
    // Mettre à jour le favicon
    let favicon = document.getElementById('favicon');
    if (favicon) {
        favicon.href = iconUrl;
    }
}
// ============================================================
// VARIABLES GLOBALES
// ============================================================
          // Stocke l'invite d'installation PWA
let onboardingStep = 0;              // Étape actuelle du tutoriel
let registrationData = {};           // Données d'inscription temporaires
let currentStep = 0;                 // Étape actuelle du formulaire d'inscription
let loaderTimeout = null;            // Timeout pour le loader global





// ============================================================
// ONBOARDING GÉNÉRAL (affiché si aucune catégorie n'est encore choisie)
// ============================================================
// ONBOARDING GÉNÉRAL (Senior / Par défaut)
const ONBOARDING_STEPS_GENERAL = [
    {
        title: "👀 Suivez vos proches en temps réel",
        desc: "Chaque visite ou livraison est visible instantanément, avec l'heure, les actions réalisées et les observations.",
        image: "/assets/images/onboarding/general-step1.png",
        accent: "border-emerald-500"
    },
    {
        title: "📸 Des preuves à chaque intervention",
        desc: "Photos, notes et comptes-rendus sont ajoutés après chaque passage pour vous rassurer en toute transparence.",
        image: "/assets/images/onboarding/general-step2.png",
        accent: "border-blue-500"
    },
    {
        title: "📦 Deux offres, un seul objectif",
        desc: "👵 Aide aux seniors : accompagnement quotidien | 👶 Maman & Bébé : suivi avant et après la naissance.",
        image: "/assets/images/onboarding/general-step3.png",
        accent: "border-indigo-500"
    },
    {
        title: "💬 Agissez à distance",
        desc: "Envoyez un message ou faites une demande à tout moment, où que vous soyez.",
        image: "/assets/images/onboarding/general-step4.png",
        accent: "border-amber-500"
    },
    {
        title: "🚀 Accédez au suivi",
        desc: "Consultez dès maintenant les dernières activités et gardez l'esprit tranquille.",
        image: "/assets/images/onboarding/general-step5.png",
        accent: "border-emerald-600"
    }
];

// ONBOARDING SENIOR / AIDE
const ONBOARDING_STEPS_SENIOR = [
    {
        title: "🏠 Des visites à domicile suivies",
        desc: "Chaque passage de l'aidant est enregistré avec précision : heure d'arrivée et de départ.",
        image: "/assets/images/onboarding/senior-step1.png",
        accent: "border-emerald-500"
    },
    {
        title: "✅ Toutes les actions tracées",
        desc: "Aide quotidienne, prise de médicaments, accompagnement… tout est clairement indiqué.",
        image: "/assets/images/onboarding/senior-step2.png",
        accent: "border-blue-500"
    },
    {
        title: "📸 Des preuves après chaque visite",
        desc: "Photos et notes sont ajoutées pour vous rassurer et garder une trace complète.",
        image: "/assets/images/onboarding/senior-step3.png",
        accent: "border-indigo-500"
    },
    {
        title: "💊 Commandez les médicaments",
        desc: "Envoyez une demande et faites livrer les traitements directement à domicile.",
        image: "/assets/images/onboarding/senior-step4.png",
        accent: "border-amber-500"
    },
    {
        title: "📞 Réagissez rapidement",
        desc: "Contactez le coordinateur ou demandez une intervention en quelques secondes.",
        image: "/assets/images/onboarding/senior-step5.png",
        accent: "border-slate-700"
    },
    {
        title: "👀 Accédez au suivi",
        desc: "Consultez les dernières visites et restez informé en temps réel.",
        image: "/assets/images/onboarding/senior-step6.png",
        accent: "border-emerald-600"
    },
    {
        title: "🏆 Prêt à commencer ?",
        desc: "Accédez dès maintenant à votre espace de suivi et restez connecté à vos proches en toute sérénité.",
        image: "/assets/images/logo-general-text.png",
        accent: "border-emerald-500",
        isLogo: true  // ← Flag pour savoir que c'est une image de logo
    }
];

// ONBOARDING MAMAN & BÉBÉ
const ONBOARDING_STEPS_BABY = [
    {
        title: "🤰 Un suivi de grossesse rassurant",
        desc: "Un professionnel vous accompagne à domicile : suivi de santé, bien-être et évolution de bébé.",
        image: "/assets/images/onboarding/maman-step1.png",
        accent: "border-rose-500"
    },
    {
        title: "👶 Un accompagnement après la naissance",
        desc: "Nous veillons sur vous et votre bébé : allaitement, sommeil, soins et conseils.",
        image: "/assets/images/onboarding/maman-step2.png",
        accent: "border-pink-500"
    },
    {
        title: "📸 Des souvenirs à chaque visite",
        desc: "Recevez des photos et des nouvelles pour suivre l'évolution de votre enfant.",
        image: "/assets/images/onboarding/maman-step3.png",
        accent: "border-purple-500"
    },
    {
        title: "🍼 Commandez facilement",
        desc: "Couches, lait, vêtements… faites-vous livrer rapidement avec preuve à l'appui.",
        image: "/assets/images/onboarding/maman-step4.png",
        accent: "border-amber-500"
    },
    {
        title: "💬 Un suivi personnalisé",
        desc: "Posez vos questions et recevez des conseils adaptés à votre situation.",
        image: "/assets/images/onboarding/maman-step5.png",
        accent: "border-emerald-500"
    },
    {
        title: "👀 Suivez votre bébé",
        desc: "Accédez au fil d'actualité et ne manquez aucun moment important.",
        image: "/assets/images/onboarding/maman-step6.png",
        accent: "border-rose-600"
    },
    {
        title: "🌸 Prête à commencer ?",
        desc: "Accédez dès maintenant à votre espace de suivi et profitez d'un accompagnement personnalisé pour vous et bébé.",
        image: "/assets/images/logo-maman-text.png",
        accent: "border-rose-500",
        isLogo: true  // ← Flag pour savoir que c'est une image de logo
    }
];


// Variable globale pour stocker les slides actuelles
let ONBOARDING_STEPS = ONBOARDING_STEPS_GENERAL;


async function initApp() {
    // Nettoyer les classes de fond au chargement
    document.body.classList.remove('auth-page', 'maman', 'senior', 'aidant', 'coordinateur');
    
    const loader = document.getElementById("initial-loader");
    const token = localStorage.getItem("token");
    const onboardingSeen = localStorage.getItem("onboarding_seen");
    const userRole = localStorage.getItem("user_role");
    
    // ✅ CORRECTION : Réinitialiser le flag Maman pour les non-familles
    if (userRole && userRole !== 'FAMILLE') {
        localStorage.setItem("user_is_maman", "false");
    }
    
    updatePWAIcon(localStorage.getItem("user_is_maman") === "true");

    console.log("📝 Onboarding vu ?", onboardingSeen);
    console.log("👤 Rôle utilisateur:", userRole);
    console.log("🌸 Mode Maman:", localStorage.getItem("user_is_maman") === "true");
    
    // 🔥 AFFICHER LE LOADER ET PRÉCHARGER
    loader.classList.remove('hidden');
    
    // Précharger toutes les ressources
    await preloadResources();
    
    // Initialisation des services (après préchargement)
    initMicroInteractions();      // Feedback haptique
    ErrorHandler.init();          // Gestion globale des erreurs
    startKeepAlive();             // Ping
    updateThemeColor();            // Color auto
    preloadOnboardingImages();
    initPushNotifications();
    applyUserTheme();

if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
        console.log("🔔 Permission notification:", permission);
    });
}


// ✅ AJOUTE ICI - Écouter les changements de visites en temps réel
if (window.Realtime && window.Realtime.subscribeToVisites) {
    window.Realtime.subscribeToVisites((visiteData) => {
        console.log("📢 [MAIN] Changement visite reçu:", visiteData);
        
        const userRole = localStorage.getItem("user_role");
        const currentView = AppState.currentView;
        
        // 1. Recharger les visites si on est sur la vue visites
        if (currentView === 'visits' && window.loadVisits) {
            window.loadVisits();
            console.log("✅ Visites rechargées");
        }
        
        // 2. Si c'est une visite qui commence et qu'on est sur le feed, recharger
        if (currentView === 'feed' && visiteData.statut === 'En cours') {
            if (window.renderFeed) window.renderFeed();
        }
        
        // 3. Mettre à jour les badges du menu
        if (window.refreshMenuBadges) {
            setTimeout(() => window.refreshMenuBadges(), 500);
        }
        
        // 4. Pour la famille : afficher une notification toast
        if (userRole === 'FAMILLE') {
            if (visiteData.statut === 'En cours') {
                showToast("🔔 Une visite a commencé", "info", 3000);
            } else if (visiteData.statut === 'En attente') {
                showToast("📋 Un nouveau rapport de visite est disponible", "info", 3000);
            } else if (visiteData.statut === 'Validé') {
                showToast("✅ Une visite a été validée", "success", 3000);
            }
        }
        
        // 5. Pour le coordinateur : mettre à jour le dashboard
        if (userRole === 'COORDINATEUR' && currentView === 'dashboard') {
            if (window.fetchStats) window.fetchStats();
            if (window.loadRegistrations) window.loadRegistrations();
        }

        handleRealtimeUpdate();
    });


    console.log("✅ Écoute des visites en temps réel activée");
}

// Écouter les commandes


    // ============================================================
// 💬 REALTIME MESSAGES (VERSION CORRECTE)
// ============================================================




    // ============================================================
// 🔔 REALTIME NOTIFICATIONS
// ============================================================
if (window.Realtime && window.Realtime.subscribeToNotifications) {
    window.Realtime.subscribeToNotifications((data) => {
        console.log("🔔 Notification reçue:", data);

        // Mettre à jour badge cloche
        if (Notifications.updateNotificationBadge) {
            Notifications.updateNotificationBadge();
        }

        // Toast
        showToast(data.message || "Nouvelle notification", "info", 4000);

        handleRealtimeUpdate();
    });

    console.log("✅ Realtime notifications activé");
}


    
if (window.Realtime && window.Realtime.subscribeToCommandes) {
    window.Realtime.subscribeToCommandes((data) => {
        console.log("📢 [MAIN] Commande mise à jour:", data);
        
        const userRole = localStorage.getItem("user_role");
        
        // Rafraîchir la liste des commandes
        if (window.loadCommandes) {
            window.loadCommandes();
        }
        
        // Notifier l'aidant si nouvelle commande
        if (userRole === 'AIDANT' && data.action === 'created') {
            showToast("📦 Nouvelle commande disponible", "info", 3000);
        }
        
        // Notifier la famille si commande prise en charge
        if (userRole === 'FAMILLE' && data.action === 'accepted') {
            showToast("🚚 Votre commande a été prise en charge", "info", 3000);
        }
        
        // Mettre à jour les badges
        if (window.refreshMenuBadges) {
            setTimeout(() => window.refreshMenuBadges(), 500);
        }

        handleRealtimeUpdate();
    });
}

    
    // ✅ Correction : appeler la fonction depuis le module importé
    Notifications.updateNotificationBadge();
    
    // Récupération des préférences utilisateur
    const savedSoundPref = localStorage.getItem('sounds_enabled');
    if (savedSoundPref !== null) {
        setSoundsEnabled(savedSoundPref === 'true');
    }

    const hideLoader = () => {
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => loader.classList.add("hidden"), 500);
        }
    };

    try {
        if (token) {
            if (!onboardingSeen && !window._onboardingCompleted) {
                hideLoader();
                window.startOnboarding();
                return;
            }
            
            renderLayout();
            
            // ✅ Vérifier les visites actives
            await Visites.checkActiveVisitOnStart();
            Visites.resumeTrackingIfActive();
            checkActiveVisit();


                        // ✅ FORCER la mise à jour de l'UI de l'aidant
            const userRole = localStorage.getItem("user_role");
            if (userRole === "AIDANT") {
                const activePatientId = localStorage.getItem("active_patient_id");
                if (activePatientId) {
                    setTimeout(() => {
                        Visites.refreshAidantUI(activePatientId);
                    }, 500);
                }
            }

            setTimeout(() => updateBrandingColors(), 100);

            const defaultView = window.innerWidth < 1024 ? "home" : (userRole === "COORDINATEUR" ? "dashboard" : "patients");
            const lastView = localStorage.getItem("last_view") || defaultView;
            
            await window.switchView(lastView);

            setTimeout(() => {
            if (AppState.currentPatient) {
                console.log("✅ Realtime messages démarré");
            }
        }, 1000);

            // ✅ ASSIGNATION DES FONCTIONS GLOBALES APRÈS LE CHARGEMENT
            console.log("🔍 Vérification des modules après chargement:");
            console.log("🔍 Type de Visites.startVisit:", typeof Visites.startVisit);
            console.log("🔍 Type de Visites.submitEndVisit:", typeof Visites.submitEndVisit);
            console.log("🔍 Type de Commandes.confirmCommand:", typeof Commandes.confirmCommand);
            console.log("🔍 Type de Commandes.markAsDelivered:", typeof Commandes.markAsDelivered);

            // ✅ Assignation des fonctions Visites
            if (Visites && typeof Visites.startVisit === 'function') {
                window.startVisit = Visites.startVisit.bind(Visites);
                window.confirmStartVisit = Visites.startVisit.bind(Visites);
                console.log("✅ window.startVisit assignée avec succès");
            } else {
                console.error("❌ Visites.startVisit n'est pas une fonction");
            }

            if (Visites && typeof Visites.submitEndVisit === 'function') {
                window.submitEndVisit = Visites.submitEndVisit.bind(Visites);
                console.log("✅ window.submitEndVisit assignée");
            }

            if (Visites && typeof Visites.savePatientHomeGPS === 'function') {
                window.savePatientHomeGPS = Visites.savePatientHomeGPS.bind(Visites);
                console.log("✅ window.savePatientHomeGPS assignée");
            }

            if (Visites && typeof Visites.rateVisit === 'function') {
                window.rateVisit = Visites.rateVisit.bind(Visites);
                console.log("✅ window.rateVisit assignée");
            }

            // ✅ Assignation des fonctions Commandes
            if (Commandes && typeof Commandes.confirmCommand === 'function') {
                window.confirmCommand = Commandes.confirmCommand;
                console.log("✅ window.confirmCommand assignée");
            } else {
                console.error("❌ Commandes.confirmCommand n'est pas une fonction");
            }

            if (Commandes && typeof Commandes.markAsDelivered === 'function') {
                window.markAsDelivered = Commandes.markAsDelivered.bind(Commandes);
                console.log("✅ window.markAsDelivered assignée");
            } else {
                console.error("❌ Commandes.markAsDelivered n'est pas une fonction");
            }

            // ✅ Assignation de quickValidate
            if (typeof quickValidate === 'function') {
                window.quickValidate = quickValidate;
                console.log("✅ window.quickValidate assignée");
            } else {
                console.error("❌ quickValidate n'est pas une fonction");
            }

            // ✅ Vérification finale des fonctions critiques
            setTimeout(() => {
                console.log("🔍 Vérification finale des fonctions globales:");
                const requiredFunctions = ['startVisit', 'confirmCommand', 'quickValidate', 'markAsDelivered', 'submitEndVisit'];
                requiredFunctions.forEach(fn => {
                    if (typeof window[fn] !== 'function') {
                        console.error(`❌ Fonction manquante: ${fn}`);
                    } else {
                        console.log(`✅ ${fn} disponible`);
                    }
                });
            }, 500);



            // Écouter les événements de notification
            window.addEventListener('new-notification', (event) => {
                const { title, message, type } = event.detail;
                
                // Afficher un toast
                showToast(message, "info", 4000);
                
                // Mettre à jour le badge de la cloche
                if (type === 'visit' && AppState.currentView === 'feed') {
                    // Si on est dans le feed, recharger
                    window.dispatchEvent(new CustomEvent('app-data-updated', {
                        detail: { endpoint: '/visites', method: 'GET', resourceType: 'visites' }
                    }));
                }
            });
            
            hideLoader();
        } else {
            renderAuthView('login');
            hideLoader();
        }
    } catch (err) {
        console.error("Erreur Init:", err);
        renderAuthView('login');
        hideLoader();
    }
}

/**
 * 🖼️ PRÉCHARGER LES IMAGES PNG D'ONBOARDING
 */
function preloadOnboardingImages() {
    const allSteps = [
        ...ONBOARDING_STEPS_GENERAL,
        ...ONBOARDING_STEPS_SENIOR,
        ...ONBOARDING_STEPS_BABY
    ];
    
    let loadedCount = 0;
    const totalImages = allSteps.length;
    
    allSteps.forEach(step => {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                console.log(`✅ ${totalImages} images d'onboarding préchargées`);
            }
        };
        img.onerror = () => {
            console.warn(`⚠️ Image manquante: ${step.image}`);
        };
        img.src = step.image;
    });
}

// ============================================================
// LOADER GLOBAL (ÉCRAN DE CHARGEMENT INITIAL)
// ============================================================

function showGlobalLoader() {
    let loader = document.getElementById('global-loader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.className = 'global-loader';
        loader.innerHTML = `
            <div class="mb-4">
                <img id="loader-logo-img" class="w-16 h-16 animate-pulse">
            </div>
            <p class="loader-text">Santé Plus Services</p>
        `;
        document.body.appendChild(loader);
    }
    
    const isMaman = localStorage.getItem('user_is_maman') === 'true';
    // ✅ Utiliser l'icône (cœur) selon le thème
    const logoSrc = isMaman ? CONFIG.LOGO_MAMAN_ICON : CONFIG.LOGO_GENERAL_ICON;
    
    const loaderLogo = document.getElementById('loader-logo-img');
    if (loaderLogo) {
        loaderLogo.src = logoSrc;
    }
    
    if (isMaman) {
        loader.classList.add('rose');
    } else {
        loader.classList.remove('rose');
    }
    
    loader.classList.remove('hidden');
    loader.style.opacity = '1';
}




/**
 * 🎨 APPLIQUER LE THÈME SELON LE RÔLE UTILISATEUR
 */
function applyUserTheme() {
    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const userCategorie = localStorage.getItem("user_categorie");
    
    // Enlever les anciennes classes
    document.body.classList.remove('maman-mode', 'senior-mode', 'aidant-mode', 'coordinateur-mode');
    
    // Appliquer la classe selon le rôle
    if (userRole === "COORDINATEUR") {
        document.body.classList.add('coordinateur-mode');
        console.log("🎨 Thème Coordinateur appliqué (GRIS ÉLÉGANT)");
        setThemeColor("#1E293B");
    } 
    else if (userRole === "AIDANT") {
        document.body.classList.add('aidant-mode');
        console.log("🎨 Thème Aidant appliqué (OR DOUX)");
        setThemeColor("#C9A84C");
    }
    else if (userRole === "FAMILLE" && (isMaman || userCategorie === 'MAMAN_BEBE')) {
        document.body.classList.add('maman-mode');
        console.log("🎨 Thème Maman appliqué (ROSE)");
        setThemeColor("#E11D48");
    }
    else if (userRole === "FAMILLE") {
        document.body.classList.add('senior-mode');
        console.log("🎨 Thème Senior appliqué (VERT)");
        setThemeColor("#059669");
    }
    
    // Mettre à jour la couleur de la barre d'état
    updateThemeColor();
}

function setThemeColor(color) {
    const metaTheme = document.getElementById('theme-color');
    if (metaTheme) {
        metaTheme.setAttribute('content', color);
    }
}

function updateThemeColor() {
    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    let color = "#0F172A"; // défaut
    
    if (isMaman || (userRole === "FAMILLE" && localStorage.getItem("user_categorie") === "MAMAN_BEBE")) {
        color = "#E11D48"; // rose maman
    } 
    else if (userRole === "FAMILLE") {
        color = "#059669"; // vert senior
    } 
    else if (userRole === "AIDANT") {
        color = "#C9A84C"; // or aidant
    } 
    else if (userRole === "COORDINATEUR") {
        color = "#1E293B"; // gris admin
    }
    
    const metaTheme = document.getElementById('theme-color');
    if (metaTheme) {
        metaTheme.setAttribute('content', color);
    }
}
/**
 * Cache le loader global
 */
function hideGlobalLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('hidden');
        loader.style.opacity = '0';
    }
}

/**
 * Cache le loader après un délai (sécurité)
 */
function hideGlobalLoaderWithDelay() {
    if (loaderTimeout) clearTimeout(loaderTimeout);
    loaderTimeout = setTimeout(() => {
        hideGlobalLoader();
    }, 5000);
}

// ============================================================
// CONFIGURATION SWEETALERT
// ============================================================
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: { popup: 'rounded-3xl shadow-2xl border border-slate-100' }
});

/**
 * Affiche une alerte personnalisée
 */
window.showAppAlert = (title, text, icon = 'success') => {
    Swal.fire({
        title: `<span class="text-xl font-black text-slate-800">${title}</span>`,
        html: `<p class="text-sm text-slate-500">${text}</p>`,
        icon: icon,
        confirmButtonText: 'COMPRIS',
        confirmButtonColor: '#0F172A',
        buttonsStyling: true,
        customClass: {
            popup: 'rounded-[3rem] p-8 border-none',
            confirmButton: 'rounded-2xl px-8 py-4 font-black uppercase text-[10px] tracking-widest shadow-xl'
        }
    });
};

// ============================================================
// INITIALISATION DE L'APPLICATION
// ============================================================
/**
 * Point d'entrée principal de l'application
 * Vérifie le token, l'onboarding et charge la bonne vue
 */




window.selectServiceType = (type) => {
    registrationData.categorie = type;
    registrationData.user_is_maman = (type === 'MAMAN_BEBE');
    currentStep = 1;
    renderAuthView('register', currentStep);
};


// ============================================================
// ÉTAPE 0 : CHOIX DU TYPE DE COMPTE (AVEC ou SANS PATIENT)
// ============================================================
function getTypeCompteChoiceHTML() {
    const isMamanFlow = registrationData.categorie === 'MAMAN_BEBE';
    const themeColor = isMamanFlow ? 'pink' : 'emerald';
    const themeBgClass = isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50';
    const themeBorderClass = isMamanFlow ? 'border-pink-200' : 'border-emerald-200';
    const themeTextClass = isMamanFlow ? 'text-pink-600' : 'text-emerald-600';
    
    return `
        <div class="text-center mb-8">
            <div class="w-16 h-16 mx-auto bg-${themeColor}-100 rounded-full flex items-center justify-center mb-4">
                <i class="fa-solid fa-users text-2xl text-${themeColor}-500"></i>
            </div>
            <h3 class="text-xl font-black text-slate-800">Comment souhaitez-vous utiliser Santé Plus ?</h3>
            <p class="text-xs text-slate-400 mt-2">Choisissez le type de compte qui vous correspond</p>
        </div>
        
        <div class="space-y-4">
            <!-- Option AVEC PATIENT -->
            <div onclick="window.selectTypeCompte('AVEC_PATIENT')" 
                 class="service-card p-5 bg-white rounded-2xl border-2 border-slate-200 cursor-pointer transition-all hover:border-${themeColor}-400 hover:shadow-lg active:scale-98">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-xl ${themeBgClass} flex items-center justify-center text-3xl">
                        👨‍👩‍👧
                    </div>
                    <div class="flex-1">
                        <h4 class="font-black text-slate-800 text-base">Avec un patient</h4>
                        <p class="text-[10px] ${themeTextClass} font-bold uppercase tracking-wider">Suivi médical complet</p>
                        <p class="text-xs text-slate-500 mt-1">Je crée un compte pour un proche (parent, grand-parent, enfant) et bénéficie des visites à domicile.</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <span class="text-[9px] text-slate-400">✓ Visites à domicile</span>
                            <span class="text-[9px] text-slate-400">✓ Suivi médical</span>
                            <span class="text-[9px] text-slate-400">✓ Commandes</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-slate-300"></i>
                </div>
            </div>
            
            <!-- Option SANS PATIENT -->
            <div onclick="window.selectTypeCompte('SANS_PATIENT')" 
                 class="service-card p-5 bg-white rounded-2xl border-2 border-slate-200 cursor-pointer transition-all hover:border-${themeColor}-400 hover:shadow-lg active:scale-98">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-xl ${themeBgClass} flex items-center justify-center text-3xl">
                        👤
                    </div>
                    <div class="flex-1">
                        <h4 class="font-black text-slate-800 text-base">Sans patient</h4>
                        <p class="text-[10px] ${themeTextClass} font-bold uppercase tracking-wider">Compte personnel</p>
                        <p class="text-xs text-slate-500 mt-1">Je crée un compte pour moi-même. Je pourrai ajouter un patient plus tard si nécessaire.</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <span class="text-[9px] text-slate-400">✓ Commandes personnelles</span>
                            <span class="text-[9px] text-slate-400">✓ Pack Confort 24/7</span>
                            <span class="text-[9px] text-slate-400">✓ Ajout patient possible</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-slate-300"></i>
                </div>
            </div>
        </div>
    `;
}



// ============================================================
// SÉLECTION DU TYPE DE COMPTE (AVEC ou SANS PATIENT)
// ============================================================
window.selectTypeCompte = (type) => {
    registrationData.type_compte = type;
    UI.vibrate('success');
    
    // Passer à l'étape suivante
    if (type === 'AVEC_PATIENT') {
        currentStep = 1;  // Formulaire complet (payeur → patient → santé → pack)
    } else {
        currentStep = 1;  // Compte SANS_PATIENT : on passe directement à l'étape payeur
        // Note : on n'affichera pas les étapes patient et santé
    }
    
    renderAuthView('register', currentStep);
};

// ============================================================
// VUES DYNAMIQUES DU FORMULAIRE D'ADMISSION
// ============================================================
/**
 * Génère le HTML des étapes du formulaire d'inscription
 * 6 étapes : Payeur → Patient → Santé → Catégorie → Pack → Validation
 */
function getStepHTML() {
    const isMamanFlow = registrationData.categorie === 'MAMAN_BEBE';
    const themeColor = isMamanFlow ? 'pink' : 'emerald';
    const themeBgClass = isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50';
    const themeBorderClass = isMamanFlow ? 'border-pink-200' : 'border-emerald-200';
    const themeTextClass = isMamanFlow ? 'text-pink-600' : 'text-emerald-600';
    
    // Déterminer si on est en mode SANS_PATIENT
    const isSansPatient = registrationData.type_compte === 'SANS_PATIENT';
    
    switch(currentStep) {
        // ============================================
        // ÉTAPE 0 : CHOIX DU TYPE DE COMPTE (AVEC ou SANS PATIENT)
        // ============================================
        case 0: return `
            <div class="text-center mb-8">
                <div class="w-16 h-16 mx-auto bg-${themeColor}-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-users text-2xl text-${themeColor}-500"></i>
                </div>
                <h3 class="text-xl font-black text-slate-800">Comment souhaitez-vous utiliser Santé Plus ?</h3>
                <p class="text-xs text-slate-400 mt-2">Choisissez le type de compte qui vous correspond</p>
            </div>
            
            <div class="space-y-4">
                <!-- Option AVEC PATIENT -->
                <div onclick="window.selectTypeCompte('AVEC_PATIENT')" 
                     class="service-card p-5 bg-white rounded-2xl border-2 border-slate-200 cursor-pointer transition-all hover:border-${themeColor}-400 hover:shadow-lg active:scale-98">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl ${themeBgClass} flex items-center justify-center text-3xl">
                            👨‍👩‍👧
                        </div>
                        <div class="flex-1">
                            <h4 class="font-black text-slate-800 text-base">Avec un patient</h4>
                            <p class="text-[10px] ${themeTextClass} font-bold uppercase tracking-wider">Suivi médical complet</p>
                            <p class="text-xs text-slate-500 mt-1">Je crée un compte pour un proche (parent, grand-parent, enfant) et bénéficie des visites à domicile.</p>
                            <div class="flex flex-wrap gap-2 mt-2">
                                <span class="text-[9px] text-slate-400">✓ Visites à domicile</span>
                                <span class="text-[9px] text-slate-400">✓ Suivi médical</span>
                                <span class="text-[9px] text-slate-400">✓ Commandes</span>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300"></i>
                    </div>
                </div>
                
                <!-- Option SANS PATIENT -->
                <div onclick="window.selectTypeCompte('SANS_PATIENT')" 
                     class="service-card p-5 bg-white rounded-2xl border-2 border-slate-200 cursor-pointer transition-all hover:border-${themeColor}-400 hover:shadow-lg active:scale-98">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl ${themeBgClass} flex items-center justify-center text-3xl">
                            👤
                        </div>
                        <div class="flex-1">
                            <h4 class="font-black text-slate-800 text-base">Sans patient</h4>
                            <p class="text-[10px] ${themeTextClass} font-bold uppercase tracking-wider">Compte personnel</p>
                            <p class="text-xs text-slate-500 mt-1">Je crée un compte pour moi-même. Je pourrai ajouter un patient plus tard si nécessaire.</p>
                            <div class="flex flex-wrap gap-2 mt-2">
                                <span class="text-[9px] text-slate-400">✓ Commandes personnelles</span>
                                <span class="text-[9px] text-slate-400">✓ Pack Confort 24/7</span>
                                <span class="text-[9px] text-slate-400">✓ Ajout patient possible</span>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300"></i>
                    </div>
                </div>
            </div>
        `;
        
        // ============================================
        // ÉTAPE 1 : QUI PAYE ? (identique pour les deux types)
        // ============================================
        case 1: return `
            <div class="text-center mb-8">
                <h3 class="text-xl font-black text-slate-800">Qui fait la demande ?</h3>
                <p class="text-xs text-slate-400 mt-1">Les informations du responsable</p>
            </div>
            <div class="space-y-4">
                <div class="relative">
                    <i class="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input id="f-nom" class="app-input !pl-12 !py-3" placeholder="Votre nom complet" value="${registrationData.nom_famille || ''}">
                </div>
                <div class="relative">
                    <i class="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input id="f-email" type="email" class="app-input !pl-12 !py-3" placeholder="Votre email" value="${registrationData.email || ''}">
                </div>
                <div class="relative">
                    <i class="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input id="f-tel" class="app-input !pl-12 !py-3" placeholder="Votre téléphone" value="${registrationData.tel_famille || ''}">
                </div>
                <div class="relative">
                    <i class="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input id="f-pass" type="password" class="app-input !pl-12 !py-3" placeholder="Choisissez un mot de passe">
                </div>
            </div>
        `;
        
        // ============================================
        // ÉTAPE 2 : PATIENT (UNIQUEMENT si AVEC_PATIENT)
        // ============================================
        case 2: 
            if (isSansPatient) {
                // Pour SANS_PATIENT, passer directement à l'étape suivante
                setTimeout(() => window.nextAuthStep(), 100);
                return `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin"></i> Chargement...</div>`;
            }
            return `
                <div class="text-center mb-8">
                    <h3 class="text-xl font-black text-slate-800">Pour qui ?</h3>
                    <p class="text-xs text-slate-400 mt-1">Les informations de la personne à accompagner</p>
                </div>
                <div class="space-y-4">
                    <div class="relative">
                        <i class="fa-solid fa-user-circle absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input id="p-nom" class="app-input !pl-12 !py-3" placeholder="Son nom complet" value="${registrationData.nom_patient || ''}">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="relative">
                            <i class="fa-solid fa-cake-candles absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input id="p-age" type="number" class="app-input !pl-12 !py-3" placeholder="Âge">
                        </div>
                        <div class="relative">
                            <i class="fa-solid fa-venus-mars absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <select id="p-sex" class="app-input !pl-12 !py-3">
                                <option value="">Sexe</option>
                                <option value="Homme">Homme</option>
                                <option value="Femme">Femme</option>
                            </select>
                        </div>
                    </div>
                    <div class="relative">
                        <i class="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input id="p-addr" class="app-input !pl-12 !py-3" placeholder="Son adresse (quartier, rue)" value="${registrationData.adresse_patient || ''}">
                    </div>
                    <div class="relative">
                        <i class="fa-solid fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input id="p-tel" class="app-input !pl-12 !py-3" placeholder="Son téléphone (optionnel)">
                    </div>
                    <div class="relative">
                        <i class="fa-solid fa-address-card absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input id="p-urgence" class="app-input !pl-12 !py-3" placeholder="Contact d'urgence (voisin, famille)">
                    </div>
                </div>
            `;
        
        // ============================================
        // ÉTAPE 3 : SANTÉ (UNIQUEMENT si AVEC_PATIENT)
        // ============================================
        case 3:
            if (isSansPatient) {
                setTimeout(() => window.nextAuthStep(), 100);
                return `<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin"></i> Chargement...</div>`;
            }
            
            if (isMamanFlow) {
                return `
                    <div class="text-center mb-8">
                        <h3 class="text-xl font-black text-slate-800">Suivi Maman & Bébé</h3>
                        <p class="text-xs text-slate-400 mt-1">Quelques informations pour mieux vous accompagner</p>
                    </div>
                    <div class="space-y-4">
                        <div class="relative">
                            <i class="fa-solid fa-hospital-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <select id="accouchement" class="app-input !pl-12 !py-3">
                                <option value="">Type d'accouchement</option>
                                <option value="voie_basse">Voie basse</option>
                                <option value="cesarienne">Césarienne</option>
                            </select>
                        </div>
                        <div class="relative">
                            <i class="fa-solid fa-hand-holding-heart absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <select id="allaitement" class="app-input !pl-12 !py-3">
                                <option value="">Allaitement</option>
                                <option value="maternel">Maternel</option>
                                <option value="mixte">Mixte</option>
                                <option value="artificiel">Artificiel</option>
                            </select>
                        </div>
                        <div>
                            <textarea id="p-notes" class="app-input !py-3" rows="3" placeholder="Informations complémentaires (poids du bébé, sommeil, soucis particuliers...)"></textarea>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="text-center mb-8">
                        <h3 class="text-xl font-black text-slate-800">Informations de santé</h3>
                        <p class="text-xs text-slate-400 mt-1">Pour un accompagnement adapté</p>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 ml-1 mb-2 block">Pathologies existantes</label>
                            <div class="flex flex-wrap gap-2">
                                <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Diabète"> Diabète</label>
                                <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Hypertension"> Hypertension</label>
                                <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Arthrose"> Arthrose</label>
                                <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Alzheimer"> Alzheimer</label>
                            </div>
                        </div>
                        <div>
                            <textarea id="p-traitements" class="app-input !py-3" rows="2" placeholder="Traitements en cours (médicaments, posologies)"></textarea>
                        </div>
                        <div>
                            <textarea id="p-allergies" class="app-input !py-3" rows="2" placeholder="Allergies connues"></textarea>
                        </div>
                        <div>
                            <textarea id="p-notes" class="app-input !py-3" rows="2" placeholder="Autres informations (mobilité, habitudes, précautions)"></textarea>
                        </div>
                    </div>
                `;
            }
        
        // ============================================
        // ÉTAPE 4 : FORFAIT (adapté selon le type de compte)
        // ============================================
        case 4:
            if (isSansPatient) {
                // Pack Confort pour comptes SANS_PATIENT
                const confortPacks = [
                    { id: 'CONFORT_247_MENSUEL', name: 'Pack Confort Mensuel', desc: 'Accès complet', price: '25.000', duration: 1, features: ['Commandes illimitées', 'Support prioritaire', 'Accès contenu éducatif'] },
                    { id: 'CONFORT_247_TRIMESTRIEL', name: 'Pack Confort 3 mois', desc: 'Économie 5%', price: '71.250', originalPrice: '75.000', duration: 3, features: ['Commandes illimitées', 'Support prioritaire', 'Accès contenu éducatif', 'Économie 5%'] },
                    { id: 'CONFORT_247_ANNUEL', name: 'Pack Confort 1 an', desc: 'Économie 15%', price: '255.000', originalPrice: '300.000', duration: 12, features: ['Commandes illimitées', 'Support prioritaire', 'Accès contenu éducatif', 'Économie 15%'] }
                ];
                
                return `
                    <div class="text-center mb-8">
                        <h3 class="text-xl font-black text-slate-800">Pack Confort 24/7</h3>
                        <p class="text-xs text-slate-400 mt-1">Commandes illimitées et support prioritaire</p>
                    </div>
                    <div id="pack-selector" class="space-y-3 max-h-96 overflow-y-auto">
                        ${confortPacks.map(pack => `
                            <div onclick="window.selectPackConfort('${pack.id}', '${pack.price}', ${pack.duration})" 
                                 class="pack-card p-4 bg-white rounded-xl border-2 cursor-pointer transition-all ${registrationData.type_pack === pack.id ? `border-${themeColor}-500 ${themeBgClass}` : 'border-slate-100'}"
                                 data-pack-id="${pack.id}">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 rounded-xl ${registrationData.type_pack === pack.id ? themeBgClass : 'bg-slate-50'} flex items-center justify-center">
                                        <i class="fa-solid fa-crown ${registrationData.type_pack === pack.id ? themeTextClass : 'text-slate-400'} text-xl"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="flex justify-between items-center">
                                            <p class="font-black text-slate-800">${pack.name}</p>
                                            <div class="text-right">
                                                ${pack.originalPrice ? `<span class="text-[10px] text-slate-400 line-through mr-2">${pack.originalPrice} F</span>` : ''}
                                                <p class="text-base font-black ${themeTextClass}">${pack.price} F</p>
                                            </div>
                                        </div>
                                        <p class="text-[10px] text-slate-400">${pack.desc}</p>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                            ${pack.features.map(f => `<span class="text-[8px] text-slate-400">✓ ${f}</span>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mt-4 p-3 bg-blue-50 rounded-xl">
                        <p class="text-[9px] text-blue-600 font-medium">✨ Ce pack vous permet de :</p>
                        <ul class="text-[9px] text-slate-500 mt-1 space-y-0.5">
                            <li>• Passer des commandes de produits (couches, lait, médicaments, etc.)</li>
                            <li>• Bénéficier d'un support prioritaire 24/7</li>
                            <li>• Accéder à tous les contenus éducatifs</li>
                            <li>• Ajouter un patient plus tard si nécessaire</li>
                        </ul>
                    </div>
                    <div class="mt-6">
                        <button onclick="window.nextAuthStep()" 
                                id="pack-continue-btn"
                                class="w-full py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg transition-all active:scale-95 ${registrationData.type_pack ? 'bg-emerald-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}"
                                ${!registrationData.type_pack ? 'disabled' : ''}>
                            Continuer
                        </button>
                    </div>
                `;
            } else {
                // Packs médicaux pour comptes AVEC_PATIENT
                const packs = isMamanFlow ? [
                    { id: 'ESSENTIEL', name: 'Essentiel', desc: '2 visites par semaine', price: '50.000', features: ['2 visites/semaine', 'Suivi de base'] },
                    { id: 'CONFORT', name: 'Confort', desc: '3 à 4 visites par semaine', price: '85.000', features: ['3-4 visites/semaine', 'Aide à la toilette', 'Préparation repas'] },
                    { id: 'SERENITE', name: 'Sérénité', desc: '6 à 7 visites par semaine', price: '150.000', features: ['6-7 visites/semaine', 'Accompagnement complet', 'Urgence 24/7'] },
                    { id: 'MATERNITE', name: 'Spécial Maternité', desc: 'Suivi intensif 2 semaines', price: '70.000', features: ['Visite quotidienne', 'Aide bébé', 'Conseils allaitement'] }
                ] : [
                    { id: 'PONCTUEL', name: 'Ponctuel', desc: 'À la demande', price: '10.000', features: ['Intervention unique', 'Accompagnement RDV'] },
                    { id: 'REGULIER', name: 'Régulier', desc: '2 à 3 visites/semaine', price: '60.000', features: ['2-3 visites/semaine', 'Suivi médical', 'Lien famille'] },
                    { id: 'COMPLET', name: 'Complet', desc: '5 à 6 visites/semaine', price: '150.000', features: ['5-6 visites/semaine', 'Présence renforcée', 'Veille sanitaire'] }
                ];
                
                return `
                    <div class="text-center mb-8">
                        <h3 class="text-xl font-black text-slate-800">Choisissez votre formule</h3>
                        <p class="text-xs text-slate-400 mt-1">Tarifs mensuels en CFA</p>
                    </div>
                    <div id="pack-selector" class="space-y-3 max-h-96 overflow-y-auto">
                        ${packs.map(pack => `
                            <div onclick="window.selectPack('${pack.id}', '${pack.price}')" 
                                 class="pack-card p-4 bg-white rounded-xl border-2 cursor-pointer transition-all ${registrationData.type_pack === pack.id ? `border-${themeColor}-500 ${themeBgClass}` : 'border-slate-100'}"
                                 data-pack-id="${pack.id}">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 rounded-xl ${registrationData.type_pack === pack.id ? themeBgClass : 'bg-slate-50'} flex items-center justify-center">
                                        <i class="fa-solid ${pack.id.includes('CONFORT') || pack.id.includes('REGULIER') ? 'fa-chart-line' : pack.id.includes('SERENITE') || pack.id.includes('COMPLET') ? 'fa-crown' : 'fa-seedling'} ${registrationData.type_pack === pack.id ? themeTextClass : 'text-slate-400'} text-xl"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="flex justify-between items-center">
                                            <p class="font-black text-slate-800">${pack.name}</p>
                                            <p class="text-base font-black ${themeTextClass}">${pack.price} F</p>
                                        </div>
                                        <p class="text-[10px] text-slate-400">${pack.desc}</p>
                                        <div class="flex flex-wrap gap-1 mt-1">
                                            ${pack.features.map(f => `<span class="text-[8px] text-slate-400">✓ ${f}</span>`).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mt-6">
                        <button onclick="window.nextAuthStep()" 
                                id="pack-continue-btn"
                                class="w-full py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg transition-all active:scale-95 ${registrationData.type_pack ? (isMamanFlow ? 'bg-pink-500' : 'bg-emerald-500') : 'bg-slate-200 text-slate-400 cursor-not-allowed'}"
                                ${!registrationData.type_pack ? 'disabled' : ''}>
                            Continuer
                        </button>
                    </div>
                `;
            }
        
        // ============================================
        // ÉTAPE 5 : CONFIRMATION (identique pour les deux types)
        // ============================================
        case 5: return `
            <div class="text-center mb-8">
                <h3 class="text-xl font-black text-slate-800">Dernière étape</h3>
                <p class="text-xs text-slate-400 mt-1">Validation de votre demande</p>
            </div>
            <div class="bg-amber-50 p-5 rounded-2xl border border-amber-100 mb-6">
                <p class="text-xs text-amber-800 leading-relaxed">
                    <b>⚠️ À savoir :</b> Notre service propose un accompagnement <b>humain et logistique</b> (non médical).
                </p>
            </div>
            <label class="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 cursor-pointer">
                <input type="checkbox" id="legal-check" class="mt-1 w-5 h-5 accent-emerald-500">
                <span class="text-xs font-medium text-slate-700">Je confirme avoir compris le principe de l'accompagnement non médical.</span>
            </label>
        `;
    }
}
// ============================================================
// SÉLECTEUR DE CATÉGORIE (SENIOR / MAMAN)
// ============================================================
window.openCategorySelector = async (category) => {
    const categories = {
        'SENIOR': {
            name: 'Personne Âgée',
            desc: 'Maintien à domicile',
            icon: '👴',
            color: 'emerald',
            bgClass: 'bg-emerald-50 border-emerald-200',
            textClass: 'text-emerald-700'
        },
        'MAMAN_BEBE': {
            name: 'Maman & Bébé',
            desc: 'Sortie de maternité',
            icon: '👶',
            color: 'pink',
            bgClass: 'bg-pink-50 border-pink-200',
            textClass: 'text-pink-600'
        }
    };
    
    const cat = categories[category];
    if (!cat) return;
    
    const confirmModal = `
        <div class="text-center">
            <div class="text-6xl mb-3">${cat.icon}</div>
            <p class="text-lg font-black text-slate-800">${cat.name}</p>
            <p class="text-xs text-slate-400 mt-1">${cat.desc}</p>
            <div class="mt-4 p-3 ${cat.bgClass} rounded-xl">
                <p class="text-[10px] font-bold ${cat.textClass}">✓ Vous allez recevoir des offres adaptées</p>
            </div>
        </div>
    `;
    
    const result = await Swal.fire({
        title: 'Confirmer la catégorie',
        html: confirmModal,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirmer',
        confirmButtonColor: category === 'MAMAN_BEBE' ? '#DB2777' : '#10B981',
        cancelButtonText: 'Annuler',
        customClass: {
            popup: 'rounded-2xl p-6',
            confirmButton: 'rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-wider',
            cancelButton: 'rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-wider'
        }
    });
    
    if (result.isConfirmed) {
        registrationData.categorie = category;
        
        const displayDiv = document.getElementById('selected-category-display');
        const iconSpan = document.getElementById('selected-category-icon');
        const textSpan = document.getElementById('selected-category-text');
        
        if (displayDiv && iconSpan && textSpan) {
            iconSpan.className = category === 'MAMAN_BEBE' ? 'fa-solid fa-baby-carriage text-pink-500' : 'fa-solid fa-user-plus text-emerald-500';
            textSpan.innerText = `${cat.icon} ${cat.name} sélectionné`;
            displayDiv.classList.remove('hidden');
        }
        
        document.querySelectorAll('.category-card').forEach(card => {
            card.classList.remove('border-emerald-500', 'border-pink-500', 'bg-emerald-50', 'bg-pink-50');
            card.classList.add('border-slate-100');
        });
        
        const selectedCard = category === 'MAMAN_BEBE' 
            ? document.querySelector('.category-card:last-child')
            : document.querySelector('.category-card:first-child');
        
        if (selectedCard) {
            selectedCard.classList.remove('border-slate-100');
            selectedCard.classList.add(category === 'MAMAN_BEBE' ? 'border-pink-500' : 'border-emerald-500');
            selectedCard.classList.add(category === 'MAMAN_BEBE' ? 'bg-pink-50' : 'bg-emerald-50');
        }
        
        UI.vibrate('success');
        
        setTimeout(() => {
            window.nextAuthStep();
        }, 500);
    }
};

window.clearCategorySelection = () => {
    registrationData.categorie = null;
    const displayDiv = document.getElementById('selected-category-display');
    if (displayDiv) displayDiv.classList.add('hidden');
    
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.remove('border-emerald-500', 'border-pink-500', 'bg-emerald-50', 'bg-pink-50');
        card.classList.add('border-slate-100');
    });
};

// ============================================================
// GESTION DES PACKS (ABONNEMENTS)
// ============================================================
window.selectPack = (packId, price) => {
    registrationData.type_pack = packId;
    registrationData.montant_prevu = price;
    
    const isMamanFlow = registrationData.categorie === 'MAMAN_BEBE';
    const themeColor = isMamanFlow ? 'pink' : 'emerald';
    const themeBgClass = isMamanFlow ? 'bg-pink-50 border-pink-200' : 'bg-emerald-50 border-emerald-200';
    const themeColorClass = isMamanFlow ? 'text-pink-600' : 'text-emerald-600';
    const borderColorClass = isMamanFlow ? 'border-pink-500' : 'border-emerald-500';
    const bgColorClass = isMamanFlow ? 'bg-pink-500' : 'bg-emerald-500';
    
    document.querySelectorAll('.pack-card').forEach(card => {
        const cardPackId = card.dataset.packId;
        if (cardPackId === packId) {
            card.classList.add(borderColorClass);
            card.classList.add(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
            card.classList.add(isMamanFlow ? 'border-pink-200' : 'border-emerald-200');
            card.classList.remove('border-slate-100');
            
            const iconDiv = card.querySelector('.w-12.h-12');
            if (iconDiv) {
                iconDiv.classList.add(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
                iconDiv.classList.add(isMamanFlow ? 'border-pink-200' : 'border-emerald-200');
                iconDiv.classList.remove('bg-slate-50');
                const icon = iconDiv.querySelector('i');
                if (icon) {
                    icon.classList.add(themeColorClass);
                    icon.classList.remove('text-slate-400');
                }
            }
            
            const radioDiv = card.querySelector('.w-5.h-5');
            if (radioDiv) {
                radioDiv.classList.add(borderColorClass);
                radioDiv.classList.add(bgColorClass);
                radioDiv.classList.remove('border-slate-300', 'bg-transparent');
                radioDiv.innerHTML = '<i class="fa-solid fa-check text-white text-[8px]"></i>';
            }
        } else {
            card.classList.remove(borderColorClass);
            card.classList.remove(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
            card.classList.remove(isMamanFlow ? 'border-pink-200' : 'border-emerald-200');
            card.classList.add('border-slate-100');
            
            const iconDiv = card.querySelector('.w-12.h-12');
            if (iconDiv) {
                iconDiv.classList.remove(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
                iconDiv.classList.remove(isMamanFlow ? 'border-pink-200' : 'border-emerald-200');
                iconDiv.classList.add('bg-slate-50');
                const icon = iconDiv.querySelector('i');
                if (icon) {
                    icon.classList.remove(themeColorClass);
                    icon.classList.add('text-slate-400');
                }
            }
            
            const radioDiv = card.querySelector('.w-5.h-5');
            if (radioDiv) {
                radioDiv.classList.remove(borderColorClass);
                radioDiv.classList.remove(bgColorClass);
                radioDiv.classList.add('border-slate-300');
                radioDiv.innerHTML = '';
            }
        }
    });
    
    const continueBtn = document.getElementById('pack-continue-btn');
    if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
        continueBtn.classList.add(isMamanFlow ? 'bg-pink-500' : 'bg-emerald-500');
        continueBtn.classList.add(isMamanFlow ? 'hover:bg-pink-600' : 'hover:bg-emerald-600');
    }
    
    UI.vibrate('success');
};

// ============================================================
// LOGIQUE DU FORMULAIRE D'ADMISSION (STEPPER)
// ============================================================
 window.nextAuthStep = () => {
    if (currentStep === 4 && !registrationData.type_pack) { 
        UI.vibrate('error');
        Swal.fire({
            title: "Sélection requise",
            text: "Veuillez choisir une formule d'accompagnement",
            icon: "warning",
            confirmButtonText: "OK",
            customClass: { popup: 'rounded-2xl' }
        });
        return;
    }
    
    if (currentStep === 0) {
        // Étape 0 : choix du service (déjà géré par selectServiceType)
        currentStep++;
        renderAuthView('register', currentStep);
        return;
    }
    
    if (currentStep === 1) {
        registrationData.nom_famille = document.getElementById('f-nom')?.value;
        registrationData.email = document.getElementById('f-email')?.value;
        registrationData.password = document.getElementById('f-pass')?.value;
        registrationData.tel_famille = document.getElementById('f-tel')?.value || "";
        registrationData.lien_parente = document.getElementById('f-lien')?.value || "";
    }
    
    if (currentStep === 2) {
        registrationData.nom_patient = document.getElementById('p-nom')?.value;
        registrationData.adresse_patient = document.getElementById('p-addr')?.value;
        registrationData.contact_urgence = document.getElementById('p-urgence')?.value;
        registrationData.age_patient = document.getElementById('p-age')?.value || "";
        registrationData.sexe_patient = document.getElementById('p-sex')?.value || "";
        registrationData.tel_patient = document.getElementById('p-tel')?.value || "";
        registrationData.contact_urgence_tel = document.getElementById('p-urgence-tel')?.value || "";
    }
    
    if (currentStep === 3) {
        const meds = Array.from(document.querySelectorAll('.med-hist:checked')).map(el => el.value);
        registrationData.pathologies = meds;  
        registrationData.traitements = document.getElementById('p-traitements')?.value || "";
        registrationData.allergies = document.getElementById('p-allergies')?.value || "";
        registrationData.notes_medicales = document.getElementById('p-notes')?.value;
    }
    
    // ✅ ÉTAPE 5 : Confirmation (c'est la dernière étape, pas 6)
    if (currentStep === 5) { 
        if(!document.getElementById('legal-check')?.checked) {
            UI.vibrate('error');
            Swal.fire({
                title: "Confirmation requise",
                text: "Veuillez accepter les conditions d'engagement",
                icon: "warning",
                customClass: { popup: 'rounded-2xl' }
            });
            return;
        }
        registrationData.engagement_non_medical = true;
        submitRegistration();
        return;
    }

    currentStep++;
    renderAuthView('register', currentStep);
    setTimeout(() => {
        if (AppState.currentPatient) {
            resetRealtimeMessages();    
            console.log("🔁 Realtime messages relancé (propre)");
        }
    }, 500);
};


window.prevAuthStep = () => {
    if (currentStep > 1) {
        currentStep--;
        renderAuthView('register', currentStep);
    }
};


async function submitRegistration() {
    if(!registrationData.type_pack) return Swal.fire("Erreur", "Veuillez choisir une formule", "warning");
    
    registrationData.formule = registrationData.type_pack;
    registrationData.email = registrationData.email.trim().toLowerCase();

    // ✅ Assure-toi que pathologies est bien un tableau
    if (registrationData.pathologies && !Array.isArray(registrationData.pathologies)) {
        registrationData.pathologies = registrationData.pathologies.split(',').map(s => s.trim());
    }
    
    // ✅ Ne pas stringifier manuellement, laisse fetch le faire
    const payload = {
        ...registrationData,
        pathologies: registrationData.pathologies || [],
        categorie: registrationData.categorie,
        type_compte: registrationData.type_compte || 'AVEC_PATIENT'  // ← AJOUTÉ
    };

    console.log("📤 Envoi inscription - Type compte:", payload.type_compte);
    console.log("📤 Payload complet:", payload);
    
    Swal.fire({ title: 'Création du dossier...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const res = await fetch(`${CONFIG.API_URL}/auth/register-family-patient`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)  // ← fetch stringifie automatiquement
        });

        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem("user_categorie", registrationData.categorie);
            localStorage.setItem("user_is_maman", registrationData.categorie === 'MAMAN_BEBE');
            
            Swal.fire({
                icon: "success",
                title: "Dossier Transmis !",
                text: "Un coordinateur va valider vos informations sous 24h.",
                confirmButtonText: "RETOUR À L'ACCUEIL",
                confirmButtonColor: "#16a34a"
            }).then(() => window.location.reload());
        } else {
            throw new Error(data.error || "Erreur lors de l'inscription");
        }
    } catch (e) {
        console.error("Erreur inscription:", e);
        Swal.fire("Erreur", e.message, "error");
    }
}
// ============================================================
// VUE AUTHENTIFICATION (LOGIN / REGISTER / OTP)
// ============================================================

function renderAuthView(mode = 'login', stepSource = 1) {
    const app = document.getElementById("app");
    currentStep = typeof stepSource === 'number' ? stepSource : 1; 
    const otpEmail = mode === 'otp' ? stepSource : null;

    // 🔥 DÉTERMINER LA CATÉGORIE POUR LE FOND DYNAMIQUE
    let category = 'senior';
    const tempCategory = localStorage.getItem("temp_category");
    const userRole = localStorage.getItem("user_role");
    const isMamanStorage = localStorage.getItem("user_is_maman") === "true";
    
    if (tempCategory === 'MAMAN_BEBE' || isMamanStorage) {
        category = 'maman';
    } else if (tempCategory === 'SENIOR') {
        category = 'senior';
    } else if (userRole === 'AIDANT') {
        category = 'aidant';
    } else if (userRole === 'COORDINATEUR') {
        category = 'coordinateur';
    }
    
    document.body.classList.add('auth-page');
    document.body.classList.remove('maman', 'senior', 'aidant', 'coordinateur');
    document.body.classList.add(category);
    
    const isMamanFlow = category === 'maman';
    
    const primaryColor = isMamanFlow ? '#E11D48' : (category === 'aidant' ? '#C9A84C' : (category === 'coordinateur' ? '#1E293B' : '#059669'));
    const primaryLight = isMamanFlow ? '#FFF1F2' : (category === 'aidant' ? '#FEF9E6' : (category === 'coordinateur' ? '#F1F5F9' : '#ECFDF5'));
    const progressColor = isMamanFlow ? 'bg-pink-500' : (category === 'aidant' ? 'bg-amber-500' : (category === 'coordinateur' ? 'bg-slate-600' : 'bg-emerald-500'));
    const focusBorderColor = isMamanFlow ? 'focus:border-pink-500' : (category === 'aidant' ? 'focus:border-amber-500' : (category === 'coordinateur' ? 'focus:border-slate-500' : 'focus:border-emerald-500'));

    let dynamicContent = "";
    let stepTitle = mode === 'login' ? "" : 
                (mode === 'otp' ? "Sécurité Avancée" : 
                (currentStep === 0 ? "" : `Étape ${currentStep} / 5`));

    const authLogo = document.getElementById('auth-logo-img');
    if (authLogo) {
        authLogo.src = isMamanFlow ? '/assets/images/logo-maman-icon.png' : '/assets/images/logo-general-icon.png';
    }
    
    // ============================================================
    // MODE LOGIN
    // ============================================================
    if (mode === 'login') {
        dynamicContent = `
            <div class="space-y-4">
                <div class="relative">
                    <i class="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input id="email" type="email" class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-${isMamanFlow ? 'pink' : (category === 'aidant' ? 'amber' : (category === 'coordinateur' ? 'slate' : 'emerald'))}-300 focus:ring-1 focus:ring-${isMamanFlow ? 'pink' : (category === 'aidant' ? 'amber' : (category === 'coordinateur' ? 'slate' : 'emerald'))}-200 transition-all" placeholder="Adresse email" value="${registrationData.email || ''}">
                </div>
                <div class="relative">
                    <i class="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <input id="password" type="password" class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-${isMamanFlow ? 'pink' : (category === 'aidant' ? 'amber' : (category === 'coordinateur' ? 'slate' : 'emerald'))}-300 focus:ring-1 focus:ring-${isMamanFlow ? 'pink' : (category === 'aidant' ? 'amber' : (category === 'coordinateur' ? 'slate' : 'emerald'))}-200 transition-all" placeholder="Mot de passe">
                </div>
                <div class="text-right">
                    <button onclick="window.forgotPassword()" class="text-[11px] text-slate-400 hover:text-${isMamanFlow ? 'pink-500' : (category === 'aidant' ? 'amber-600' : (category === 'coordinateur' ? 'slate-600' : 'emerald-600'))} transition-all font-medium">
                        Mot de passe oublié ?
                    </button>
                </div>
                <button onclick="window.login()" id="btn-login" class="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md active:scale-98 transition-all flex items-center justify-center gap-2" style="background: ${primaryColor}; color: white;">
                    Se connecter <i class="fa-solid fa-arrow-right text-xs"></i>
                </button>
            </div>`;
    } 
    // ============================================================
    // MODE REGISTER (avec marges externes)
    // ============================================================
else if (mode === 'register') {
    const isLastStep = currentStep === 5;  // Étape 5 = confirmation finale
    
    // Déterminer si on est en mode AVEC_PATIENT ou SANS_PATIENT
    const hasSelectedPatientType = registrationData.type_compte === 'AVEC_PATIENT';
    const isSansPatient = registrationData.type_compte === 'SANS_PATIENT';
    
    // À l'étape 0, on affiche le choix du type de compte
    if (currentStep === 0) {
        dynamicContent = getTypeCompteChoiceHTML();
    } 
    // Pour les autres étapes, on vérifie d'abord que le type a été choisi
    else if (!registrationData.type_compte) {
        currentStep = 0;
        dynamicContent = getTypeCompteChoiceHTML();
    }
    else {
        dynamicContent = `
            <div class="flex flex-col min-h-0">
                <div 
                    class="flex-1 overflow-y-auto custom-scroll pr-1"
                    style="max-height: clamp(360px, 52vh, 480px); padding-bottom: 4px;"
                >
                    ${getStepHTML()}
                </div>

                ${currentStep !== 4 ? `
                    <div class="flex gap-3 pt-4 border-t border-slate-100 mt-4 bg-white">
                        ${currentStep > 1 ? `
                            <button 
                                onclick="window.prevAuthStep()" 
                                class="prev-btn w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shadow-sm active:scale-95 transition-all hover:bg-slate-200"
                            >
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                        ` : ''}

                        <button 
                            onclick="window.nextAuthStep()" 
                            class="next-btn flex-1 py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-md active:scale-95 transition-all" 
                            style="background: ${primaryColor}; color: white;"
                        >
                            ${isLastStep ? 'Valider la demande' : 'Étape suivante'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
}
    // ============================================================
    // MODE OTP
    // ============================================================
    else if (mode === 'otp') {
        dynamicContent = `
            <div class="text-center space-y-5">
                <div class="w-20 h-20 mx-auto ${isMamanFlow ? 'bg-pink-100' : (category === 'aidant' ? 'bg-amber-100' : (category === 'coordinateur' ? 'bg-slate-100' : 'bg-emerald-100'))} rounded-2xl flex items-center justify-center">
                    <i class="fa-solid fa-shield-alt text-3xl ${isMamanFlow ? 'text-pink-500' : (category === 'aidant' ? 'text-amber-500' : (category === 'coordinateur' ? 'text-slate-500' : 'text-emerald-500'))}"></i>
                </div>
                <div>
                    <h3 class="text-xl font-black text-slate-800">Vérification à deux facteurs</h3>
                    <p class="text-xs text-slate-500 mt-1">Code à 6 chiffres envoyé à<br><span class="font-bold text-slate-700">${otpEmail}</span></p>
                </div>
                <div>
                    <input id="otp-code" type="text" maxlength="6" inputmode="numeric" autocomplete="one-time-code" class="w-full py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.5em] focus:${focusBorderColor} focus:ring-2 focus:ring-${isMamanFlow ? 'pink' : (category === 'aidant' ? 'amber' : (category === 'coordinateur' ? 'slate' : 'emerald'))}-200 outline-none transition-all" placeholder="000000">
                </div>
                <button onclick="window.verifyOTP('${otpEmail}')" id="btn-otp" class="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2" style="background: ${primaryColor}; color: white;">
                    Vérifier <i class="fa-solid fa-shield-check text-xs"></i>
                </button>
                <button onclick="window.renderAuthView('login')" class="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                    Annuler la vérification
                </button>
            </div>`;
    }

    const existingCard = document.getElementById("auth-card-content");

    if (existingCard) {
        document.getElementById("auth-step-title").innerText = stepTitle;
        
        const tabContainer = document.getElementById("auth-tabs");
        if (tabContainer && mode !== 'otp') {
            tabContainer.style.display = "block";
            tabContainer.innerHTML = `
                <div class="bg-slate-100 p-1 rounded-xl flex gap-1">
                    <button onclick="window.renderAuthView('login')" class="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}">
                        Connexion
                    </button>
                    <button onclick="window.renderAuthView('register', 0)" class="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}">
                        Inscription
                    </button>
                </div>`;
        } else if (tabContainer) {
            tabContainer.style.display = "none";
        }

        const progressContainer = document.getElementById("auth-progress");
        if (progressContainer) {
            if (mode === 'register') {
                progressContainer.style.display = "block";
                progressContainer.innerHTML = `
                    <div class="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full ${progressColor} transition-all duration-500" style="width: ${(currentStep/6)*100}%"></div>
                    </div>`;
            } else {
                progressContainer.style.display = "none";
            }
        }

        existingCard.innerHTML = dynamicContent;
    } 
    // ============================================================
    // PREMIER AFFICHAGE
    // ============================================================
    else {
        let bgGradient, blurColor1, blurColor2;
        
        if (isMamanFlow) {
            bgGradient = 'from-pink-300 via-pink-100 to-rose-200';
            blurColor1 = 'bg-pink-400';
            blurColor2 = 'bg-rose-400';
        } else if (category === 'aidant') {
            bgGradient = 'from-amber-300 via-amber-100 to-yellow-200';
            blurColor1 = 'bg-amber-500';
            blurColor2 = 'bg-yellow-500';
        } else if (category === 'coordinateur') {
            bgGradient = 'from-slate-700 via-slate-500 to-gray-600';
            blurColor1 = 'bg-slate-600';
            blurColor2 = 'bg-gray-600';
        } else {
            bgGradient = 'from-emerald-300 via-emerald-100 to-teal-200';
            blurColor1 = 'bg-emerald-500';
            blurColor2 = 'bg-teal-500';
        }
        
        // Classes supplémentaires pour le mode register
       const registerClasses = mode === 'register' ? 'my-4 sm:my-6' : '';
       const cardHeight = mode === 'register'
           ? 'max-height: calc(100vh - 32px);'
           : '';
        
        app.innerHTML = `
        <div class="fixed inset-0 w-full h-screen flex items-center justify-center px-4 py-4 sm:px-6 sm:py-6 z-50 overflow-y-auto" style="background: linear-gradient(135deg, ${primaryLight} 0%, white 100%);">
            <div class="absolute -top-20 -left-20 w-96 h-96 rounded-full ${blurColor1} filter blur-[120px] opacity-30 pointer-events-none"></div>
            <div class="absolute -bottom-20 -right-20 w-96 h-96 rounded-full ${blurColor2} filter blur-[120px] opacity-30 pointer-events-none"></div>
            
           <div class="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-y-auto ${registerClasses}" style="max-height: 90vh; height: auto; min-height: auto;">
                
                <!-- Logo -->
                <div class="text-center pt-6 pb-2">
                    <div class="flex justify-center mb-2">
                        <div class="pb-1" style="border-bottom: 2px solid ${primaryColor};">
                            <img id="auth-logo-img" src="/assets/images/logo-general-icon.png" class="w-16 h-16 object-contain" style="border: none;">
                        </div>
                    </div>
                    <p id="auth-step-title" class="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">${stepTitle}</p>
                </div>
                
                <!-- Tabs -->
                <div id="auth-tabs" class="px-6 mt-2" style="display: ${mode !== 'otp' ? 'block' : 'none'}">
                    <div class="bg-slate-100 p-1 rounded-xl flex gap-1">
                        <button onclick="window.renderAuthView('login')" class="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}">
                            Connexion
                        </button>
                        <button onclick="window.renderAuthView('register', 0)" class="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}">
                            Inscription
                        </button>
                    </div>
                </div>
                
                <!-- Progress -->
                <div id="auth-progress" class="px-6 mt-3" style="display: ${mode === 'register' ? 'block' : 'none'}">
                    <div class="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full ${progressColor} transition-all duration-500" style="width: ${(currentStep/6)*100}%"></div>
                    </div>
                </div>
                
                <!-- Contenu -->
                <div id="auth-card-content" class="px-5 sm:px-6 py-5 ${mode === 'register' ? 'pb-5' : ''}">
                    ${dynamicContent}
                </div>
                
            </div>
        </div>`;
    }
}

// ============================================================
// HUB DE NAVIGATION MOBILE
// ============================================================

function renderMobileHub() {
    const userRole = localStorage.getItem("user_role");
    const userName = localStorage.getItem("user_name");
    const container = document.getElementById("view-container");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const isSenior = !isMaman && userRole === "FAMILLE";
    const isAidant = userRole === "AIDANT";
    const isCoordinateur = userRole === "COORDINATEUR";
    
    // 🔥 Récupérer le type de compte
    const typeCompte = localStorage.getItem("user_type_compte") || "AVEC_PATIENT";
    const isSansPatient = typeCompte === "SANS_PATIENT";
    
    // ============================================================
    // 🔥 COULEURS DYNAMIQUES SELON LE RÔLE
    // ============================================================
    
    let primaryColor, primaryLight, goldColor, bannerIcon, bannerDesc, tileBgColor, tileIconColor, tileTextColor;
    
    if (isCoordinateur) {
        primaryColor = '#D4AF37';
        primaryLight = '#FEF9E6';
        goldColor = '#FFFFFF';
        bannerIcon = 'fa-chart-pie';
        bannerDesc = "Gestion complète de la plateforme";
        tileBgColor = '#D4AF37';
        tileIconColor = '#FFFFFF';
        tileTextColor = '#0F172A';
    } 
    else if (isAidant) {
        primaryColor = '#C9A84C';
        primaryLight = '#FEF9E6';
        goldColor = '#FFFFFF';
        bannerIcon = 'fa-user-nurse';
        bannerDesc = "Gestion de vos interventions";
        tileBgColor = '#C9A84C';
        tileIconColor = '#FFFFFF';
        tileTextColor = '#0F172A';
    }
    else if (isMaman) {
        primaryColor = '#E11D48';
        primaryLight = '#FFF1F2';
        goldColor = '#FFFFFF';
        bannerIcon = 'fa-baby-carriage';
        bannerDesc = isSansPatient ? "Votre espace personnel" : "Soutien et bien-être pour maman et bébé";
        tileBgColor = '#E11D48';
        tileIconColor = '#FFFFFF';
        tileTextColor = '#FFFFFF';
    }
    else if (isSenior) {
        primaryColor = '#059669';
        primaryLight = '#ECFDF5';
        goldColor = '#FFFFFF';
        bannerIcon = 'fa-crown';
        bannerDesc = isSansPatient ? "Votre espace personnel" : "Maintien à domicile et soins au quotidien";
        tileBgColor = '#059669';
        tileIconColor = '#FFFFFF';
        tileTextColor = '#FFFFFF';
    }
    else {
        primaryColor = '#059669';
        primaryLight = '#ECFDF5';
        goldColor = '#FFFFFF';
        bannerIcon = 'fa-chart-pie';
        bannerDesc = "Gestion complète de la plateforme";
        tileBgColor = '#059669';
        tileIconColor = '#FFFFFF';
        tileTextColor = '#FFFFFF';
    }
    
    // ============================================================
    // 🔥 MENU ITEMS ADAPTÉS SELON LE RÔLE ET LE TYPE DE COMPTE
    // ============================================================
    
    let menuItems = [];
    
    if (isCoordinateur) {
        menuItems = [
            { id: 'dashboard', label: 'Dashboard', desc: 'Statistiques', icon: 'fa-chart-pie', roles: ['COORDINATEUR'] },
            { id: 'patients', label: 'Patients', desc: 'Dossiers', icon: 'fa-folder-open', roles: ['COORDINATEUR'] },
            { id: 'aidants', label: 'Aidants', desc: 'Équipe', icon: 'fa-user-nurse', roles: ['COORDINATEUR'] },
            { id: 'planning', label: 'Planning', desc: 'Agenda', icon: 'fa-calendar-days', roles: ['COORDINATEUR'] },
            { id: 'map', label: 'Radar', desc: 'Localisation', icon: 'fa-location-dot', roles: ['COORDINATEUR'] },
            { id: 'billing', label: 'Factures', desc: 'Paiements', icon: 'fa-file-invoice-dollar', roles: ['COORDINATEUR'] },
            { id: 'profile', label: 'Profil', desc: 'Mon compte', icon: 'fa-user-circle', roles: ['COORDINATEUR'] }
        ];
    }
    else if (isAidant) {
        menuItems = [
            { id: 'patients', label: 'Patients', desc: 'Mes dossiers', icon: 'fa-folder-open', roles: ['AIDANT'] },
            { id: 'planning', label: 'Planning', desc: 'Agenda', icon: 'fa-calendar-days', roles: ['AIDANT'] },
            { id: 'visits', label: 'Visites', desc: 'Historique', icon: 'fa-calendar-check', roles: ['AIDANT'] },
            { id: 'commandes', label: 'Livraisons', desc: 'Commandes', icon: 'fa-box', roles: ['AIDANT'] },
            { id: 'map', label: 'Radar', desc: 'Localisation', icon: 'fa-location-dot', roles: ['AIDANT'] },
            { id: 'profile', label: 'Profil', desc: 'Mon compte', icon: 'fa-user-circle', roles: ['AIDANT'] }
        ];
    }
    else if (isMaman) {
        if (isSansPatient) {
            menuItems = [
                { id: 'home', label: 'Accueil', desc: 'Tableau de bord', icon: 'fa-home', roles: ['FAMILLE'] },
                { id: 'commandes', label: 'Mes commandes', desc: 'Produits', icon: 'fa-box', roles: ['FAMILLE'] },
                { id: 'education', label: 'Éducation', desc: 'Conseils', icon: 'fa-graduation-cap', roles: ['FAMILLE'] },
                { id: 'billing', label: 'Factures', desc: 'Paiements', icon: 'fa-file-invoice-dollar', roles: ['FAMILLE'] },
                { id: 'profile', label: 'Profil', desc: 'Mon compte', icon: 'fa-user-circle', roles: ['FAMILLE'] }
            ];
        } else {
            menuItems = [
                { id: 'dashboard-maman', label: 'Accueil', desc: 'Dashboard maman', icon: 'fa-home', roles: ['FAMILLE'] },
                { id: 'feed', label: 'Journal', desc: 'Messages', icon: 'fa-newspaper', roles: ['FAMILLE'] },
                { id: 'visits', label: 'Visites', desc: 'Historique', icon: 'fa-calendar-check', roles: ['FAMILLE'] },
                { id: 'commandes', label: 'Commandes', desc: 'Bébé', icon: 'fa-box', roles: ['FAMILLE'] },
                { id: 'education', label: 'Éducation', desc: 'Conseils', icon: 'fa-graduation-cap', roles: ['FAMILLE'] },
                { id: 'billing', label: 'Factures', desc: 'Paiements', icon: 'fa-file-invoice-dollar', roles: ['FAMILLE'] },
                { id: 'profile', label: 'Profil', desc: 'Mon compte', icon: 'fa-user-circle', roles: ['FAMILLE'] }
            ];
        }
    }
    else if (isSenior) {
        if (isSansPatient) {
            menuItems = [
                { id: 'home', label: 'Accueil', desc: 'Tableau de bord', icon: 'fa-home', roles: ['FAMILLE'] },
                { id: 'commandes', label: 'Mes commandes', desc: 'Produits', icon: 'fa-box', roles: ['FAMILLE'] },
                { id: 'billing', label: 'Factures', desc: 'Paiements', icon: 'fa-file-invoice-dollar', roles: ['FAMILLE'] },
                { id: 'profile', label: 'Profil', desc: 'Mon compte', icon: 'fa-user-circle', roles: ['FAMILLE'] }
            ];
        } else {
            menuItems = [
                { id: 'dashboard', label: 'Dashboard', desc: 'Statistiques', icon: 'fa-chart-line', roles: ['FAMILLE'] },
                { id: 'feed', label: 'Journal', desc: 'Soins', icon: 'fa-newspaper', roles: ['FAMILLE'] },
                { id: 'visits', label: 'Visites', desc: 'Historique', icon: 'fa-calendar-check', roles: ['FAMILLE'] },
                { id: 'commandes', label: 'Commandes', desc: 'Médicaments', icon: 'fa-box', roles: ['FAMILLE'] },
                { id: 'billing', label: 'Factures', desc: 'Paiements', icon: 'fa-file-invoice-dollar', roles: ['FAMILLE'] },
                { id: 'subscription', label: 'Abonnement', desc: 'Formules', icon: 'fa-ticket', roles: ['FAMILLE'] },
                { id: 'profile', label: 'Profil', desc: 'Mon compte', icon: 'fa-user-circle', roles: ['FAMILLE'] }
            ];
        }
    }

    // Filtrer selon le rôle (déjà fait dans la construction, mais sécurité)
    const filteredMenu = menuItems;

    // ============================================================
    // 🔥 GÉNÉRATION DU HTML
    // ============================================================
    
    container.innerHTML = `
        <div class="animate-fadeIn" style="background: #F8FAFC; padding-bottom: 20px;">
            <!-- Bannière de bienvenue -->
            <div class="relative rounded-2xl overflow-hidden mb-5" style="height: 160px;">
                <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${getBannerImage(userRole)}');"></div>
                <div class="relative z-10 h-full flex justify-between items-center p-5">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <div class="bg-black/30 w-8 h-8 rounded-full flex items-center justify-center">
                                <i class="fa-solid ${bannerIcon} text-white text-sm"></i>
                            </div>
                            <span class="text-[9px] font-bold uppercase tracking-wider text-white/80">BIENVENUE</span>
                        </div>
                        <h2 class="text-2xl font-black text-white drop-shadow-md">${userName?.split(' ')[0] || 'Utilisateur'}</h2>
                        <p class="text-sm text-white drop-shadow-sm mt-1">${bannerDesc}</p>
                    </div>
                    <div class="bg-black/30 w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-sm relative">
                        <i class="fa-regular fa-bell text-white text-xl"></i>
                        <span id="mobile-notif-badge" class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[8px] text-white flex items-center justify-center hidden">0</span>
                    </div>
                </div>
            </div>
            
            <!-- Prochaine intervention -->
            <div class="relative rounded-xl overflow-hidden mb-5" style="height: 90px;">
                <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('${getNextVisitImage(userRole)}');"></div>
                <div class="absolute inset-0 bg-black/30"></div>
                <div class="relative z-10 h-full flex justify-between items-center px-4">
                    <div>
                        <p class="text-[9px] font-bold uppercase tracking-wider text-white/80">
                            ${isMaman ? 'PROCHAINE VISITE' : (isAidant ? 'PROCHAINE MISSION' : 'PROCHAINE INTERVENTION')}
                        </p>
                        <p class="text-sm font-bold text-white mt-1">
                            ${isSansPatient ? 'Aucune visite prévue' : (isMaman ? 'Aujourd\'hui, 10h30' : (isAidant ? 'Patient: DIALLO Fatoumata' : 'À venir'))}
                        </p>
                    </div>
                    <div class="bg-black/30 w-8 h-8 rounded-full flex items-center justify-center">
                        <i class="fa-solid fa-calendar-check text-white text-sm"></i>
                    </div>
                </div>
            </div>
            
            <!-- Titre menu -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4 style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: ${primaryColor};">MENU PRINCIPAL</h4>
                <span style="font-size: 9px; color: #94A3B8;">${filteredMenu.length} services</span>
            </div>
            
            <!-- Grille des tuiles -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;" id="menu-grid">
                ${filteredMenu.map((item, index) => `
                    <div data-menu="${item.id}" onclick="window.switchView('${item.id}')" 
                         style="background: ${tileBgColor}; border-radius: 20px; padding: 16px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: cardAppear 0.3s ease-out ${index * 0.03}s forwards; opacity: 0; position: relative;"
                         ontouchstart="this.style.transform='scale(0.97)'"
                         ontouchend="this.style.transform='scale(1)'"
                         onmousedown="this.style.transform='scale(0.97)'"
                         onmouseup="this.style.transform='scale(1)'">
                        <div style="background: rgba(255,255,255,0.15); width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                            <i class="fa-solid ${item.icon}" style="color: ${tileIconColor}; font-size: 22px;"></i>
                        </div>
                        <div>
                            <p style="font-weight: 700; color: ${tileTextColor}; font-size: 14px; margin-bottom: 2px;">${item.label}</p>
                            <p style="font-size: 10px; color: ${isCoordinateur || isAidant ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255,255,255,0.7)'};">${item.desc}</p>
                        </div>
                        <span class="menu-badge" style="position: absolute; top: -6px; right: -6px; background: #EF4444; color: white; font-size: 10px; font-weight: 800; min-width: 22px; height: 22px; border-radius: 22px; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(239,68,68,0.4); border: 2px solid white;"></span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Initialiser les badges
    initHomeBadges();
    
    // Fonctions internes
    function initHomeBadges() {
        refreshBadges();
        
        let intervalId = setInterval(() => {
            if (AppState.currentView === 'home' && document.visibilityState === 'visible') {
                refreshBadges();
            }
        }, 60000);
        
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") refreshBadges();
        });
        
        window.addEventListener('beforeunload', () => clearInterval(intervalId));
    }
    
    function updateBadgeUI(menuId, count) {
        const tile = document.querySelector(`[data-menu="${menuId}"]`);
        if (!tile) return;
        const badge = tile.querySelector('.menu-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
            badge.style.animation = 'badgePop 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)';
        } else {
            badge.style.display = 'none';
        }
    }
    
    async function refreshBadges() {
        try {
            let messagesCount = 0;
            let commandesCount = 0;
            let visitesCount = 0;
            let notificationsCount = 0;
            
            const currentUserId = localStorage.getItem("user_id");
            
            if (AppState.currentPatient && !isSansPatient) {
                const lastRead = localStorage.getItem(`last_read_${AppState.currentPatient}`);
                let messages = await secureFetch(`/messages?patient_id=${AppState.currentPatient}`);
                if (!Array.isArray(messages)) messages = messages?.data || [];
                const currentUserName = localStorage.getItem("user_name");
                const otherMessages = messages.filter(m => m.sender_name !== currentUserName);
                
                if (lastRead) {
                    messagesCount = otherMessages.filter(m => new Date(m.created_at) > new Date(lastRead)).length;
                } else if (otherMessages.length > 0) {
                    messagesCount = otherMessages.length;
                }
            }
            
            try {
                let commandes;
                if (isSansPatient) {
                    commandes = await secureFetch("/commandes/mes-commandes", { noCache: true });
                } else {
                    commandes = await secureFetch("/commandes", { noCache: true });
                }
                
                if (userRole === "COORDINATEUR") {
                    commandesCount = commandes.filter(c => c.statut === "Livrée").length;
                } else if (userRole === "AIDANT") {
                    commandesCount = commandes.filter(c => c.statut === "En attente" && !c.aidant_id).length;
                } else if (userRole === "FAMILLE") {
                    if (isSansPatient) {
                        commandesCount = commandes.filter(c => c.statut === "En attente" || c.statut === "En cours de livraison").length;
                    } else {
                        commandesCount = commandes.filter(c => c.statut === "En attente" || c.statut === "En cours de livraison").length;
                    }
                }
            } catch (err) {}
            
            if (userRole === "COORDINATEUR") {
                try {
                    const visites = await secureFetch("/visites", { noCache: true });
                    visitesCount = visites.filter(v => v.statut === "En attente").length;
                } catch (err) {}
            }
            
            try {
                const notifications = await secureFetch("/notifications", { noCache: true });
                notificationsCount = notifications.filter(n => !n.read && n.user_id === currentUserId).length;
                
                const headerBadge = document.getElementById('notification-badge');
                if (headerBadge) {
                    headerBadge.style.display = notificationsCount > 0 ? 'flex' : 'none';
                    headerBadge.textContent = notificationsCount > 9 ? '9+' : notificationsCount;
                }
                
                const mobileBadge = document.getElementById('mobile-notif-badge');
                if (mobileBadge) {
                    mobileBadge.style.display = notificationsCount > 0 ? 'flex' : 'none';
                    mobileBadge.textContent = notificationsCount > 9 ? '9+' : notificationsCount;
                }
            } catch (err) {}
            
            updateBadgeUI('feed', messagesCount);
            updateBadgeUI('commandes', commandesCount);
            updateBadgeUI('visits', visitesCount);
            
        } catch (err) {
            console.error("❌ Erreur refreshBadges:", err);
        }
    }
}


// Fonction utilitaire
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ✅ Exposer la fonction pour rafraîchir les badges
window.refreshMenuBadges = () => {
    console.log("🔄 refreshMenuBadges appelée, currentView:", AppState.currentView);
    if (AppState.currentView === 'home') {
        renderMobileHub();
    }
};


// ============================================================
// DASHBOARD POUR COMPTES SANS PATIENT
// ============================================================
async function renderSansPatientDashboard() {
    const container = document.getElementById("view-container");
    if (!container) return;
    
    const userName = localStorage.getItem("user_name") || "Utilisateur";
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    const themeBgClass = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
    const themeTextClass = isMaman ? 'text-pink-600' : 'text-emerald-600';
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    
    // Récupérer les données
    let commandesEnCours = [];
    let commandesRecentes = [];
    let packConfortActif = false;
    let joursRestants = 0;
    
    try {
        // Récupérer les commandes de l'utilisateur
        const commandes = await secureFetch("/commandes/mes-commandes");
        commandesEnCours = commandes.filter(c => c.statut === "En attente" || c.statut === "En cours de livraison");
        commandesRecentes = commandes.slice(0, 3);
        
        // Récupérer le statut du Pack Confort
        const confortStatus = await secureFetch("/billing/confort-status");
        packConfortActif = confortStatus.actif || false;
        joursRestants = confortStatus.jours_restants || 0;
        
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
            
            <!-- Statut Pack Confort -->
            <div class="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-slate-100">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl ${themeBgClass} flex items-center justify-center">
                            <i class="fa-solid fa-crown ${themeTextClass} text-xl"></i>
                        </div>
                        <div>
                            <p class="font-black text-slate-800">Pack Confort 24/7</p>
                            ${packConfortActif ? `
                                <p class="text-[10px] text-emerald-600 font-bold">✅ Actif</p>
                                <p class="text-[9px] text-slate-400">Plus que ${joursRestants} jour(s)</p>
                            ` : `
                                <p class="text-[10px] text-amber-600 font-bold">⚠️ Inactif</p>
                                <p class="text-[9px] text-slate-400">Souscrivez pour bénéficier des avantages</p>
                            `}
                        </div>
                    </div>
                    ${!packConfortActif ? `
                        <button onclick="window.switchView('subscription')" 
                                class="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-${themeColor}-500 text-white shadow-md active:scale-95 transition-all">
                            Souscrire
                        </button>
                    ` : `
                        <i class="fa-solid fa-check-circle text-2xl text-emerald-500"></i>
                    `}
                </div>
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
                        <button onclick="window.openOrderModal()" 
                                class="mt-3 px-4 py-2 rounded-xl text-[9px] font-black uppercase ${themeBgClass} ${themeTextClass} active:scale-95 transition-all">
                            + Nouvelle commande
                        </button>
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
            
            <!-- Section Ajouter un patient (si pas déjà fait) -->
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
// AJOUTER UN PATIENT APRÈS INSCRIPTION (compte SANS_PATIENT)
// ============================================================
window.addPatientAfterRegistration = async () => {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeColor = isMaman ? 'pink' : 'emerald';
    
    const { value: formData } = await Swal.fire({
        title: "➕ Ajouter un patient",
        html: `
            <div class="text-left space-y-3">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[10px] font-black text-slate-400">Prénom</label>
                        <input id="patient-prenom" class="w-full p-2 border rounded-lg text-sm" placeholder="Prénom">
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-400">Nom</label>
                        <input id="patient-nom" class="w-full p-2 border rounded-lg text-sm" placeholder="Nom">
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Âge</label>
                    <input id="patient-age" type="number" class="w-full p-2 border rounded-lg text-sm" placeholder="Âge">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Sexe</label>
                    <select id="patient-sexe" class="w-full p-2 border rounded-lg text-sm">
                        <option value="Homme">Homme</option>
                        <option value="Femme">Femme</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Adresse</label>
                    <input id="patient-adresse" class="w-full p-2 border rounded-lg text-sm" placeholder="Adresse complète">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Téléphone</label>
                    <input id="patient-tel" class="w-full p-2 border rounded-lg text-sm" placeholder="Téléphone">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Contact urgence</label>
                    <input id="patient-urgence" class="w-full p-2 border rounded-lg text-sm" placeholder="Nom et téléphone">
                </div>
                <div>
                    <label class="text-[10px] font-black text-slate-400">Notes médicales</label>
                    <textarea id="patient-notes" rows="2" class="w-full p-2 border rounded-lg text-sm" placeholder="Pathologies, traitements, allergies..."></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: "✅ Ajouter le patient",
        confirmButtonColor: "#10B981",
        cancelButtonText: "Annuler",
        width: '500px',
        customClass: { popup: 'rounded-2xl' },
        preConfirm: () => {
            const prenom = document.getElementById('patient-prenom').value;
            const nom = document.getElementById('patient-nom').value;
            const adresse = document.getElementById('patient-adresse').value;
            
            if (!prenom || !nom || !adresse) {
                Swal.showValidationMessage("Prénom, nom et adresse sont requis");
                return false;
            }
            
            return {
                prenom: prenom,
                nom: nom,
                age: document.getElementById('patient-age').value,
                sexe: document.getElementById('patient-sexe').value,
                adresse: adresse,
                telephone: document.getElementById('patient-tel').value,
                contact_urgence: document.getElementById('patient-urgence').value,
                notes_medicales: document.getElementById('patient-notes').value
            };
        }
    });
    
    if (!formData) return;
    
    Swal.fire({ title: "Ajout en cours...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    
    try {
        const nomComplet = `${formData.prenom} ${formData.nom}`.trim();
        
        await secureFetch("/patients/add-after-registration", {
            method: "POST",
            body: JSON.stringify({
                nom_complet: nomComplet,
                prenom: formData.prenom,
                nom: formData.nom,
                age: formData.age,
                sexe: formData.sexe,
                adresse: formData.adresse,
                telephone: formData.telephone,
                contact_urgence: formData.contact_urgence,
                notes_medicales: formData.notes_medicales
            })
        });
        
        // Mettre à jour le type de compte dans localStorage
        localStorage.setItem("user_type_compte", "AVEC_PATIENT");
        
        Swal.fire({
            icon: "success",
            title: "Patient ajouté !",
            text: "Votre compte a été transformé en compte avec patient. Vous pouvez maintenant bénéficier des visites à domicile.",
            confirmButtonText: "OK"
        }).then(() => {
            window.location.reload();
        });
        
    } catch (err) {
        Swal.close();
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message,
            confirmButtonText: "OK"
        });
    }
};


// ============================================================
// LAYOUT PRINCIPAL (HEADER, SIDEBAR, FOOTER)
// ============================================================
function renderLayout() {
    const userRole = localStorage.getItem("user_role");
    const userName = localStorage.getItem("user_name");
    const userPhoto = localStorage.getItem("user_photo");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const isFamily = userRole === "FAMILLE";
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    const primaryLight = isMaman ? '#FFF1F2' : '#ECFDF5';



     // Couleurs dynamiques pour le drawer mobile (fond clair + dégradé subtil)
    const drawerBgClass = userRole === 'COORDINATEUR' ? 'bg-gradient-to-br from-white to-amber-50/80' 
                        : (userRole === 'AIDANT' ? 'bg-gradient-to-br from-white to-amber-50/70'
                        : (isMaman ? 'bg-gradient-to-br from-white to-pink-50/80'
                        : 'bg-gradient-to-br from-white to-emerald-50/80'));
    
    const drawerAccentColor = userRole === 'COORDINATEUR' ? 'text-amber-600' 
                            : (userRole === 'AIDANT' ? 'text-amber-500'
                            : (isMaman ? 'text-pink-500'
                            : 'text-emerald-600'));
    
    const drawerBorderColor = userRole === 'COORDINATEUR' ? 'border-amber-100' 
                            : (userRole === 'AIDANT' ? 'border-amber-100'
                            : (isMaman ? 'border-pink-100'
                            : 'border-emerald-100'));

    document.getElementById("app").innerHTML = `
        <div class="flex h-screen w-full bg-transparent overflow-hidden font-sans select-none">
            <!-- Sidebar Desktop -->
                 <aside class="hidden lg:flex flex-col w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-xl">
                    <!-- Logo -->
                    <div class="flex justify-center py-6 border-b border-white/10">
                        <div class="w-16 h-16">
                            <img id="sidebar-logo-img" class="w-full h-full object-contain" src="${isMaman ? CONFIG.LOGO_MAMAN_ICON : CONFIG.LOGO_GENERAL_ICON}">
                        </div>
                    </div>
                    
                    <!-- Navigation -->
                    <nav class="flex-1 py-6 px-4 space-y-1" id="nav-desktop">
                        ${getNavLinks(userRole, 'desktop')}
                    </nav>
                    
                    <!-- Profil & Déconnexion -->
                    <div class="p-4 border-t border-white/10 mt-auto">
                        <div class="flex items-center gap-3 mb-4 p-2 rounded-xl bg-white/5">
                            <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-black text-sm border border-white/20 overflow-hidden">
                                ${userPhoto ? `<img src="${userPhoto}" class="w-full h-full object-cover">` : `<i class="fa-regular fa-user text-white"></i>`}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold truncate">${userName?.split(' ')[0] || 'Utilisateur'}</p>
                                 <p class="text-[9px] text-slate-400 uppercase tracking-wider">${userRole}</p>
                            </div>
                        </div>
                        <button onclick="window.logout()" class="w-full py-2.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                            <i class="fa-solid fa-power-off text-xs"></i> Déconnexion
                        </button>
                    </div>
                </aside>

            <!-- Contenu principal -->
            <div class="flex-1 flex flex-col min-w-0 h-[100dvh] relative overflow-hidden">
                <!-- Header -->
                <header class="h-14 lg:h-16 bg-white/95 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 lg:px-6 shrink-0 z-40">
                    <!-- Menu hamburger (mobile) -->
                    <button id="menu-hamburger" class="lg:hidden w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-all">
                        <i class="fa-solid fa-bars text-lg"></i>
                    </button>
                    
                    <!-- Logo mobile -->
                        <div class="lg:hidden flex items-center justify-center">
                            <div class="w-16 h-16">
                                <img id="header-logo-img" class="w-full h-full object-contain" src="${isMaman ? CONFIG.LOGO_MAMAN_ICON : CONFIG.LOGO_GENERAL_ICON}">
                            </div>
                        </div>
                    
                    <!-- Titre desktop -->
                    <div class="hidden lg:block">
                    </div>
                    
                    <!-- Actions droite -->
                    <div class="flex items-center gap-2">
                        <button onclick="window.switchView('notifications')" 
                                class="relative w-9 h-9 lg:w-10 lg:h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-all active:scale-95">
                            <i class="fa-regular fa-bell text-base"></i>
                            <span id="notification-badge" class="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white hidden">0</span>
                        </button>
                        <button onclick="window.switchView('profile')" 
                                class="w-9 h-9 lg:w-10 lg:h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95">
                            ${userPhoto ? `<img src="${userPhoto}" class="w-8 h-8 rounded-full object-cover">` : `<i class="fa-regular fa-user-circle text-slate-500 text-xl"></i>`}
                        </button>
                    </div>
                </header>

                             <!-- Menu latéral mobile (drawer) - FOND CLAIR + DÉGRADÉ SUBTIL -->
             <div id="mobile-drawer" class="fixed inset-0 z-50 hidden">
                 <div class="absolute inset-0 bg-black/30" id="drawer-overlay"></div>
                 <div class="absolute top-0 left-0 bottom-0 w-80 ${drawerBgClass} shadow-xl transform -translate-x-full transition-transform duration-300 flex flex-col border-r ${drawerBorderColor}">
                     <!-- En-tête du drawer -->
                     <div class="p-5 border-b ${drawerBorderColor} shrink-0">
                         <div class="flex items-center justify-between">
                             <div class="flex items-center gap-3">
                              <div class="w-12 h-12 rounded-xl flex items-center justify-center">
                                  <img src="${isMaman ? CONFIG.LOGO_MAMAN_ICON : CONFIG.LOGO_GENERAL_ICON}" class="w-12 h-12 object-contain">
                              </div>
                                 
                                 <div>
                                     <p class="font-bold text-slate-800 text-base">${userName?.split(' ')[0] || 'Utilisateur'}</p>
                                     <p class="text-[9px] ${drawerAccentColor} uppercase font-black tracking-wider">${userRole}</p>
                                 </div>
                             </div>
                             <button id="close-drawer" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition">
                                 <i class="fa-solid fa-times text-sm"></i>
                             </button>
                         </div>
                     </div>
                     
                     <!-- Navigation -->
                     <nav class="flex-1 overflow-y-auto py-4" id="drawer-menu"></nav>
                     
                     <!-- Bouton déconnexion en bas -->
                     <div class="shrink-0 p-5 border-t ${drawerBorderColor} space-y-3">
                         <button id="install-app-drawer" 
                                 class="w-full py-3 rounded-xl text-[10px] font-black uppercase active:scale-98 transition-all flex items-center justify-center gap-2 bg-white border ${drawerBorderColor} text-slate-600 hover:${drawerAccentColor} hover:border-${userRole === 'COORDINATEUR' ? 'amber-200' : (userRole === 'AIDANT' ? 'amber-200' : (isMaman ? 'pink-200' : 'emerald-200'))} transition">
                             <i class="fa-solid fa-download"></i> Installer l'application
                         </button>
                         
                         <button onclick="window.logout()" 
                                 class="w-full py-3 bg-rose-50 text-rose-500 rounded-xl text-[10px] font-black uppercase active:scale-98 transition-all flex items-center justify-center gap-2 hover:bg-rose-100 border border-rose-100">
                             <i class="fa-solid fa-power-off"></i> Déconnexion
                         </button>
                     </div>
                 </div>
             </div>
                <!-- Effets de fond -->
                <div class="absolute top-40 left-[-5%] w-[500px] h-[500px] bg-green-200/20 rounded-full blur-[120px] pointer-events-none z-0 animate-blob"></div>
                <div class="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-200/20 rounded-full blur-[100px] pointer-events-none z-0 animate-blob animation-delay-2000"></div>

                <!-- Main content -->
                <main id="main-content" class="flex-1 overflow-y-auto custom-scroll p-6 lg:p-12 z-10 relative">
                    <div id="view-container" class="max-w-7xl mx-auto min-h-full"></div>
                </main>
            </div>
        </div>
    `;

    // ============================================================
    // MENU LATÉRAL MOBILE - VERSION ACCORDÉON
    // ============================================================
    const drawerMenu = document.getElementById('drawer-menu');
    if (drawerMenu) {
        const primaryColor = isMaman ? '#E11D48' : '#059669';
        const primaryBgLight = isMaman ? 'bg-pink-50' : 'bg-emerald-50';
        const primaryText = isMaman ? 'text-pink-600' : 'text-emerald-600';
        
       // Définition des sections avec leurs items
         const sections = [];
         
         // Section PRINCIPAL
         const mainItems = [
             { id: 'home', icon: 'fa-home', label: 'Accueil', roles: ['COORDINATEUR', 'FAMILLE', 'AIDANT'] },
             { id: 'map', icon: 'fa-location-dot', label: 'Radar', roles: ['COORDINATEUR', 'AIDANT', 'FAMILLE'] },
             { id: 'patients', icon: 'fa-folder-open', label: isMaman ? 'Mon suivi' : 'Dossiers', roles: ['COORDINATEUR', 'FAMILLE', 'AIDANT'] },
             { id: 'feed', icon: 'fa-newspaper', label: 'Journal', roles: ['COORDINATEUR', 'FAMILLE', 'AIDANT'] },
             { id: 'visits', icon: 'fa-calendar-check', label: 'Visites', roles: ['COORDINATEUR', 'FAMILLE', 'AIDANT'] },
             { id: 'commandes', icon: 'fa-box', label: isMaman ? 'Commandes bébé' : 'Commandes', roles: ['COORDINATEUR', 'FAMILLE', 'AIDANT'] },
             { id: 'planning', icon: 'fa-calendar-days', label: 'Planning', roles: ['COORDINATEUR', 'AIDANT'] },
             { id: 'users', icon: 'fa-users', label: 'Utilisateurs', roles: ['COORDINATEUR'] },
         ].filter(item => item.roles.includes(userRole));
         
         if (mainItems.length > 0) {
             sections.push({ title: 'PRINCIPAL', icon: 'fa-compass', items: mainItems, defaultOpen: true });
         }
         
         // Section SERVICES (uniquement pour les services spécifiques)
         const serviceItems = [];
         if (userRole === 'COORDINATEUR') {
             serviceItems.push(
                 { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard', roles: ['COORDINATEUR'] },
                 { id: 'aidants', icon: 'fa-user-nurse', label: 'Aidants', roles: ['COORDINATEUR'] },
                 { id: 'rh-dashboard', icon: 'fa-users', label: 'RH & Assignations', roles: ['COORDINATEUR'] }
             );
         }
         if (userRole === 'FAMILLE') {
             serviceItems.push(
                 { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Factures', roles: ['FAMILLE'] },
                 { id: 'subscription', icon: 'fa-ticket', label: 'Abonnement', roles: ['FAMILLE'] }
             );
             if (isMaman) {
                 serviceItems.push({ id: 'education', icon: 'fa-graduation-cap', label: 'Éducation', roles: ['FAMILLE'] });
             }
         }
         
         if (serviceItems.length > 0) {
             sections.push({ title: 'SERVICES', icon: 'fa-briefcase', items: serviceItems, defaultOpen: false });
         }
         
         // Section COMPTE (profil pour tous)
         const accountItems = [
             { id: 'profile', icon: 'fa-user-circle', label: 'Mon profil', roles: ['COORDINATEUR', 'FAMILLE', 'AIDANT'] }
         ].filter(item => item.roles.includes(userRole));
         
         if (accountItems.length > 0) {
             sections.push({ title: 'COMPTE', icon: 'fa-user-circle', items: accountItems, defaultOpen: false });
         }


     
        
        // Stocker l'état d'ouverture des sections dans localStorage
        const getSectionState = (sectionTitle) => {
            const saved = localStorage.getItem(`drawer_section_${sectionTitle}`);
            if (saved !== null) return saved === 'true';
            // Valeur par défaut
            if (sectionTitle === 'PRINCIPAL') return true;
            return false;
        };
        
        const saveSectionState = (sectionTitle, isOpen) => {
            localStorage.setItem(`drawer_section_${sectionTitle}`, isOpen);
        };
        
        // Compter les notifications
        const unreadMessages = Object.values(AppState.unreadByPatient || {}).reduce((a, b) => a + b, 0);
        const pendingVisits = (AppState.visites || []).filter(v => v.statut === "En attente").length;
        
        // Générer le HTML des sections avec accordéon
        drawerMenu.innerHTML = `
            <div class="flex flex-col h-full px-3 py-4">
                ${sections.map(section => {
                    const isOpen = getSectionState(section.title);
                    return `
                        <div class="mb-2">
                            <!-- En-tête de section (cliquable) -->
                            <button class="section-header w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all active:scale-98" 
                                    data-section="${section.title}">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid ${section.icon} ${primaryText} text-xs"></i>
                                    <span class="text-[9px] font-black uppercase tracking-wider ${primaryText}">${section.title}</span>
                                </div>
                                <i class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}"></i>
                            </button>
                            
                            <!-- Corps de section (repliable) -->
                            <div class="section-content ml-2 mt-1 space-y-0.5 ${isOpen ? '' : 'hidden'}">
                                ${section.items.map(item => `
                                    <button onclick="window.switchView('${item.id}'); window.closeDrawerMobile?.()" 
                                            class="drawer-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-98">
                                        <div class="w-8 h-8 rounded-lg ${primaryBgLight} flex items-center justify-center">
                                            <i class="fa-solid ${item.icon} ${primaryText} text-sm"></i>
                                        </div>
                                        <span class="font-medium text-sm text-slate-700 flex-1 text-left">${item.label}</span>
                                        ${item.id === 'feed' && unreadMessages > 0 ? `
                                            <span class="min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-1">${unreadMessages > 9 ? '9+' : unreadMessages}</span>
                                        ` : ''}
                                        ${item.id === 'visits' && pendingVisits > 0 && userRole === 'COORDINATEUR' ? `
                                            <span class="min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-1">${pendingVisits}</span>
                                        ` : ''}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Ajouter les écouteurs d'événements pour l'accordéon
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const sectionTitle = header.dataset.section;
                const content = header.nextElementSibling;
                const chevron = header.querySelector('.fa-chevron-down');
                const isOpen = !content.classList.contains('hidden');
                
                if (isOpen) {
                    content.classList.add('hidden');
                    chevron.classList.add('-rotate-90');
                    chevron.classList.remove('rotate-0');
                    saveSectionState(sectionTitle, false);
                } else {
                    content.classList.remove('hidden');
                    chevron.classList.remove('-rotate-90');
                    chevron.classList.add('rotate-0');
                    saveSectionState(sectionTitle, true);
                }
                
                // Feedback haptique
                if (window.UI?.vibrate) window.UI.vibrate('light');
            });
        });
        
        // Ajouter les styles dynamiques
        const styleId = 'drawer-dynamic-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .drawer-nav-item:active {
                    background: ${primaryBgLight};
                    transform: scale(0.98);
                }
                .drawer-nav-item.active {
                    background: ${primaryBgLight};
                }
                .drawer-nav-item.active i {
                    color: ${primaryColor};
                }
                .drawer-nav-item.active span {
                    color: ${primaryColor};
                }
                .section-header:active {
                    background: ${primaryBgLight};
                    transform: scale(0.98);
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ============================================================
    // INITIALISATION DU DRAWER (menu latéral mobile)
    // ============================================================
    setTimeout(() => {
        const menuBtn = document.getElementById('menu-hamburger');
        const drawer = document.getElementById('mobile-drawer');
        const overlay = document.getElementById('drawer-overlay');
        const closeBtn = document.getElementById('close-drawer');
        
        // Fonction pour fermer le drawer
        window.closeDrawerMobile = () => {
            if (drawer) {
                drawer.classList.remove('show');
                setTimeout(() => {
                    drawer.classList.add('hidden');
                    document.body.style.overflow = '';
                }, 300);
            }
        };
        
        if (menuBtn && drawer) {
            menuBtn.onclick = () => {
                drawer.classList.remove('hidden');
                setTimeout(() => drawer.classList.add('show'), 10);
                document.body.style.overflow = 'hidden';
            };
            
            if (overlay) overlay.onclick = window.closeDrawerMobile;
            if (closeBtn) closeBtn.onclick = window.closeDrawerMobile;
        }
        
const installBtn = document.getElementById('install-app-drawer');
if (installBtn) {
    // Vérifier si l'app est déjà installée
    const isAppInstalled = () => {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true;
    };
    
    // Cacher le bouton si déjà installé
    if (isAppInstalled()) {
        installBtn.style.display = 'none';
    }
    
    installBtn.onclick = () => {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ PWA installée');
                    // Cacher le bouton après installation
                    installBtn.style.display = 'none';
                    if (window.showToast) showToast("Application installée avec succès !", "success");
                } else {
                    console.log('❌ Installation refusée');
                }
                window.deferredPrompt = null;
            });
        } else {
            if (window.showToast) showToast("L'installation sera disponible dans quelques instants", "info");
        }
    };
}
    }, 100);
    

    // Mettre à jour les couleurs du branding
    setTimeout(() => {
        updateBrandingColors();
    }, 50);
}




// ============================================================
// ÉTAPE SANTÉ (pour AVEC_PATIENT)
// ============================================================
function getEtapeSanteHTML(isMamanFlow, themeBgClass, themeTextClass) {
    if (isMamanFlow) {
        return `
            <div class="text-center mb-8">
                <h3 class="text-xl font-black text-slate-800">Suivi Maman & Bébé</h3>
                <p class="text-xs text-slate-400 mt-1">Quelques informations pour mieux vous accompagner</p>
            </div>
            <div class="space-y-4">
                <div class="relative">
                    <i class="fa-solid fa-hospital-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <select id="accouchement" class="app-input !pl-12 !py-3">
                        <option value="">Type d'accouchement</option>
                        <option value="voie_basse">Voie basse</option>
                        <option value="cesarienne">Césarienne</option>
                    </select>
                </div>
                <div class="relative">
                    <i class="fa-solid fa-hand-holding-heart absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                    <select id="allaitement" class="app-input !pl-12 !py-3">
                        <option value="">Allaitement</option>
                        <option value="maternel">Maternel</option>
                        <option value="mixte">Mixte</option>
                        <option value="artificiel">Artificiel</option>
                    </select>
                </div>
                <div>
                    <textarea id="p-notes" class="app-input !py-3" rows="3" placeholder="Informations complémentaires (poids du bébé, sommeil, soucis particuliers...)"></textarea>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="text-center mb-8">
                <h3 class="text-xl font-black text-slate-800">Informations de santé</h3>
                <p class="text-xs text-slate-400 mt-1">Pour un accompagnement adapté</p>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="text-[10px] font-black text-slate-400 ml-1 mb-2 block">Pathologies existantes</label>
                    <div class="flex flex-wrap gap-2">
                        <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Diabète"> Diabète</label>
                        <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Hypertension"> Hypertension</label>
                        <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Arthrose"> Arthrose</label>
                        <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-full text-xs"><input type="checkbox" class="med-hist" value="Alzheimer"> Alzheimer</label>
                    </div>
                </div>
                <div>
                    <textarea id="p-traitements" class="app-input !py-3" rows="2" placeholder="Traitements en cours (médicaments, posologies)"></textarea>
                </div>
                <div>
                    <textarea id="p-allergies" class="app-input !py-3" rows="2" placeholder="Allergies connues"></textarea>
                </div>
                <div>
                    <textarea id="p-notes" class="app-input !py-3" rows="2" placeholder="Autres informations (mobilité, habitudes, précautions)"></textarea>
                </div>
            </div>
        `;
    }
}

// ============================================================
// PACK MÉDICAL (pour AVEC_PATIENT)
// ============================================================
function getPackMedicalHTML(isMamanFlow, themeColor, themeBgClass, themeTextClass) {
    const packs = isMamanFlow ? [
        { id: 'ESSENTIEL', name: 'Essentiel', desc: '2 visites par semaine', price: '50.000', features: ['2 visites/semaine', 'Suivi de base'] },
        { id: 'CONFORT', name: 'Confort', desc: '3 à 4 visites par semaine', price: '85.000', features: ['3-4 visites/semaine', 'Aide à la toilette', 'Préparation repas'] },
        { id: 'SERENITE', name: 'Sérénité', desc: '6 à 7 visites par semaine', price: '150.000', features: ['6-7 visites/semaine', 'Accompagnement complet', 'Urgence 24/7'] },
        { id: 'MATERNITE', name: 'Spécial Maternité', desc: 'Suivi intensif 2 semaines', price: '70.000', features: ['Visite quotidienne', 'Aide bébé', 'Conseils allaitement'] }
    ] : [
        { id: 'PONCTUEL', name: 'Ponctuel', desc: 'À la demande', price: '10.000', features: ['Intervention unique', 'Accompagnement RDV'] },
        { id: 'REGULIER', name: 'Régulier', desc: '2 à 3 visites/semaine', price: '60.000', features: ['2-3 visites/semaine', 'Suivi médical', 'Lien famille'] },
        { id: 'COMPLET', name: 'Complet', desc: '5 à 6 visites/semaine', price: '150.000', features: ['5-6 visites/semaine', 'Présence renforcée', 'Veille sanitaire'] }
    ];
    
    return `
        <div class="text-center mb-8">
            <h3 class="text-xl font-black text-slate-800">Choisissez votre formule</h3>
            <p class="text-xs text-slate-400 mt-1">Tarifs mensuels en CFA</p>
        </div>
        <div id="pack-selector" class="space-y-3 max-h-96 overflow-y-auto">
            ${packs.map(pack => `
                <div onclick="window.selectPack('${pack.id}', '${pack.price}')" 
                     class="pack-card p-4 bg-white rounded-xl border-2 cursor-pointer transition-all ${registrationData.type_pack === pack.id ? `border-${themeColor}-500 ${themeBgClass}` : 'border-slate-100'}"
                     data-pack-id="${pack.id}">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl ${registrationData.type_pack === pack.id ? themeBgClass : 'bg-slate-50'} flex items-center justify-center">
                            <i class="fa-solid ${pack.id.includes('CONFORT') || pack.id.includes('REGULIER') ? 'fa-chart-line' : pack.id.includes('SERENITE') || pack.id.includes('COMPLET') ? 'fa-crown' : 'fa-seedling'} ${registrationData.type_pack === pack.id ? themeTextClass : 'text-slate-400'} text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-center">
                                <p class="font-black text-slate-800">${pack.name}</p>
                                <p class="text-base font-black ${themeTextClass}">${pack.price} F</p>
                            </div>
                            <p class="text-[10px] text-slate-400">${pack.desc}</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${pack.features.map(f => `<span class="text-[8px] text-slate-400">✓ ${f}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="mt-6">
            <button onclick="window.nextAuthStep()" 
                    id="pack-continue-btn"
                    class="w-full py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg transition-all active:scale-95 ${registrationData.type_pack ? (isMamanFlow ? 'bg-pink-500' : 'bg-emerald-500') : 'bg-slate-200 text-slate-400 cursor-not-allowed'}"
                    ${!registrationData.type_pack ? 'disabled' : ''}>
                Continuer
            </button>
        </div>
    `;
}

// ============================================================
// PACK CONFORT 24/7 (pour SANS_PATIENT)
// ============================================================
function getPackConfortHTML(themeColor, themeBgClass, themeTextClass) {
    const packs = [
        { id: 'CONFORT_247_MENSUEL', name: 'Pack Confort Mensuel', desc: 'Accès complet', price: '25.000', duration: 1, features: ['Commandes illimitées', 'Support prioritaire', 'Accès contenu éducatif'] },
        { id: 'CONFORT_247_TRIMESTRIEL', name: 'Pack Confort 3 mois', desc: 'Économie 5%', price: '71.250', originalPrice: '75.000', duration: 3, features: ['Commandes illimitées', 'Support prioritaire', 'Accès contenu éducatif', 'Économie 5%'] },
        { id: 'CONFORT_247_ANNUEL', name: 'Pack Confort 1 an', desc: 'Économie 15%', price: '255.000', originalPrice: '300.000', duration: 12, features: ['Commandes illimitées', 'Support prioritaire', 'Accès contenu éducatif', 'Économie 15%'] }
    ];
    
    return `
        <div class="text-center mb-8">
            <h3 class="text-xl font-black text-slate-800">Pack Confort 24/7</h3>
            <p class="text-xs text-slate-400 mt-1">Commandes illimitées et support prioritaire</p>
        </div>
        <div id="pack-selector" class="space-y-3 max-h-96 overflow-y-auto">
            ${packs.map(pack => `
                <div onclick="window.selectPackConfort('${pack.id}', '${pack.price}', ${pack.duration})" 
                     class="pack-card p-4 bg-white rounded-xl border-2 cursor-pointer transition-all ${registrationData.type_pack === pack.id ? `border-${themeColor}-500 ${themeBgClass}` : 'border-slate-100'}"
                     data-pack-id="${pack.id}">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl ${registrationData.type_pack === pack.id ? themeBgClass : 'bg-slate-50'} flex items-center justify-center">
                            <i class="fa-solid fa-crown ${registrationData.type_pack === pack.id ? themeTextClass : 'text-slate-400'} text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex justify-between items-center">
                                <p class="font-black text-slate-800">${pack.name}</p>
                                <div class="text-right">
                                    ${pack.originalPrice ? `<span class="text-[10px] text-slate-400 line-through mr-2">${pack.originalPrice} F</span>` : ''}
                                    <p class="text-base font-black ${themeTextClass}">${pack.price} F</p>
                                </div>
                            </div>
                            <p class="text-[10px] text-slate-400">${pack.desc}</p>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${pack.features.map(f => `<span class="text-[8px] text-slate-400">✓ ${f}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="mt-4 p-3 bg-blue-50 rounded-xl">
            <p class="text-[9px] text-blue-600 font-medium">✨ Ce pack vous permet de :</p>
            <ul class="text-[9px] text-slate-500 mt-1 space-y-0.5">
                <li>• Passer des commandes de produits (couches, lait, médicaments, etc.)</li>
                <li>• Bénéficier d'un support prioritaire 24/7</li>
                <li>• Accéder à tous les contenus éducatifs</li>
                <li>• Ajouter un patient plus tard si nécessaire</li>
            </ul>
        </div>
        <div class="mt-6">
            <button onclick="window.nextAuthStep()" 
                    id="pack-continue-btn"
                    class="w-full py-4 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-lg transition-all active:scale-95 ${registrationData.type_pack ? 'bg-emerald-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}"
                    ${!registrationData.type_pack ? 'disabled' : ''}>
                Continuer
            </button>
        </div>
    `;
}



// ============================================================
// SÉLECTION DU PACK CONFORT (pour comptes SANS_PATIENT)
// ============================================================
window.selectPackConfort = (packId, price, durationMonths) => {
    registrationData.type_pack = packId;
    registrationData.montant_prevu = price;
    registrationData.duree_abonnement_mois = durationMonths;
    
    const isMamanFlow = registrationData.categorie === 'MAMAN_BEBE';
    const themeColor = isMamanFlow ? 'pink' : 'emerald';
    const themeBgClass = isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50';
    const themeBorderClass = isMamanFlow ? 'border-pink-200' : 'border-emerald-200';
    const themeColorClass = isMamanFlow ? 'text-pink-600' : 'text-emerald-600';
    const borderColorClass = isMamanFlow ? 'border-pink-500' : 'border-emerald-500';
    const bgColorClass = isMamanFlow ? 'bg-pink-500' : 'bg-emerald-500';
    
    document.querySelectorAll('.pack-card').forEach(card => {
        const cardPackId = card.dataset.packId;
        if (cardPackId === packId) {
            card.classList.add(borderColorClass);
            card.classList.add(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
            card.classList.add(isMamanFlow ? 'border-pink-200' : 'border-emerald-200');
            card.classList.remove('border-slate-100');
            
            const iconDiv = card.querySelector('.w-12.h-12');
            if (iconDiv) {
                iconDiv.classList.add(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
                iconDiv.classList.remove('bg-slate-50');
                const icon = iconDiv.querySelector('i');
                if (icon) {
                    icon.classList.add(themeColorClass);
                    icon.classList.remove('text-slate-400');
                }
            }
        } else {
            card.classList.remove(borderColorClass);
            card.classList.remove(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
            card.classList.remove(isMamanFlow ? 'border-pink-200' : 'border-emerald-200');
            card.classList.add('border-slate-100');
            
            const iconDiv = card.querySelector('.w-12.h-12');
            if (iconDiv) {
                iconDiv.classList.remove(isMamanFlow ? 'bg-pink-50' : 'bg-emerald-50');
                iconDiv.classList.add('bg-slate-50');
                const icon = iconDiv.querySelector('i');
                if (icon) {
                    icon.classList.remove(themeColorClass);
                    icon.classList.add('text-slate-400');
                }
            }
        }
    });
    
    const continueBtn = document.getElementById('pack-continue-btn');
    if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.classList.remove('bg-slate-200', 'text-slate-400', 'cursor-not-allowed');
        continueBtn.classList.add(isMamanFlow ? 'bg-pink-500' : 'bg-emerald-500');
    }
    
    UI.vibrate('success');
};

// ============================================================
// LIENS DE NAVIGATION (DESKTOP)
// ============================================================

function getNavLinks(role, mode) {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const isFamily = role === "FAMILLE";
    const isAidant = role === "AIDANT";
    const isCoordinateur = role === "COORDINATEUR";
    
    // 🔥 NOUVEAU : Récupérer le type de compte
    const typeCompte = localStorage.getItem("user_type_compte") || "AVEC_PATIENT";
    const isSansPatient = typeCompte === "SANS_PATIENT";
    
    // ============================================================
    // DÉFINITION DES ONGLETS SELON LE RÔLE ET LE TYPE DE COMPTE
    // ============================================================
    let tabs = [];
    
    if (isCoordinateur) {
        // 👔 COORDINATEUR (inchangé)
        tabs = [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
            { id: 'patients', icon: 'fa-hospital-user', label: 'Patients' },
            { id: 'aidants', icon: 'fa-user-nurse', label: 'Aidants' },
            { id: 'planning', icon: 'fa-calendar-days', label: 'Planning' },
            { id: 'rh-dashboard', icon: 'fa-users', label: 'RH' },
            { id: 'map', icon: 'fa-location-dot', label: 'Radar' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Factures' },
            { id: 'profile', icon: 'fa-user-circle', label: 'Profil' },
            { id: 'users', icon: 'fa-users', label: 'Utilisateurs' }
        ];
    } 
    else if (isAidant) {
        // 🩺 AIDANT (inchangé)
        tabs = [
            { id: 'patients', icon: 'fa-folder-open', label: 'Mes patients' },
            { id: 'planning', icon: 'fa-calendar-days', label: 'Planning' },
            { id: 'visits', icon: 'fa-calendar-check', label: 'Visites' },
            { id: 'commandes', icon: 'fa-box', label: 'Livraisons' },
            { id: 'map', icon: 'fa-location-dot', label: 'Radar' },
            { id: 'profile', icon: 'fa-user-circle', label: 'Profil' }
        ];
    } 
    else if (isFamily && isMaman) {
        // 🌸 MAMAN & BÉBÉ - Dashboard unique
        if (isSansPatient) {
            tabs = [
                { id: 'home', icon: 'fa-home', label: 'Accueil' },
                { id: 'commandes', icon: 'fa-box', label: 'Mes commandes' },
                { id: 'education', icon: 'fa-graduation-cap', label: 'Éducation' },
                { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Factures' },
                { id: 'profile', icon: 'fa-user-circle', label: 'Profil' }
            ];
        } else {
            tabs = [
                { id: 'home', icon: 'fa-home', label: 'Accueil' },
                { id: 'feed', icon: 'fa-newspaper', label: 'Journal bébé' },
                { id: 'visits', icon: 'fa-calendar-check', label: 'Visites' },
                { id: 'commandes', icon: 'fa-box', label: 'Commandes bébé' },
                { id: 'education', icon: 'fa-graduation-cap', label: 'Éducation' },
                { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Factures' },
                { id: 'profile', icon: 'fa-user-circle', label: 'Profil' }
            ];
        }
    }
    else if (isFamily && !isMaman) {
        // 👴 SENIOR
        if (isSansPatient) {
            tabs = [
                { id: 'home', icon: 'fa-home', label: 'Accueil' },
                { id: 'commandes', icon: 'fa-box', label: 'Mes commandes' },
                { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Factures' },
                { id: 'profile', icon: 'fa-user-circle', label: 'Profil' }
            ];
        } else {
            tabs = [
                { id: 'dashboard', icon: 'fa-chart-line', label: 'Tableau de bord' },
                { id: 'feed', icon: 'fa-newspaper', label: 'Journal de soins' },
                { id: 'visits', icon: 'fa-calendar-check', label: 'Visites' },
                { id: 'commandes', icon: 'fa-box', label: 'Commandes' },
                { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Factures' },
                { id: 'subscription', icon: 'fa-ticket', label: 'Abonnement' },
                { id: 'profile', icon: 'fa-user-circle', label: 'Profil' }
            ];
        }
    }

    // ============================================================
    // GÉNÉRATION DU HTML
    // ============================================================
    if (mode === 'mobile') {
        return tabs.map(tab => `
            <button onclick="window.switchView('${tab.id}')" data-view="${tab.id}" class="nav-btn flex flex-col items-center gap-1 flex-1 text-slate-400 transition-all">
                <i class="fa-solid ${tab.icon} text-lg"></i>
                <span class="text-[8px] font-black uppercase tracking-tighter">${tab.label}</span>
            </button>
        `).join('');
    } else {
        return tabs.map(tab => `
            <button onclick="window.switchView('${tab.id}')" data-view="${tab.id}" 
                    class="sidebar-link w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm">
                <i class="fa-solid ${tab.icon} text-base w-5"></i>
                <span>${tab.label}</span>
            </button>
        `).join('');
    }
}

// ============================================================
// TRANSITION ENTRE LES VUES (SWITCHVIEW)
// ============================================================
let isTransitioning = false;
let pendingView = null;

window.switchView = async function(viewName) {
    if (isTransitioning) {
        pendingView = viewName;
        return;
    }
    
    isTransitioning = true;
    const container = document.getElementById("view-container");
    
    if (!container) {
        isTransitioning = false;
        return;
    }
    
    // ✅ AFFICHER LE LOADER IMMÉDIATEMENT (sans attendre)
    const isMaman = localStorage.getItem('user_is_maman') === 'true';
    const loaderIcon = isMaman ? CONFIG.LOGO_MAMAN_ICON : CONFIG.LOGO_GENERAL_ICON;
    
    // Changer le contenu instantanément (pas d'animation de sortie qui crée un blanc)
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 min-h-[300px] animate-fadeIn">
            <div class="relative">
                <div class="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                <img src="${loaderIcon}" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-7 h-7 object-contain">
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-4">Chargement...</p>
            <p class="text-[8px] text-slate-300 mt-1">Santé Plus Services</p>
        </div>
    `;
    
    try {
        await performViewSwitch(viewName);
        
        // ✅ La nouvelle vue est déjà chargée, plus besoin de transformation
        // On s'assure juste que la vue est visible
        container.style.opacity = "1";
        
    } catch (err) {
        console.error("❌ Erreur switchView:", err);
        container.innerHTML = `<div class="p-10 text-center bg-white rounded-2xl border border-rose-100 shadow-sm animate-fadeIn">
                                    <i class="fa-solid fa-circle-exclamation text-rose-500 text-3xl mb-4"></i>
                                    <h3 class="text-rose-500 font-black text-lg uppercase">Erreur de chargement</h3>
                                    <p class="text-xs text-slate-500 mt-2">${err.message || "Le serveur n'a pas pu répondre."}</p>
                                    <button onclick="window.switchView('${viewName}')" class="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Réessayer</button>
                                </div>`;
    }
    
    isTransitioning = false;
    if (pendingView) {
        const next = pendingView;
        pendingView = null;
        window.switchView(next);
    }
};


// ============================================================
// CHARGEMENT D'UNE VUE SPÉCIFIQUE
// ============================================================
async function performViewSwitch(viewName) {
    const container = document.getElementById("view-container");
    const titleElement = document.getElementById("view-title");
    if (!container) return;

    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const isFamily = userRole === "FAMILLE";
    const paymentStatus = localStorage.getItem("payment_status");

    // ============================================================
    // 1. VÉRIFICATIONS D'ACCÈS
    // ============================================================
    
    // Vues réservées au coordinateur
    const adminOnlyViews = ["dashboard", "aidants", "rh-dashboard", "admin"];
    if (adminOnlyViews.includes(viewName) && userRole !== "COORDINATEUR") {
        UI.error("Accès non autorisé");
        window.switchView("home");
        return;
    }
    
    // Vues réservées aux aidants et coordinateurs
    const aidantRestrictedViews = ["planning", "start-visit", "end-visit"];
    if (aidantRestrictedViews.includes(viewName) && userRole !== "AIDANT" && userRole !== "COORDINATEUR") {
        UI.error("Accès non autorisé");
        window.switchView("home");
        return;
    }

    // Sécurité paiement : accès restreint si impayé (pour famille uniquement)
    const paymentRestrictedViews = ["feed", "visits", "commandes"];
    if (userRole === "FAMILLE" && paymentStatus === "En retard" && paymentRestrictedViews.includes(viewName)) {
        UI.vibrate("error");
        Swal.fire({
            icon: "warning",
            title: `<span class="text-rose-600 font-black">Accès Suspendu</span>`,
            html: `<p class="text-sm text-slate-500">Merci de régulariser votre abonnement pour accéder au suivi en direct de votre proche.</p>`,
            confirmButtonText: "VOIR MA FACTURE",
            confirmButtonColor: "#0F172A",
            customClass: { popup: 'rounded-[2.5rem]' }
        }).then(() => window.switchView("billing"));
        return;
    }

    // ============================================================
    // 2. MISE À JOUR DES ONGLETS ACTIFS
    // ============================================================
    document.querySelectorAll(".nav-btn, .sidebar-link").forEach((btn) => {
        const isActive = btn.dataset.view === viewName;
        if (btn.classList.contains('sidebar-link')) {
            btn.classList.toggle("active", isActive);
            btn.classList.toggle("text-white", isActive);
            btn.classList.toggle("text-slate-400", !isActive);
        } else {
            btn.classList.toggle("text-green-600", isActive);
            btn.classList.toggle("text-slate-400", !isActive);
        }
    });

    // ============================================================
    // 3. TITRES DYNAMIQUES
    // ============================================================
    let patientsTitle = "Gestion des Dossiers";
    let feedTitle = "Journal de Soins Live";
    let commandesTitle = "Commandes";
    let commandesDesc = "Produits et livraisons";
    let commandesBtnColor = "emerald-600";
    
    if (isFamily) {
        if (isMaman) {
            patientsTitle = "Mon accompagnement";
            feedTitle = "Mon journal";
            commandesTitle = "Commandes bébé";
            commandesDesc = "Couches, lait, puériculture";
            commandesBtnColor = "pink-500";
        } else {
            patientsTitle = "Mon proche";
            feedTitle = "Journal de soins";
            commandesTitle = "Commandes";
            commandesDesc = "Médicaments et matériel médical";
            commandesBtnColor = "emerald-600";
        }
    }
    
    const viewTitles = {
        dashboard: "Aperçu Analytique", 
        map: "Radar Terrain Live", 
        patients: patientsTitle,
        visits: "Suivi des Interventions", 
        feed: feedTitle, 
        billing: "Centre de Facturation",
        aidants: "Gestion de l'Équipe", 
        commandes: commandesTitle,
        planning: "Agenda des Soins",
        home: "Accueil",
        "rh-dashboard": "RH & Assignations",
        "add-patient": "Nouveau Patient",
        "link-family": "Lier une Famille",
        "add-aidant": "Nouvel Aidant",
        "end-visit": "Clôturer la visite",
        "start-visit": "Démarrer la visite",
        "subscription": "Nos Formules",
        "profile": "Mon Profil"
    };
    
    if (titleElement) titleElement.innerText = viewTitles[viewName] || "Santé Plus";
    localStorage.setItem("last_view", viewName);
    AppState.currentView = viewName;

    // ============================================================
    // 4. TEMPLATES DE BASE
    // ============================================================
    const templates = {
        dashboard: '<div class="animate-fadeIn"><div id="dashboard-content" class="space-y-6"></div></div>',
        map: '<div class="animate-fadeIn h-full" id="map-container"><div id="map" class="h-full w-full rounded-2xl"></div></div>',
        patients: `<div class="animate-slideIn pb-32">
                        <div class="flex justify-between items-center mb-8">
                            <div>
                                <h3 class="font-black text-2xl text-slate-800 tracking-tight">${patientsTitle}</h3>
                                <p class="text-xs text-slate-400 font-bold uppercase mt-1">${isFamily ? (isMaman ? "Santé maman et bébé" : "Suivi médical") : "Base de données active"}</p>
                            </div>
                            ${userRole === "COORDINATEUR" ? `<button onclick="window.openAddPatient()" class="w-12 h-12 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><i class="fa-solid fa-plus"></i></button>` : ""}
                        </div>
                        <div id="patients-list" class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
                    </div>`,
        visits: '<div class="animate-slideIn pb-32"><div id="visits-list" class="space-y-4"></div></div>',
        feed: '<div class="animate-fadeIn h-full" id="feed-container"></div>',
        billing: '<div class="animate-slideIn pb-32"><div id="billing-content"></div></div>',
        commandes: `<div class="animate-slideIn pb-32">
                        <div class="flex justify-between items-center mb-8">
                            <div>
                                <h3 class="font-black text-2xl text-slate-800 tracking-tight">${commandesTitle}</h3>
                                <p class="text-xs text-slate-400 font-bold uppercase mt-1">${commandesDesc}</p>
                            </div>
                            ${userRole === "FAMILLE" ? `<button onclick="window.openOrderModal()" class="w-12 h-12 bg-${commandesBtnColor} text-white rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center"><i class="fa-solid fa-plus text-xl"></i></button>` : ""}
                        </div>
                        <div id="commandes-list" class="space-y-4"></div>
                    </div>`,
        planning: `<div class="animate-slideIn pb-32">
                        <div class="flex justify-between items-center mb-8">
                            <div>
                                <h3 class="font-black text-2xl text-slate-800 tracking-tight">Agenda des Soins</h3>
                                <p class="text-xs text-slate-400 font-bold uppercase mt-1">Planification des interventions</p>
                            </div>
                            ${userRole === "COORDINATEUR" ? `<button onclick="window.openAssignPage()" class="w-12 h-12 bg-slate-900 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><i class="fa-solid fa-calendar-plus"></i></button>` : ""}
                        </div>
                        <div id="planning-list" class="space-y-4"></div>
                    </div>`,
        home: '<div class="animate-fadeIn" id="home-content"></div>',
        profile: '<div class="animate-fadeIn" id="profile-content"></div>',
        notifications: '<div class="animate-fadeIn" id="notifications-content"></div>',
        subscription: '<div class="animate-fadeIn" id="subscription-content"></div>',
        education: '<div class="animate-fadeIn" id="education-content"></div>',
        "dashboard-maman": '<div class="animate-fadeIn" id="maman-dashboard-content"></div>',
        aidants: `<div class="animate-slideIn pb-32">
                        <div class="flex justify-between items-center mb-8">
                            <div>
                                <h3 class="font-black text-2xl text-slate-800 tracking-tight">Équipe & RH</h3>
                                <p class="text-xs text-slate-400 font-bold uppercase mt-1">Gestion des collaborateurs</p>
                            </div>
                            ${userRole === 'COORDINATEUR' ? `<button onclick="window.switchView('add-aidant')" class="w-12 h-12 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center"><i class="fa-solid fa-user-plus text-lg"></i></button>` : ''}
                        </div>
                        <div id="aidants-list" class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
                    </div>`,
        "rh-dashboard": '<div class="animate-fadeIn" id="rh-content"></div>',
        "add-patient": '<div class="animate-fadeIn" id="add-patient-content"></div>',
        "link-family": '<div class="animate-fadeIn" id="link-family-content"></div>',
        "add-aidant": '<div class="animate-fadeIn" id="add-aidant-content"></div>',
        "end-visit": '<div class="animate-fadeIn" id="end-visit-content"></div>',
        "start-visit": '<div class="animate-fadeIn" id="start-visit-content"></div>'
    };

    // Afficher le template immédiatement
    container.innerHTML = templates[viewName] || `<div class="animate-fadeIn"><div id="${viewName}-content"></div></div>`;

    // Animation d'entrée
    container.style.opacity = "0";
    container.style.transform = "translateY(8px)";
    container.style.transition = "opacity 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1), transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1)";
    setTimeout(() => {
        container.style.opacity = "1";
        container.style.transform = "translateY(0)";
        updateActiveNavButtons(viewName);
        updateBottomNav(viewName);
        setTimeout(() => {
            if (container) container.style.transition = "";
        }, 150);
    }, 10);

    // ============================================================
    // 5. CHARGEMENT DES DONNÉES PAR VUE
    // ============================================================
    try {
        switch (viewName) {
            case "dashboard":
                if (userRole === "FAMILLE" && !isMaman) {
                    const module = await import('./modules/dashboard.js');
                    if (module.loadSeniorDashboard) await module.loadSeniorDashboard();
                } else {
                    container.innerHTML = document.getElementById("template-dashboard").innerHTML;
                    await Dashboard.loadAdminDashboard();
                }
                break;
            case "map":
                await MapModule.initLiveMap();
                break;
            case "patients":
                await Patients.loadPatients();
                refreshMicroInteractions();
                break;
            case "visits":
                await Visites.loadVisits();
                break;
            case "feed":
                if (window.cleanupRealtime) window.cleanupRealtime();
                if (!AppState.currentPatient && userRole === "FAMILLE") {
                    window.switchView("patients");
                    return;
                }
                if (!AppState.currentPatient) {
                    const patients = await secureFetch("/patients");
                    if (patients && patients.length > 0) {
                        AppState.currentPatient = patients[0].id;
                        localStorage.setItem("current_patient_id", AppState.currentPatient);
                    }
                }
                console.log("🔄 [switchView] Ouverture du feed pour patient:", AppState.currentPatient);
                await window.loadFeed();
                break;
            case "billing":
                // Utiliser le template HTML existant
                const billingTemplate = document.getElementById("template-billing");
                if (billingTemplate) {
                    container.innerHTML = billingTemplate.innerHTML;
                } else {
                    container.innerHTML = '<div class="animate-slideIn pb-32"><div id="billing-content"></div></div>';
                }
                await Billing.loadBilling();
                break;
            case "aidants":
                await Aidants.loadAidants();
                break;
            case "planning":
                await Planning.loadPlanning();
                break;
            case "commandes":
                await Commandes.loadCommandes();
                break;
            case "add-patient":
                await Patients.renderAddPatientView();
                break;
            case "link-family":
                await Patients.renderLinkFamilyView();
                break;
            case "add-aidant":
                await Aidants.renderAddAidantView();
                break;
            case "end-visit":
                await Visites.renderEndVisitView();
                break;
            case "start-visit":
                if (!AppState.currentPatient) {
                    const patients = await secureFetch("/patients");
                    if (patients && patients.length > 0) {
                        AppState.currentPatient = patients[0].id;
                    } else {
                        UI.error("Aucun patient trouvé");
                        window.switchView('patients');
                        return;
                    }
                }
                await Visites.renderStartVisitView(AppState.currentPatient);
                break;
            case "home":
                const typeCompte = localStorage.getItem("user_type_compte") || "AVEC_PATIENT";
                const isSansPatient = typeCompte === "SANS_PATIENT";
                const isMaman = localStorage.getItem("user_is_maman") === "true";
                const userRole = localStorage.getItem("user_role");
                
                if (isSansPatient && userRole === "FAMILLE") {
                    // Afficher le dashboard spécifique pour comptes sans patient
                    await renderSansPatientDashboard();
                } else if (isMaman && userRole === "FAMILLE") {
                    await Maman.loadMamanDashboard();
                } else {
                    renderMobileHub();
                }
                break;
            case "subscription":
                await Subscription.renderSubscriptionPage();
                break;
            case "rh-dashboard":
                await Admin.renderRHDashboard();
                break;
            case "profile":
                await Profile.renderProfilePage();
                break;
            case "notifications":
                await Notifications.renderNotificationsPage();
                break;
            case "dashboard-maman":
                await Maman.loadMamanDashboard();
                break;
            case "maman-planning":
                if (typeof loadMamanPlanning === 'function') {
                    await loadMamanPlanning();
                } else {
                    const { loadMamanPlanning } = await import("./modules/maman.js");
                    await loadMamanPlanning();
                }
                break;
            case "education":
                if (!isMaman) {
                    UI.warning("Cette section est réservée aux mamans");
                    window.switchView("home");
                    return;
                }
                await loadEducationPage();
                break;
          case "users":
            const { renderUsersPage } = await import('./modules/users.js');
                await renderUsersPage();
                break;
        }

        // Forcer la mise à jour de l'UI aidant si nécessaire
        if (viewName === 'patients' && localStorage.getItem("user_role") === "AIDANT") {
            const activePatientId = localStorage.getItem("active_patient_id");
            if (activePatientId && typeof Visites.refreshAidantUI === 'function') {
                setTimeout(() => {
                    Visites.refreshAidantUI(activePatientId);
                }, 100);
            }
        }

    } catch (err) {
        console.error("DEBUG VIEW ERROR:", err);
        container.innerHTML = `<div class="p-10 text-center bg-white rounded-[2rem] border border-rose-100 shadow-sm animate-fadeIn">
                                    <i class="fa-solid fa-circle-exclamation text-rose-500 text-3xl mb-4"></i>
                                    <h3 class="text-rose-500 font-black text-lg uppercase">Erreur de chargement</h3>
                                    <p class="text-xs text-slate-500 mt-2">${err.message || "Le serveur n'a pas pu répondre à cette requête."}</p>
                                    <button onclick="window.switchView('${viewName}')" class="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Réessayer</button>
                                </div>`;
        container.style.opacity = "1";
    }
}
// ============================================================
// MENU PROFIL (COMPTE UTILISATEUR)
// ============================================================
window.openProfileMenu = () => {
    const userName = localStorage.getItem("user_name");
    const userRole = localStorage.getItem("user_role");
    const soundsEnabled = localStorage.getItem('sounds_enabled') === 'true';
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    Swal.fire({
        title: `<div class="text-sm font-black uppercase text-slate-400 tracking-widest mb-1">Mon Compte</div><div class="text-xl font-black text-slate-800">${userName}</div>`,
        html: `
            <div class="text-center p-4">
                <div class="inline-block px-4 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase mb-6">${userRole}</div>
                <div class="space-y-3">
                    <!-- 🌙 Mode Nuit -->
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid ${isDarkMode ? 'fa-moon' : 'fa-sun'} text-slate-400"></i>
                            <span class="text-xs font-bold text-slate-700">Mode ${isDarkMode ? 'Nuit' : 'Jour'}</span>
                        </div>
                    </div>
                    
                    <!-- Effets sonores -->
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-volume-high text-slate-400"></i>
                            <span class="text-xs font-bold text-slate-700">Effets sonores</span>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="sound-toggle" class="sr-only peer" ${soundsEnabled ? 'checked' : ''}>
                            <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-download text-slate-400"></i>
                            <span class="text-xs font-bold text-slate-700">Installer l'application</span>
                        </div>
                        <button onclick="window.installPWA(); Swal.close();" class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">Installer</button>
                    </div>
                    <button onclick="window.logout()" class="w-full py-4 bg-rose-50 text-rose-500 rounded-2xl font-bold text-sm active:scale-95 transition-transform">Déconnexion</button>
                </div>
            </div>`,
        showConfirmButton: false,
        customClass: { popup: 'rounded-3xl p-6' },
        didOpen: () => {
            const soundToggle = document.getElementById('sound-toggle');
            if (soundToggle) {
                soundToggle.addEventListener('change', (e) => {
                    const enabled = e.target.checked;
                    setSoundsEnabled(enabled);
                    if (enabled) {
                        playSound('success');
                        showToast("Sons activés", "success", 1500);
                    } else {
                        showToast("Sons désactivés", "info", 1500);
                    }
                });
            }
        }
    });
};




window.installPWA = () => {
    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast("Application installée !", "success");
            }
            window.deferredPrompt = null;
        });
    } else {
        showToast("L'installation est déjà disponible ou non supportée", "info");
    }
};

// ============================================================
// ONBOARDING (TUTORIEL D'ACCUEIL)
// ============================================================
window.startOnboarding = () => {
    if (localStorage.getItem("onboarding_seen")) return;
    onboardingStep = 0;
    
    // ✅ Récupérer la catégorie de l'utilisateur depuis localStorage
    // Essaye d'abord user_categorie, puis déduis de user_is_maman
    let userCategorie = localStorage.getItem("user_categorie");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    
    // ✅ Si user_categorie n'existe pas mais isMaman est true, c'est MAMAN_BEBE
    if (!userCategorie && isMaman) {
        userCategorie = 'MAMAN_BEBE';
    }
    // ✅ Si ce n'est pas MAMAN_BEBE et que le rôle est FAMILLE, c'est SENIOR
    else if (!userCategorie && localStorage.getItem("user_role") === "FAMILLE") {
        userCategorie = 'SENIOR';
    }
    
    console.log("🎯 Catégorie détectée pour onboarding:", userCategorie);
    
    // ✅ Choisir les bonnes slides
    if (userCategorie === 'MAMAN_BEBE') {
        ONBOARDING_STEPS = ONBOARDING_STEPS_BABY;
        console.log("🌸 Onboarding MAMAN & BÉBÉ chargé");
    } else if (userCategorie === 'SENIOR') {
        ONBOARDING_STEPS = ONBOARDING_STEPS_SENIOR;
        console.log("👴 Onboarding SENIOR chargé");
    } else {
        ONBOARDING_STEPS = ONBOARDING_STEPS_GENERAL;
        console.log("🌍 Onboarding GÉNÉRAL chargé");
    }
    
    renderOnboarding();
};




// ============================================================
// 🚀 PRÉCHARGEMENT COMPLET AVANT AFFICHAGE
// ============================================================

let resourcesLoaded = false;
let resourcesToLoad = [];

// Liste de toutes les ressources à précharger
const RESOURCES_TO_PRELOAD = {
    // Logos et icônes principales
    logos: [
        '/assets/images/logo-general-icon.png',
        '/assets/images/logo-general-text.png',
        '/assets/images/logo-maman-icon.png',
        '/assets/images/logo-maman-text.png',
        '/assets/fontawesome/webfonts/fa-solid-900.woff2',
        '/assets/fontawesome/webfonts/fa-regular-400.woff2',
        '/assets/fontawesome/webfonts/fa-brands-400.woff2'
    ],
    // Images onboarding
    onboarding: [
        '/assets/images/onboarding/general-step1.png',
        '/assets/images/onboarding/general-step2.png',
        '/assets/images/onboarding/general-step3.png',
        '/assets/images/onboarding/general-step4.png',
        '/assets/images/onboarding/general-step5.png',
        '/assets/images/onboarding/senior-step1.png',
        '/assets/images/onboarding/senior-step2.png',
        '/assets/images/onboarding/senior-step3.png',
        '/assets/images/onboarding/senior-step4.png',
        '/assets/images/onboarding/senior-step5.png',
        '/assets/images/onboarding/senior-step6.png',
        '/assets/images/onboarding/maman-step1.png',
        '/assets/images/onboarding/maman-step2.png',
        '/assets/images/onboarding/maman-step3.png',
        '/assets/images/onboarding/maman-step4.png',
        '/assets/images/onboarding/maman-step5.png',
        '/assets/images/onboarding/maman-step6.png'
    ],
    // Bannières
    banners: [
        '/assets/images/banners/coord-banner.png',
        '/assets/images/banners/aidant-banner.png',
        '/assets/images/banners/maman-banner.png',
        '/assets/images/banners/senior-banner.png',
        '/assets/images/banners/coord-visit.png',
        '/assets/images/banners/aidant-visit.png',
        '/assets/images/banners/maman-visit.png',
        '/assets/images/banners/senior-visit.png'
    ]
};

// Rassembler toutes les ressources
const ALL_RESOURCES = [
    ...RESOURCES_TO_PRELOAD.logos,
    ...RESOURCES_TO_PRELOAD.onboarding,
    ...RESOURCES_TO_PRELOAD.banners
];

async function preloadResources() {
    const total = ALL_RESOURCES.length;
    let loaded = 0;
    
    // Mettre à jour la barre de progression
    const updateProgress = () => {
        loaded++;
        const percent = Math.round((loaded / total) * 100);
        const progressBar = document.getElementById('preload-progress-bar');
        const progressText = document.getElementById('preload-progress-text');
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}%`;
    };
    
    // Charger chaque ressource
    const promises = ALL_RESOURCES.map(src => {
        return new Promise((resolve) => {
            // Déterminer le type de ressource par extension
            const ext = src.split('.').pop().toLowerCase();
            
            if (ext === 'woff2') {
                // Police - utiliser un simple fetch pour précharger
                fetch(src, { mode: 'no-cors' })
                    .then(() => { updateProgress(); resolve(); })
                    .catch(() => { updateProgress(); resolve(); });
            } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'svg') {
                // Image
                const img = new Image();
                img.onload = () => { updateProgress(); resolve(); };
                img.onerror = () => { updateProgress(); resolve(); };
                img.src = src;
            } else {
                updateProgress();
                resolve();
            }
        });
    });
    
    await Promise.all(promises);
    console.log(`✅ ${total} ressources préchargées`);
}



function renderOnboarding() {
    const app = document.getElementById("app");
    
    // ✅ Même logique pour être sûr
    let userCategorie = localStorage.getItem("user_categorie");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    
    if (!userCategorie && isMaman) {
        userCategorie = 'MAMAN_BEBE';
    } else if (!userCategorie && localStorage.getItem("user_role") === "FAMILLE") {
        userCategorie = 'SENIOR';
    }
    
    if (userCategorie === 'MAMAN_BEBE') {
        ONBOARDING_STEPS = ONBOARDING_STEPS_BABY;
    } else if (userCategorie === 'SENIOR') {
        ONBOARDING_STEPS = ONBOARDING_STEPS_SENIOR;
    } else {
        ONBOARDING_STEPS = ONBOARDING_STEPS_GENERAL;
    }
    
    const step = ONBOARDING_STEPS[onboardingStep];
    const isLast = onboardingStep === ONBOARDING_STEPS.length - 1;


    app.innerHTML = `
        <div class="absolute inset-0 z-[10000] animate-fadeIn font-sans bg-white flex flex-col">

            <div class="onboarding-image-container animate-fadeIn ${step.isLogo ? 'flex items-center justify-center bg-white' : ''}" style="${step.isLogo ? 'background: white;' : ''}">
                ${step.isLogo ? 
                    `<img src="${step.image}" class="w-48 h-48 object-contain" style="max-width: 200px; max-height: 200px;">` :
                    `<img src="${step.image}" class="onboarding-img shadow-2xl">
                     <div class="onboarding-image-blur"></div>`
                }

                    ${!isLast && !step.isFinal ? `
                        <button onclick="window.finishOnboarding()" 
                                class="absolute top-10 right-6 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/30 z-50"
                                style="color: ${isMaman ? '#E11D48' : '#059669'}">
                            Ignorer
                        </button>
                    ` : ''}
                </div>
            
            <div class="flex-1 flex flex-col items-center text-center px-10 pb-10">
                <h2 class="text-3xl font-[900] text-slate-900 tracking-tight mb-4 leading-tight">${step.title}</h2>
                <p class="text-slate-400 text-sm leading-relaxed mb-auto">${step.desc}</p>
                <div class="flex gap-2 mb-8">
                    ${ONBOARDING_STEPS.map((_, i) => `<div class="onboarding-dot ${i === onboardingStep ? 'active' : ''}"></div>`).join('')}
                </div>
                <button onclick="${isLast ? 'window.finishOnboarding()' : 'window.nextOnboarding()'}" 
                        class="w-full py-5 rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
                        style="background: ${isMaman ? '#E11D48' : '#059669'}; color: white;">
                    ${isLast ? 'Go SantéPlus' : 'Continuer'}
                </button>
            </div>
        </div>
    `;
}


// Vérifier si une visite est en cours au chargement
async function checkActiveVisit() {
    const activeVisitId = localStorage.getItem("active_visit_id");
    if (activeVisitId) {
        // Vérifier si la visite existe toujours en backend
        try {
            const visits = await secureFetch("/visites");
            const activeVisit = visits.find(v => v.id === activeVisitId && v.statut === "En cours");
            if (!activeVisit) {
                // La visite n'existe plus ou est terminée, nettoyer
                localStorage.removeItem("active_visit_id");
                localStorage.removeItem("geo_watch_id");
            }
        } catch (err) {
            console.error("Erreur vérification visite active:", err);
        }
    }
}





function getNextVisitImage(role) {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const basePath = "/assets/images/banners/";
    
    if (role === "COORDINATEUR") {
        return basePath + "coord-visit.png";
    } else if (role === "AIDANT") {
        return basePath + "aidant-visit.png";
    } else if (role === "FAMILLE" && isMaman) {
        return basePath + "maman-visit.png";
    } else {
        return basePath + "senior-visit.png";
    }
}

/**
 * 🎨 Applique les couleurs dynamiques aux éléments
 */
function applyDynamicColors() {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    const primaryLight = isMaman ? '#FFF1F2' : '#ECFDF5';
    
    // Appliquer aux boutons sans classe
    document.querySelectorAll('.dynamic-btn, button[class*="bg-emerald"], button[class*="bg-pink"]').forEach(btn => {
        btn.style.backgroundColor = primaryColor;
    });
    
    // Appliquer aux bordures
    document.querySelectorAll('.dynamic-border').forEach(el => {
        el.style.borderColor = primaryColor;
    });
}

// Appeler après chaque chargement de vue
window.addEventListener('view-loaded', () => applyDynamicColors());

/**
 * 🎨 Met à jour les couleurs du branding partout
 */


function updateBrandingColors() {
    const isMaman = localStorage.getItem('user_is_maman') === 'true';
    
    // Mettre à jour la couleur de "Santé" partout
    const santeElements = document.querySelectorAll('#header-sante, #sidebar-sante, #footer-sante, #loader-sante, .mobile-brand-sante');
    santeElements.forEach(el => {
        if (el) {
            el.style.color = isMaman ? '#DB2777' : '#10B981';
        }
    });
    
    // ✅ Changer le texte de "Service" ou "Maman & Bébé"
    const serviceElements = document.querySelectorAll('#header-service, #sidebar-service, #footer-service, #loader-service, .mobile-brand-service');
    serviceElements.forEach(el => {
        if (el) {
            if (isMaman) {
                el.textContent = 'Maman & Bébé';
            } else {
                el.textContent = 'Service';
            }
            el.style.color = '#64748B';
        }
    });
    
    // Mettre à jour "Plus" (couleur or)
    const plusElements = document.querySelectorAll('#header-plus, #sidebar-plus, #footer-plus, .mobile-brand-plus');
    plusElements.forEach(el => {
        if (el) {
            el.style.color = '#D4AF37'; // Or
        }
    });
    
    // Mettre à jour les logos
    const logoElements = document.querySelectorAll('#header-logo-img, #sidebar-logo-img, #loader-logo-img');
    const logoSrc = isMaman 
        ? '/assets/images/logo-maman-icon.png'
        : '/assets/images/logo-general-icon.png';
    
    logoElements.forEach(img => {
        if (img) img.src = logoSrc;
    });
    
    // Barre de progression du loader
    const loaderBar = document.querySelector('#initial-loader .bg-emerald-500, #initial-loader .bg-pink-500');
    if (loaderBar) {
        if (isMaman) {
            loaderBar.classList.remove('bg-emerald-500');
            loaderBar.classList.add('bg-pink-500');
        } else {
            loaderBar.classList.remove('bg-pink-500');
            loaderBar.classList.add('bg-emerald-500');
        }
    }
}
//fonction
window.updateBrandingColors = updateBrandingColors;

window.nextOnboarding = () => {
    onboardingStep++;
    renderOnboarding();
};

window.finishOnboarding = () => {
    localStorage.setItem("onboarding_seen", "true");
    console.log("✅ Onboarding marqué comme vu", localStorage.getItem("onboarding_seen"));
    window.location.reload(); 
};

// ============================================================
// ÉVÉNEMENTS GLOBAUX
// ============================================================
// ============================================================
// ÉVÉNEMENTS GLOBAUX
// ============================================================
window.CONFIG = CONFIG;
window.AppState = AppState;
window.login = Auth.handleLogin;
window.logout = Auth.handleLogout;
window.refreshAidantUI = Visites.refreshAidantUI;
window.renderFeed = Messages.renderFeed;
window.loadPatients = Patients.loadPatients;
window.loadVisits = Visites.loadVisits;
window.verifyOTP = Auth.verifyOTP;
window.openAddPatient = () => window.switchView('add-patient');
window.openEndVisit = () => window.switchView('end-visit');
window.submitAddAidant = Aidants.submitAddAidant;
window.loadEducationPage = Education.loadEducationPage;
window.openLinkFamilyModal = (id, name) => {
    AppState.tempData = { patientId: id, patientName: name }; 
    window.switchView('link-family');
};
window.openAddAidantModal = Aidants.openAddAidantModal;

if (Commandes && typeof Commandes.markAsDelivered === 'function') {
    window.markAsDelivered = Commandes.markAsDelivered.bind(Commandes);
    console.log("✅ window.markAsDelivered assignée");
} else {
    console.error("❌ Commandes.markAsDelivered n'est pas une fonction");
}


window.viewPatientFeed = async (patientId) => {
    const userRole = localStorage.getItem("user_role");
    const titleElement = document.getElementById("view-title");
    
    // Mettre à jour le patient courant
    localStorage.setItem("current_patient_id", patientId);
    AppState.currentPatient = patientId;
    
    console.log("🔄 [viewPatientFeed] Changement de patient vers:", patientId);
    
    // Vider le cache
    if (window.clearApiCache) window.clearApiCache();
    if (window.cleanupRealtime) window.cleanupRealtime();
    AppState.messages = [];
    
    if (userRole === 'AIDANT') {
        UI.vibrate();
        if (titleElement) titleElement.innerText = "Briefing Patient";
        
        // ✅ CHARGER LES INFOS DU PATIENT AVANT D'AFFICHER
        try {
            const patient = await secureFetch(`/patients/${patientId}`);
            console.log("📋 Patient chargé:", patient);
            
            // Mettre à jour le titre avec le nom du patient
            if (titleElement && patient?.nom_complet) {
                titleElement.innerText = `Briefing : ${patient.nom_complet}`;
            }
            
            await Patients.renderPatientDetailsView(patientId);
        } catch (err) {
            console.error("Erreur chargement patient:", err);
            UI.error("Impossible de charger les infos du patient");
        }
    } else {
        await window.switchView("feed");
    }
};


window.viewPatientDetails = Patients.renderPatientDetailsView;
window.renderAuthView = renderAuthView;
window.nextAuthStep = nextAuthStep;
window.prevAuthStep = prevAuthStep;
window.setPlan = (plan) => {
    registrationData.formule = plan;
    renderAuthView('register', 4);
};
window.submitRegistration = submitRegistration;
window.loadMamanPlanning = Maman.loadMamanPlanning;
window.startOnboarding = startOnboarding;
window.finishOnboarding = finishOnboarding;
window.nextOnboarding = nextOnboarding;
window.setPatientHomeDirect = Patients.setPatientHomeDirect;
window.openAssignModal = Planning.openAssignModal;
window.openAssignPage = Planning.openAssignPage;
window.openOrderModal = Commandes.openOrderModal;
window.loadPlanning = Planning.loadPlanning;
window.loadCommandes = Commandes.loadCommandes;
window.openMissionBriefing = Planning.openMissionBriefing;
console.log("✅ openMissionBriefing assignée depuis Planning:", typeof window.openMissionBriefing);
window.loadRegistrations = Admin.loadRegistrations;
window.confirmActivation = Admin.confirmActivation;
window.fetchStats = Dashboard.fetchStats;
window.openActivationPage = Admin.openActivationPage;
window.confirmCommand = Commandes.confirmCommand;
window.processValidation = Admin.processValidation;
window.loadMamanDashboard = Maman.loadMamanDashboard;

if (typeof quickValidate === 'function') {
    window.quickValidate = quickValidate;
    console.log("✅ window.quickValidate assignée");
} else {
    console.error("❌ quickValidate n'est pas une fonction");
}
window.setThemeColor = setThemeColor;
window.openModernSelector = openModernSelector;
window.showToast = showToast;
window.UI = UI;
window.playSound = playSound;
window.renderRHDashboard = Admin.renderRHDashboard;




// Événements pour la page d'assignation (dropdowns)
document.addEventListener('click', (e) => {
    const aidantItem = e.target.closest('.aidant-item');
    if (aidantItem) {
        const id = aidantItem.dataset.id;
        const name = aidantItem.dataset.name;
        const email = aidantItem.dataset.email;
        window._selectedAidant = { id, name, email };
        const nameEl = document.getElementById('selected-aidant-name');
        const emailEl = document.getElementById('selected-aidant-email');
        if (nameEl) nameEl.innerText = name;
        if (emailEl) emailEl.innerHTML = email || '<span class="text-slate-400">Email non renseigné</span>';
        const dropdown = document.getElementById('aidant-dropdown');
        const chevron = document.getElementById('aidant-chevron');
        if (dropdown) dropdown.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        document.querySelectorAll('.aidant-item').forEach(el => el.classList.remove('bg-emerald-50'));
        aidantItem.classList.add('bg-emerald-50');
        UI.vibrate('click');
    }
    
    const patientItem = e.target.closest('.patient-item');
    if (patientItem) {
        const id = patientItem.dataset.id;
        const name = patientItem.dataset.name;
        const formule = patientItem.dataset.formule;
        window._selectedPatient = { id, name, formule };
        const nameEl = document.getElementById('selected-patient-name');
        const formuleEl = document.getElementById('selected-patient-formule');
        if (nameEl) nameEl.innerText = name;
        if (formuleEl) formuleEl.innerHTML = formule || 'Standard';
        const dropdown = document.getElementById('patient-dropdown');
        const chevron = document.getElementById('patient-chevron');
        if (dropdown) dropdown.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('bg-blue-50'));
        patientItem.classList.add('bg-blue-50');
        UI.vibrate('click');
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#aidant-selector')) {
        const dropdown = document.getElementById('aidant-dropdown');
        const chevron = document.getElementById('aidant-chevron');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }
    if (!e.target.closest('#patient-selector')) {
        const dropdown = document.getElementById('patient-dropdown');
        const chevron = document.getElementById('patient-chevron');
        if (dropdown && !dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }
});



// Met à jour la couleur des icônes du menu du bas
function updateActiveNavButtons(viewName) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const btnView = btn.getAttribute('data-view');
        if (btnView === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}
// ============================================================
// VALIDATION D'ACTIVATION DE COMPTE
// ============================================================
window.processValidation = async (id, email, nom, role) => {
    console.log("🔵 Activation déclenchée pour:", { id, email, nom, role });
    
    const notes = document.getElementById('val-notes')?.value || '';
    
    Swal.fire({ 
        title: 'Activation en cours...', 
        didOpen: () => Swal.showLoading(), 
        allowOutsideClick: false 
    });

    try {
        // ✅ secureFetch est maintenant importé
        const result = await secureFetch('/admin/validate-member', {
            method: 'POST',
            body: JSON.stringify({ 
                user_id: id, 
                email: email, 
                nom: nom, 
                role: role, 
                notes: notes 
            })
        });
        
        console.log("✅ Réponse serveur:", result);
        
        Swal.fire({
            icon: "success",
            title: "✅ Activation réussie !",
            text: `Le compte de ${nom} a été activé.`,
            confirmButtonColor: "#10B981",
            timer: 2000,
            showConfirmButton: false
        });
        
        setTimeout(() => {
            window.switchView('dashboard');
        }, 500);
        
    } catch(error) {
        console.error("❌ Erreur activation:", error);
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: error.message,
            confirmButtonColor: "#F43F5E"
        });
    }
};



// ============================================================
// GESTION DE L'INSTALLATION PWA
// ============================================================

let deferredPrompt = null;
let installPromptShown = false;
let installReminderShown = false;

// Stocker si l'utilisateur a déjà refusé
const INSTALL_DECLINED_KEY = 'pwa_install_declined';
const INSTALL_REMINDER_COUNT = 'pwa_reminder_count';

// Vérifier si l'utilisateur a déjà refusé
function hasDeclinedInstall() {
    return localStorage.getItem(INSTALL_DECLINED_KEY) === 'true';
}




function getBannerImage(role) {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const basePath = "/assets/images/banners/";
    
    if (role === "COORDINATEUR") {
        return basePath + "coord-banner.png";
    } else if (role === "AIDANT") {
        return basePath + "aidant-banner.png";
    } else if (role === "FAMILLE" && isMaman) {
        return basePath + "maman-banner.png";
    } else {
        return basePath + "senior-banner.png";
    }
}


// Marquer que l'utilisateur a refusé
function setDeclinedInstall() {
    localStorage.setItem(INSTALL_DECLINED_KEY, 'true');
}

// Incrémenter le compteur de rappels
function incrementReminderCount() {
    const count = parseInt(localStorage.getItem(INSTALL_REMINDER_COUNT) || '0');
    localStorage.setItem(INSTALL_REMINDER_COUNT, count + 1);
    return count + 1;
}

// Afficher la bannière d'installation
// Afficher la bannière d'installation (version élégante)
function showInstallBanner(message, isReminder = false) {
    // Ne pas montrer si déjà refusé
    if (hasDeclinedInstall()) return;
    
    // Ne pas montrer si déjà installé
    if (isAppInstalled()) return;
    
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: white;
        border-radius: 16px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        z-index: 10001;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        backdrop-filter: blur(10px);
        animation: slideUpBanner 0.3s ease;
    `;
    
    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div style="background: #10B981; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-download" style="color: white; font-size: 16px;"></i>
            </div>
            <div style="flex: 1;">
                <p style="font-weight: 600; margin: 0; font-size: 13px; color: #1e293b;">Installer l'application</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Accès rapide depuis l'écran d'accueil</p>
            </div>
        </div>
        <button id="install-banner-install" style="background: #10B981; border: none; color: white; padding: 8px 16px; border-radius: 40px; font-weight: 600; font-size: 12px; cursor: pointer;">Installer</button>
        <button id="install-banner-close" style="background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">&times;</button>
    `;
    
    document.body.appendChild(banner);
    
    // Ajouter l'animation CSS
    if (!document.getElementById('banner-animation-style')) {
        const style = document.createElement('style');
        style.id = 'banner-animation-style';
        style.textContent = `
            @keyframes slideUpBanner {
                from {
                    opacity: 0;
                    transform: translateY(100px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.getElementById('install-banner-install').onclick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ PWA installée');
                    localStorage.setItem(INSTALL_DECLINED_KEY, 'false');
                    showToast("Application installée avec succès !", "success");
                } else {
                    console.log('❌ Installation refusée');
                    setDeclinedInstall();
                }
                deferredPrompt = null;
                banner.remove();
            });
        } else {
            showToast("L'installation sera disponible dans quelques instants", "info");
            banner.remove();
        }
    };
    
    document.getElementById('install-banner-close').onclick = () => {
        banner.remove();
        if (!isReminder) {
            setDeclinedInstall();
        }
    };
    
    installPromptShown = true;
    
    // Auto-fermeture après 8 secondes
    setTimeout(() => {
        if (document.getElementById('pwa-install-banner')) {
            banner.remove();
        }
    }, 8000);
}
// Vérifier si l'application est déjà installée
function isAppInstalled() {
    // Sur mobile, vérifier si en mode standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    // Sur iOS
    if (window.navigator.standalone === true) {
        return true;
    }
    return false;
}

// Écouter l'événement d'installation
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Ne pas montrer si déjà installé
    if (isAppInstalled()) return;
    
    // Montrer la bannière après un court délai
    setTimeout(() => {
        showInstallBanner("Installez l'application pour un accès rapide", false);
    }, 2000);
});

// Rappel après 3 visites si non installé
function checkReminderForInstall() {
    if (isAppInstalled()) return;
    if (hasDeclinedInstall()) return;
    if (installReminderShown) return;
    
    const reminderCount = parseInt(localStorage.getItem(INSTALL_REMINDER_COUNT) || '0');
    
    // Rappel après la 3ème visite
    if (reminderCount >= 2 && reminderCount < 5) {
        setTimeout(() => {
            showInstallBanner("Pensez à installer l'application pour y accéder plus facilement !", true);
            installReminderShown = true;
        }, 3000);
    }
    
    // Incrémenter le compteur de visites
    incrementReminderCount();
}

// Exécuter le rappel au chargement
setTimeout(() => {
    checkReminderForInstall();
}, 5000);

// Détecter si l'app a été installée (sur iOS)
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installée avec succès');
    localStorage.setItem(INSTALL_DECLINED_KEY, 'false');
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    showToast("Merci d'avoir installé l'application !", "success");
});





window.syncService = syncService;




/**
 * 📱 PULL TO REFRESH (Mobile)
 */
function initPullToRefresh() {
    let touchStartY = 0;
    let isRefreshing = false;
    const mainContent = document.querySelector('main');
    
    if (!mainContent) return;
    
    // Créer l'indicateur
    let indicator = document.getElementById('pull-to-refresh');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'pull-to-refresh';
        indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Tirer pour actualiser';
        mainContent.insertBefore(indicator, mainContent.firstChild);
    }
    
    mainContent.addEventListener('touchstart', (e) => {
        if (mainContent.scrollTop === 0) {
            touchStartY = e.touches[0].clientY;
        }
    });
    
    mainContent.addEventListener('touchmove', (e) => {
        if (mainContent.scrollTop === 0 && !isRefreshing) {
            const diff = e.touches[0].clientY - touchStartY;
            if (diff > 60) {
                indicator.classList.add('active');
                indicator.innerHTML = '<i class="fa-solid fa-arrow-down fa-bounce"></i> Relâcher pour actualiser';
            } else if (diff > 20) {
                indicator.classList.add('active');
                indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Tirer pour actualiser';
            } else {
                indicator.classList.remove('active');
            }
        }
    });
    
    mainContent.addEventListener('touchend', async (e) => {
        if (indicator.classList.contains('active') && !isRefreshing) {
            isRefreshing = true;
            indicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualisation...';
            
            // Rafraîchir la vue courante
            const currentView = AppState.currentView;
            if (currentView && window.switchView) {
                await window.switchView(currentView);
            }
            
            setTimeout(() => {
                indicator.classList.remove('active');
                indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Tirer pour actualiser';
                isRefreshing = false;
                showToast("Données actualisées", "success", 1500);
            }, 1000);
        }
    });
}

function updateBottomNav(viewName) {
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        const btnView = btn.getAttribute('onclick')?.match(/switchView\('([^']+)'\)/)?.[1];
        if (btnView === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ============================================================
// MOT DE PASSE OUBLIÉ
// ============================================================
window.forgotPassword = async () => {
    const { value: email } = await Swal.fire({
        title: "Mot de passe oublié",
        input: "email",
        inputLabel: "Entrez votre adresse email",
        inputPlaceholder: "votre@email.com",
        showCancelButton: true,
        confirmButtonText: "Envoyer",
        cancelButtonText: "Annuler",
        confirmButtonColor: "#10B981",
        inputValidator: (value) => {
            if (!value) {
                return "Email requis";
            }
            if (!value.includes('@')) {
                return "Email invalide";
            }
        }
    });
    
    if (!email) return;
    
    Swal.fire({
        title: "Envoi en cours...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });
    
    try {
        await secureFetch("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email })
        });
        
        Swal.fire({
            icon: "success",
            title: "Email envoyé !",
            text: "Vérifiez votre boîte de réception (pensez à vérifier vos spams).",
            confirmButtonColor: "#10B981"
        });
        
    } catch (err) {
        Swal.close();
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message || "Impossible d'envoyer l'email",
            confirmButtonColor: "#F43F5E"
        });
    }
};




// Appeler dans initApp()
initPullToRefresh();

initApp();
