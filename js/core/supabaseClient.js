/**
 * 🛰️ CONFIGURATION SUPABASE FRONTEND (Realtime)
 */

import { CONFIG } from "./config.js";

const { createClient } = window.supabase;

const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseKey = CONFIG.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ Partager l'instance pour éviter les doublons GoTrueClient
window._supabaseInstance = supabase;

export default supabase;
