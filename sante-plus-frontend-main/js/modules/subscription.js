import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// PAGE D'ABONNEMENT
// ============================================================

export async function renderSubscriptionPage() {
    const container = document.getElementById("view-container");
    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    
    // Récupérer le patient actuel
    let currentPatient = null;
    if (userRole === "FAMILLE") {
        try {
            const patients = await secureFetch("/patients");
            if (patients && patients.length > 0) {
                currentPatient = patients[0];
            }
        } catch (e) {
            console.error("Erreur récupération patient:", e);
        }
    }
    
    // Définition des packs
    const packs = getPacks(isMaman);
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('home')" 
                        class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-95">
                    <i class="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">Nos Formules</h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Choisissez l'accompagnement qui vous convient</p>
                </div>
            </div>
            
            ${currentPatient ? `
                <div class="bg-slate-100 p-4 rounded-2xl mb-6 flex items-center justify-between">
                    <div>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pour le dossier</p>
                        <p class="font-black text-slate-800">${escapeHtml(currentPatient.nom_complet)}</p>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <i class="fa-solid fa-user text-emerald-600"></i>
                    </div>
                </div>
            ` : ''}
            
            <div class="space-y-4">
                ${packs.map(pack => `
                    <div onclick="window.selectSubscriptionPack('${pack.id}', ${pack.price}, ${pack.duration})" 
                         class="pack-card bg-white rounded-2xl border-2 border-slate-100 p-5 cursor-pointer transition-all active:scale-98 hover:border-emerald-300">
                        <div class="flex items-start gap-4">
                            <div class="w-14 h-14 rounded-xl ${pack.bg} flex items-center justify-center shrink-0">
                                <i class="fa-solid ${pack.icon} ${pack.color} text-2xl"></i>
                            </div>
                            <div class="flex-1">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <h4 class="font-black text-slate-800 text-lg">${pack.name}</h4>
                                        ${pack.popular ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-black uppercase">Populaire</span>' : ''}
                                        ${pack.badge ? `<span class="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[8px] font-black uppercase">${pack.badge}</span>` : ''}
                                    </div>
                                    <div class="text-right">
                                        ${pack.originalPrice ? `<span class="text-[10px] text-slate-400 line-through mr-2">${pack.originalPrice.toLocaleString()} CFA</span>` : ''}
                                        <p class="text-xl font-black text-emerald-600">${pack.priceDisplay}</p>
                                    </div>
                                </div>
                                <p class="text-xs text-slate-500 mt-1">${pack.desc} • ${pack.durationText}</p>
                                <div class="flex flex-wrap gap-2 mt-3">
                                    ${pack.features.map(f => `<span class="text-[9px] text-slate-500 bg-slate-50 px-2 py-1 rounded-full">✓ ${f}</span>`).join('')}
                                </div>
                            </div>
                            <div class="shrink-0">
                                <div class="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center">
                                    <i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <div class="flex items-center gap-3 mb-3">
                    <i class="fa-solid fa-shield-heart text-emerald-500 text-xl"></i>
                    <p class="font-black text-slate-800 text-sm">Pourquoi s'abonner ?</p>
                </div>
                <ul class="space-y-2 text-xs text-slate-600">
                    <li class="flex items-center gap-2">✓ Suivi médical personnalisé 24/7</li>
                    <li class="flex items-center gap-2">✓ Intervenants qualifiés et formés</li>
                    <li class="flex items-center gap-2">✓ Rapport détaillé après chaque visite</li>
                    <li class="flex items-center gap-2">✓ Assistance téléphonique prioritaire</li>
                    <li class="flex items-center gap-2">✓ Paiement sécurisé via FedaPay</li>
                </ul>
            </div>
        </div>
    `;
}

// ============================================================
// DÉFINITION DES PACKS
// ============================================================

function getPacks(isMaman) {
    if (isMaman) {
        return [
            { id: 'MENSUEL_ESSENTIEL', name: 'Essentiel', desc: '2 visites / semaine', price: 100, priceDisplay: '100 CFA', duration: 1, durationText: '1 mois', features: ['2 visites par semaine', 'Suivi de base', 'Rapport hebdomadaire'], icon: 'fa-seedling', color: 'text-emerald-600', bg: 'bg-emerald-50', popular: false },
            { id: 'MENSUEL_CONFORT', name: 'Confort', desc: '3 à 4 visites / semaine', price: 85000, priceDisplay: '85.000 CFA', duration: 1, durationText: '1 mois', features: ['3-4 visites par semaine', 'Aide à la toilette', 'Préparation repas', 'Rapport détaillé'], icon: 'fa-chart-line', color: 'text-blue-600', bg: 'bg-blue-50', popular: true },
            { id: 'MENSUEL_SERENITE', name: 'Sérénité', desc: 'Présence quasi quotidienne', price: 150000, priceDisplay: '150.000 CFA', duration: 1, durationText: '1 mois', features: ['6-7 visites par semaine', 'Accompagnement complet', 'Urgence 24/7', 'Rapport en temps réel'], icon: 'fa-crown', color: 'text-gold-primary', bg: 'bg-amber-50', popular: false },
            { id: 'TRIMESTRIEL_ESSENTIEL', name: 'Essentiel 3 mois', desc: '2 visites / semaine', price: 142500, priceDisplay: '142.500 CFA', originalPrice: 150000, duration: 3, durationText: '3 mois', features: ['2 visites par semaine', 'Suivi de base', 'Rapport hebdomadaire', 'Économie 5%'], icon: 'fa-calendar-alt', color: 'text-emerald-600', bg: 'bg-emerald-50', popular: false, badge: '-5%' },
            { id: 'TRIMESTRIEL_CONFORT', name: 'Confort 3 mois', desc: '3 à 4 visites / semaine', price: 242250, priceDisplay: '242.250 CFA', originalPrice: 255000, duration: 3, durationText: '3 mois', features: ['3-4 visites par semaine', 'Aide à la toilette', 'Préparation repas', 'Rapport détaillé', 'Économie 5%'], icon: 'fa-calendar-alt', color: 'text-blue-600', bg: 'bg-blue-50', popular: false, badge: '-5%' },
            { id: 'ANNUEL_ESSENTIEL', name: 'Essentiel 1 an', desc: '2 visites / semaine', price: 510000, priceDisplay: '510.000 CFA', originalPrice: 600000, duration: 12, durationText: '12 mois', features: ['2 visites par semaine', 'Suivi de base', 'Rapport hebdomadaire', 'Économie 15%', 'Paiement unique'], icon: 'fa-calendar-year', color: 'text-emerald-600', bg: 'bg-emerald-50', popular: false, badge: '-15%' },
            { id: 'ANNUEL_CONFORT', name: 'Confort 1 an', desc: '3 à 4 visites / semaine', price: 867000, priceDisplay: '867.000 CFA', originalPrice: 1020000, duration: 12, durationText: '12 mois', features: ['3-4 visites par semaine', 'Aide à la toilette', 'Préparation repas', 'Rapport détaillé', 'Économie 15%', 'Paiement unique'], icon: 'fa-calendar-year', color: 'text-blue-600', bg: 'bg-blue-50', popular: true, badge: '-15%' },
            { id: 'MATERNITE', name: 'Spécial Sortie Maternité', desc: 'Suivi intensif sur 2 semaines', price: 70000, priceDisplay: '70.000 CFA', duration: 0.5, durationText: '2 semaines', features: ['Visite quotidienne', 'Aide bébé', 'Conseils allaitement', 'Suivi personnalisé'], icon: 'fa-baby-carriage', color: 'text-pink-600', bg: 'bg-pink-50', popular: false }
        ];
    } else {
        return [
            { id: 'MENSUEL_PONCTUEL', name: 'Ponctuel', desc: 'Intervention à la demande', price: 100, priceDisplay: '100 CFA', duration: 1, durationText: '1 mois', features: ['Intervention à la demande', 'Accompagnement RDV', 'Flexibilité totale'], icon: 'fa-clock', color: 'text-slate-600', bg: 'bg-slate-100', popular: false },
            { id: 'MENSUEL_REGULIER', name: 'Régulier', desc: '2 à 3 visites / semaine', price: 60000, priceDisplay: '60.000 CFA', duration: 1, durationText: '1 mois', features: ['2-3 visites par semaine', 'Suivi médical', 'Lien famille', 'Rapport détaillé'], icon: 'fa-calendar-week', color: 'text-emerald-600', bg: 'bg-emerald-50', popular: true },
            { id: 'MENSUEL_COMPLET', name: 'Complet', desc: 'Présence soutenue', price: 150000, priceDisplay: '150.000 CFA', duration: 1, durationText: '1 mois', features: ['5-6 visites par semaine', 'Présence renforcée', 'Veille sanitaire', 'Rapport en temps réel'], icon: 'fa-star', color: 'text-gold-primary', bg: 'bg-amber-50', popular: false },
            { id: 'TRIMESTRIEL_REGULIER', name: 'Régulier 3 mois', desc: '2 à 3 visites / semaine', price: 171000, priceDisplay: '171.000 CFA', originalPrice: 180000, duration: 3, durationText: '3 mois', features: ['2-3 visites par semaine', 'Suivi médical', 'Lien famille', 'Rapport détaillé', 'Économie 5%'], icon: 'fa-calendar-alt', color: 'text-emerald-600', bg: 'bg-emerald-50', popular: false, badge: '-5%' },
            { id: 'ANNUEL_REGULIER', name: 'Régulier 1 an', desc: '2 à 3 visites / semaine', price: 612000, priceDisplay: '612.000 CFA', originalPrice: 720000, duration: 12, durationText: '12 mois', features: ['2-3 visites par semaine', 'Suivi médical', 'Lien famille', 'Rapport détaillé', 'Économie 15%', 'Paiement unique'], icon: 'fa-calendar-year', color: 'text-emerald-600', bg: 'bg-emerald-50', popular: true, badge: '-15%' },
            { id: 'ANNUEL_COMPLET', name: 'Complet 1 an', desc: 'Présence soutenue', price: 1530000, priceDisplay: '1.530.000 CFA', originalPrice: 1800000, duration: 12, durationText: '12 mois', features: ['5-6 visites par semaine', 'Présence renforcée', 'Veille sanitaire', 'Rapport en temps réel', 'Économie 15%', 'Paiement unique'], icon: 'fa-calendar-year', color: 'text-gold-primary', bg: 'bg-amber-50', popular: false, badge: '-15%' }
        ];
    }
}

// ============================================================
// SÉLECTION D'UN PACK
// ============================================================
window.selectSubscriptionPack = async (packId, price, durationMonths) => {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const packs = getPacks(isMaman);
    const selectedPack = packs.find(p => p.id === packId);
    
    // Récupérer le patient ID
    let patientId = AppState.currentPatient;
    if (!patientId) {
        try {
            const patients = await secureFetch("/patients");
            if (patients && patients.length > 0) {
                patientId = patients[0].id;
                AppState.currentPatient = patientId;
                localStorage.setItem("current_patient_id", patientId);
            } else {
                UI.error("Aucun patient trouvé");
                return;
            }
        } catch (err) {
            UI.error("Impossible de récupérer le patient");
            return;
        }
    }
    
    // Confirmation avant paiement
    const confirm = await Swal.fire({
        title: '<span class="text-xl font-black">💳 Paiement sécurisé</span>',
        html: `
            <div class="text-center">
                <div class="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-credit-card text-emerald-500 text-3xl"></i>
                </div>
                <p class="text-sm font-bold text-slate-800 mb-2">${selectedPack?.name}</p>
                <p class="text-xs text-slate-500">Montant: <span class="font-bold text-emerald-600">${price.toLocaleString()} CFA</span></p>
                <p class="text-xs text-slate-500 mt-1">Durée: ${durationMonths === 0.5 ? '2 semaines' : durationMonths + ' mois'}</p>
                <div class="mt-4 p-3 bg-slate-50 rounded-xl">
                    <p class="text-[10px] text-slate-500">🔒 Paiement sécurisé par FedaPay</p>
                    <p class="text-[10px] text-slate-500 mt-1">📱 Mobile Money • 💳 Carte bancaire</p>
                </div>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '💳 Payer maintenant',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#94A3B8',
        customClass: { popup: 'rounded-2xl p-6' }
    });
    
    if (!confirm.isConfirmed) return;
    
    // Créer la facture
    Swal.fire({
        title: "Préparation...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });
    
    try {
        const facture = await secureFetch("/billing/generate", {
            method: "POST",
            body: JSON.stringify({
                patient_id: patientId,
                montant: price,
                pack: packId
            })
        });
        
        console.log("✅ Facture créée:", facture);
        Swal.close();
        
        // Préparer les données pour FedaPay
        const userEmail = localStorage.getItem("user_email");
        const userName = localStorage.getItem("user_name") || "Client";
        const firstName = userName.split(' ')[0];
        const lastName = userName.split(' ')[1] || "SPS";
        
        // Créer un bouton temporaire pour FedaPay
        const tempBtn = document.createElement('button');
        tempBtn.id = 'temp-pay-btn';
        tempBtn.style.display = 'none';
        document.body.appendChild(tempBtn);
        
        // Initialiser FedaPay en mode popup
        FedaPay.init('#temp-pay-btn', {
            public_key: 'pk_live_tGAFMjEYOV37KoKgDSZGtktR',
            transaction: {
                amount: price,
                description: `Pack ${selectedPack?.name} - ${durationMonths} mois`
            },
            customer: {
                email: userEmail,
                firstname: firstName,
                lastname: lastName
            },

onComplete: async (response) => {
    console.log("FedaPay fermé - Réponse complète:", response);
    
    // La transaction est dans response, pas dans un deuxième paramètre
    const transaction = response.transaction || response;
    const reason = response.reason || response;
    
    console.log("Transaction status:", transaction?.status);
    console.log("Reason:", reason);
    
    // Vérifier si le paiement est approuvé
    const isApproved = transaction && transaction.status === 'approved';
    
    if (isApproved) {
        Swal.fire({
            title: "Validation du paiement...",
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });
        
        try {
            console.log("🔵 Appel à /billing/pay avec:", {
                abonnement_id: facture.id,
                montant: price,
                transaction_id: transaction.id,
                mode_paiement: "FEDAPAY"
            });
            
            const result = await secureFetch("/billing/pay", {
                method: "POST",
                body: JSON.stringify({
                    abonnement_id: facture.id,
                    montant: price,
                    transaction_id: transaction.id,
                    mode_paiement: "FEDAPAY"
                })
            });
            
            console.log("✅ Résultat de /billing/pay:", result);
            
            Swal.fire({
                icon: "success",
                title: "✅ Abonnement activé !",
                timer: 2000,
                showConfirmButton: false
            });
            
            window.switchView("billing");
            
        } catch (err) {
            console.error("❌ Erreur lors de l'appel à /billing/pay:", err);
            Swal.fire({
                icon: "error",
                title: "Erreur",
                text: err.message || "Erreur lors de l'activation",
                confirmButtonText: "OK"
            });
        }
    } else {
        Swal.fire({
            icon: "info",
            title: "Paiement annulé",
            text: "Vous pouvez réessayer quand vous voulez.",
            confirmButtonText: "OK"
        });
    }
    
    tempBtn.remove();
}
        });
        
        // Déclencher l'ouverture du popup
        document.getElementById('temp-pay-btn').click();
        
    } catch (err) {
        Swal.close();
        console.error("Erreur:", err);
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message || "Impossible d'initier le paiement",
            confirmButtonText: "OK"
        });
    }
};


window.retryPayment = async (abonnementId, montant, patientNom, packId, durationMonths) => {
    // Récupérer le patient ID
    let patientId = AppState.currentPatient;
    if (!patientId) {
        try {
            const patients = await secureFetch("/patients");
            if (patients && patients.length > 0) {
                patientId = patients[0].id;
                AppState.currentPatient = patientId;
                localStorage.setItem("current_patient_id", patientId);
            } else {
                UI.error("Aucun patient trouvé");
                return;
            }
        } catch (err) {
            UI.error("Impossible de récupérer le patient");
            return;
        }
    }
    
    // Confirmation avant paiement
    const confirm = await Swal.fire({
        title: '<span class="text-xl font-black">💳 Paiement sécurisé</span>',
        html: `
            <div class="text-center">
                <div class="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid fa-credit-card text-emerald-500 text-3xl"></i>
                </div>
                <p class="text-sm font-bold text-slate-800 mb-2">${packId?.replace(/_/g, ' ') || 'Abonnement'}</p>
                <p class="text-xs text-slate-500">Montant: <span class="font-bold text-emerald-600">${montant.toLocaleString()} CFA</span></p>
                <p class="text-xs text-slate-500 mt-1">Durée: ${durationMonths === 0.5 ? '2 semaines' : durationMonths + ' mois'}</p>
                <div class="mt-4 p-3 bg-slate-50 rounded-xl">
                    <p class="text-[10px] text-slate-500">🔒 Paiement sécurisé par FedaPay</p>
                    <p class="text-[10px] text-slate-500 mt-1">📱 Mobile Money • 💳 Carte bancaire</p>
                </div>
            </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: '💳 Payer maintenant',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#94A3B8',
        customClass: { popup: 'rounded-2xl p-6' }
    });
    
    if (!confirm.isConfirmed) return;
    
    Swal.fire({
        title: "Préparation...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });
    
    try {
        Swal.close();
        
        // Préparer les données pour FedaPay
        const userEmail = localStorage.getItem("user_email");
        const userName = localStorage.getItem("user_name") || "Client";
        const firstName = userName.split(' ')[0];
        const lastName = userName.split(' ')[1] || "SPS";
        
        // Créer un bouton temporaire pour FedaPay
        const tempBtn = document.createElement('button');
        tempBtn.id = 'temp-pay-btn-retry';
        tempBtn.style.display = 'none';
        document.body.appendChild(tempBtn);
        
        // Initialiser FedaPay en mode popup (sans iframe)
        FedaPay.init('#temp-pay-btn-retry', {
            public_key: 'pk_live_tGAFMjEYOV37KoKgDSZGtktR',
            transaction: {
                amount: montant,
                description: `Pack ${packId?.replace(/_/g, ' ') || 'Abonnement'} - ${durationMonths} mois`
            },
            customer: {
                email: userEmail,
                firstname: firstName,
                lastname: lastName
            },
            onComplete: async (response) => {
                console.log("FedaPay fermé - Réponse:", response);
                
                const transaction = response.transaction || response;
                const isApproved = transaction && transaction.status === 'approved';
                
                if (isApproved) {
                    Swal.fire({
                        title: "Validation...",
                        didOpen: () => Swal.showLoading(),
                        allowOutsideClick: false
                    });
                    
                    try {
                        await secureFetch("/billing/pay", {
                            method: "POST",
                            body: JSON.stringify({
                                abonnement_id: abonnementId,
                                montant: montant,
                                transaction_id: transaction.id,
                                mode_paiement: "FEDAPAY"
                            })
                        });
                        
                        Swal.fire({
                            icon: "success",
                            title: "✅ Paiement confirmé !",
                            timer: 2000,
                            showConfirmButton: false
                        });
                        
                        window.switchView("billing");
                        
                    } catch (err) {
                        console.error(err);
                        Swal.fire({
                            icon: "error",
                            title: "Erreur",
                            text: err.message,
                            confirmButtonText: "OK"
                        });
                    }
                } else {
                    Swal.fire({
                        icon: "info",
                        title: "Paiement annulé",
                        text: "Vous pouvez réessayer quand vous voulez.",
                        confirmButtonText: "OK"
                    });
                }
                
                tempBtn.remove();
            }
        });
        
        // Déclencher l'ouverture du popup
        document.getElementById('temp-pay-btn-retry').click();
        
    } catch (err) {
        Swal.close();
        console.error("Erreur:", err);
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message || "Impossible d'initier le paiement",
            confirmButtonText: "OK"
        });
    }
};
                                      
// ============================================================
// INITIATION PAIEMENT FEDAPAY (fallback - non utilisé)
// ============================================================

window.initiateFedaPayPayment = async (packId, durationMonths, price) => {
    // Cette fonction n'est plus utilisée, mais gardée pour compatibilité
    console.warn("initiateFedaPayPayment n'est plus utilisé");
};
