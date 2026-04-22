// js/core/db.js
// ============================================================
// INDEXEDDB - STOCKAGE OFFLINE
// ============================================================

const DB_NAME = 'SantePlusDB';
const DB_VERSION = 1;

// Stores
const STORES = {
    MESSAGES: 'messages',
    VISITES: 'visites',
    COMMANDES: 'commandes',
    NOTIFICATIONS: 'notifications',
    PATIENTS: 'patients',
    CACHE: 'api_cache'
};

class Database {
    constructor() {
        this.db = null;
        this.isReady = false;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn("⚠️ IndexedDB non supporté, fallback sur localStorage");
                this.isReady = false;
                resolve(false);
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("❌ Erreur IndexedDB:", event.target.error);
                this.isReady = false;
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isReady = true;
                console.log("✅ IndexedDB initialisée");
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store Messages
                if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
                    const messagesStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
                    messagesStore.createIndex('patient_id', 'patient_id', { unique: false });
                    messagesStore.createIndex('created_at', 'created_at', { unique: false });
                    messagesStore.createIndex('patient_created', ['patient_id', 'created_at'], { unique: false });
                    console.log("✅ Store MESSAGES créé");
                }
                
                // Store Visites
                if (!db.objectStoreNames.contains(STORES.VISITES)) {
                    const visitesStore = db.createObjectStore(STORES.VISITES, { keyPath: 'id' });
                    visitesStore.createIndex('patient_id', 'patient_id', { unique: false });
                    visitesStore.createIndex('statut', 'statut', { unique: false });
                    visitesStore.createIndex('created_at', 'created_at', { unique: false });
                    console.log("✅ Store VISITES créé");
                }
                
                // Store Commandes
                if (!db.objectStoreNames.contains(STORES.COMMANDES)) {
                    const commandesStore = db.createObjectStore(STORES.COMMANDES, { keyPath: 'id' });
                    commandesStore.createIndex('patient_id', 'patient_id', { unique: false });
                    commandesStore.createIndex('statut', 'statut', { unique: false });
                    console.log("✅ Store COMMANDES créé");
                }
                
                // Store Notifications
                if (!db.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
                    const notifsStore = db.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
                    notifsStore.createIndex('user_id', 'user_id', { unique: false });
                    notifsStore.createIndex('read', 'read', { unique: false });
                    notifsStore.createIndex('created_at', 'created_at', { unique: false });
                    console.log("✅ Store NOTIFICATIONS créé");
                }
                
                // Store Patients
                if (!db.objectStoreNames.contains(STORES.PATIENTS)) {
                    const patientsStore = db.createObjectStore(STORES.PATIENTS, { keyPath: 'id' });
                    patientsStore.createIndex('famille_user_id', 'famille_user_id', { unique: false });
                    console.log("✅ Store PATIENTS créé");
                }
                
                // Store Cache API
                if (!db.objectStoreNames.contains(STORES.CACHE)) {
                    const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
                    cacheStore.createIndex('expires_at', 'expires_at', { unique: false });
                    console.log("✅ Store CACHE créé");
                }
            };
        });
    }

    // ============================================================
    // MÉTHODES GÉNÉRIQUES
    // ============================================================
    
    async _getStore(storeName, mode = 'readonly') {
        if (!this.isReady || !this.db) {
            await this.init();
        }
        if (!this.db) return null;
        const transaction = this.db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    async get(storeName, id) {
        try {
            const store = await this._getStore(storeName);
            if (!store) return null;
            return new Promise((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error(`❌ Erreur get ${storeName}:`, err);
            return null;
        }
    }

    async getAll(storeName, indexName = null, value = null) {
        try {
            const store = await this._getStore(storeName);
            if (!store) return [];
            return new Promise((resolve, reject) => {
                let request;
                if (indexName && value !== null) {
                    const index = store.index(indexName);
                    request = index.getAll(value);
                } else {
                    request = store.getAll();
                }
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error(`❌ Erreur getAll ${storeName}:`, err);
            return [];
        }
    }

    async put(storeName, data) {
        try {
            const store = await this._getStore(storeName, 'readwrite');
            if (!store) return false;
            return new Promise((resolve, reject) => {
                const request = store.put(data);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error(`❌ Erreur put ${storeName}:`, err);
            return false;
        }
    }

    async bulkPut(storeName, items) {
        try {
            const store = await this._getStore(storeName, 'readwrite');
            if (!store) return 0;
            let count = 0;
            return new Promise((resolve, reject) => {
                const tx = store.transaction;
                items.forEach(item => {
                    const request = store.put(item);
                    request.onsuccess = () => {
                        count++;
                        if (count === items.length) resolve(count);
                    };
                });
                tx.onerror = () => reject(tx.error);
                tx.oncomplete = () => resolve(count);
            });
        } catch (err) {
            console.error(`❌ Erreur bulkPut ${storeName}:`, err);
            return 0;
        }
    }

    async delete(storeName, id) {
        try {
            const store = await this._getStore(storeName, 'readwrite');
            if (!store) return false;
            return new Promise((resolve, reject) => {
                const request = store.delete(id);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error(`❌ Erreur delete ${storeName}:`, err);
            return false;
        }
    }

    async clear(storeName) {
        try {
            const store = await this._getStore(storeName, 'readwrite');
            if (!store) return false;
            return new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error(`❌ Erreur clear ${storeName}:`, err);
            return false;
        }
    }

    // ============================================================
    // MÉTHODES SPÉCIFIQUES
    // ============================================================
    
    async getMessages(patientId, limit = 50) {
        try {
            const store = await this._getStore(STORES.MESSAGES);
            if (!store) return [];
            const index = store.index('patient_created');
            const range = IDBKeyRange.bound(
                [patientId, 0],
                [patientId, Date.now()],
                false,
                true
            );
            return new Promise((resolve, reject) => {
                const request = index.getAll(range, limit);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            return [];
        }
    }

    async saveMessages(patientId, messages) {
        await this.bulkPut(STORES.MESSAGES, messages);
        // Nettoyer les anciens messages (> 30 jours)
        await this.cleanOldMessages(30);
    }

    async cleanOldMessages(daysOld = 30) {
        const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        const store = await this._getStore(STORES.MESSAGES, 'readwrite');
        if (!store) return;
        const index = store.index('created_at');
        const range = IDBKeyRange.upperBound(cutoff);
        const request = index.openCursor(range);
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    }

    async saveVisites(visites) {
        await this.bulkPut(STORES.VISITES, visites);
    }

    async saveCommandes(commandes) {
        await this.bulkPut(STORES.COMMANDES, commandes);
    }

    async savePatients(patients) {
        await this.bulkPut(STORES.PATIENTS, patients);
    }

    // Cache API avec expiration
    async cacheApiResponse(key, data, ttlMinutes = 10) {
        const expires_at = Date.now() + (ttlMinutes * 60 * 1000);
        await this.put(STORES.CACHE, { key, data, expires_at });
    }

    async getCachedApiResponse(key) {
        const cached = await this.get(STORES.CACHE, key);
        if (cached && cached.expires_at > Date.now()) {
            return cached.data;
        }
        if (cached) {
            await this.delete(STORES.CACHE, key);
        }
        return null;
    }

    // Nettoyage du cache expiré
    async cleanExpiredCache() {
        const store = await this._getStore(STORES.CACHE, 'readwrite');
        if (!store) return;
        const index = store.index('expires_at');
        const range = IDBKeyRange.upperBound(Date.now());
        const request = index.openCursor(range);
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    }

    // Statistiques
    async getStats() {
        const stats = {};
        for (const [name, storeName] of Object.entries(STORES)) {
            const items = await this.getAll(storeName);
            stats[name] = items.length;
        }
        return stats;
    }

    // Nettoyage complet
    async clearAll() {
        for (const storeName of Object.values(STORES)) {
            await this.clear(storeName);
        }
        console.log("🗑️ Tous les stores IndexedDB vidés");
    }
}

// Instance unique
const db = new Database();

// Exporter pour utilisation
export default db;
export { STORES };
