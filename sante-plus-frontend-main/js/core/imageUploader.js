// js/core/imageUploader.js
import { CONFIG } from './config.js';
import { compressImage } from './utils.js';
import ErrorHandler from './errorHandler.js';  

class ImageUploader {
    constructor() {
        this.maxRetries = 3;
        this.maxSize = 2 * 1024 * 1024; // 2MB max
    }

    // Upload avec progression
    static async upload(file, endpoint, fieldName = 'photo') {
        // Vérifier la taille
        if (file.size > this.maxSize) {
            Swal.fire({
                title: "Image trop lourde",
                text: "Veuillez choisir une image de moins de 2MB",
                icon: "warning",
                confirmButtonText: "OK"
            });
            return null;
        }

        // Afficher un loader
        let toast = null;
        
        try {
            // Compression automatique
            const compressed = await compressImage(file, 800);
            
            const formData = new FormData();
            formData.append(fieldName, compressed, file.name);

            // Upload avec retry
            const result = await ErrorHandler.retry(async () => {
                const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "Upload échoué");
                }

                return await response.json();
            }, 3);

            return result;

        } catch (err) {
            console.error("❌ Upload error:", err);
            
            // Si hors ligne, mettre en file d'attente
            if (!navigator.onLine) {
                this.queueUpload(file, endpoint, fieldName);
                Swal.fire({
                    title: "Photo mise en attente",
                    text: "Votre photo sera envoyée automatiquement quand la connexion sera rétablie.",
                    icon: "info",
                    timer: 2000,
                    showConfirmButton: false
                });
                return { queued: true };
            }
            
            Swal.fire({
                title: "Erreur d'upload",
                text: err.message || "Impossible d'envoyer la photo. Réessayez.",
                icon: "error",
                confirmButtonText: "OK"
            });
            return null;
        }
    }

    // File d'attente pour les photos hors ligne
    static queueUpload(file, endpoint, fieldName) {
        const queue = JSON.parse(localStorage.getItem('offline_photos') || '[]');
        
        // Lire le fichier en base64 pour le stocker
        const reader = new FileReader();
        reader.onload = (e) => {
            queue.push({
                endpoint,
                fieldName,
                data: e.target.result,
                filename: file.name,
                timestamp: Date.now()
            });
            localStorage.setItem('offline_photos', JSON.stringify(queue));
        };
        reader.readAsDataURL(file);
    }

    // Traiter les photos en file d'attente
    static async processQueue() {
        const queue = JSON.parse(localStorage.getItem('offline_photos') || '[]');
        if (queue.length === 0) return;

        console.log(`📸 Traitement de ${queue.length} photos en attente`);

        for (const item of queue) {
            try {
                // Convertir base64 en blob
                const blob = this.dataURLtoBlob(item.data);
                const file = new File([blob], item.filename, { type: 'image/jpeg' });
                
                const result = await this.upload(file, item.endpoint, item.fieldName);
                
                if (result && !result.queued) {
                    console.log(`✅ Photo envoyée: ${item.filename}`);
                }
            } catch (err) {
                console.log(`❌ Échec envoi photo: ${item.filename}`);
            }
        }

        // Vider la file d'attente
        localStorage.setItem('offline_photos', '[]');
    }

    // Utilitaire: dataURL → Blob
    static dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }
}

// Vérifier les photos en attente au retour de connexion
window.addEventListener('online', () => {
    setTimeout(() => ImageUploader.processQueue(), 1000);
});

export default ImageUploader;
