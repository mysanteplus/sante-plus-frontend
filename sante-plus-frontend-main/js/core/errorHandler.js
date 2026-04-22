// js/core/errorHandler.js

class ErrorHandler {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    // Initialisation globale
    static init() {
        // Capture les erreurs non capturées
        window.addEventListener('error', (e) => {
            console.error('❌ Global error:', e.error);
            this.showUserFriendlyError(e.error);
        });

        // Capture les promesses rejetées
        window.addEventListener('unhandledrejection', (e) => {
            console.error('❌ Unhandled promise:', e.reason);
            this.showUserFriendlyError(e.reason);
        });

        // Détection de la connexion
        window.addEventListener('online', () => {
            console.log('📶 Connexion rétablie');
            this.processRetryQueue();
        });

        window.addEventListener('offline', () => {
            console.log('📶 Connexion perdue');
            this.showToast('Connexion internet perdue', 'error');
        });

        console.log('✅ ErrorHandler initialisé');
    }

    // Message d'erreur compréhensible
    static showUserFriendlyError(error) {
        let message = "Une erreur est survenue. Veuillez réessayer.";
        
        if (!error) {
            message = "Erreur inconnue. Rafraîchissez la page.";
        } else if (error.message?.includes('NetworkError') || error.message?.includes('fetch')) {
            message = "Problème de connexion internet. Vérifiez votre réseau.";
        } else if (error.message?.includes('timeout')) {
            message = "Le serveur met trop de temps à répondre. Réessayez.";
        } else if (error.message?.includes('401')) {
            message = "Session expirée. Vous allez être redirigé vers la connexion.";
            setTimeout(() => {
                if (window.logout) window.logout();
                else window.location.reload();
            }, 2000);
        } else if (error.message?.includes('403')) {
            message = "Vous n'avez pas les droits pour cette action.";
        } else if (error.message?.includes('404')) {
            message = "Service temporairement indisponible. Réessayez plus tard.";
        } else if (error.message?.includes('500')) {
            message = "Erreur serveur. Nos équipes sont informées.";
        }
        
        // Utiliser SweetAlert si disponible
        if (window.Swal) {
            Swal.fire({
                title: "Oups !",
                text: message,
                icon: "error",
                confirmButtonText: "OK",
                confirmButtonColor: "#0F172A",
                customClass: { popup: 'rounded-2xl' }
            });
        } else {
            alert(message);
        }
    }

    // Toast simple
    static showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    // Système de retry automatique
    static async retry(fn, retries = 3) {
        let lastError;
        
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                const delay = 1000 * (i + 1);
                console.log(`🔄 Retry ${i + 1}/${retries} dans ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        
        throw lastError;
    }

    // File d'attente pour requêtes hors ligne
    static queueRequest(request) {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        queue.push({
            ...request,
            timestamp: Date.now(),
            id: Date.now() + Math.random().toString(36)
        });
        localStorage.setItem('offline_queue', JSON.stringify(queue));
        console.log(`📦 Requête mise en attente (${queue.length} dans la file)`);
    }

    // Traiter les requêtes en attente
    static async processRetryQueue() {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
        if (queue.length === 0) return;
        
        console.log(`📦 Traitement de ${queue.length} requêtes en attente`);
        
        const results = [];
        for (const req of queue) {
            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers: { 'Content-Type': 'application/json' },
                    body: req.body
                });
                if (response.ok) {
                    results.push({ id: req.id, success: true });
                    console.log(`✅ Requête traitée: ${req.url}`);
                } else {
                    results.push({ id: req.id, success: false });
                }
            } catch (err) {
                results.push({ id: req.id, success: false });
                console.log(`❌ Échec requête: ${req.url}`);
            }
        }
        
        // Garder seulement les échecs
        const failedQueue = queue.filter(req => 
            !results.find(r => r.id === req.id && r.success)
        );
        localStorage.setItem('offline_queue', JSON.stringify(failedQueue));
        
        if (failedQueue.length === 0) {
            this.showToast('Toutes les actions ont été synchronisées', 'success');
        }
    }

    // Vérifier la connexion
    static isOnline() {
        return navigator.onLine;
    }
}

// Auto-initialisation
if (typeof window !== 'undefined') {
    setTimeout(() => ErrorHandler.init(), 100);
}

export default ErrorHandler;
