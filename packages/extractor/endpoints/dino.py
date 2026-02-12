import logging
from typing import List, Dict, Any, Union
from urllib.parse import urlparse
import time
from ray import serve
from PIL import Image
import torch
from transformers import AutoImageProcessor, AutoModel

from .common import decode_image_data

# Configurazione logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@serve.deployment(
    autoscaling_config={
        "min_replicas": 0,           # Può scendere a 0 repliche
        "initial_replicas": 0,       # Inizia con 0 repliche
        "max_replicas": 1,
        "metrics_interval_s": 10,    # Frequenza metriche per decisioni autoscaling
        "look_back_period_s": 30,    # Periodo per analizzare trend
        "smoothing_factor": 1.0,     # Reattività alle variazioni (1.0 = molto reattivo)
        "downscale_delay_s": 3600,     # Attesa prima di deallocare (1 ora)
        "upscale_delay_s": 0,        # Nessuna attesa per allocare nuove repliche
    },
    ray_actor_options={"num_cpus": 1, "num_gpus": 0.3},
    max_concurrent_queries=100,
)
class DINOFeatureExtractor:
    def __init__(self, model_name: str):
        """
        Inizializza l'estrattore di features visuali
        
        Args:
            model_name: Nome del modello Hugging Face
        """
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.startup_time = time.time()
        
        # Carica modello e processor
        logger.info(f"Caricamento modello {model_name} su {self.device}")
        start_load = time.time()
        
        self.processor = AutoImageProcessor.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()
        
        load_time = time.time() - start_load
        logger.info(f"✅ READY: Estrattore visuale {model_name} inizializzato in {load_time:.2f}s")

    def __del__(self):
        """Chiamato quando l'istanza viene deallocata"""
        if hasattr(self, 'startup_time'):
            uptime = time.time() - self.startup_time
            logger.info(f"🗑️  SHUTDOWN: Deallocazione modello {self.model_name} dopo {uptime:.1f}s di uptime")

    def _extract_images_batch(self, images: List[Image.Image]) -> torch.Tensor:
        """
        Estrae features da un batch di immagini
        
        Args:
            images: Lista di immagini PIL
            
        Returns:
            Tensor con features estratte
        """
        with torch.no_grad():
            # Preprocessa le immagini
            inputs = self.processor(images=images, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Estrai features
            outputs = self.model(**inputs)
            last_hidden_states = outputs[0]
            cls_tokens = last_hidden_states[:, 0, :]
            
            return cls_tokens.cpu()

    @serve.batch(max_batch_size=64, batch_wait_timeout_s=0.1)
    async def extract_image(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Processa un batch di richieste di estrazione features
        Ray Serve raggruppa automaticamente le richieste singole in batch
        
        Args:
            requests: Lista di richieste, ognuna per una singola immagine
                     Formato: {"image": "url_or_base64_string"}
        
        Returns:
            Lista di risposte per ogni richiesta
        """
        batch_size = len(requests)
        logger.info(f"Processando batch di {batch_size} richieste con modello {self.model_name}")
        
        # Prepara containers per risultati
        successful_images = []
        successful_indices = []
        results = []
        
        # Inizializza tutti i risultati come errori
        for i in range(batch_size):
            results.append({
                "success": False,
                "error": "Non processato",
                "model": self.model_name
            })
        
        # Carica e valida tutte le immagini
        for idx, request in enumerate(requests):
            try:
                # Estrai dati immagine dalla richiesta
                if "image" not in request:
                    results[idx] = {
                        "success": False,
                        "error": "Campo 'image' mancante nella richiesta",
                        "model": self.model_name
                    }
                    continue
                
                image_data = request["image"]
                image = decode_image_data(image_data)
                successful_images.append(image)
                successful_indices.append(idx)
                
            except Exception as e:
                results[idx] = {
                    "success": False,
                    "error": str(e),
                    "model": self.model_name
                }
        
        # Estrai features per le immagini valide (se ce ne sono)
        if successful_images:
            try:
                features_tensor = self._extract_images_batch(successful_images)
                
                # Aggiorna risultati per immagini processate con successo
                for i, features in enumerate(features_tensor):
                    idx = successful_indices[i]
                    results[idx] = {
                        "success": True,
                        "features": features.numpy().tolist(),
                        "feature_dim": features.shape[0],
                        "model": self.model_name
                    }
                    
            except Exception as e:
                # Se l'estrazione batch fallisce, aggiorna gli errori
                for idx in successful_indices:
                    results[idx] = {
                        "success": False,
                        "error": f"Errore nell'estrazione features: {str(e)}",
                        "model": self.model_name
                    }
        
        logger.info(f"Batch completato: {sum(1 for r in results if r['success'])} successi, "
                   f"{sum(1 for r in results if not r['success'])} errori")
        
        return results