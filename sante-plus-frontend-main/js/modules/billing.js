import { secureFetch, clearApiCache } from "../core/api.js";
import { CONFIG } from "../core/config.js";
import { UI } from "../core/utils.js";

/**
 * 📥 CHARGER LA FACTURATION
 */
export async function loadBilling() {
  const table = document.getElementById("billing-table");
  const kpiContainer = document.getElementById("billing-kpis");
  const userRole = localStorage.getItem("user_role");

  if (!table || !kpiContainer) return;

  try {
    let abonnements = await secureFetch("/billing");
    
    // Sécurisation : s'assurer que c'est un tableau
    if (!Array.isArray(abonnements)) {
      abonnements = abonnements?.data || [];
    }

    console.log("✅ Données reçues Billing:", abonnements);

    // PAS DE FACTURES
    if (!abonnements || abonnements.length === 0) {
      table.innerHTML = renderEmptyState(userRole);
      kpiContainer.innerHTML = renderEmptyKpis();
      return;
    }

    // IL Y A DES FACTURES
    // Mise à jour du statut de paiement
    const hasDebt = abonnements.some((abo) => 
      abo.statut === "En retard" || abo.statut === "Expiré"
    );
    localStorage.setItem("payment_status", hasDebt ? "Expiré" : "A jour");
    
    // Récupérer le dernier abonnement payé
    const paidAbonnement = abonnements.find(abo => abo.statut === "Payé" && abo.date_paiement);
    
    if (paidAbonnement) {
      if (paidAbonnement.date_fin_abonnement) {
        localStorage.setItem("subscription_end_date", paidAbonnement.date_fin_abonnement);
      }
      if (paidAbonnement.date_paiement) {
        localStorage.setItem("last_payment_date", paidAbonnement.date_paiement);
      }
    }

    let totalPaid = 0;
    let totalLate = 0;
    table.innerHTML = "";

    abonnements.forEach((abo) => {
      const statusBadge = getStatusBadge(abo.statut);
      const actionButton = getActionButton(abo, userRole);
      const expirationInfo = abo.date_fin_abonnement ? 
        `<div class="text-[8px] text-slate-400 mt-1">Valable jusqu'au ${new Date(abo.date_fin_abonnement).toLocaleDateString('fr-FR')}</div>` : '';

      totalPaid += abo.montant_paye || 0;
      if (abo.statut === "En retard" || abo.statut === "Expiré") {
        totalLate += (abo.montant_du - (abo.montant_paye || 0));
      }

      table.innerHTML += `
        <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
          <td class="p-4">
            <p class="font-black text-slate-800 text-xs uppercase">${escapeHtml(abo.patient?.nom_complet || 'Inconnu')}</p>
            <p class="text-[9px] text-slate-400 font-bold">${escapeHtml(abo.patient?.formule || '-')}</p>
            ${expirationInfo}
          </td>
          <td class="p-4 text-[11px] font-bold text-slate-500">${abo.mois_annee}</td>
          <td class="p-4 text-right font-black text-slate-900 text-xs">${UI.formatMoney(abo.montant_du)}</td>
          <td class="p-4 text-center">${statusBadge}</td>
          <td class="p-4 text-center">${actionButton}</td>
        </tr>
      `;
    });

    kpiContainer.innerHTML = renderKpis(totalPaid, totalLate);

  } catch (err) {
    console.error("❌ Erreur loadBilling:", err.message);
    UI.error("Erreur de chargement de la facturation");
    
    table.innerHTML = renderErrorState();
    kpiContainer.innerHTML = renderEmptyKpis();
  }
}

// ============================================================
// FONCTIONS DE RENDU
// ============================================================

function renderEmptyState(userRole) {
  return `
    <tr>
      <td colspan="5" class="p-10 text-center">
        <div class="flex flex-col items-center gap-4">
          <i class="fa-solid fa-receipt text-4xl text-slate-300"></i>
          <p class="text-slate-400 italic text-sm">Aucune facture disponible pour le moment</p>
          <p class="text-[10px] text-slate-300">Les factures apparaîtront après validation des paiements</p>
          ${userRole === "FAMILLE" ? `
            <button onclick="window.switchView('subscription')" 
                    class="mt-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all">
              🎁 Souscrire un abonnement
            </button>
          ` : ''}
          ${userRole === "COORDINATEUR" ? `
            <p class="text-xs text-slate-400 mt-2">Les factures sont créées automatiquement le 1er du mois.</p>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
}

function renderEmptyKpis() {
  return `
    <div class="bg-white p-5 rounded-2xl border border-slate-100 text-center col-span-2">
      <p class="text-slate-400 text-sm">Aucune donnée de facturation</p>
    </div>
  `;
}

function renderErrorState() {
  return `
    <tr>
      <td colspan="5" class="p-10 text-center">
        <div class="flex flex-col items-center gap-4">
          <i class="fa-solid fa-circle-exclamation text-4xl text-rose-400"></i>
          <p class="text-rose-500 text-sm">Erreur de chargement des factures</p>
          <button onclick="window.loadBilling()" class="px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px]">Réessayer</button>
        </div>
      </td>
    </tr>
  `;
}

function getStatusBadge(statut) {
  if (statut === "Payé") {
    return `<span class="badge-gold px-3 py-1 rounded-full text-[10px] font-bold">
      <i class="fa-solid fa-check-circle mr-1"></i> PAYÉ
    </span>`;
  } else if (statut === "En retard" || statut === "Expiré") {
    return `<span class="px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200 animate-pulse">
      ⚠️ ${statut === "Expiré" ? "EXPIRÉ" : "IMPAYÉ"}
    </span>`;
  } else {
    return `<span class="px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
      ⏳ EN ATTENTE
    </span>`;
  }
}


function renderKpis(totalPaid, totalLate) {
  return `
    <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total encaissé</p>
        <h3 class="text-xl font-black text-emerald-600">${UI.formatMoney(totalPaid)}</h3>
      </div>
      <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
        <i class="fa-solid fa-sack-dollar text-xl"></i>
      </div>
    </div>
    ${totalLate > 0 ? `
      <div class="bg-red-50 p-5 rounded-2xl border border-red-100 flex items-center justify-between">
        <div>
          <p class="text-[9px] font-black text-red-600 uppercase tracking-widest">Reste à recouvrer</p>
          <h3 class="text-xl font-black text-red-700">${UI.formatMoney(totalLate)}</h3>
        </div>
        <i class="fa-solid fa-hand-holding-dollar text-red-200 text-2xl"></i>
      </div>
    ` : ""}
  `;
}

// ============================================================
// PAIEMENT KIKIAPAY
// ============================================================

window.payWithKikiapay = async (abonnementId, montant, patientNom) => {
    Swal.fire({
        title: "Préparation...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        // Appel au backend pour initier le paiement
        const response = await secureFetch("/kikiapay/init-payment", {
            method: "POST",
            body: JSON.stringify({
                abonnement_id: abonnementId,
                montant: montant,
                patient_nom: patientNom,
                user_email: localStorage.getItem("user_email")
            })
        });

        Swal.close();

        if (response.success && response.payment_url) {
            // Rediriger vers la page de paiement Kikiapay
            window.location.href = response.payment_url;
        } else {
            throw new Error("URL de paiement non reçue");
        }

    } catch (err) {
        Swal.close();
        console.error("❌ Erreur:", err);
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message || "Impossible d'initier le paiement",
            confirmButtonText: "OK"
        });
    }
};

// ============================================================
// VALIDATION MANUELLE (Coordinateur)
// ============================================================

window.markAsPaid = async (id, montant) => {
  const confirm = await Swal.fire({
    title: "Confirmer le paiement ?",
    text: `Voulez-vous marquer cette facture de ${UI.formatMoney(montant)} comme payée ?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "OUI, REÇU",
    confirmButtonColor: "#10B981",
    cancelButtonText: "Annuler",
    cancelButtonColor: "#94A3B8",
    customClass: { popup: 'rounded-2xl' }
  });

  if (!confirm.isConfirmed) return;

  Swal.fire({ 
    title: "Traitement...", 
    didOpen: () => Swal.showLoading(), 
    allowOutsideClick: false 
  });
  
  try {
    await secureFetch("/billing/pay", {
      method: "POST",
      body: JSON.stringify({ abonnement_id: id, montant: montant }),
    });
    
    UI.success("Paiement validé");
    clearApiCache();
    await loadBilling();
    
    Swal.fire({
      icon: "success",
      title: "Paiement validé !",
      text: "La facture a été marquée comme payée.",
      timer: 2000,
      showConfirmButton: false
    });
    
  } catch (err) {
    console.error("❌ Erreur validation:", err);
    UI.error(err.message);
    Swal.fire({
      title: "Erreur",
      text: err.message,
      icon: "error",
      customClass: { popup: 'rounded-2xl' }
    });
  }
};


function getActionButton(abo, userRole) {
  if (userRole === "COORDINATEUR" && abo.statut !== "Payé") {
    return `<button onclick="window.markAsPaid('${abo.id}', ${abo.montant_du})" 
                   class="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase">
              Valider Cash
            </button>`;
  } else if (userRole === "FAMILLE" && abo.statut !== "Payé") {
    return `<button onclick="window.retryPayment('${abo.id}', ${abo.montant_du}, '${escapeHtml(abo.patient?.nom_complet || 'Patient')}', '${abo.type_pack || ''}', ${abo.duree_mois || 1})" 
                   class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase shadow-lg">
              💳 Payer Mobile
            </button>`;
  } else if (abo.statut === "Payé") {
    return `<button onclick="window.viewInvoice('${abo.id}')" 
                   class="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-bold text-[9px]">
              📄 Voir facture
            </button>`;
  }
  return '<span class="text-slate-300 text-[9px]">—</span>';
}






// ============================================================
// 📄 VOIR LE DÉTAIL D'UNE FACTURE
// ============================================================

window.viewInvoice = async (abonnementId) => {
    try {
        const invoice = await secureFetch(`/billing/invoice/${abonnementId}`);
        
        const result = await Swal.fire({
            title: '<span class="text-xl font-black">📄 FACTURE</span>',
            html: `
                <div class="text-left space-y-3">
                    <div class="border-b pb-2">
                        <p class="text-[10px] text-slate-400">N° FACTURE</p>
                        <p class="font-black text-slate-800">${invoice.numero}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <p class="text-[10px] text-slate-400">DATE</p>
                            <p class="font-bold text-slate-700">${invoice.date}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400">STATUT</p>
                            <p class="font-bold ${invoice.statut === 'Payé' ? 'text-emerald-600' : 'text-amber-600'}">${invoice.statut}</p>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400">FORFAIT</p>
                        <p class="font-bold text-slate-800">${invoice.type_pack?.replace(/_/g, ' ') || 'Standard'}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400">MONTANT</p>
                        <p class="text-2xl font-black text-emerald-600">${invoice.montant.toLocaleString()} CFA</p>
                    </div>
                    ${invoice.date_fin ? `
                    <div class="bg-slate-50 p-2 rounded-lg">
                        <p class="text-[9px] text-slate-400">VALIDITÉ JUSQU'AU</p>
                        <p class="font-bold text-slate-700">${invoice.date_fin}</p>
                    </div>
                    ` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "📥 Télécharger PDF",
            cancelButtonText: "Fermer",
            confirmButtonColor: "#10B981",
            cancelButtonColor: "#94A3B8",
            customClass: { popup: 'rounded-2xl p-6', confirmButton: 'rounded-xl px-6 py-3 text-[10px] font-black', cancelButton: 'rounded-xl px-6 py-3 text-[10px] font-black' }
        });
        
        if (result.isConfirmed) {
            window.downloadInvoicePDF(abonnementId);
        }
        
    } catch (err) {
        console.error("❌ Erreur chargement facture:", err);
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: "Impossible de charger la facture",
            confirmButtonText: "OK"
        });
    }
};





 
 // ============================================================
// 📄 TÉLÉCHARGER LA FACTURE EN PDF (version simplifiée)
// ============================================================

window.downloadInvoicePDF = async (abonnementId) => {
    try {
        Swal.fire({
            title: "Génération de la facture...",
            didOpen: () => Swal.showLoading(),
            allowOutsideClick: false
        });
        
        // Récupérer les données de la facture
        const invoice = await secureFetch(`/billing/invoice-data/${abonnementId}`);
        
        // Sélectionner le logo selon le thème
        const isMaman = localStorage.getItem("user_is_maman") === "true";
        const logoSrc = isMaman 
            ? "/sante-plus-frontend/assets/images/logo-maman-text.png"
            : "/sante-plus-frontend/assets/images/logo-general-text.png";
        
        const themeColor = isMaman ? '#DB2777' : '#10B981';
        
        const invoiceHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Facture ${invoice.numero}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background: white;
            padding: 40px;
            font-size: 14px;
            color: #1e293b;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid ${themeColor};
        }
        .logo { max-width: 150px; max-height: 60px; }
        .company-info { text-align: right; font-size: 12px; color: #64748b; }
        .title { text-align: center; margin: 30px 0; }
        .title h1 { font-size: 28px; color: ${themeColor}; letter-spacing: 2px; }
        .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
        }
        .info-box { flex: 1; }
        .info-box p { margin: 5px 0; }
        .info-label {
            font-size: 11px;
            font-weight: bold;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            background: #f8fafc;
            font-weight: bold;
            font-size: 12px;
            color: #475569;
            text-transform: uppercase;
        }
        .total-row { background: #f8fafc; font-weight: bold; }
        .amount {
            text-align: right;
            font-weight: bold;
            font-size: 18px;
            color: ${themeColor};
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: bold;
            background: ${invoice.statut === 'Payé' ? '#dcfce7' : '#fef3c7'};
            color: ${invoice.statut === 'Payé' ? '#166534' : '#b45309'};
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <img src="${logoSrc}" class="logo" alt="Santé Plus" style="max-width:150px; max-height:60px;">
            <div class="company-info">
                <strong>Santé Plus Services</strong><br>
                Cotonou, Bénin<br>
                +229 01 23 45 67<br>
                contact@santeplus.bj
            </div>
        </div>
        
        <div class="title">
            <h1>FACTURE</h1>
        </div>
        
        <div class="info-section">
            <div class="info-box">
                <p class="info-label">FACTURE N°</p>
                <p><strong>${invoice.numero}</strong></p>
                <p class="info-label" style="margin-top: 10px;">DATE</p>
                <p>${invoice.dateFormatted}</p>
            </div>
            <div class="info-box">
                <p class="info-label">CLIENT</p>
                <p><strong>${invoice.famille_nom || invoice.patient_nom}</strong></p>
                <p>${invoice.patient_adresse || 'Adresse non renseignée'}</p>
                <p>${invoice.patient_telephone || ''}</p>
                <p>${invoice.famille_email || ''}</p>
            </div>
            <div class="info-box">
                <p class="info-label">STATUT</p>
                <p><span class="status-badge">${invoice.statut}</span></p>
                ${invoice.date_fin ? `<p class="info-label" style="margin-top: 10px;">VALIDITÉ</p><p>Jusqu'au ${invoice.date_fin}</p>` : ''}
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Désignation</th>
                    <th>Période</th>
                    <th class="amount">Montant</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Forfait ${invoice.type_pack}</td>
                    <td>${invoice.mois}</td>
                    <td class="amount">${invoice.montant.toLocaleString()} CFA</td>
                </tr>
                <tr class="total-row">
                    <td colspan="2"><strong>TOTAL</strong></td>
                    <td class="amount"><strong>${invoice.montant.toLocaleString()} CFA</strong></td>
                </tr>
            </tbody>
        </table>
        
        <div class="footer">
            <p>Santé Plus Services - Votre partenaire de confiance pour le bien-être à domicile</p>
            <p>Merci de votre confiance</p>
        </div>
    </div>
</body>
</html>
        `;
        
        Swal.close();
        
        // Ouvrir une nouvelle fenêtre (popup) avec la facture
        const printWindow = window.open('', '_blank', 'width=800,height=600,toolbar=yes,menubar=yes');
        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        
        // Afficher une instruction
        Swal.fire({
            icon: "info",
            title: "Facture ouverte",
            html: "Une nouvelle fenêtre s'est ouverte avec la facture.<br>Utilisez <strong>Ctrl+P</strong> ou <strong>Cmd+P</strong> pour l'imprimer ou l'enregistrer en PDF.",
            confirmButtonText: "OK",
            confirmButtonColor: "#10B981"
        });
        
    } catch (err) {
        Swal.close();
        console.error("❌ Erreur génération facture:", err);
        Swal.fire({
            icon: "error",
            title: "Erreur",
            text: err.message || "Impossible de générer la facture",
            confirmButtonText: "OK"
        });
    }
};
// ============================================================
// UTILITAIRE
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
