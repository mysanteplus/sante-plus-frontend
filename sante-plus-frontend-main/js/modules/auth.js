import { UI } from "../core/utils.js";
import supabase from "../core/supabaseClient.js";

/**
 * 🟢 GESTION DE LA CONNEXION
 */
export async function handleLogin() {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;
  const btn = document.getElementById("btn-login");

  if (!email || !password) {
    UI.vibrate("error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authentification...';

  try {
    const response = await fetch(`${window.CONFIG.API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("📦 Données reçues du backend :", data);
    
    if (!response.ok) throw new Error(data.error || "Erreur de connexion");

    // 🔴 2FA POUR COORDINATEUR
    if (data.status === "require_2fa") {
      window.renderAuthView('otp', data.email);
      btn.disabled = false;
      btn.innerHTML = 'Accéder à mon espace <i class="fa-solid fa-arrow-right-long opacity-50"></i>';
      return;
    }

    // 🟢 CONNEXION NORMALE
    localStorage.setItem("token", data.token);
    localStorage.setItem("user_role", data.role);
    localStorage.setItem("user_name", data.nom);
    localStorage.setItem("user_email", email);
    
    if (data.photo_url) {
      localStorage.setItem("user_photo", data.photo_url);
    } else {
      localStorage.setItem("user_photo", "");
    }
    
    if (data.user_id) {
      localStorage.setItem("user_id", data.user_id);
    }

    // ============================================================
    // 🔥 CORRECTION : RÉCUPÉRER LA CATÉGORIE DEPUIS LA BDD
    // ============================================================
    if (data.role === 'FAMILLE') {
      try {
        // Récupérer le patient lié à cette famille
        const { data: patient, error } = await supabase
          .from("patients")
          .select("categorie_service")
          .eq("famille_user_id", data.user_id)
          .maybeSingle();
        
        console.log("📋 Patient trouvé:", patient);
        
        if (patient?.categorie_service === 'MAMAN_BEBE') {
          localStorage.setItem("user_is_maman", "true");
          localStorage.setItem("user_categorie", "MAMAN_BEBE");
          console.log("🌸 Mode Maman ACTIVÉ");
          window.setThemeColor('#DB2777'); // Rose pour Maman
        } else {
          localStorage.setItem("user_is_maman", "false");
          localStorage.setItem("user_categorie", "SENIOR");
          console.log("👴 Mode Senior ACTIVÉ");
          window.setThemeColor('#D4AF37'); // Or pour les autres familles
        }
        
      } catch (err) {
        console.error("❌ Erreur récupération catégorie:", err);
        localStorage.setItem("user_is_maman", "false");
        localStorage.setItem("user_categorie", "SENIOR");
      }
    } else {
      // Pour les aidants et coordinateurs, désactiver le mode Maman
      localStorage.setItem("user_is_maman", "false");
      window.setThemeColor('#0F172A');
    }

    console.log("🌸 Mode Maman après connexion:", localStorage.getItem("user_is_maman") === "true");

    UI.success("Connexion réussie");
    window.location.reload();

  } catch (err) {
    UI.error(err.message);
    Swal.fire({
      icon: 'error',
      title: 'Accès refusé',
      text: err.message,
      confirmButtonColor: '#0F172A',
      customClass: { popup: 'rounded-2xl' }
    });
    btn.disabled = false;
    btn.innerHTML = 'Accéder à mon espace <i class="fa-solid fa-arrow-right-long opacity-50"></i>';
  }
}

/**
 * 🔒 VÉRIFICATION DU CODE OTP (Appelé depuis la vue OTP)
 */
export async function verifyOTP(email) {
  const code = document.getElementById("otp-code")?.value;
  const btn = document.getElementById("btn-otp");

  if (!code || code.length < 5) {
    UI.vibrate("error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Vérification...';

  try {
    const verifyRes = await fetch(`${window.CONFIG.API_URL}/auth/verify-2fa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyRes.ok) throw new Error(verifyData.message || "Code invalide");
    
    // ✅ CONNEXION RÉUSSIE AVEC 2FA
    localStorage.setItem("token", verifyData.token);
    localStorage.setItem("user_role", verifyData.role);
    localStorage.setItem("user_name", verifyData.nom);
    localStorage.setItem("user_email", email);
    
    if (verifyData.photo_url) {
      localStorage.setItem("user_photo", verifyData.photo_url);
    } else {
      localStorage.setItem("user_photo", "");
    }
    
    if (verifyData.user_id) {
      localStorage.setItem("user_id", verifyData.user_id);
    }
    
    // Récupérer la catégorie pour les familles
    if (verifyData.role === 'FAMILLE') {
      try {
        const { data: patient } = await supabase
          .from("patients")
          .select("categorie_service")
          .eq("famille_user_id", verifyData.user_id)
          .maybeSingle();
        
        if (patient?.categorie_service === 'MAMAN_BEBE') {
          localStorage.setItem("user_is_maman", "true");
          localStorage.setItem("user_categorie", "MAMAN_BEBE");
          window.setThemeColor('#DB2777');
        } else {
          localStorage.setItem("user_is_maman", "false");
          localStorage.setItem("user_categorie", "SENIOR");
          window.setThemeColor('#D4AF37');
        }
      } catch (err) {
        console.error("Erreur récupération catégorie:", err);
        localStorage.setItem("user_is_maman", "false");
      }
    } else {
      localStorage.setItem("user_is_maman", "false");
      window.setThemeColor('#0F172A');
    }
    
    UI.success("Connexion réussie");
    window.location.reload();

  } catch (err) {
    UI.error(err.message);
    Swal.fire({
      icon: 'error',
      title: 'Code Incorrect',
      text: err.message,
      confirmButtonColor: '#0F172A',
      customClass: { popup: 'rounded-2xl' }
    });
    btn.disabled = false;
    btn.innerHTML = 'Vérifier le code <i class="fa-solid fa-shield-check"></i>';
    const otpInput = document.getElementById("otp-code");
    if (otpInput) otpInput.value = "";
  }
}

/**
 * 🚪 DÉCONNEXION
 */
export function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_role");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_categorie");
  localStorage.removeItem("user_is_maman");
  localStorage.removeItem("active_visit_id");
  localStorage.removeItem("geo_watch_id");
  localStorage.removeItem("last_view");
  window.location.reload();
}
