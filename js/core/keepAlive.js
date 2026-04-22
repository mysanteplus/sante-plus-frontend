// js/core/keepAlive.js
import { CONFIG } from './config.js';

let keepAliveInterval = null;

export function startKeepAlive() {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    
    // Pinger le serveur toutes les 10 minutes
    keepAliveInterval = setInterval(async () => {
        try {
            const response = await fetch(`${CONFIG.API_URL}/`);
            if (response.ok) {
                console.log("💓 Keep-alive ping envoyé");
            }
        } catch (err) {
            console.log("⚠️ Keep-alive échoué");
        }
    }, 10 * 60 * 1000); // 10 minutes
}

export function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}
