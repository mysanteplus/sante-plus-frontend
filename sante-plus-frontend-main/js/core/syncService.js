// js/core/syncService.js
// ============================================================
// SYNC SERVICE — Réagit aux événements Realtime Supabase
// et met à jour l'UI de TOUS les utilisateurs connectés
// ============================================================

import { clearApiCache } from './api.js';
import { AppState } from './state.js';
import { showToast } from './utils.js';

class SyncService {
    constructor() {
        this.refreshInProgress = false;
        this.pendingRefresh = new Set(); // évite les doublons en rafale
        this._init();
    }

    // ── Initialisation ─────────────────────────────────────
    _init() {
        // Attendre que Realtime soit disponible
        const waitForRealtime = setInterval(() => {
            if (window.Realtime) {
                clearInterval(waitForRealtime);
                this._bindRealtime();
            }
        }, 200);

        // Connexion/déconnexion réseau
        window.addEventListener('online',  () => this._onOnline());
        window.addEventListener('offline', () => this._onOffline());

        // Compatibilité ancienne API (événements locaux)
        window.addEventListener('app-data-updated', (e) => {
            clearApiCache();
        });

        console.log('✅ SyncService initialisé');
    }

    // ── Branchement sur Realtime ───────────────────────────
    _bindRealtime() {
        const R = window.Realtime;

        // ── VISITES ──────────────────────────────────────
        R.on('visites', (eventType, row) => {
            console.log(`🔄 [Sync] visites ${eventType}`);
            clearApiCache();
            this._scheduleRefresh('visites');
        });

        // ── PLANNING / ASSIGNATIONS ───────────────────────
        R.on('planning', (eventType, row) => {
            console.log(`🔄 [Sync] planning ${eventType}`);
            clearApiCache();
            this._scheduleRefresh('planning');

            // Toast contextuel selon le rôle
            const role = localStorage.getItem('user_role');
            const userId = localStorage.getItem('user_id');

            if (eventType === 'INSERT' && role === 'AIDANT' && row?.aidant_id === userId) {
                showToast('📋 Nouvelle mission assignée !', 'info', 4000);
                this._bumpBadge('planning');
            }
            if (eventType === 'UPDATE' && role === 'AIDANT' && row?.aidant_id === userId && !row?.est_actif) {
                showToast('❌ Une assignation a été désactivée', 'warning', 4000);
            }
            if (role === 'COORDINATEUR') {
                this._scheduleRefresh('assignments-dashboard');
            }
        });

        // ── NOTIFICATIONS ─────────────────────────────────
        R.on('notifications', (eventType, row) => {
            console.log('🔔 [Sync] nouvelle notification');
            this._onNewNotification(row);
        });

        // ── ABONNEMENTS / BILLING ─────────────────────────
        R.on('abonnements', (eventType, row) => {
            console.log(`🔄 [Sync] abonnements ${eventType}`);
            clearApiCache();
            this._scheduleRefresh('billing');
        });

        // ── COMMANDES ─────────────────────────────────────
        R.on('commandes', (eventType, row) => {
            console.log(`🔄 [Sync] commandes ${eventType}`);
            clearApiCache();
            this._scheduleRefresh('commandes');
        });

        // ── MESSAGES (via CustomEvent global) ────────────
        window.addEventListener('rt:notification', (e) => {
            this._onNewNotification(e.detail.row);
        });

        // Démarrer le canal global Realtime
        R.start();

        console.log('✅ [Sync] Branchement Realtime complet');
    }

    // ── Dé-duplication des refreshs rapides ───────────────
    // Si 3 événements arrivent en 300ms, on ne déclenche qu'un seul refresh
    _scheduleRefresh(type) {
        if (this.pendingRefresh.has(type)) return;
        this.pendingRefresh.add(type);

        setTimeout(async () => {
            this.pendingRefresh.delete(type);
            await this._doRefresh(type);
        }, 350);
    }

    // ── Refresh effectif ──────────────────────────────────
    async _doRefresh(type) {
        const currentView = AppState?.currentView;
        console.log(`🔄 [Sync] Refresh "${type}" (vue courante: ${currentView})`);

        switch (type) {
            // ── Visites ──────────────────────────────────
            case 'visites':
                if (currentView === 'visits' || currentView === 'visites') {
                    await this._call('loadVisits');
                }
                // Mettre à jour le bouton start/stop de l'aidant si présent
                const activePatientId = localStorage.getItem('active_patient_id');
                if (activePatientId) {
                    await this._call('refreshAidantUI', activePatientId);
                }
                await this._refreshBadges();
                break;

            // ── Planning ─────────────────────────────────
            case 'planning':
                if (currentView === 'planning') {
                    await this._call('loadPlanning');
                }
                await this._refreshBadges();
                break;

            // ── Dashboard RH (coordinateur) ───────────────
            case 'assignments-dashboard':
                if (currentView === 'assignments' || currentView === 'planning') {
                    await this._call('loadPlanning');
                }
                break;

            // ── Billing ───────────────────────────────────
            case 'billing':
                if (currentView === 'billing') {
                    const { loadBilling } = await import('../modules/billing.js');
                    await loadBilling();
                }
                await this._refreshBadges();
                break;

            // ── Commandes ─────────────────────────────────
            case 'commandes':
                if (currentView === 'commandes') {
                    await this._call('loadCommandes');
                }
                await this._refreshBadges();
                break;
        }
    }

    // ── Nouvelle notification en temps réel ───────────────
    _onNewNotification(row) {
        // Mettre à jour le badge header
        this._bumpBadge('notifications');

        // Toast discret
        if (row?.title) {
            showToast(`${row.title}`, 'info', 5000);
        }

        // Si l'utilisateur est sur la page notifications, rafraîchir
        if (AppState?.currentView === 'notifications') {
            this._call('renderNotificationsPage');
        }

        // Émettre un événement pour que le header mette à jour son badge
        window.dispatchEvent(new CustomEvent('notification-received', { detail: { notification: row } }));
    }

    // ── Utilitaires ───────────────────────────────────────

    /** Appelle une fonction globale si elle existe */
    async _call(fnName, ...args) {
        if (typeof window[fnName] === 'function') {
            try {
                await window[fnName](...args);
            } catch (e) {
                console.error(`❌ [Sync] Erreur ${fnName}:`, e);
            }
        } else {
            console.warn(`⚠️ [Sync] window.${fnName} non trouvé`);
        }
    }

    /** Incrémente visuellement un badge dans le menu */
    _bumpBadge(type) {
        // On délègue au refreshMenuBadges qui sait tout calculer
        setTimeout(() => this._refreshBadges(), 200);
    }

    /** Rafraîchit tous les badges du menu */
    async _refreshBadges() {
        await this._call('refreshMenuBadges');
    }

    // ── Réseau ────────────────────────────────────────────
    _onOnline() {
        console.log('📶 Connexion rétablie');
        showToast('Connexion rétablie', 'success', 2000);
        clearApiCache();
        // Forcer le rechargement de la vue courante
        if (AppState?.currentView && typeof window.switchView === 'function') {
            window.switchView(AppState.currentView);
        }
    }

    _onOffline() {
        console.log('📶 Connexion perdue');
        showToast('Connexion perdue', 'warning', 3000);
    }
}

export const syncService = new SyncService();
