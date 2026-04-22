// js/modules/notifications.js
import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";

// Stockage des notifications
let notifications = [];
let unreadCount = 0;

/**
 * 📋 PAGE DES NOTIFICATIONS
 */
export async function renderNotificationsPage() {
    const container = document.getElementById("view-container");
    
    await loadNotifications();
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('home')" 
                        class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-95">
                    <i class="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">Notifications</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Historique des alertes</p>
                </div>
                <button onclick="markAllAsRead()" class="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                    Tout marquer comme lu
                </button>
            </div>
            
            <div id="notifications-list" class="space-y-3">
                ${renderNotificationsList()}
            </div>
        </div>
    `;
}

/**
 * 🎨 AFFICHER LA LISTE DES NOTIFICATIONS
 */
function renderNotificationsList() {
    if (notifications.length === 0) {
        return `
            <div class="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <i class="fa-regular fa-bell-slash text-4xl text-slate-300 mb-3"></i>
                <p class="text-sm text-slate-400">Aucune notification</p>
                <p class="text-[10px] text-slate-300 mt-1">Les alertes apparaîtront ici</p>
            </div>
        `;
    }
    
    return notifications.map(notif => `
        <div class="notification-item bg-white rounded-2xl border border-slate-100 p-4 shadow-sm transition-all ${!notif.read ? 'border-l-4 border-l-emerald-500 bg-emerald-50/30' : ''}" 
             data-id="${notif.id}">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl ${getIconBg(notif.type)} flex items-center justify-center">
                    <i class="${getIcon(notif.type)} text-white text-sm"></i>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <p class="font-black text-slate-800 text-sm">${escapeHtml(notif.title)}</p>
                        ${!notif.read ? '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>' : ''}
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(notif.message)}</p>
                    <p class="text-[9px] text-slate-400 mt-2 flex items-center gap-2">
                        <i class="fa-regular fa-clock"></i>
                        ${formatDate(notif.created_at)}
                    </p>
                </div>
                ${notif.url ? `
                    <button onclick="window.goToNotification('${notif.url}', '${notif.id}')" 
                            class="text-emerald-600 hover:text-emerald-700 transition">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

/**
 * 🎨 ICÔNE SELON LE TYPE
 */
function getIcon(type) {
    const icons = {
        'visit': 'fa-solid fa-camera',
        'payment': 'fa-solid fa-credit-card',
        'assignment': 'fa-solid fa-user-plus',
        'alert': 'fa-solid fa-triangle-exclamation',
        'message': 'fa-regular fa-comment',
        'expiration': 'fa-regular fa-clock',
        'default': 'fa-regular fa-bell'
    };
    return icons[type] || icons.default;
}

function getIconBg(type) {
    const colors = {
        'visit': 'bg-emerald-500',
        'payment': 'bg-blue-500',
        'assignment': 'bg-purple-500',
        'alert': 'bg-rose-500',
        'message': 'bg-amber-500',
        'expiration': 'bg-orange-500',
        'default': 'bg-slate-500'
    };
    return colors[type] || colors.default;
}

/**
 * 📥 CHARGER LES NOTIFICATIONS
 */
async function loadNotifications() {
    try {
        // Récupérer les notifications depuis le backend
        const data = await secureFetch("/notifications");
        notifications = data || [];
        unreadCount = notifications.filter(n => !n.read).length;
        updateNotificationBadge();
    } catch (err) {
        console.error("Erreur chargement notifications:", err);
        notifications = [];
    }
}

/**
 * 🔔 METTRE À JOUR LE BADGE DANS LE HEADER
 */
export function updateNotificationBadge() {
    // Chercher par ID ou par classe
    const badge = document.getElementById('notification-badge') || document.querySelector('header .bg-rose-500');
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }
}
/**
 * ✅ MARQUER TOUT COMME LU
 */
window.markAllAsRead = async () => {
    try {
        await secureFetch("/notifications/mark-all-read", { method: "POST" });
        notifications.forEach(n => n.read = true);
        unreadCount = 0;
        updateNotificationBadge();
        
        const listContainer = document.getElementById("notifications-list");
        if (listContainer) {
            listContainer.innerHTML = renderNotificationsList();
        }
        UI.success("Toutes les notifications marquées comme lues");
    } catch (err) {
        UI.error(err.message);
    }
};

/**
 * 🔗 REDIRIGER VERS LA PAGE CORRESPONDANTE
 */
window.goToNotification = async (url, notifId, type) => {
    // Marquer comme lue
    await markAsRead(notifId);
    
    let targetView = 'home';
    
    // Déterminer la vue selon le type
    switch(type) {
        case 'visit':
            targetView = 'visits';
            break;
        case 'payment':
            targetView = 'billing';
            break;
        case 'assignment':
            targetView = 'planning';
            break;
        case 'expiration':
            targetView = 'subscription';
            break;
        case 'message':
            targetView = 'feed';
            break;
        default:
            targetView = url?.replace('#', '') || 'home';
    }
    
    console.log("🔀 Redirection vers:", targetView);
    window.switchView(targetView);
};


async function markAsRead(notifId) {
    try {
        await secureFetch(`/notifications/mark-read/${notifId}`, { method: "POST" });
        const notif = notifications.find(n => n.id === notifId);
        if (notif) notif.read = true;
        unreadCount = notifications.filter(n => !n.read).length;
        updateNotificationBadge();
    } catch (err) {
        console.error(err);
    }
}

/**
 * 📅 FORMATER LA DATE
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours} h`;
    if (days < 7) return `Il y a ${days} j`;
    return date.toLocaleDateString('fr-FR');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Exporter pour rafraîchir le badge après chaque notification
export { unreadCount };
