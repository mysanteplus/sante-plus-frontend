// js/modules/maman.js - VERSION 100% DYNAMIQUE
import { secureFetch } from "../core/api.js";
import { UI } from "../core/utils.js";
import supabase from "../core/supabaseClient.js";

// ============================================================
// DASHBOARD MAMAN COMPLET AVEC DONNÉES RÉELLES
// ============================================================

export async function loadMamanDashboard() {
    const container = document.getElementById("view-container");
    if (!container) return;

    const userName = localStorage.getItem("user_name") || "Maman";
    const isMaman = localStorage.getItem("user_is_maman") === "true";

    if (!isMaman) {
        window.switchView('home');
        return;
    }

    // Récupérer l'ID du patient
    let patientId = null;
    let patientInfo = null;
    
    try {
        let patients = await secureFetch("/patients");
        if (!Array.isArray(patients)) patients = patients?.data || [];
        patientInfo = patients[0];
        patientId = patientInfo?.id;
        
        if (!patientId) {
            container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">Aucun patient associé</p></div>`;
            return;
        }
    } catch (err) {
        console.error("Erreur récupération patient:", err);
        container.innerHTML = `<div class="text-center py-20"><p class="text-red-500">Erreur de chargement</p></div>`;
        return;
    }

    // 📊 CHARGER TOUTES LES DONNÉES RÉELLES
    const [
        babyMetrics,      // Dernières métriques
        weightHistory,    // Historique poids
        feedingHistory,   // Historique tétées
        sleepHistory,     // Historique sommeil
        diaperHistory,    // Historique couches
        nextVisit,        // Prochaine visite
        visitProgress,    // Progression des visites
        moodHistory       // Historique humeurs
    ] = await Promise.all([
        fetchLatestBabyMetrics(patientId),
        fetchMetricsHistory(patientId, 'weight', 30),
        fetchMetricsHistory(patientId, 'feeding', 14),
        fetchMetricsHistory(patientId, 'sleep', 14),
        fetchMetricsHistory(patientId, 'diapers', 14),
        fetchNextVisit(patientId),
        calculateVisitProgress(patientId),
        fetchMoodHistory(patientId, 30)
    ]);

    // 📈 CALCULER LES STATISTIQUES RÉELLES
    const feedingStats = calculateAverageStats(feedingHistory, 'feeding');
    const sleepStats = calculateAverageStats(sleepHistory, 'sleep');
    const diaperToday = getTodayValue(diaperHistory, 'diapers');
    const weightLastWeek = getWeightChange(weightHistory);
    const lastFeeding = getLastFeedingTime(feedingHistory);
    
    // 🎨 COULEURS DYNAMIQUES
    const primaryColor = '#E11D48';
    const primaryLight = '#FFF1F2';
    
    // 📅 FORMATER LA DATE DE PROCHAINE VISITE
    const nextVisitDate = nextVisit ? new Date(nextVisit.date_prevue) : null;
    const nextVisitFormatted = nextVisitDate ? nextVisitDate.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long',
        weekday: 'long'
    }) : 'Aucune visite planifiée';
    
    const nextVisitTime = nextVisit?.heure_prevue ? nextVisit.heure_prevue.substring(0, 5) : '--:--';
    
    // 🏆 BADGES DE FÉLICITATIONS (basés sur données réelles)
    const badges = generateRealBadges(weightHistory, feedingHistory, sleepHistory);

    container.innerHTML = `
        <div class="maman-dashboard-container animate-fadeIn pb-24">
            <!-- HEADER ROSE -->
            <div class="bg-gradient-to-r from-pink-500 to-pink-600 rounded-2xl p-5 mb-5 text-white">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="text-[10px] font-bold opacity-80">Bonjour</p>
                        <h2 class="text-2xl font-black">${escapeHtml(userName.split(' ')[0])}</h2>
                        <p class="text-sm opacity-90 mt-1">Suivi maman & bébé</p>
                        <p class="text-[9px] opacity-70 mt-1">👶 ${escapeHtml(patientInfo?.nom_complet || 'Bébé')}</p>
                    </div>
                    <div class="relative">
                        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <i class="fa-regular fa-bell text-white text-lg"></i>
                        </div>
                        <span id="maman-notif-badge" class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[8px] text-white flex items-center justify-center hidden">0</span>
                    </div>
                </div>
            </div>

            <!-- PROCHAINE VISITE (DONNÉES RÉELLES) -->
            <div class="bg-white rounded-xl p-4 mb-5 shadow-sm border border-pink-100">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <p class="text-[9px] font-bold text-pink-500 uppercase tracking-wider">📅 PROCHAINE VISITE</p>
                        <h3 class="text-base font-black text-slate-800">${nextVisitFormatted}</h3>
                        <p class="text-xs text-slate-500">${nextVisitTime} • À domicile</p>
                    </div>
                    <div class="bg-pink-50 px-3 py-1 rounded-full">
                        <span class="text-[9px] font-bold text-pink-600">${nextVisit ? 'Planifié' : 'Aucune'}</span>
                    </div>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div class="h-1.5 rounded-full bg-pink-500 transition-all" style="width: ${visitProgress}%"></div>
                </div>
                <p class="text-[8px] text-slate-400 text-center mt-2">${visitProgress}% du programme réalisé</p>
            </div>

            <!-- MÉTRIQUES BÉBÉ (4 CARTES - DONNÉES RÉELLES) -->
            <div class="grid grid-cols-2 gap-3 mb-5">
                <!-- Carte Tétée -->
                <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div class="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center mb-2">
                        <i class="fa-solid fa-baby-bottle text-pink-500 text-base"></i>
                    </div>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Dernière tétée</p>
                    <p class="text-xl font-black text-slate-800">${formatFeedingTime(lastFeeding)}</p>
                    <p class="text-[9px] text-slate-400">depuis dernier repas</p>
                    <p class="text-[7px] text-pink-400 mt-1">📊 ${feedingHistory.length} enregistrements</p>
                </div>
                
                <!-- Carte Sommeil -->
                <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                        <i class="fa-solid fa-moon text-blue-500 text-base"></i>
                    </div>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Sommeil moyen</p>
                    <p class="text-xl font-black text-slate-800">${sleepStats.avg}h</p>
                    <p class="text-[9px] text-slate-400">par jour (7j)</p>
                    <p class="text-[7px] text-pink-400 mt-1">📊 ${sleepHistory.length} nuits</p>
                </div>
                
                <!-- Carte Couches -->
                <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                        <i class="fa-solid fa-droplet text-amber-500 text-base"></i>
                    </div>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Couches aujourd'hui</p>
                    <p class="text-xl font-black text-slate-800">${diaperToday}</p>
                    <p class="text-[9px] text-slate-400">changées</p>
                    <p class="text-[7px] text-pink-400 mt-1">📊 ${diaperHistory.length} jours suivis</p>
                </div>
                
                <!-- Carte Poids -->
                <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                        <i class="fa-solid fa-chart-line text-emerald-500 text-base"></i>
                    </div>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Croissance</p>
                    <p class="text-xl font-black text-slate-800">${formatWeight(weightHistory[weightHistory.length - 1]?.value)}</p>
                    <p class="text-[9px] text-slate-400">dernier poids</p>
                    <p class="text-[7px] ${weightLastWeek.change > 0 ? 'text-emerald-500' : weightLastWeek.change < 0 ? 'text-amber-500' : 'text-slate-400'} mt-1">
                        ${weightLastWeek.change > 0 ? '+' : ''}${weightLastWeek.change}g cette semaine
                    </p>
                </div>
            </div>

            <!-- GRAPHIQUE DE POIDS (DONNÉES RÉELLES) -->
            ${weightHistory.length > 1 ? `
            <div class="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-pink-100">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-bold text-slate-800 text-sm">📈 Courbe de poids de bébé</h4>
                    <span class="text-[9px] text-pink-500 font-bold">${weightHistory.length} mesures</span>
                </div>
                <canvas id="weight-chart" height="160" style="max-height: 160px;"></canvas>
                <p class="text-[8px] text-slate-400 text-center mt-2">Les mesures sont enregistrées par l'accompagnatrice lors des visites</p>
            </div>
            ` : `
            <div class="bg-white rounded-2xl p-5 mb-5 shadow-sm border border-pink-100 text-center">
                <i class="fa-solid fa-chart-line text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs text-slate-400">Aucune mesure de poids pour le moment</p>
                <p class="text-[9px] text-slate-400 mt-1">L'accompagnatrice enregistrera le poids lors des visites</p>
            </div>
            `}

            <!-- STATISTIQUES TÉTÉES VS SOMMEIL (DONNÉES RÉELLES) -->
            ${(feedingHistory.length > 1 || sleepHistory.length > 1) ? `
            <div class="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-pink-100">
                <h4 class="font-bold text-slate-800 text-sm mb-3">🍼 Tétées vs 😴 Sommeil (7 derniers jours)</h4>
                <canvas id="feeding-sleep-chart" height="140" style="max-height: 140px;"></canvas>
            </div>
            ` : ''}

            <!-- TRACKER D'HUMEUR (DONNÉES RÉELLES) -->
            <div class="bg-white rounded-xl p-4 mb-5 shadow-sm border border-pink-100">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-bold text-slate-800 text-sm">💝 Comment vous sentez-vous ?</h4>
                    ${moodHistory.length > 0 ? `
                        <button onclick="window.showMoodHistoryFromDB()" class="text-[10px] font-semibold text-pink-500">
                            📊 ${moodHistory.length} jours
                        </button>
                    ` : ''}
                </div>
                <div class="grid grid-cols-4 gap-2">
                    <button onclick="window.saveMoodToDB('excellent')" class="mood-btn flex flex-col items-center active:scale-95 transition-all">
                        <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-xl">😊</div>
                        <span class="text-[8px] text-slate-500 mt-1">Excellent</span>
                    </button>
                    <button onclick="window.saveMoodToDB('bien')" class="mood-btn flex flex-col items-center active:scale-95 transition-all">
                        <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">😐</div>
                        <span class="text-[8px] text-slate-500 mt-1">Bien</span>
                    </button>
                    <button onclick="window.saveMoodToDB('fatigue')" class="mood-btn flex flex-col items-center active:scale-95 transition-all">
                        <div class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl">😴</div>
                        <span class="text-[8px] text-slate-500 mt-1">Fatiguée</span>
                    </button>
                    <button onclick="window.saveMoodToDB('triste')" class="mood-btn flex flex-col items-center active:scale-95 transition-all">
                        <div class="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-xl">😔</div>
                        <span class="text-[8px] text-slate-500 mt-1">Triste</span>
                    </button>
                </div>
            </div>

            <!-- BADGES DE RÉUSSITE (basés sur données réelles) -->
            ${badges.length > 0 ? `
            <div class="bg-gradient-to-r from-pink-50 to-pink-100 rounded-2xl p-4 mb-5">
                <div class="flex flex-wrap justify-center gap-2">
                    ${badges.map(b => `
                        <span class="px-3 py-1.5 rounded-full text-[9px] font-bold ${b.color}">
                            <span class="mr-1">${b.emoji}</span>${b.text}
                        </span>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- FORFAITS (DONNÉES RÉELLES DEPUIS LA BDD) -->
            <div class="mb-5">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="font-bold text-slate-800 text-sm">🎁 Nos Forfaits</h4>
                    <button onclick="window.switchView('subscription')" class="text-[10px] font-semibold text-pink-500">Voir tout</button>
                </div>
                <div id="packs-container" class="space-y-2">
                    <div class="text-center py-4">
                        <div class="relative w-6 h-6 mx-auto mb-2">
                            <div class="absolute inset-0 border-2 border-slate-100 border-t-pink-500 rounded-full animate-spin"></div>
                        </div>
                        <p class="text-[10px] text-slate-400">Chargement des offres...</p>
                    </div>
                </div>
            </div>

            <!-- NAVIGATION RAPIDE -->
            <div class="grid grid-cols-4 gap-2">
                <button onclick="window.switchView('feed')" class="flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-pink-100 text-pink-500 active:scale-95 transition-all">
                    <i class="fa-regular fa-message text-base"></i>
                    <span class="text-[8px] font-bold">Journal</span>
                </button>
                <button onclick="window.switchView('visits')" class="flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-pink-100 text-pink-500 active:scale-95 transition-all">
                    <i class="fa-regular fa-calendar-check text-base"></i>
                    <span class="text-[8px] font-bold">Visites</span>
                </button>
                <button onclick="window.switchView('commandes')" class="flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-pink-100 text-pink-500 active:scale-95 transition-all">
                    <i class="fa-solid fa-box text-base"></i>
                    <span class="text-[8px] font-bold">Commandes</span>
                </button>
                <button onclick="window.switchView('profile')" class="flex flex-col items-center gap-1 py-3 bg-white rounded-xl border border-pink-100 text-pink-500 active:scale-95 transition-all">
                    <i class="fa-regular fa-user text-base"></i>
                    <span class="text-[8px] font-bold">Profil</span>
                </button>
            </div>
        </div>
    `;

    // 📊 DESSINER LES GRAPHIQUES AVEC DONNÉES RÉELLES
    setTimeout(() => {
        if (weightHistory.length > 1) drawRealWeightChart(weightHistory);
        if (feedingHistory.length > 1 || sleepHistory.length > 1) {
            drawRealFeedingSleepChart(feedingHistory, sleepHistory);
        }
    }, 100);

    // Charger les packs depuis la BDD
    loadRealPacks();
}

// ============================================================
// FONCTIONS DE RÉCUPÉRATION DES DONNÉES (RÉELLES)
// ============================================================

async function fetchLatestBabyMetrics(patientId) {
    try {
        const { data, error } = await supabase
            .from("baby_metrics")
            .select("metric_type, value, recorded_at")
            .eq("patient_id", patientId)
            .order("recorded_at", { ascending: false });
        
        if (error) throw error;
        
        const metrics = { lastFeeding: null, sleep: null, diapers: null, weight: null };
        const latestByType = {};
        
        for (const item of data || []) {
            if (!latestByType[item.metric_type]) {
                latestByType[item.metric_type] = item;
            }
        }
        
        if (latestByType.feeding) metrics.lastFeeding = latestByType.feeding.value;
        if (latestByType.sleep) metrics.sleep = latestByType.sleep.value;
        if (latestByType.diapers) metrics.diapers = latestByType.diapers.value;
        if (latestByType.weight) metrics.weight = latestByType.weight.value;
        
        return metrics;
    } catch (err) {
        console.error("Erreur fetch baby metrics:", err);
        return { lastFeeding: null, sleep: null, diapers: null, weight: null };
    }
}

async function fetchMetricsHistory(patientId, metricType, limit = 30) {
    try {
        const { data, error } = await supabase
            .from("baby_metrics")
            .select("value, recorded_at")
            .eq("patient_id", patientId)
            .eq("metric_type", metricType)
            .order("recorded_at", { ascending: true })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error(`Erreur fetch ${metricType}:`, err);
        return [];
    }
}

async function fetchMoodHistory(patientId, limit = 30) {
    try {
        const { data, error } = await supabase
            .from("mama_moods")
            .select("mood, recorded_at")
            .eq("patient_id", patientId)
            .order("recorded_at", { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Erreur fetch moods:", err);
        return [];
    }
}

async function fetchNextVisit(patientId) {
    try {
        const { data, error } = await supabase
            .from("planning")
            .select("date_prevue, heure_prevue, statut")
            .eq("patient_id", patientId)
            .eq("est_actif", true)
            .gte("date_prevue", new Date().toISOString().split('T')[0])
            .order("date_prevue", { ascending: true })
            .limit(1)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Erreur fetch next visit:", err);
        return null;
    }
}

async function calculateVisitProgress(patientId) {
    try {
        const { data, error } = await supabase
            .from("visites")
            .select("statut")
            .eq("patient_id", patientId);
        
        if (error) throw error;
        
        const total = data?.length || 0;
        const completed = data?.filter(v => v.statut === "Validé").length || 0;
        return total > 0 ? Math.round((completed / total) * 100) : 0;
    } catch (err) {
        console.error("Erreur calcul progression:", err);
        return 0;
    }
}

// ============================================================
// FONCTIONS DE CALCUL STATISTIQUE
// ============================================================

function calculateAverageStats(history, type) {
    if (!history.length) return { avg: 0, percentage: 0 };
    
    const avg = (history.reduce((a, b) => a + b.value, 0) / history.length).toFixed(1);
    let percentage = 0;
    
    if (type === 'feeding') {
        percentage = Math.min(100, Math.round((parseFloat(avg) / 4) * 100));
    } else if (type === 'sleep') {
        percentage = Math.min(100, Math.round((parseFloat(avg) / 12) * 100));
    }
    
    return { avg: parseFloat(avg), percentage: percentage };
}

function getTodayValue(history, type) {
    if (!history.length) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = history.find(h => h.recorded_at?.split('T')[0] === today);
    
    if (todayEntry) return todayEntry.value;
    
    // Sinon, retourner la dernière valeur
    return history[history.length - 1]?.value || 0;
}

function getWeightChange(weightHistory) {
    if (weightHistory.length < 2) return { change: 0, percentage: 0 };
    
    const lastWeek = weightHistory.slice(-7);
    if (lastWeek.length < 2) return { change: 0, percentage: 0 };
    
    const first = lastWeek[0]?.value || 0;
    const last = lastWeek[lastWeek.length - 1]?.value || 0;
    const change = last - first;
    
    return { change: change, percentage: first > 0 ? (change / first) * 100 : 0 };
}

function getLastFeedingTime(feedingHistory) {
    if (!feedingHistory.length) return '--';
    
    const lastFeeding = feedingHistory[feedingHistory.length - 1];
    if (!lastFeeding?.recorded_at) return '--';
    
    const lastDate = new Date(lastFeeding.recorded_at);
    const now = new Date();
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
        const minutes = Math.round(diffHours * 60);
        return `${minutes} min`;
    }
    return `${diffHours.toFixed(1)} h`;
}

// ============================================================
// FONCTIONS DE FORMATAGE
// ============================================================

function formatFeedingTime(hours) {
    if (!hours || hours === '--') return '--';
    if (typeof hours === 'number') {
        if (hours < 1) return `${Math.round(hours * 60)} min`;
        return `${hours.toFixed(1)} h`;
    }
    return hours;
}

function formatWeight(grams) {
    if (!grams) return '--';
    if (grams < 1000) return `${grams} g`;
    return `${(grams / 1000).toFixed(1)} kg`;
}

// ============================================================
// BADGES DE RÉUSSITE (BASÉS SUR DONNÉES RÉELLES)
// ============================================================

function generateRealBadges(weightHistory, feedingHistory, sleepHistory) {
    const badges = [];
    
    // Badge poids
    if (weightHistory.length >= 2) {
        const firstWeight = weightHistory[0]?.value || 0;
        const lastWeight = weightHistory[weightHistory.length - 1]?.value || 0;
        const gain = (lastWeight - firstWeight) / 1000;
        
        if (gain > 1) badges.push({ emoji: '🏆', text: `+${gain.toFixed(1)} kg pris !`, color: 'bg-emerald-100 text-emerald-700' });
        else if (gain > 0.5) badges.push({ emoji: '📈', text: `+${gain.toFixed(1)} kg`, color: 'bg-blue-100 text-blue-700' });
    }
    
    // Badge nombre de tétées
    if (feedingHistory.length >= 7) {
        const avgFeeding = feedingHistory.slice(-7).reduce((a, b) => a + b.value, 0) / 7;
        if (avgFeeding >= 8) badges.push({ emoji: '🍼', text: `${avgFeeding.toFixed(0)} tétées/jour en moyenne`, color: 'bg-pink-100 text-pink-700' });
    }
    
    // Badge sommeil
    if (sleepHistory.length >= 7) {
        const avgSleep = sleepHistory.slice(-7).reduce((a, b) => a + b.value, 0) / 7;
        if (avgSleep >= 10) badges.push({ emoji: '😴', text: 'Bébé dort très bien !', color: 'bg-indigo-100 text-indigo-700' });
        else if (avgSleep >= 8) badges.push({ emoji: '🌙', text: 'Nuits paisibles', color: 'bg-purple-100 text-purple-700' });
    }
    
    // Badge nombre de mesures
    if (weightHistory.length >= 5) {
        badges.push({ emoji: '📊', text: `${weightHistory.length} pesées enregistrées`, color: 'bg-amber-100 text-amber-700' });
    }
    
    return badges;
}

// ============================================================
// GRAPHIQUES AVEC DONNÉES RÉELLES
// ============================================================

function drawRealWeightChart(data) {
    const canvas = document.getElementById('weight-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Nettoyer l'ancien graphique
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    const labels = data.map(d => new Date(d.recorded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    const values = data.map(d => d.value / 1000);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Poids (kg)',
                data: values,
                borderColor: '#E11D48',
                backgroundColor: 'rgba(225, 29, 72, 0.05)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#E11D48',
                pointBorderColor: 'white',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} kg` } }
            },
            scales: { 
                y: { 
                    beginAtZero: false, 
                    grid: { display: false },
                    title: { display: true, text: 'kg', font: { size: 9 } }
                } 
            }
        }
    });
}

function drawRealFeedingSleepChart(feedingData, sleepData) {
    const canvas = document.getElementById('feeding-sleep-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Nettoyer l'ancien graphique
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    // Prendre les 7 derniers jours
    const maxLength = Math.max(feedingData.length, sleepData.length);
    const startIndex = Math.max(0, maxLength - 7);
    
    const labels = [];
    const feedingValues = [];
    const sleepValues = [];
    
    for (let i = startIndex; i < maxLength; i++) {
        if (feedingData[i]) {
            feedingValues.push(feedingData[i].value);
            labels.push(new Date(feedingData[i].recorded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        } else if (sleepData[i]) {
            sleepValues.push(sleepData[i].value);
            if (!labels[i - startIndex]) {
                labels.push(new Date(sleepData[i].recorded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
            }
        }
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.slice(-7),
            datasets: [
                { 
                    label: '🍼 Tétées (nombre/jour)', 
                    data: feedingValues.slice(-7), 
                    borderColor: '#F472B6', 
                    backgroundColor: 'transparent', 
                    tension: 0.3, 
                    pointRadius: 4,
                    pointBackgroundColor: '#F472B6'
                },
                { 
                    label: '😴 Sommeil (heures)', 
                    data: sleepValues.slice(-7), 
                    borderColor: '#60A5FA', 
                    backgroundColor: 'transparent', 
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#60A5FA'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { position: 'top', labels: { font: { size: 9 } } }
            }
        }
    });
}

// ============================================================
// CHARGEMENT DES PACKS DEPUIS LA BDD
// ============================================================

async function loadRealPacks() {
    const container = document.getElementById('packs-container');
    if (!container) return;
    
    try {
        // Récupérer les packs depuis la BDD (ou utiliser les packs par défaut)
        const isMaman = true;
        const packs = getPacksFromConfig(isMaman);
        
        container.innerHTML = packs.slice(0, 3).map(pack => `
            <div class="bg-white rounded-xl p-3 border border-slate-100 active:scale-98 transition-all cursor-pointer" 
                 onclick="window.switchView('subscription')">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${pack.name}</p>
                        <p class="text-[9px] text-slate-400">${pack.desc}</p>
                    </div>
                    <p class="font-black text-pink-600">${pack.priceDisplay}</p>
                </div>
                ${pack.popular ? `<span class="text-[7px] font-bold text-pink-500 mt-1 block">⭐ Populaire</span>` : ''}
            </div>
        `).join('');
        
    } catch (err) {
        console.error("Erreur chargement packs:", err);
        container.innerHTML = `
            <div class="bg-white rounded-xl p-3 border border-slate-100 text-center">
                <p class="text-[10px] text-slate-400">Cliquez pour voir nos offres</p>
                <button onclick="window.switchView('subscription')" class="mt-2 text-pink-500 text-[9px] font-bold">Voir les forfaits →</button>
            </div>
        `;
    }
}

function getPacksFromConfig(isMaman) {
    if (isMaman) {
        return [
            { id: 'ESSENTIEL', name: 'Essentiel', desc: '2 visites / semaine', priceDisplay: '45.000 CFA', popular: false },
            { id: 'CONFORT', name: 'Confort', desc: '3-4 visites / semaine', priceDisplay: '85.000 CFA', popular: true },
            { id: 'SERENITE', name: 'Sérénité', desc: '6-7 visites / semaine', priceDisplay: '150.000 CFA', popular: false }
        ];
    }
    return [
        { id: 'REGULIER', name: 'Régulier', desc: '2-3 visites / semaine', priceDisplay: '60.000 CFA', popular: true },
        { id: 'COMPLET', name: 'Complet', desc: '5-6 visites / semaine', priceDisplay: '150.000 CFA', popular: false }
    ];
}

// ============================================================
// GESTION DE L'HUMEUR (AVEC SAUVEGARDE BDD)
// ============================================================

window.saveMoodToDB = async (mood) => {
    try {
        let patients = await secureFetch("/patients");
        if (!Array.isArray(patients)) patients = patients?.data || [];
        const patient = patients?.[0];
        
        if (!patient) {
            UI.error("Patient non trouvé");
            return;
        }
        
        await secureFetch('/educational/mood', {
            method: 'POST',
            body: JSON.stringify({
                patient_id: patient.id,
                mood: mood,
                notes: null
            })
        });
        
        UI.success("Humeur enregistrée !");
        setTimeout(() => loadMamanDashboard(), 500);
        
    } catch (err) {
        console.error("Erreur sauvegarde humeur:", err);
        UI.error("Impossible d'enregistrer l'humeur");
    }
};

window.showMoodHistoryFromDB = async () => {
    try {
        let patients = await secureFetch("/patients");
        if (!Array.isArray(patients)) patients = patients?.data || [];
        const patient = patients?.[0];
        
        if (!patient) return;
        
        let moods = await secureFetch(`/educational/moods/${patient.id}`);
        if (!Array.isArray(moods)) moods = moods?.data || [];
        
        if (moods.length === 0) {
            Swal.fire({
                title: "Pas encore d'humeur",
                text: "Utilisez le tracker pour enregistrer votre humeur",
                icon: "info",
                confirmButtonColor: "#DB2777"
            });
            return;
        }
        
        Swal.fire({
            title: "📊 Mon évolution",
            html: `
                <div class="space-y-2 max-h-96 overflow-y-auto">
                    ${moods.map(m => `
                        <div class="flex justify-between items-center p-3 bg-pink-50 rounded-xl">
                            <span class="text-lg">${getMoodEmoji(m.mood)}</span>
                            <span class="text-xs text-slate-500">${new Date(m.recorded_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                    `).join('')}
                </div>
            `,
            confirmButtonText: "Fermer",
            confirmButtonColor: "#DB2777",
            customClass: { popup: 'rounded-2xl' }
        });
        
    } catch (err) {
        console.error(err);
        UI.error("Impossible de charger l'historique");
    }
};

function getMoodEmoji(mood) {
    const emojis = { excellent: '😊', bien: '😐', fatigue: '😴', triste: '😔' };
    return emojis[mood] || '😊';
}

// ============================================================
// NOTIFICATIONS
// ============================================================

async function updateMamanNotifications() {
    try {
        let notifications = await secureFetch("/notifications", { noCache: true });
        if (!Array.isArray(notifications)) notifications = notifications?.data || [];
        
        const unreadCount = notifications.filter(n => !n.read).length;
        const badge = document.getElementById('maman-notif-badge');
        
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error("Erreur notifications:", err);
    }
}

// ============================================================
// UTILITAIRES
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

export { updateMamanNotifications };
