import { secureFetch } from "../core/api.js";
import { AppState } from "../core/state.js";
import { UI, compressImage } from "../core/utils.js";
import { syncService } from "../core/syncService.js";
import db from '../core/db.js';

// ============================================================
// VARIABLES GLOBALES
// ============================================================

let unreadMessagesCount = 0;
let isUserAtBottom = true;
let newMessageBadge = null;
let readSubscribed = false;
let activeTab = 'STORY';
let currentReplyTo = null;
let currentReplyToName = null;
let currentEmojiMessageId = null;
let emojiPickerVisible = false;
let currentVisibility = 'all';

if (!AppState.unreadByPatient) {
    AppState.unreadByPatient = {};
}

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFC')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function playNotificationBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.08;
        oscillator.type = 'sine';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
        oscillator.stop(audioContext.currentTime + 0.2);
        setTimeout(() => audioContext.close(), 300);
    } catch(e) {}
}

function scrollToBottom() {
    // Essayer plusieurs sélecteurs pour trouver le bon conteneur
    const messagesContainer = document.getElementById('care-feed-content') || 
                              document.querySelector('.chat-messages') ||
                              document.querySelector('.chat-whatsapp-messages');
    
    if (messagesContainer) {
        // Scroll fluide
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    } else {
        // Fallback
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.scrollTo({
                top: mainContent.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
}

function cleanupRealtime() {
    if (window.Realtime) {
        window.Realtime.unsubscribe();
        console.log("🧹 [Realtime] Nettoyé");
    }
}

// ============================================================
// GESTION DES FICHIERS (IMAGES & DOCUMENTS)
// ============================================================

function getFileInfo(url, filename) {
    const extension = (filename || url).split('.').pop()?.toLowerCase();
    const fileTypes = {
        pdf: { icon: 'fa-file-pdf', color: 'text-red-500', bg: 'bg-red-50', label: 'PDF' },
        doc: { icon: 'fa-file-word', color: 'text-blue-500', bg: 'bg-blue-50', label: 'DOC' },
        docx: { icon: 'fa-file-word', color: 'text-blue-500', bg: 'bg-blue-50', label: 'DOCX' },
        jpg: { icon: 'fa-file-image', color: 'text-green-500', bg: 'bg-green-50', label: 'IMAGE' },
        jpeg: { icon: 'fa-file-image', color: 'text-green-500', bg: 'bg-green-50', label: 'IMAGE' },
        png: { icon: 'fa-file-image', color: 'text-green-500', bg: 'bg-green-50', label: 'IMAGE' },
        gif: { icon: 'fa-file-image', color: 'text-green-500', bg: 'bg-green-50', label: 'IMAGE' },
        webp: { icon: 'fa-file-image', color: 'text-green-500', bg: 'bg-green-50', label: 'IMAGE' },
        mp4: { icon: 'fa-file-video', color: 'text-purple-500', bg: 'bg-purple-50', label: 'VIDEO' },
        mp3: { icon: 'fa-file-audio', color: 'text-amber-500', bg: 'bg-amber-50', label: 'AUDIO' }
    };
    return fileTypes[extension] || { icon: 'fa-file', color: 'text-slate-500', bg: 'bg-slate-50', label: 'FICHIER' };
}

function renderDocumentCard(url, filename) {
    const fileInfo = getFileInfo(url, filename);
    const displayName = filename || url.split('/').pop() || 'Document';
    const shortName = displayName.length > 30 ? displayName.substring(0, 27) + '...' : displayName;
    return `
        <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white shadow-sm active:scale-98 transition-all cursor-pointer" 
             onclick="window.open('${url}', '_blank')">
            <div class="w-10 h-10 rounded-xl ${fileInfo.bg} flex items-center justify-center">
                <i class="fa-solid ${fileInfo.icon} ${fileInfo.color} text-lg"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(shortName)}</p>
                <p class="text-[9px] text-slate-400">${fileInfo.label} • Cliquer pour ouvrir</p>
            </div>
            <i class="fa-solid fa-download text-slate-300 text-xs"></i>
        </div>
    `;
}

function isImageUrl(url) {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
}



function setVisibility(visibility) {
    currentVisibility = visibility;
    
    // Mettre à jour l'apparence des boutons
    document.querySelectorAll('.visibility-btn').forEach(btn => {
        const btnVisibility = btn.dataset.visibility;
        if (btnVisibility === visibility) {
            btn.style.background = '#25D366';
            btn.style.color = 'white';
        } else {
            btn.style.background = '#2a3942';
            btn.style.color = '#aebac1';
        }
    });
}

// ============================================================
// RENDU DES CARTES
// ============================================================





function renderStoryCard(msg, isReply = false) {
    let content = msg.content || '';
    let humeurBadge = "";
    const isMaman = localStorage.getItem("user_is_maman") === "true";
    const themeLightBg = isMaman ? 'bg-pink-50' : 'bg-emerald-50';

    // 🔥 CORRECTION : Récupérer correctement l'URL du fichier
    let fileUrl = null;
    let isImage = false;
    let isDocument = false;
    
    // Cas 1: photo_url existe
    if (msg.photo_url) {
        fileUrl = msg.photo_url;
        isImage = isImageUrl(fileUrl);
        isDocument = !isImage && msg.type_media === 'DOCUMENT';
    }
    // Cas 2: message photo avec content
    else if (msg.is_photo && msg.content) {
        fileUrl = msg.content;
        isImage = isImageUrl(fileUrl);
    }
    // Cas 3: document
    else if (msg.type_media === 'DOCUMENT' && msg.content) {
        fileUrl = msg.content;
        isDocument = true;
        isImage = false;
    }
    // Cas 4: URL dans content
    else if (msg.content && (msg.content.startsWith('http') || msg.content.startsWith('/'))) {
        fileUrl = msg.content;
        isImage = isImageUrl(fileUrl);
        isDocument = !isImage;
    }
    
    // Déterminer si c'est un message texte pur
    const isTextMessage = !isImage && !isDocument && content && content.trim() !== '' && !msg.is_photo;
    
    // Pour les images et documents, on ne veut pas afficher le contenu texte
    if (isImage || isDocument) {
        content = '';
    }
    
    const currentUserId = localStorage.getItem("user_id");
    const currentUserName = localStorage.getItem("user_name");

    // Détection du propriétaire du message
    let isOwnMessage = false;
    if (msg.sender_id && String(msg.sender_id) === String(currentUserId)) {
        isOwnMessage = true;
    } else if (msg.sender_name && msg.sender_name === currentUserName) {
        isOwnMessage = true;
    } else if (msg.is_temp === true) {
        isOwnMessage = true;
    }
    
    // Décodage de l'humeur
    if (!msg.is_photo && content && content.includes('|')) {
        const parts = content.split('|');
        const humeur = parts[0];
        const notes = parts.slice(1).join('|');
        const emojis = { 
            "Très Joyeux": "😊", 
            "Calme": "😐", 
            "Fatigué": "😴", 
            "Triste": "😔" 
        };
        humeurBadge = `<span class="text-xs mr-1">${emojis[humeur] || '✨'}</span>`;
        content = notes;
    }
    
    const rawDate = msg.created_at || msg.createdAt || new Date().toISOString();
    const safeDate = new Date(rawDate);
    const timeStr = isNaN(safeDate) ? "Maintenant" : safeDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Message parent (réponse)
    let parentMessageHtml = '';
    if (msg.reply_to_id && !isOwnMessage) {
        const parentMsg = AppState.messages?.find(m => m.id === msg.reply_to_id);
        if (parentMsg) {
            const parentContent = parentMsg.is_photo ? '📷 Photo' : (parentMsg.content?.substring(0, 50) + (parentMsg.content?.length > 50 ? '...' : ''));
            parentMessageHtml = `
                <div class="text-[9px] text-amber-600 mb-1 flex items-center gap-1">
                    <i class="fa-solid fa-reply-all text-[8px]"></i>
                    <span class="truncate">↳ ${escapeHtml(parentMsg.sender_name || 'message')}: ${escapeHtml(parentContent)}</span>
                </div>
            `;
        }
    }

    const isTemp = msg.is_temp === true;
    const tempClass = isTemp ? 'opacity-70' : '';

    // ============================================================
    // MESSAGE ENVOYÉ (À DROITE)
    // ============================================================
    if (isOwnMessage) {
        let statusIcon = '';
        if (!isTemp) {
            if (msg.read) {
                statusIcon = '<i class="fa-solid fa-check-double text-[10px] text-[#53bdeb]"></i>';
            } else {
                statusIcon = '<i class="fa-solid fa-check-double text-[10px] text-[#8696a0]"></i>';
            }
        } else {
            statusIcon = '<i class="fa-solid fa-spinner fa-spin text-[10px] text-[#8696a0]"></i>';
        }
        
        return `
            <div class="flex justify-end mb-1 ${isReply ? 'ml-8' : ''} ${tempClass} animate-fadeIn" data-message-id="${msg.id}">
                <div class="max-w-[75%] sm:max-w-[65%]">
                    ${isImage && fileUrl ? `
                        <img src="${fileUrl}" class="rounded-2xl max-w-[200px] max-h-48 object-cover cursor-pointer mb-1" 
                             onclick="window.open('${fileUrl}')" loading="lazy"
                             onerror="this.onerror=null; this.src='https://placehold.co/400x300?text=Image+non+chargée'">
                    ` : ''}
                    ${isDocument && fileUrl ? renderDocumentCard(fileUrl, msg.titre_media) : ''}
                    ${isTextMessage ? `
                        <div class="chat-message-sent" style="background: var(--role-primary); border-bottom-right-radius: 4px; padding: 6px 12px;">
                            <span style="color: white; font-size: 13px; line-height: 1.3; display: inline-block;">${escapeHtml(content)} ${humeurBadge}</span>
                        </div>
                    ` : ''}
                    ${msg.visibility && msg.visibility !== 'all' ? `
                        <div class="flex items-center gap-1 mt-1">
                            <i class="fa-solid ${getVisibilityIcon(msg.visibility)} text-[8px] text-slate-400"></i>
                            <span class="text-[7px] text-slate-400">${getVisibilityLabel(msg.visibility)}</span>
                        </div>
                    ` : ''}
                    <div class="flex justify-end items-center gap-1 mt-0.5">
                        <span class="text-[9px] text-slate-400">${timeStr}</span>
                        <span class="message-status">${statusIcon}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================================
    // MESSAGE REÇU (À GAUCHE)
    // ============================================================
    const isAidant = msg.sender_role === 'AIDANT';
    const isFamily = msg.sender_role === 'FAMILLE';
    const isCoordinator = msg.sender_role === 'COORDINATEUR';
    
    let avatarBg = 'bg-slate-100';
    let roleColor = 'text-slate-500';
    let roleInitial = '';
    let roleBadge = '';
    
    if (isAidant) {
        avatarBg = themeLightBg;
        roleColor = isMaman ? 'text-pink-600' : 'text-emerald-600';
        roleInitial = msg.sender_name?.charAt(0).toUpperCase() || 'A';
        roleBadge = `<span class="text-[8px] font-medium ${roleColor} ml-1"><i class="fa-solid fa-shield-check"></i></span>`;
    } else if (isFamily) {
        avatarBg = 'bg-blue-100';
        roleColor = 'text-blue-600';
        roleInitial = msg.sender_name?.charAt(0).toUpperCase() || 'F';
    } else if (isCoordinator) {
        avatarBg = 'bg-purple-100';
        roleColor = 'text-purple-600';
        roleInitial = msg.sender_name?.charAt(0).toUpperCase() || 'C';
    }

    return `
        <div class="flex items-start gap-2 mb-2 ${isReply ? 'ml-8' : ''} ${tempClass} animate-fadeIn" data-message-id="${msg.id}">
            <div class="w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center flex-shrink-0">
                ${msg.sender_photo ? 
                    `<img src="${msg.sender_photo}" class="w-full h-full rounded-full object-cover">` : 
                    `<span class="text-xs font-bold ${roleColor}">${roleInitial}</span>`
                }
            </div>
            <div class="max-w-[75%] sm:max-w-[65%]">
                <div class="flex items-center gap-1 mb-0.5 flex-wrap">
                    <span class="font-semibold text-slate-700 text-xs">${escapeHtml(msg.sender_name || 'Inconnu')}</span>
                    ${roleBadge}
                </div>
                
                ${parentMessageHtml}
                
                ${isImage && fileUrl ? `
                    <div class="relative rounded-xl overflow-hidden mb-1 max-w-[200px]">
                        <img src="${fileUrl}" class="rounded-xl max-h-48 object-cover cursor-pointer w-full" 
                             onclick="window.open('${fileUrl}')" loading="lazy"
                             onerror="this.onerror=null; this.src='https://placehold.co/400x300?text=Image+non+chargée'">
                        <div class="absolute bottom-2 right-2 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-lg">
                            <i class="fa-regular fa-image text-white text-[8px]"></i>
                        </div>
                    </div>
                ` : ''}
                
                ${isDocument && fileUrl ? renderDocumentCard(fileUrl, msg.titre_media) : ''}
                
                ${isTextMessage ? `
                    <div class="chat-message-received" style="background: white; border-bottom-left-radius: 4px; padding: 6px 12px;">
                        <span style="color: #1E293B; font-size: 13px; line-height: 1.3; display: inline-block;">${escapeHtml(content)} ${humeurBadge}</span>
                    </div>
                ` : ''}
                ${msg.visibility && msg.visibility !== 'all' ? `
                        <div class="flex items-center gap-1 mt-1">
                            <i class="fa-solid ${getVisibilityIcon(msg.visibility)} text-[8px] text-slate-400"></i>
                            <span class="text-[7px] text-slate-400">${getVisibilityLabel(msg.visibility)}</span>
                        </div>
                    ` : ''}
                <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[9px] text-slate-400">${timeStr}</span>
                    <button onclick="window.replyToMessage('${msg.id}', '${escapeHtml(msg.sender_name || "l'utilisateur")}')" 
                            class="text-[9px] text-slate-400 hover:text-amber-500 transition">
                        <i class="fa-solid fa-reply text-[8px]"></i>
                    </button>
                    <button onclick="window.showEmojiPickerForMessage('${msg.id}', this)" 
                            class="text-[9px] text-slate-400 hover:text-amber-500 transition">
                        <i class="fa-regular fa-face-smile"></i>
                    </button>
                </div>
                
                ${Object.keys(msg.reactions || {}).length > 0 ? `
                    <div class="flex gap-1 mt-1">
                        ${Object.entries(msg.reactions || {}).map(([emoji, count]) => `
                            <button onclick="window.sendReaction('${msg.id}', '${emoji}')" 
                                    class="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs transition">
                                <span class="text-sm">${emoji}</span>
                                <span class="text-[9px] font-medium text-slate-500">${count}</span>
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}


function renderFeed() {
    const content = document.getElementById('care-feed-content');
    const inputArea = document.getElementById('input-area');
    const btnStory = document.getElementById('tab-story');
    const btnDoc = document.getElementById('tab-doc');

    if (!content) return;
    content.classList.add('updating');

    const activeClass = "bg-white text-slate-900 shadow-sm border border-slate-200/50";
    const inactiveClass = "text-slate-400 hover:text-slate-600";

    if (btnStory) {
        btnStory.className = `flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'STORY' ? activeClass : inactiveClass}`;
    }
    if (btnDoc) {
        btnDoc.className = `flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'DOCUMENT' ? activeClass : inactiveClass}`;
    }
    if (inputArea) {
        inputArea.style.display = activeTab === 'STORY' ? 'block' : 'none';
    }

    // Filtrer selon l'onglet sélectionné
    let filtered = (AppState.messages || []).filter(m => {
        if (activeTab === 'DOCUMENT') {
            return m.type_media === 'DOCUMENT';
        }
        // STORY : afficher tous les messages (textes, images, documents)
        return true;
    });
    
    const sortedMessages = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // Utiliser renderStoryCard pour tous les messages (y compris les documents)
    content.innerHTML = sortedMessages.map(msg => renderStoryCard(msg, false)).join('');

    if (sortedMessages.length === 0) {
        const emptyMessage = activeTab === 'DOCUMENT' 
            ? 'Aucun document'
            : 'Aucun message';
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full py-20">
                <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <i class="fa-regular fa-comment-dots text-2xl text-slate-400"></i>
                </div>
                <p class="text-sm font-bold text-slate-500">${emptyMessage}</p>
                <p class="text-[10px] text-slate-400 mt-1">Soyez le premier à envoyer un message</p>
            </div>
        `;
    }

    setTimeout(() => {
        content.classList.remove('updating');
    }, 50);
}
// ============================================================
// RÉPONSES AUX MESSAGES
// ============================================================

window.replyToMessage = (messageId, senderName) => {
    currentReplyTo = messageId;
    currentReplyToName = senderName;
    
    const indicator = document.getElementById('reply-indicator');
    const replyingToName = document.getElementById('replying-to-name');
    
    if (indicator && replyingToName) {
        replyingToName.textContent = senderName;
        indicator.classList.remove('hidden');
        document.getElementById('quick-msg')?.focus();
    }
    
    UI.vibrate('light');
};

window.cancelReply = () => {
    currentReplyTo = null;
    currentReplyToName = null;
    
    const indicator = document.getElementById('reply-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
    
    UI.vibrate('light');
};

// ============================================================
// ENVOI DE PHOTO
// ============================================================

async function sendPhotoMessage() {
    const photoInput = document.getElementById('photo-input');
    const file = photoInput?.files?.[0];
    
    if (!file) {
        console.log("❌ Aucun fichier sélectionné");
        return;
    }
    
    console.log("📸 Fichier sélectionné:", file.name, file.size, file.type);
    
    if (file.size > 5 * 1024 * 1024) {
        UI.error("Photo trop lourde (max 5MB)");
        photoInput.value = '';
        return;
    }
    
    Swal.fire({
        title: "Envoi de la photo...",
        text: "Veuillez patienter",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        let fileToSend = file;
        if (file.size > 2 * 1024 * 1024) {
            console.log("🔄 Compression de l'image...");
            fileToSend = await compressImage(file, 1024, 0.7);
            console.log("✅ Image compressée:", fileToSend.size, "bytes");
        }
        
        const formData = new FormData();
        formData.append('patient_id', AppState.currentPatient);
        formData.append('photo', fileToSend, fileToSend.name || 'photo.jpg');
        formData.append('visibility', currentVisibility);

        
        if (currentReplyTo) {
            formData.append('reply_to_id', currentReplyTo);
        }
        
        // 🔥 AJOUTER caption si présent
        if (currentReplyToName) {
            formData.append('caption', "Réponse à " + currentReplyToName);
        }
        
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error("Token d'authentification manquant");
        }
        
        const response = await fetch(window.CONFIG.API_URL + "/messages/send-photo", {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erreur " + response.status);
        }
        
        const result = await response.json();
        console.log("✅ Réponse serveur:", result);
        
        photoInput.value = '';
        window.cancelReply();
        
        Swal.close();
        UI.success("Photo envoyée !");
        
        // 🔥 NE PAS APPELER loadFeed() - le message arrivera via Realtime
        // Mais on peut ajouter un message temporaire pour l'UI
        if (result.photo_url) {
            const tempMessage = {
                id: 'temp_' + Date.now(),
                patient_id: AppState.currentPatient,
                sender_id: localStorage.getItem("user_id"),
                sender_name: localStorage.getItem("user_name"),
                sender_role: localStorage.getItem("user_role"),
                content: result.photo_url,
                photo_url: result.photo_url,
                is_photo: true,
                type_media: 'STORY',
                created_at: new Date().toISOString(),
                is_temp: true,
                reactions: {}
            };
            
            AppState.messages.push(tempMessage);
            
            if (activeTab === 'STORY') {
                const container = document.getElementById('care-feed-content');
                const tempHtml = renderStoryCard(tempMessage, false);
                container.insertAdjacentHTML('beforeend', tempHtml);
                scrollToBottom();
            }
        }
        
    } catch (err) {
        Swal.close();
        console.error("❌ Erreur sendPhotoMessage:", err);
        UI.error(err.message || "Erreur lors de l'envoi de la photo");
        photoInput.value = '';
    }
}
// ============================================================
// ENVOI DE DOCUMENT
// ============================================================

 
async function sendDocumentMessage() {
    const docInput = document.getElementById('document-input');
    const file = docInput?.files?.[0];
    
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        UI.error("Document trop lourd (max 10MB)");
        docInput.value = '';
        return;
    }
    
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        UI.error("Format non supporté. Utilisez PDF, DOC ou image");
        docInput.value = '';
        return;
    }
    
    // Afficher un indicateur de chargement
    Swal.fire({
        title: "Envoi du document...",
        text: "Veuillez patienter",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
    
    try {
        const formData = new FormData();
        formData.append('patient_id', AppState.currentPatient);
        formData.append('document', file);
        formData.append('type_media', 'DOCUMENT');
        formData.append('visibility', currentVisibility);

        
        if (currentReplyTo) {
            formData.append('reply_to_id', currentReplyTo);
        }
        
        const token = localStorage.getItem('token');
        const response = await fetch(window.CONFIG.API_URL + "/messages/send-document", {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erreur d'envoi");
        }
        
        const result = await response.json();
        
        docInput.value = '';
        window.cancelReply();
        
        Swal.close();
        
        // ✅ NE PAS APPELER loadFeed() - juste afficher un succès
        UI.success("Document envoyé !");
        
        // Le message arrivera via Realtime, pas besoin de recharger
        
    } catch (err) {
        Swal.close();
        console.error("❌ Erreur:", err);
        UI.error(err.message);
        docInput.value = '';
    }
}
// ============================================================
// AFFICHAGE DES RÉPONSES (THREADS)
// ============================================================

window.showAllReplies = (parentMessageId) => {
    const container = document.querySelector(`.replies-container[data-parent="${parentMessageId}"]`);
    if (!container) return;
    
    const allReplies = (AppState.messages || [])
        .filter(m => m.reply_to_id === parentMessageId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    if (allReplies.length === 0) return;
    
    const allRepliesHtml = allReplies.map(reply => renderStoryCard(reply, true)).join('');
    container.innerHTML = allRepliesHtml + `
        <button onclick="window.collapseReplies('${parentMessageId}', ${allReplies.length})" 
                class="ml-8 mt-2 text-[10px] font-medium text-amber-600 hover:text-amber-700 transition-all flex items-center gap-1">
            <i class="fa-solid fa-chevron-up text-[8px]"></i>
            Réduire (${allReplies.length} réponse${allReplies.length > 1 ? 's' : ''})
        </button>
    `;
    UI.vibrate('light');
};

window.collapseReplies = (parentMessageId, totalCount) => {
    const container = document.querySelector(`.replies-container[data-parent="${parentMessageId}"]`);
    if (!container) return;
    
    const allReplies = (AppState.messages || [])
        .filter(m => m.reply_to_id === parentMessageId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const visibleReplies = allReplies.slice(0, 3);
    const hasMore = allReplies.length > 3;
    
    const repliesHtml = visibleReplies.map(reply => renderStoryCard(reply, true)).join('');
    const moreButton = hasMore ? `
        <button onclick="window.showAllReplies('${parentMessageId}')" 
                class="ml-8 mt-2 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 transition-all flex items-center gap-1">
            <i class="fa-solid fa-chevron-down text-[8px]"></i>
            Voir les ${allReplies.length - 3} autre${allReplies.length - 3 > 1 ? 's' : ''} réponse${allReplies.length - 3 > 1 ? 's' : ''}
        </button>
    ` : '';
    
    container.innerHTML = repliesHtml + moreButton;
    UI.vibrate('light');
};

// ============================================================
// FILTRAGE DU FEED
// ============================================================

window.filterFeed = (type) => {
    UI.vibrate();
    activeTab = type;
    
    if (type !== 'STORY') {
        cleanupRealtime();
    } else {
        if (AppState.currentPatient) {
            initRealtimeForCurrentPatient();
        }
    }
    
    renderFeed();
};

// ============================================================
// ENVOI DE MESSAGE RAPIDE (AVEC OPTIMISTIC UI)
// ============================================================
window.sendQuickMessage = async () => {
    const input = document.getElementById('quick-msg');
    const content = input?.value?.trim();
    if (!content) return;

    // Sauvegarder et réinitialiser
    const messageContent = content;
    input.value = '';
    
    // ID temporaire unique
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    const currentUserId = localStorage.getItem("user_id");
    const currentUserName = localStorage.getItem("user_name");
    const currentUserRole = localStorage.getItem("user_role");
    
    // Message temporaire
    const tempMessage = {
        id: tempId,
        patient_id: AppState.currentPatient,
        sender_id: currentUserId,
        sender_name: currentUserName,
        sender_role: currentUserRole,
        content: messageContent,
        is_photo: false,
        type_media: 'STORY',
        created_at: new Date().toISOString(),
        reactions: {},
        is_temp: true,
        read: false,
        visibility: currentVisibility
    };
    
    // Ajouter au state
    AppState.messages.push(tempMessage);
    
// Après avoir ajouté le message temporaire
if (activeTab === 'STORY') {
    const container = document.getElementById('care-feed-content');
    if (container) {
        const tempHtml = renderStoryCard(tempMessage, false);
        container.insertAdjacentHTML('beforeend', tempHtml);
        // ✅ Scroll immédiat
        setTimeout(() => scrollToBottom(), 50);
    }
}

    
    // Indicateur d'envoi
    const tempMessageEl = document.querySelector(`[data-message-id="${tempId}"]`);
    if (tempMessageEl) {
        tempMessageEl.classList.add('opacity-50');
        const sendingIndicator = document.createElement('div');
        sendingIndicator.className = 'sending-indicator text-[8px] text-slate-400 mt-1';
        sendingIndicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
        const targetEl = tempMessageEl.querySelector('.flex-1') || tempMessageEl.querySelector('.message-bubble') || tempMessageEl;
        if (targetEl) targetEl.appendChild(sendingIndicator);
    }
    
    try {
        UI.vibrate();
        window.cancelReply();
        
        // Envoi du vrai message
        const body = {
            patient_id: AppState.currentPatient,
            content: messageContent,
            is_photo: false,
            type_media: 'STORY',
            visibility: currentVisibility 
        };
        if (currentReplyTo) body.reply_to_id = currentReplyTo;
        
        await secureFetch('/messages/send', { method: 'POST', body: JSON.stringify(body) });
        
        // Timeout de sécurité (10s)
        setTimeout(() => {
            if (document.querySelector(`[data-message-id="${tempId}"]`)) {
                console.log("🔄 Timeout: rechargement forcé");
                loadFeed();
            }
        }, 10000);
        
    } catch (err) {
        console.error("Erreur envoi:", err);
        UI.error("Erreur lors de l'envoi");
        
        if (tempMessageEl) {
            tempMessageEl.classList.remove('opacity-50');
            tempMessageEl.classList.add('border-rose-200', 'bg-rose-50');
            const indicator = tempMessageEl.querySelector('.sending-indicator');
            if (indicator) {
                indicator.innerHTML = '<i class="fa-solid fa-circle-exclamation text-rose-500"></i> Échec';
            }
            
            // Bouton réessayer
            const retryBtn = document.createElement('button');
            retryBtn.className = 'text-[8px] text-rose-500 mt-1 underline cursor-pointer hover:text-rose-600 transition';
            retryBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Réessayer';
            retryBtn.onclick = async (e) => {
                e.stopPropagation();
                retryBtn.remove();
                try {
                    await secureFetch('/messages/send', {
                        method: 'POST',
                        body: JSON.stringify({
                            patient_id: AppState.currentPatient,
                            content: messageContent,
                            is_photo: false,
                            type_media: 'STORY',
                            visibility: currentVisibility
                        })
                    });
                    tempMessageEl?.remove();
                    const idx = AppState.messages.findIndex(m => m.id === tempId);
                    if (idx !== -1) AppState.messages.splice(idx, 1);
                    UI.success("Message envoyé !");
                } catch {
                    UI.error("Échec de l'envoi");
                }
            };
            const targetEl = tempMessageEl.querySelector('.max-w-[75%]') || tempMessageEl;
            targetEl.appendChild(retryBtn);
        }
    }
};
// ============================================================
// RÉACTIONS AUX MESSAGES
// ============================================================

window.sendReaction = async (msgId, type) => {
    try {
        UI.vibrate();
        await secureFetch('/messages/react', {
            method: 'POST',
            body: JSON.stringify({ message_id: msgId, reaction_type: type })
        });
        await loadFeed();
    } catch (err) {
        console.error(err);
        UI.error("Erreur lors de l'envoi de la réaction");
    }
};

// ============================================================
// GESTION DES MESSAGES LUS
// ============================================================

function updateSeenStatus(data) {
    const messageAge = Date.now() - new Date(data.created_at).getTime();
    if (messageAge < 2000) {
        console.log("👁️ Message trop récent, on attend avant de marquer comme lu");
        return;
    }
    
    if (!data.read) return;
    const currentUserId = localStorage.getItem("user_id");
    if (!currentUserId) return;
    if (data.sender_id === currentUserId) return;
    
    const messageEl = document.querySelector(`[data-message-id="${data.id}"]`);
    if (!messageEl) return;
    if (messageEl.querySelector('.seen-status')) return;
    
    const container = messageEl.querySelector('.message-status');
    if (!container) return;
    
    const status = document.createElement('span');
    status.className = "seen-status text-[8px] text-blue-500 ml-2";
    status.textContent = "✔✔ Vu";
    status.style.opacity = "0";
    status.style.transition = "opacity 0.3s ease";
    container.appendChild(status);
    setTimeout(() => { status.style.opacity = "1"; }, 10);
}

if (!readSubscribed) {
    readSubscribed = true;
    window.Realtime.subscribeToRead((data) => {
        console.log("👁️ Messages lus (Realtime):", data);
        updateSeenStatus(data);
    });
}

// ============================================================
// EMOJI PICKER
// ============================================================

function showEmojiPicker(messageId, buttonElement) {
    const oldPicker = document.getElementById('emoji-picker-container');
    if (oldPicker) oldPicker.remove();
    
    currentEmojiMessageId = messageId;
    const emojis = ['😊', '❤️', '👍', '😂', '😢', '🎉', '😍', '🔥', '👏', '🙏'];
    const panel = document.createElement('div');
    panel.id = 'emoji-picker-container';
    panel.style.cssText = 'position: fixed; background: white; border-radius: 16px; padding: 10px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); z-index: 99999; display: flex; gap: 8px; flex-wrap: wrap; max-width: 280px; border: 1px solid #ddd;';
    
    const rect = buttonElement.getBoundingClientRect();
    panel.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    panel.style.left = rect.left + 'px';
    
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.style.cssText = 'width: 44px; height: 44px; font-size: 24px; border: none; background: #f1f5f9; border-radius: 12px; cursor: pointer;';
        btn.onclick = () => {
            sendEmojiReaction(messageId, emoji);
            panel.remove();
        };
        panel.appendChild(btn);
    });
    document.body.appendChild(panel);
}

document.addEventListener('click', function(e) {
    const panel = document.getElementById('emoji-picker-container');
    if (panel && !panel.contains(e.target) && !e.target.closest('[onclick*="showEmojiPicker"]')) {
        panel.remove();
    }
});

function closeEmojiPicker() {
    const existingPicker = document.getElementById('emoji-picker-container');
    if (existingPicker) existingPicker.remove();
    currentEmojiMessageId = null;
    emojiPickerVisible = false;
}

async function sendEmojiReaction(messageId, emoji) {
    try {
        UI.vibrate('light');
        await secureFetch('/messages/react', {
            method: 'POST',
            body: JSON.stringify({ message_id: messageId, reaction_type: emoji })
        });
        await loadFeed();
    } catch (err) {
        console.error("Erreur envoi réaction:", err);
        UI.error("Impossible d'ajouter la réaction");
    }
}

window.showEmojiPickerForMessage = (messageId, buttonElement) => {
    showEmojiPicker(messageId, buttonElement);
};

// ============================================================
// AJOUT DE MESSAGES AU FEED SANS RE-RENDU COMPLET
// ============================================================

window.appendMessagesToFeed = (newMessages) => {
    const container = document.getElementById('care-feed-content');
    if (!container) return;
    
    const mainContent = document.querySelector('main');
    const wasAtBottom = mainContent ? mainContent.scrollHeight - mainContent.scrollTop <= mainContent.clientHeight + 100 : false;
    
    // 🔥 NE PAS FILTRER - ajouter tous les nouveaux messages
    const newMessagesHtml = newMessages.map(msg => {
        if (activeTab === 'DOCUMENT') return renderDocCard(msg);
        return renderStoryCard(msg, false);
    }).join('');
    
    container.insertAdjacentHTML('beforeend', newMessagesHtml);
    if (wasAtBottom) scrollToBottom();
    playNotificationBeep();
    console.log(`✅ ${newMessages.length} message(s) ajouté(s) au feed`);
};
// ============================================================
// BADGE NOUVEAU MESSAGE
// ============================================================

function showNewMessageBadge() {
    const currentView = AppState?.currentView;
    if (currentView !== 'feed') {
        console.log("📌 Pas dans le feed, badge ignoré");
        return;
    }
    
    if (!newMessageBadge) {
        newMessageBadge = document.createElement('div');
        newMessageBadge.id = 'new-message-badge';
        newMessageBadge.innerHTML = '<div class="bg-emerald-500 text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 transition-all"><i class="fa-solid fa-message text-xs"></i><span class="text-xs font-black">Nouveau message</span><i class="fa-solid fa-arrow-down text-xs"></i></div>';
        newMessageBadge.style.cssText = 'position: fixed; bottom: 80px; right: 20px; z-index: 1000; transform: translateY(100px); transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1);';
        newMessageBadge.onclick = () => { scrollToBottom(); hideNewMessageBadge(); };
        document.body.appendChild(newMessageBadge);
    }
    setTimeout(() => { if (newMessageBadge) newMessageBadge.style.transform = 'translateY(0)'; }, 100);
}

function hideNewMessageBadge() {
    if (newMessageBadge) newMessageBadge.style.transform = 'translateY(100px)';
}

// ============================================================
// DÉTECTION DE SCROLL
// ============================================================

function initScrollDetection() {
    const mainContent = document.querySelector('main');
    if (!mainContent) return;
    mainContent.addEventListener('scroll', () => {
        const isBottom = mainContent.scrollHeight - mainContent.scrollTop <= mainContent.clientHeight + 50;
        isUserAtBottom = isBottom;
        if (isBottom) {
            hideNewMessageBadge();
            unreadMessagesCount = 0;
        }
    });
}

// ============================================================
// BADGES PATIENTS
// ============================================================

function updatePatientBadges() {
    console.log("🔴 [BADGE] Mise à jour des badges patients, unreadByPatient:", AppState.unreadByPatient);
    document.querySelectorAll(".patient-item").forEach(el => {
        const patientId = el.dataset.patientId;
        const badge = el.querySelector(".patient-badge");
        if (!badge) return;
        const count = AppState.unreadByPatient?.[patientId] || 0;
        console.log(`🔴 Patient ${patientId} → ${count} non lus`);
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove("hidden");
            badge.style.animation = 'badgePop 0.3s ease';
        } else {
            badge.classList.add("hidden");
        }
    });
}

// ============================================================
// REALTIME - MESSAGES EN TEMPS RÉEL
// ============================================================

function initRealtimeForCurrentPatient() {
    if (!AppState.currentPatient || !window.Realtime) return;

    window.Realtime.unsubscribe();
    console.log("📡 Realtime initialisé pour:", AppState.currentPatient);

    window.Realtime.subscribe(AppState.currentPatient, async (event, newMessage) => {
        if (!newMessage?.sender_id) return;

        const currentUserId = localStorage.getItem("user_id");
        const isOwnMessage = String(newMessage.sender_id) === String(currentUserId);
        
        if (AppState.messages.some(m => m.id === newMessage.id)) return;

        try {
            const data = await secureFetch(`/messages?message_id=${newMessage.id}`);
            const fullMessage = data?.[0];
            if (!fullMessage?.patient_id) return;

            const isCurrentPatient = fullMessage.patient_id === AppState.currentPatient;
            const isInFeed = AppState.currentView === "feed";
            
            // 🔥 Remplacer le message temporaire SANS FLASH
            const tempIndex = AppState.messages.findIndex(m => 
                m.is_temp === true && 
                m.content === fullMessage.content && 
                m.sender_id === fullMessage.sender_id
            );
            
            if (tempIndex !== -1) {
                const tempId = AppState.messages[tempIndex].id;
                console.log(`🔄 Remplacement du temporaire ${tempId} par ${fullMessage.id}`);
                
                // Remplacer dans le state
                AppState.messages[tempIndex] = fullMessage;
                
                // 🔥 METTRE À JOUR LE DOM EXISTANT (sans suppression/ajout)
                const tempEl = document.querySelector(`[data-message-id="${tempId}"]`);
                if (tempEl) {
                    // Remplacer l'attribut data-message-id
                    tempEl.setAttribute('data-message-id', fullMessage.id);
                    
                    // Remplacer le contenu HTML
                    const newHtml = renderStoryCard(fullMessage, false);
                    tempEl.outerHTML = newHtml;
                    
                    // Mettre à jour les références
                    const newEl = document.querySelector(`[data-message-id="${fullMessage.id}"]`);
                    if (newEl && isUserAtBottom) {
                        setTimeout(() => scrollToBottom(), 50);
                    }
                }
                
                updatePatientBadges();
                window.refreshMenuBadges?.();
                return;
            }
            
            // Gestion des non-lus
            if (!isOwnMessage && (!isCurrentPatient || !isInFeed)) {
                AppState.unreadByPatient = AppState.unreadByPatient || {};
                AppState.unreadByPatient[fullMessage.patient_id] = (AppState.unreadByPatient[fullMessage.patient_id] || 0) + 1;
                updatePatientBadges();
                window.refreshMenuBadges?.();
            }

            // Ajouter le message s'il n'existe pas
            if (!AppState.messages.some(m => m.id === fullMessage.id)) {
                AppState.messages.push(fullMessage);
            }

            // Afficher dans le feed
            if (isCurrentPatient && isInFeed && !isOwnMessage) {
                const container = document.getElementById('care-feed-content');
                if (container) {
                    const newMessageHtml = renderStoryCard(fullMessage, false);
                    container.insertAdjacentHTML('beforeend', newMessageHtml);
                    if (isUserAtBottom) setTimeout(() => scrollToBottom(), 50);
                }
            }

            // Notifications
            if (!isOwnMessage) {
                try { playNotificationBeep(); } catch(e) {}
            }

        } catch (err) {
            console.warn("⚠️ Erreur Realtime:", err.message);
        }
    });
}
// ============================================================
// TYPING INDICATOR
// ============================================================

function showTypingIndicator(show, name = '') {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    
    if (show) {
        indicator.classList.remove('hidden');
        const textSpan = indicator.querySelector('.typing-text');
        if (textSpan) textSpan.textContent = name ? (name + ' écrit...') : 'quelqu\'un écrit...';
    } else {
        indicator.classList.add('hidden');
    }
}

if (window.Realtime && window.Realtime.subscribeToTyping) {
    window.Realtime.subscribeToTyping((data) => {
        console.log("✍️ Typing:", data);
        if (data.user_id === localStorage.getItem("user_id")) return;
        showTypingIndicator(true, data.user_name);
        setTimeout(() => showTypingIndicator(false), 3000);
    });
}

// ============================================================
// CHARGEMENT DU FEED
// ============================================================

 
async function loadFeed() {
    const container = document.getElementById('view-container');
    if (!container) return;

    // 🔥 RÉINITIALISATION COMPLÈTE
    AppState.messages = [];
    
    if (window.cleanupRealtime) {
        window.cleanupRealtime();
    }

    // Supprimer toutes les marges/paddings
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.overflow = 'hidden';
    
    if (!AppState.currentPatient) {
        return window.switchView('patients');
    }

    const isMaman = localStorage.getItem('user_is_maman') === "true";
    const primaryColor = isMaman ? '#E11D48' : '#059669';
    
    // Récupérer les infos du patient
    let patientInfo = null;
    try {
        let patients = await secureFetch("/patients", { noCache: true });
        if (!Array.isArray(patients)) {
            patients = patients?.data || patients?.results || [];
        }
        patientInfo = patients.find(p => p.id === AppState.currentPatient);
        if (!patientInfo && patients.length > 0) {
            patientInfo = patients[0];
            AppState.currentPatient = patientInfo.id;
            localStorage.setItem("current_patient_id", patientInfo.id);
        }
    } catch(e) {
        console.error("Erreur chargement patient:", e);
        patientInfo = null;
    }

    // ============================================================
    // HTML DU CHAT - STYLE WHATSAPP
    // ============================================================

        container.innerHTML = `
            <div class="chat-whatsapp-container">
                <!-- HEADER FIXE -->
                <div class="chat-whatsapp-header">
                    <div class="chat-whatsapp-back" onclick="window.switchView('patients')">
                        <i class="fa-solid fa-arrow-left"></i>
                    </div>
                    <div class="chat-whatsapp-avatar">
                        ${patientInfo?.nom_complet?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div class="chat-whatsapp-info">
                        <div class="chat-whatsapp-name">${escapeHtml(patientInfo?.nom_complet || 'Patient')}</div>
                        <div class="chat-whatsapp-status" id="chat-status">
                            <span class="online-dot"></span> En ligne
                        </div>
                    </div>
                    <div class="chat-whatsapp-actions">
                        <button id="attach-doc-btn" title="Pièce jointe">
                            <i class="fa-solid fa-paperclip"></i>
                        </button>
                    </div>
                </div>
        
                <!-- 🔥 NOUVEAU : SÉLECTEUR DE PORTÉE DES MESSAGES -->
                <div class="chat-visibility-bar">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-eye text-slate-400 text-xs"></i>
                        <span class="text-[10px] text-slate-400 font-medium">Envoyer à :</span>
                        <div class="flex gap-1 ml-2">
                            <button id="visibility-all" class="visibility-btn active px-2 py-1 rounded-lg text-[9px] font-medium transition-all" 
                                    data-visibility="all" style="background: #25D366; color: white;">
                                <i class="fa-solid fa-globe text-[8px]"></i> Tous
                            </button>
                            <button id="visibility-family" class="visibility-btn px-2 py-1 rounded-lg text-[9px] font-medium transition-all" 
                                    data-visibility="family" style="background: #2a3942; color: #aebac1;">
                                <i class="fa-solid fa-users text-[8px]"></i> Famille
                            </button>
                            <button id="visibility-aidant" class="visibility-btn px-2 py-1 rounded-lg text-[9px] font-medium transition-all" 
                                    data-visibility="aidant" style="background: #2a3942; color: #aebac1;">
                                <i class="fa-solid fa-user-nurse text-[8px]"></i> Aidant
                            </button>
                            ${localStorage.getItem("user_role") === "COORDINATEUR" ? `
                                <button id="visibility-coordinateur" class="visibility-btn px-2 py-1 rounded-lg text-[9px] font-medium transition-all" 
                                        data-visibility="coordinateur" style="background: #2a3942; color: #aebac1;">
                                    <i class="fa-solid fa-user-tie text-[8px]"></i> Coordinateur
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
        
                <!-- ZONE DES MESSAGES (SCROLLABLE) -->
                <div id="care-feed-content" class="chat-whatsapp-messages">
                    <div class="flex justify-center py-10">
                        <div class="relative w-8 h-8">
                            <div class="absolute inset-0 border-3 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>
        
                <!-- INDICATEUR DE TYPING -->
                <div id="typing-indicator" class="chat-whatsapp-typing hidden">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <span class="typing-text">quelqu'un écrit...</span>
                </div>
        
                <!-- BARRE DE SAISIE FIXE EN BAS -->
                <div class="chat-whatsapp-input">
                    <button class="chat-whatsapp-attach" id="attach-photo-btn" title="Photo">
                        <i class="fa-solid fa-camera"></i>
                    </button>
                    <div class="chat-whatsapp-input-wrapper">
                        <input type="text" id="quick-msg" class="chat-whatsapp-input-field" placeholder="Message" autocomplete="off">
                        <button class="chat-whatsapp-send" id="send-btn">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
        
                <!-- INPUTS CACHÉS -->
                <input type="file" id="photo-input" accept="image/*" class="hidden">
                <input type="file" id="document-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" class="hidden">
            </div>
        `;

    // ============================================================
    // STYLES CSS DYNAMIQUES (WHATSAPP STYLE)
    // ============================================================
    const styleId = 'chat-whatsapp-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* CONTENEUR PRINCIPAL - PLEIN ÉCRAN */
            .chat-whatsapp-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                background: #efeae2;
                z-index: 1000;
            }
            
            /* HEADER WHATSAPP */
            .chat-whatsapp-header {
                background: #202c33;
                color: white;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
                z-index: 10;
            }
            
            .chat-whatsapp-back {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background 0.2s;
            }
            .chat-whatsapp-back:hover { background: rgba(255,255,255,0.1); }
            .chat-whatsapp-back:active { transform: scale(0.95); }
            
            .chat-whatsapp-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${primaryColor}, ${isMaman ? '#BE123C' : '#047857'});
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 18px;
                color: white;
                flex-shrink: 0;
            }
            
            .chat-whatsapp-info {
                flex: 1;
                min-width: 0;
            }
            
            .chat-whatsapp-name {
                font-weight: 600;
                font-size: 16px;
                line-height: 1.2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .chat-whatsapp-status {
                font-size: 12px;
                opacity: 0.8;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .online-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #25D366;
            }
            
            .chat-whatsapp-actions {
                display: flex;
                gap: 8px;
            }
            .chat-whatsapp-actions button {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                transition: background 0.2s;
            }
            .chat-whatsapp-actions button:hover { background: rgba(255,255,255,0.1); }
            .chat-whatsapp-actions button:active { transform: scale(0.95); }
            
            /* ZONE DES MESSAGES */
            .chat-whatsapp-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                scroll-behavior: smooth;
                background: #efeae2;
            }
            
            .chat-whatsapp-messages::-webkit-scrollbar {
                width: 6px;
            }
            .chat-whatsapp-messages::-webkit-scrollbar-track {
                background: transparent;
            }
            .chat-whatsapp-messages::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.2);
                border-radius: 3px;
            }
            
            /* INDICATEUR DE TYPING */
            .chat-whatsapp-typing {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 12px;
                background: white;
                border-radius: 18px;
                border-bottom-left-radius: 4px;
                width: fit-content;
                margin: 0 16px 8px 16px;
                flex-shrink: 0;
            }
            .chat-whatsapp-typing.hidden {
                display: none;
            }
            .typing-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #8696a0;
                animation: typingBounce 1.4s infinite ease-in-out;
            }
            .typing-dot:nth-child(1) { animation-delay: 0s; }
            .typing-dot:nth-child(2) { animation-delay: 0.2s; }
            .typing-dot:nth-child(3) { animation-delay: 0.4s; }
            
            @keyframes typingBounce {
                0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                30% { transform: translateY(-6px); opacity: 1; }
            }
            
            .typing-text {
                font-size: 12px;
                color: #667781;
            }
            
            /* BARRE DE SAISIE FIXE */
            .chat-whatsapp-input {
                background: #202c33;
                padding: 10px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
            }
            
            .chat-whatsapp-attach {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: none;
                color: #aebac1;
                cursor: pointer;
                transition: background 0.2s;
            }
            .chat-whatsapp-attach:hover { background: rgba(255,255,255,0.1); }
            .chat-whatsapp-attach:active { transform: scale(0.95); }
            
            .chat-whatsapp-input-wrapper {
                flex: 1;
                background: #2a3942;
                border-radius: 24px;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px 12px;
            }
            
            .chat-whatsapp-input-field {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: #e9edef;
                font-size: 15px;
                padding: 10px 0;
            }
            .chat-whatsapp-input-field::placeholder {
                color: #8696a0;
            }
            
            .chat-whatsapp-send {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #25D366;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .chat-whatsapp-send:active {
                transform: scale(0.92);
            }
            
            /* STYLES DES MESSAGES */
            .chat-message-sent {
                background: ${primaryColor};
                color: white;
                border-radius: 18px;
                border-bottom-right-radius: 4px;
                padding: 10px 14px;
                max-width: 75%;
                word-wrap: break-word;
            }
            
            .chat-message-received {
                background: white;
                color: #1E293B;
                border-radius: 18px;
                border-bottom-left-radius: 4px;
                padding: 10px 14px;
                max-width: 75%;
                word-wrap: break-word;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            
            /* ANIMATION DES MESSAGES */
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .message-item {
                animation: messageSlideIn 0.2s ease-out;
            }
            
            /* MESSAGE AVEC PHOTO */
            .message-image {
                max-width: 250px;
                max-height: 250px;
                border-radius: 12px;
                cursor: pointer;
                margin-bottom: 4px;
            }
            
            /* THREAD DE RÉPONSES */
            .reply-thread {
                margin-left: 1rem;
                padding-left: 0.75rem;
                border-left: 3px solid #fbbf24;
                margin-top: 0.5rem;
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // BRANCHER LES ÉVÉNEMENTS
    // ============================================================
    const photoBtn = document.getElementById('attach-photo-btn');
    const photoInput = document.getElementById('photo-input');
    const sendBtn = document.getElementById('send-btn');
    const attachDocBtn = document.getElementById('attach-doc-btn');
    const documentInput = document.getElementById('document-input');
    const input = document.getElementById('quick-msg');

    let typingTimeout;

    if (input) {
        input.addEventListener('input', () => {
            if (!AppState.currentPatient) return;
            if (window.Realtime && window.Realtime.sendTyping) {
                window.Realtime.sendTyping({ 
                    patient_id: AppState.currentPatient, 
                    user_id: localStorage.getItem("user_id") 
                });
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                if (window.Realtime && window.Realtime.stopTyping) {
                    window.Realtime.stopTyping({ patient_id: AppState.currentPatient });
                }
            }, 2000);
        });
        
        input.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                window.sendQuickMessage(); 
            } 
        });
    }
    
    if (attachDocBtn && documentInput) {
        attachDocBtn.onclick = () => documentInput.click();
        documentInput.onchange = () => sendDocumentMessage();
    }
    
    if (photoBtn && photoInput) {
        photoBtn.onclick = () => photoInput.click();
        photoInput.onchange = () => sendPhotoMessage();
    }
    
    if (sendBtn) {
        sendBtn.onclick = () => window.sendQuickMessage();
    }


    const btnAll = document.getElementById('visibility-all');
    const btnFamily = document.getElementById('visibility-family');
    const btnAidant = document.getElementById('visibility-aidant');
    const btnCoordinateur = document.getElementById('visibility-coordinateur');
    
    if (btnAll) btnAll.addEventListener('click', () => setVisibility('all'));
    if (btnFamily) btnFamily.addEventListener('click', () => setVisibility('family'));
    if (btnAidant) btnAidant.addEventListener('click', () => setVisibility('aidant'));
    if (btnCoordinateur) btnCoordinateur.addEventListener('click', () => setVisibility('coordinateur'));
        
    cleanupRealtime();

    // ============================================================
    // CHARGEMENT DES MESSAGES
    // ============================================================
    let data = null;
    let fromCache = false;
    
    try {
        data = await secureFetch(`/messages?patient_id=${AppState.currentPatient}`, { noCache: true });
        console.log(`✅ ${data.length} messages chargés depuis le réseau`);
        console.log("📦 [DEBUG] Messages bruts reçus:", data);
        console.log("📦 [DEBUG] Nombre de messages:", data.length);
        
        // Afficher chaque message pour voir sa structure
        data.forEach((msg, index) => {
            console.log(`📦 Message ${index + 1}:`, {
                id: msg.id,
                type_media: msg.type_media,
                is_photo: msg.is_photo,
                content: msg.content?.substring(0, 100),
                photo_url: msg.photo_url,
                created_at: msg.created_at
            });
        });
        
        if (db && db.isReady) {
            await db.saveMessages(AppState.currentPatient, data);
            console.log("💾 Messages sauvegardés en IndexedDB");
        }
        
    } catch (networkError) {
        console.warn("⚠️ Erreur réseau, tentative de chargement depuis IndexedDB:", networkError.message);
        
        if (db && db.isReady) {
            const cachedMessages = await db.getMessages(AppState.currentPatient);
            if (cachedMessages && cachedMessages.length > 0) {
                data = cachedMessages;
                fromCache = true;
                console.log(`📦 ${data.length} messages chargés depuis IndexedDB (mode offline)`);
                
                if (window.showToast) {
                    window.showToast("Mode hors-ligne - Affichage des messages en cache", "info", 3000);
                }
            } else {
                throw new Error("Aucun message en cache disponible");
            }
        } else {
            throw networkError;
        }
    }
    
    if (!data || data.length === 0) {
        const contentDiv = document.getElementById('care-feed-content');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="flex justify-center items-center h-full py-20">
                    <div class="text-center">
                        <i class="fa-regular fa-comment-dots text-4xl text-slate-300 mb-3"></i>
                        <p class="text-sm font-bold text-slate-400">Aucun message</p>
                        <p class="text-[10px] text-slate-400 mt-1">Soyez le premier à envoyer un message</p>
                    </div>
                </div>
            `;
        }
        return;
    }
    
    try {
        const currentUserId = localStorage.getItem("user_id");
        AppState.messages = data.map(msg => ({
            ...msg,
            sender_id: msg.sender_id || (msg.sender ? msg.sender.id : null)
        }));
        
        AppState.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        AppState.unreadByPatient = {};
        data.forEach(msg => {
            const patientId = msg.patient_id;
            if (msg.sender_id !== currentUserId && !msg.read) {
                if (!AppState.unreadByPatient[patientId]) {
                    AppState.unreadByPatient[patientId] = 0;
                }
                AppState.unreadByPatient[patientId]++;
            }
        });

        console.log("🔴 [COMPTEUR INITIAL] unreadByPatient:", AppState.unreadByPatient);
        updatePatientBadges();
        
        if (window.Realtime) {
            window.Realtime.unsubscribe();
        }
        
        initRealtimeForCurrentPatient();
        renderFeed();

        if (!fromCache) {
            const now = new Date().toISOString();
            localStorage.setItem(`last_read_${AppState.currentPatient}`, now);

            try {
                await secureFetch('/messages/mark-read', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        patient_id: AppState.currentPatient, 
                        user_id: localStorage.getItem("user_id") 
                    })
                });
                console.log("👁️ Messages marqués comme lus (backend)");
                
                if (AppState.currentPatient && AppState.unreadByPatient) {
                    AppState.unreadByPatient[AppState.currentPatient] = 0;
                }
                
                updatePatientBadges();
                
                if (typeof window.refreshMenuBadges === 'function') {
                    setTimeout(() => window.refreshMenuBadges(), 100);
                }
            } catch (err) { 
                console.error("Erreur mark-read:", err); 
            }
        }
        
        unreadMessagesCount = 0;
        hideNewMessageBadge();
        
        setTimeout(() => { 
            initScrollDetection(); 
            isUserAtBottom = true; 
            scrollToBottom(); 
        }, 500);
        
        if (typeof window.refreshMenuBadges === 'function') {
            setTimeout(() => window.refreshMenuBadges(), 500);
        }

    } catch (err) {
        console.error("Erreur traitement Feed:", err);
        const contentDiv = document.getElementById('care-feed-content');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="flex justify-center items-center h-full py-20">
                    <div class="text-center">
                        <i class="fa-solid fa-circle-exclamation text-rose-400 text-3xl mb-3"></i>
                        <p class="text-sm font-bold text-rose-500">Erreur de chargement</p>
                        <p class="text-[10px] text-slate-400 mt-1">${err.message}</p>
                    </div>
                </div>
            `;
        }
    }
}




// Fonctions pour l'affichage de la portée
function getVisibilityIcon(visibility) {
    const icons = {
        'family': 'fa-users',
        'aidant': 'fa-user-nurse',
        'coordinateur': 'fa-user-tie'
    };
    return icons[visibility] || 'fa-globe';
}

function getVisibilityLabel(visibility) {
    const labels = {
        'family': 'Famille uniquement',
        'aidant': 'Aidant uniquement',
        'coordinateur': 'Coordinateur uniquement'
    };
    return labels[visibility] || 'Public';
}
// ============================================================
// EXPORTS GLOBAUX
// ============================================================

window.loadFeed = loadFeed;
window.cleanupRealtime = cleanupRealtime;
window.renderFeed = renderFeed;
