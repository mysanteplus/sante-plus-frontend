/**
 * 🛰️ CONFIGURATION SUPABASE FRONTEND (Realtime)
 */

const { createClient } = window.supabase;

const supabaseUrl = "https://bcliieqhymeubmsdkqyn.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjbGlpZXFoeW1ldWJtc2RrcXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTY1NDksImV4cCI6MjA5MjI5MjU0OX0.wohWAn4emeWqZicjYv7jDq8xzZFNVZlEhZRWr1xEog8";

const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ Partager l'instance pour éviter les doublons GoTrueClient
window._supabaseInstance = supabase;

export default supabase;
