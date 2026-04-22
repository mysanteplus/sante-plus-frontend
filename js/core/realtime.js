// js/core/realtime.js
// ============================================================
// TEMPS RÉEL GLOBAL — Supabase postgres_changes sur toutes tables
// ============================================================

const REALTIME_CONFIG = {
    url: 'https://tagqwwfbpfzluahboczh.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZ3F3d2ZicGZ6bHVhaGJvY3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDYxMDYsImV4cCI6MjA5MDM4MjEwNn0.I0HqBYPTrxPOg41sEWm_hU7YY3f9ZXCekUX5NlgIBWw'
};

// ── État interne ──────────────────────────────────────────────
let supabaseClient = null;

// Canaux actifs
let globalChannel    = null;
let messagesChannel  = null;

// Callbacks enregistrés
const callbacks = {
    messages: [],
    visites: [],
    planning: [],
    notifications: [],
    abonnements: [],
    commandes: [],
};

// Callbacks pour les messages (par patient)
let messageCallbacks = [];

// ── Init client Supabase ─────────────────────────────────────
function initClient() {
    if (supabaseClient) return supabaseClient;
    if (window._supabaseInstance) return (supabaseClient = window._supabaseInstance);
    if (!window.supabase) return null;

    supabaseClient = window.supabase.createClient(
        REALTIME_CONFIG.url,
        REALTIME_CONFIG.key,
        { realtime: { params: { eventsPerSecond: 10 } } }
    );

    window._supabaseInstance = supabaseClient;
    return supabaseClient;
}

// ── Dispatcher ───────────────────────────────────────────────
function dispatch(type, event, row) {
    const list = callbacks[type] || [];
    list.forEach(cb => {
        try { cb(event, row); } catch (e) { console.error(e); }
    });
}

// ── Canal GLOBAL ─────────────────────────────────────────────
function initGlobalChannel() {
    const client = initClient();
    if (!client) return;
    if (globalChannel) return;

    globalChannel = client
        .channel('sps-global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'visites' },
            ({ eventType, new: row, old }) => dispatch('visites', eventType, row || old)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planning' },
            ({ eventType, new: row, old }) => dispatch('planning', eventType, row || old)
        )
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
            ({ new: row }) => {
                const userId = localStorage.getItem('user_id');
                if (row.user_id !== userId) return;
                dispatch('notifications', 'INSERT', row);
            }
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'abonnements' },
            ({ eventType, new: row, old }) => dispatch('abonnements', eventType, row || old)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes_meds' },
            ({ eventType, new: row, old }) => dispatch('commandes', eventType, row || old)
        )
        .subscribe();
}

// ── Canal MESSAGES GLOBAL (créé une seule fois) ─────────────
function initMessagesChannel() {
    const client = initClient();
    if (!client) return;
    if (messagesChannel) return;

    messagesChannel = client
        .channel('global-messages')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages' }, 
            (payload) => {
                const newMessage = payload.new;
                console.log("📡 [REALTIME] Nouveau message global:", newMessage);
                // Appeler tous les callbacks enregistrés pour ce patient
                messageCallbacks.forEach(({ patientId: pid, callback: cb }) => {
                    if (pid === newMessage.patient_id) {
                        cb('INSERT', newMessage);
                    }
                });
            }
        )
        .subscribe((status) => {
            console.log(`📡 Canal global messages: ${status}`);
        });
}

// ── Subscribe aux messages ──────────────────────────────────
function subscribeToMessages(patientId, callback) {
    if (!patientId) return;

    // Enregistrer le callback
    messageCallbacks.push({ patientId, callback });
    console.log(`📡 Callback enregistré pour patient ${patientId}, total: ${messageCallbacks.length}`);
}

// ── Unsubscribe des messages ────────────────────────────────
function unsubscribeFromMessages() {
    // On vide uniquement les callbacks, on garde le canal actif
    messageCallbacks = [];
    console.log("🧹 Callbacks messages nettoyés");
}

// ── API helpers ─────────────────────────────────────────────
function on(type, callback) {
    if (!callbacks[type]) return;
    callbacks[type].push(callback);
}

function off(type, callback) {
    if (!callbacks[type]) return;
    callbacks[type] = callbacks[type].filter(cb => cb !== callback);
}

// ── Infos expéditeur ─────────────────────────────────────────
async function fetchSenderInfo(senderId) {
    const client = initClient();
    if (!client) return { nom: 'Utilisateur', role: 'COORDINATEUR', photo_url: null };

    try {
        const { data } = await client
            .from('profiles')
            .select('nom, role, photo_url')
            .eq('id', senderId)
            .single();

        return {
            nom: data.nom || 'Utilisateur',
            role: data.role || 'COORDINATEUR',
            photo_url: data.photo_url || null
        };
    } catch {
        return { nom: 'Utilisateur', role: 'COORDINATEUR', photo_url: null };
    }
}

// ── START ────────────────────────────────────────────────────
function start() {
    initClient();
    initGlobalChannel();
    initMessagesChannel(); // ← CRÉER LE CANAL DES MESSAGES DÈS LE DÉPART
}

// ── EXPORT GLOBAL ────────────────────────────────────────────
window.Realtime = {
    start,
    on,
    off,

    subscribe: subscribeToMessages,
    unsubscribe: unsubscribeFromMessages,

    fetchSenderInfo,

    isActive: () => globalChannel !== null,

    subscribeToVisites: (cb) => on('visites', (_, row) => cb(row)),
    subscribeToCommandes: (cb) => on('commandes', (_, row) => cb(row)),

    initVisitesChannel: initGlobalChannel,
    initClient,

    // =========================
    // 👁️ READ (VU)
    // =========================
    subscribeToRead: (callback) => {
        const client = initClient();
        if (!client) return;

        client
            .channel('read-status')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    console.log("🔥 REALTIME READ PAYLOAD:", payload);
                    if (!payload.new) {
                        console.warn("⚠️ payload.new manquant:", payload);
                        return;
                    }
                    callback(payload.new); 
                }
            )
            .subscribe((status) => {
                console.log(`📡 read-status: ${status}`);
            });
    },

    // =========================
    // ✍️ TYPING (EN TRAIN D'ÉCRIRE)
    // =========================
    subscribeToTyping: (callback) => {
        const client = initClient();
        if (!client) return;

        client
            .channel('typing-channel')
            .on(
                'broadcast',
                { event: '*' },
                (payload) => {
                    if (payload.event === 'typing') {
                        callback(payload.payload);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`📡 typing-channel: ${status}`);
            });
    },

    sendTyping: (data) => {
        const client = initClient();
        if (!client) return;

        client.channel('typing-channel').send({
            type: 'broadcast',
            event: 'typing',
            payload: data
        });
    },

    stopTyping: (data) => {
        const client = initClient();
        if (!client) return;

        client.channel('typing-channel').send({
            type: 'broadcast',
            event: 'stop_typing',
            payload: data
        });
    }
};

console.log('✅ [Realtime] Module chargé');
