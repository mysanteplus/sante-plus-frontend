// modules/subscription.js - VERSION PRODUCTION CORRIGÉE

import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";
import { AppState } from "../core/state.js";

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

async function getCurrentPatientForSubscription() {
    let patientId =
        AppState.currentPatient ||
        localStorage.getItem("current_patient_id") ||
        localStorage.getItem("active_patient_id");

    let patients = await secureFetch("/patients");

    if (!Array.isArray(patients)) {
        patients = patients?.data || patients?.results || [];
    }

    if (!patients.length) {
        return {
            patient: null,
            reason: "NO_PATIENT"
        };
    }

    if (patientId) {
        const found = patients.find(p => p.id === patientId);

        if (found) {
            AppState.currentPatient = found.id;
            localStorage.setItem("current_patient_id", found.id);
            localStorage.setItem("active_patient_id", found.id);

            return {
                patient: found,
                reason: "FOUND"
            };
        }
    }

    if (patients.length === 1) {
        AppState.currentPatient = patients[0].id;
        localStorage.setItem("current_patient_id", patients[0].id);
        localStorage.setItem("active_patient_id", patients[0].id);

        return {
            patient: patients[0],
            reason: "ONLY_ONE"
        };
    }

    return {
        patient: null,
        reason: "MULTIPLE_PATIENTS"
    };
}

// ============================================================
// PACKS CONFORT 24/7 (pour comptes SANS_PATIENT)
// ============================================================

function getConfortPacks() {
    return [
        { 
            id: 'CONFORT_247_MENSUEL', 
            name: 'Mensuel', 
            desc: 'Accès complet', 
            price: 25000, 
            priceDisplay: '25.000 CFA', 
            duration: 1, 
            durationText: '1 mois',
            features: ['Commandes illimitées', 'Support prioritaire 24/7', 'Historique de commandes'],
            icon: 'fa-crown',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            popular: true
        },
        { 
            id: 'CONFORT_247_TRIMESTRIEL', 
            name: 'Trimestriel', 
            desc: 'Économie 5%', 
            price: 71250, 
            priceDisplay: '71.250 CFA',
            originalPrice: 75000,
            duration: 3, 
            durationText: '3 mois',
            features: ['Commandes illimitées', 'Support prioritaire 24/7', 'Historique de commandes', 'Économie 5%'],
            icon: 'fa-calendar-alt',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            popular: false,
            badge: '-5%'
        },
        { 
            id: 'CONFORT_247_ANNUEL', 
            name: 'Annuel', 
            desc: 'Économie 15%', 
            price: 255000, 
            priceDisplay: '255.000 CFA',
            originalPrice: 300000,
            duration: 12, 
            durationText: '12 mois',
            features: ['Commandes illimitées', 'Support prioritaire 24/7', 'Historique de commandes', 'Économie 15%', 'Paiement unique'],
            icon: 'fa-calendar-year',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            popular: false,
            badge: '-15%'
        }
    ];
}

// ============================================================
// DÉFINITION DES PACKS MÉDICAUX
// ============================================================

function getMedicalPacks(isMaman) {
    if (isMaman) {
        return [
            { 
                id: 'ESSENTIEL_MAMAN', 
                name: 'Essentiel', 
                desc: '2 semaines', 
                price: 65000, 
                priceDisplay: '65.000 CFA', 
                duration: 0.5, 
                durationText: '2 semaines',
                features: ['Découverte post-partum', 'Suivi de base'],
                icon: 'fa-seedling',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                popular: false
            },
            { 
                id: 'CONFORT_MAMAN', 
                name: 'Confort', 
                desc: '3 semaines', 
                price: 100000, 
                priceDisplay: '100.000 CFA', 
                duration: 0.75, 
                durationText: '3 semaines',
                features: ['Accompagnement standard', 'Aide à l\'allaitement'],
                icon: 'fa-chart-line',
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                popular: true
            },
            { 
                id: 'SERENITE_MAMAN', 
                name: 'Sérénité', 
                desc: '4 semaines', 
                price: 140000, 
                priceDisplay: '140.000 CFA', 
                duration: 1, 
                durationText: '4 semaines',
                features: ['Suivi rapproché premium', 'Accompagnement complet'],
                icon: 'fa-crown',
                color: 'text-gold-primary',
                bg: 'bg-amber-50',
                popular: false
            },
            { 
                id: 'PRIVILEGE_MAMAN', 
                name: 'Privilège', 
                desc: '5 semaines', 
                price: 200000, 
                priceDisplay: '200.000 CFA', 
                duration: 1.25, 
                durationText: '5 semaines',
                features: ['Coaching complet', 'Service diaspora', 'Support 24/7'],
                icon: 'fa-star',
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                popular: false,
                badge: '⭐ Premium'
            }
        ];
    } else {
        return [
            { 
                id: 'ESSENTIEL_SENIOR', 
                name: 'Essentiel', 
                desc: '4 visites / mois', 
                price: 45000, 
                priceDisplay: '45.000 CFA', 
                duration: 1, 
                durationText: '1 mois',
                features: ['4 visites par mois', 'Suivi léger'],
                icon: 'fa-seedling',
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
                popular: false
            },
            { 
                id: 'ACCOMPAGNEMENT_SENIOR', 
                name: 'Accompagnement', 
                desc: '8 visites / mois', 
                price: 80000, 
                priceDisplay: '80.000 CFA', 
                duration: 1, 
                durationText: '1 mois',
                features: ['8 visites par mois', 'Sortie hôpital', 'Convalescence'],
                icon: 'fa-hand-holding-heart',
                color: 'text-blue-600',
                bg: 'bg-blue-50',
                popular: true
            },
            { 
                id: 'SERENITE_SENIOR', 
                name: 'Sérénité Seniors', 
                desc: '12 visites / mois', 
                price: 100000, 
                priceDisplay: '100.000 CFA', 
                duration: 1, 
                durationText: '1 mois',
                features: ['12 visites par mois', 'Suivi régulier', 'Personnes âgées'],
                icon: 'fa-crown',
                color: 'text-gold-primary',
                bg: 'bg-amber-50',
                popular: false
            },
            { 
                id: 'PRIVILEGE_SENIOR', 
                name: 'Privilège Famille', 
                desc: 'Visites illimitées', 
                price: 200000, 
                priceDisplay: '200.000 CFA', 
                duration: 1, 
                durationText: '1 mois',
                features: ['Visites illimitées', 'Coordination totale', 'Support prioritaire'],
                icon: 'fa-star',
                color: 'text-purple-600',
                bg: 'bg-purple-50',
                popular: false,
                badge: '⭐ Premium'
            }
        ];
    }
}

// ============================================================
// PAGE D'ABONNEMENT
// ============================================================

export async function renderSubscriptionPage() {
    const container = document.getElementById("view-container");
    const userRole = localStorage.getItem("user_role");
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const typeCompte = localStorage.getItem("user_type_compte") || "AVEC_PATIENT";
    const isSansPatient = typeCompte === "SANS_PATIENT";
    
    let currentPatient = null;

    if (userRole === "FAMILLE" && !isSansPatient) {
        try {
            const result = await getCurrentPatientForSubscription();

            if (result.reason === "MULTIPLE_PATIENTS") {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-[55vh] p-8 text-center">
                        <div class="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                            <i class="fa-solid fa-users text-3xl text-amber-500"></i>
                        </div>
                        <h3 class="text-xl font-black text-slate-800">Choisissez un dossier</h3>
                        <p class="text-sm text-slate-500 mt-2 max-w-xs">
                            Vous avez plusieurs dossiers patients. Sélectionnez d'abord le dossier concerné avant de choisir une formule.
                        </p>
                        <button onclick="window.switchView('patients')" 
                                class="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                            Choisir un dossier
                        </button>
                    </div>
                `;
                return;
            }

            if (result.reason === "NO_PATIENT") {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center min-h-[55vh] p-8 text-center">
                        <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <i class="fa-solid fa-user-slash text-3xl text-slate-300"></i>
                        </div>
                        <h3 class="text-xl font-black text-slate-800">Aucun dossier patient</h3>
                        <p class="text-sm text-slate-500 mt-2 max-w-xs">
                            Vous devez avoir un dossier patient actif pour souscrire à une formule médicale.
                        </p>
                        <button onclick="window.switchView('home')" 
                                class="mt-6 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                            Retour à l'accueil
                        </button>
                    </div>
                `;
                return;
            }

            currentPatient = result.patient;

        } catch (e) {
            console.error("Erreur récupération patient:", e);
            UI.error("Impossible de charger le dossier patient");
        }
    }
    
    let packs = [];
    
    if (isSansPatient) {
        packs = getConfortPacks();
    } else {
        packs = getMedicalPacks(isMaman);
    }
    
    container.innerHTML = `
        <div class="animate-fadeIn max-w-2xl mx-auto pb-32">
            <div class="flex items-center gap-4 mb-8">
                <button onclick="window.switchView('home')" 
                        class="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-95">
                    <i class="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <div>
                    <h3 class="font-black text-2xl text-slate-800 tracking-tight">
                        ${isSansPatient ? 'Pack Confort 24/7' : 'Nos Formules'}
                    </h3>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        ${isSansPatient ? 'Commandes illimitées et support prioritaire' : 'Choisissez l\'accompagnement qui vous convient'}
                    </p>
                </div>
            </div>
            
            ${currentPatient && !isSansPatient ? `
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
                    <p class="font-black text-slate-800 text-sm">
                        ${isSansPatient ? 'Pourquoi souscrire au Pack Confort ?' : 'Pourquoi s\'abonner ?'}
                    </p>
                </div>
                <ul class="space-y-2 text-xs text-slate-600">
                    ${isSansPatient ? `
                        <li class="flex items-center gap-2">✓ Commandes de produits illimitées</li>
                        <li class="flex items-center gap-2">✓ Support prioritaire 24/7</li>
                        <li class="flex items-center gap-2">✓ Historique de commandes conservé</li>
                        <li class="flex items-center gap-2">✓ Ajout possible d'un patient plus tard</li>
                        <li class="flex items-center gap-2">✓ Paiement sécurisé via FedaPay</li>
                    ` : `
                        <li class="flex items-center gap-2">✓ Suivi médical personnalisé 24/7</li>
                        <li class="flex items-center gap-2">✓ Intervenants qualifiés et formés</li>
                        <li class="flex items-center gap-2">✓ Rapport détaillé après chaque visite</li>
                        <li class="flex items-center gap-2">✓ Assistance téléphonique prioritaire</li>
                        <li class="flex items-center gap-2">✓ Paiement sécurisé via FedaPay</li>
                    `}
                </ul>
            </div>
        </div>
    `;
}

// ============================================================
// SÉLECTION D'UN PACK ET PAIEMENT
// ============================================================

window.selectSubscriptionPack = async (packId, price, durationMonths) => {
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const typeCompte = localStorage.getItem("user_type_compte") || "AVEC_PATIENT";
    const isSansPatient = typeCompte === "SANS_PATIENT";
    
    let selectedPack = null;
    let packs = [];
    
    if (isSansPatient) {
        packs = getConfortPacks();
    } else {
        packs = getMedicalPacks(isMaman);
    }
    
    selectedPack = packs.find(p => p.id === packId);
    
    if (!selectedPack) {
        UI.error("Pack non trouvé");
        return;
    }
    
    let patientId = null;

    if (!isSansPatient) {
        try {
            const result = await getCurrentPatientForSubscription();

            if (result.reason === "MULTIPLE_PATIENTS") {
                await Swal.fire({
                    icon: "info",
                    title: "Choisissez d'abord un dossier",
                    text: "Vous avez plusieurs dossiers patients. Sélectionnez le dossier concerné avant de payer une formule.",
                    confirmButtonText: "Choisir un dossier",
                    confirmButtonColor: "#10B981"
                });

                await window.switchView("patients");
                return;
            }

            if (result.reason === "NO_PATIENT" || !result.patient) {
                UI.error("Aucun patient trouvé");
                return;
            }

            patientId = result.patient.id;

        } catch (err) {
            console.error("Erreur récupération patient:", err);
            UI.error("Impossible de récupérer le patient");
            return;
        }
    }
    
    // Confirmation avant paiement
    const confirm = await Swal.fire({
        title: `<span class="text-xl font-black">${isSansPatient ? '💎 Pack Confort' : '💳 Paiement sécurisé'}</span>`,
        html: `
            <div class="text-center">
                <div class="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <i class="fa-solid ${isSansPatient ? 'fa-crown' : 'fa-credit-card'} text-emerald-500 text-3xl"></i>
                </div>
                <p class="text-sm font-bold text-slate-800 mb-2">${selectedPack.name}</p>
                <p class="text-xs text-slate-500">Montant: <span class="font-bold text-emerald-600">${price.toLocaleString()} CFA</span></p>
                <p class="text-xs text-slate-500 mt-1">Durée: ${durationMonths === 0.5 ? '2 semaines' : durationMonths + ' mois'}</p>
                <div class="mt-4 p-3 bg-slate-50 rounded-xl">
                    <p class="text-[10px] text-slate-500">🔒 Paiement sécurisé par FedaPay</p>
                    <p class="text-[10px] text-slate-500 mt-1">📱 Mobile Money • 💳 Carte bancaire</p>
                </div>
                ${isSansPatient ? `
                    <div class="mt-3 p-2 bg-blue-50 rounded-lg">
                        <p class="text-[8px] text-blue-600">✨ Inclus: commandes illimitées, support prioritaire, historique conservé</p>
                    </div>
                ` : ''}
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
        let facture;
        
        if (isSansPatient) {
            const response = await secureFetch("/billing/init-confort-payment", {
                method: "POST",
                body: JSON.stringify({
                    montant: price,
                    duree_mois: durationMonths
                })
            });
        
            Swal.close();
        
            if (response.success === true && response.payment_url) {
                window.location.href = response.payment_url;
                return;
            }
        
            throw new Error("URL de paiement FedaPay non reçue");
        } else {
            facture = await secureFetch("/billing/generate", {
                method: "POST",
                body: JSON.stringify({
                    patient_id: patientId,
                    montant: price,
                    pack: packId
                })
            });
            console.log("✅ Facture médicale créée:", facture);
        }
        
        Swal.close();
        
        const userEmail = localStorage.getItem("user_email");
        const userName = localStorage.getItem("user_name") || "Client";
        const firstName = userName.split(' ')[0];
        const lastName = userName.split(' ')[1] || "SPS";
        
        const tempBtn = document.createElement('button');
        tempBtn.id = 'temp-pay-btn';
        tempBtn.style.display = 'none';
        document.body.appendChild(tempBtn);
        
        FedaPay.init('#temp-pay-btn', {
            public_key: 'pk_live_yUBTAv4LLN0V7WBMpfuXnPdD',
            transaction: {
                amount: price,
                description: isSansPatient 
                    ? `Pack Confort 24/7 - ${durationMonths} mois`
                    : `Pack ${selectedPack.name} - ${durationMonths} mois`
            },
            customer: {
                email: userEmail,
                firstname: firstName,
                lastname: lastName
            },
            onComplete: async (response) => {
                console.log("FedaPay fermé - Réponse complète:", response);

                const transaction = response.transaction || response;
                const isApproved = transaction && transaction.status === "approved";

                if (!isApproved) {
                    Swal.fire({
                        icon: "info",
                        title: "Paiement annulé",
                        text: "Vous pouvez réessayer quand vous voulez.",
                        confirmButtonText: "OK"
                    });

                    tempBtn.remove();
                    return;
                }

                Swal.fire({
                    title: "Validation du paiement...",
                    didOpen: () => Swal.showLoading(),
                    allowOutsideClick: false
                });

                try {
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

                    localStorage.setItem("subscription_active", "true");

                    if (typeof window.refreshSubscriptionStatus === "function") {
                        await window.refreshSubscriptionStatus();
                    }

                    Swal.fire({
                        icon: "success",
                        title: "✅ Abonnement activé !",
                        timer: 2000,
                        showConfirmButton: false
                    });

                    window.switchView("billing");

                } catch (err) {
                    console.error("❌ Erreur lors de la validation:", err);

                    Swal.fire({
                        icon: "error",
                        title: "Erreur",
                        text: err.message || "Erreur lors de l'activation",
                        confirmButtonText: "OK"
                    });
                } finally {
                    tempBtn.remove();
                }
            }
        });
        
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

// ============================================================
// RETRY PAYMENT
// ============================================================

window.retryPayment = async (abonnementId, montant, patientNom, packId, durationMonths) => {
    let patientId = AppState.currentPatient ||
        localStorage.getItem("current_patient_id") ||
        localStorage.getItem("active_patient_id");

    if (!patientId) {
        try {
            const result = await getCurrentPatientForSubscription();

            if (result.reason === "MULTIPLE_PATIENTS") {
                await Swal.fire({
                    icon: "info",
                    title: "Choisissez d'abord un dossier",
                    text: "Vous avez plusieurs dossiers patients. Sélectionnez le dossier concerné avant de payer cette facture.",
                    confirmButtonText: "Choisir un dossier",
                    confirmButtonColor: "#10B981"
                });

                await window.switchView("patients");
                return;
            }

            if (result.reason === "NO_PATIENT" || !result.patient) {
                UI.error("Aucun patient trouvé");
                return;
            }

            patientId = result.patient.id;

        } catch (err) {
            console.error("Erreur récupération patient:", err);
            UI.error("Impossible de récupérer le patient");
            return;
        }
    }
    
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
        
        const userEmail = localStorage.getItem("user_email");
        const userName = localStorage.getItem("user_name") || "Client";
        const firstName = userName.split(' ')[0];
        const lastName = userName.split(' ')[1] || "SPS";
        
        const tempBtn = document.createElement('button');
        tempBtn.id = 'temp-pay-btn-retry';
        tempBtn.style.display = 'none';
        document.body.appendChild(tempBtn);
        
        FedaPay.init('#temp-pay-btn-retry', {
            public_key: 'pk_live_yUBTAv4LLN0V7WBMpfuXnPdD',
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
