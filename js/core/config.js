// ============================================================
// CHARGEMENT DE LA CONFIGURATION DEPUIS LE BACKEND
// ============================================================

async function loadBackendConfig() {
    try {
        console.log('🔧 Chargement de la configuration depuis le backend...');
        
        // ✅ URL ABSOLUE du backend
        const configUrl = 'https://sante-plus-backend-main.onrender.com/api/config';
        
        console.log(`📡 Appel de: ${configUrl}`);
        
        const response = await fetch(configUrl, { 
            cache: 'no-store',
            headers: { 
                'Cache-Control': 'no-cache',
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error(`❌ /api/config a répondu ${response.status}`);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const config = await response.json();
        
        // ✅ Vérifier que les données sont valides
        if (!config.supabaseUrl || !config.supabaseKey) {
            console.warn('⚠️ Configuration reçue incomplète:', config);
            throw new Error('Configuration incomplete');
        }
        
        console.log('✅ Configuration reçue du backend');
        
        // ✅ Injecter les variables dans window._env_
        window._env_ = {
            SUPABASE_URL: config.supabaseUrl,
            SUPABASE_KEY: config.supabaseKey,
            API_URL: config.apiUrl || 'https://sante-plus-backend-main.onrender.com/api',
            ENVIRONMENT: config.environment || 'production'
        };
        
        // ✅ Sauvegarder en cache pour le prochain chargement
        try {
            localStorage.setItem('sps_config', JSON.stringify({
                supabaseUrl: window._env_.SUPABASE_URL,
                supabaseKey: window._env_.SUPABASE_KEY,
                apiUrl: window._env_.API_URL,
                environment: window._env_.ENVIRONMENT,
                timestamp: Date.now()
            }));
            console.log('✅ Configuration sauvegardée en cache');
        } catch (e) {
            // Ignorer les erreurs de localStorage
        }
        
        console.log('✅ Configuration chargée depuis le backend');
        console.log(`   Environnement: ${window._env_.ENVIRONMENT}`);
        console.log(`   Supabase URL: ${window._env_.SUPABASE_URL ? '✅' : '❌'}`);
        console.log(`   API URL: ${window._env_.API_URL ? '✅' : '❌'}`);
        
        // ✅ Mettre à jour window.CONFIG
        if (window.CONFIG) {
            if (window._env_.SUPABASE_URL) window.CONFIG.SUPABASE_URL = window._env_.SUPABASE_URL;
            if (window._env_.SUPABASE_KEY) window.CONFIG.SUPABASE_KEY = window._env_.SUPABASE_KEY;
            if (window._env_.API_URL) window.CONFIG.API_URL = window._env_.API_URL;
            console.log('✅ window.CONFIG mis à jour');
        }
        
    } catch (err) {
        console.error('❌ Erreur chargement config:', err.message);
        console.warn('   Utilisation des valeurs par défaut');
        
        // ✅ Fallback 1 : essayer depuis localStorage
        try {
            const cached = localStorage.getItem('sps_config');
            if (cached) {
                const parsed = JSON.parse(cached);
                // Vérifier que le cache n'est pas trop vieux (24h)
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < 24 * 60 * 60 * 1000) {
                    window._env_ = {
                        SUPABASE_URL: parsed.supabaseUrl,
                        SUPABASE_KEY: parsed.supabaseKey,
                        API_URL: parsed.apiUrl || 'https://sante-plus-backend-main.onrender.com/api',
                        ENVIRONMENT: parsed.environment || 'production'
                    };
                    console.log('✅ Configuration chargée depuis localStorage');
                    return;
                } else {
                    console.warn('⚠️ Cache expiré, suppression');
                    localStorage.removeItem('sps_config');
                }
            }
        } catch (e) {
            // Ignorer
        }
        
        // ✅ Fallback 2 : window.CONFIG
        if (window.CONFIG && window.CONFIG.SUPABASE_URL) {
            window._env_ = {
                SUPABASE_URL: window.CONFIG.SUPABASE_URL,
                SUPABASE_KEY: window.CONFIG.SUPABASE_KEY,
                API_URL: window.CONFIG.API_URL,
                ENVIRONMENT: 'production'
            };
            console.log('✅ Utilisation de window.CONFIG comme fallback');
            return;
        }
        
        // ✅ Fallback 3 : valeurs d'urgence (dernier recours)
        window._env_ = {
            SUPABASE_URL: 'https://bcliieqhymeubmsdkqyn.supabase.co',
            SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjbGlpZXFoeW1ldWJtc2RrcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTY1NDksImV4cCI6MjA5MjI5MjU0OX0.wohWAn4emeWqZicjYv7jDq8xzZFNVZlEhZRWr1xEog8',
            API_URL: 'https://sante-plus-backend-main.onrender.com/api',
            ENVIRONMENT: 'production'
        };
        console.warn('⚠️ Utilisation des valeurs d\'urgence');
    }
}
