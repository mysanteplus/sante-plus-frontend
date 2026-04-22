/**
 * 🛰️ CONFIGURATION SUPABASE FRONTEND (Realtime)
 */

const { createClient } = window.supabase;

const supabaseUrl = "https://tagqwwfbpfzluahboczh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhZ3F3d2ZicGZ6bHVhaGJvY3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDYxMDYsImV4cCI6MjA5MDM4MjEwNn0.I0HqBYPTrxPOg41sEWm_hU7YY3f9ZXCekUX5NlgIBWw";

const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ Partager l'instance pour éviter les doublons GoTrueClient
window._supabaseInstance = supabase;

export default supabase;
