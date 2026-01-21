import asyncio
import base64
import io
import json
import logging
from typing import List, Dict, Any, Union
from urllib.parse import urlparse
import time
import ray
from ray import serve
from ray.serve.handle import DeploymentHandle
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel, CLIPTokenizer
import requests

# Configurazione logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ray.serve")

@serve.deployment(
    autoscaling_config={
        "min_replicas": 0,           # Può scendere a 0 repliche
        "initial_replicas": 1,       # Inizia con 1 replica
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
class CLIPFeatureExtractor:
    def __init__(self, model_name: str):
        """
        Inizializza l'estrattore di features CLIP per un singolo modello
        
        Args:
            model_name: Nome del modello CLIP da Hugging Face
        """
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.startup_time = time.time()
        
        # Carica modello e processor
        logger.info(f"Caricamento modello {model_name} su {self.device}")
        start_load = time.time()
        
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.tokenizer = CLIPTokenizer.from_pretrained(model_name)
        self.model.to(self.device)
        self.model.eval()
        
        load_time = time.time() - start_load
        logger.info(f"✅ READY: Estrattore CLIP {model_name} inizializzato in {load_time:.2f}s")

    def __del__(self):
        """Chiamato quando l'istanza viene deallocata"""
        if hasattr(self, 'startup_time'):
            uptime = time.time() - self.startup_time
            logger.info(f"🗑️  SHUTDOWN: Deallocazione modello {self.model_name} dopo {uptime:.1f}s di uptime")

    def _decode_image_data(self, image_data: str) -> Image.Image:
        """
        Decodifica immagine da base64 o URL
        
        Args:
            image_data: Stringa contenente URL o dati base64
            
        Returns:
            PIL Image object
            
        Raises:
            Exception: Se l'immagine non può essere caricata
        """
        try:
            # Controlla se è base64
            if image_data.startswith('data:image') or not urlparse(image_data).scheme:
                # Rimuovi prefisso data URL se presente
                if image_data.startswith('data:image'):
                    image_data = image_data.split(',')[1]
                
                # Decodifica base64
                image_bytes = base64.b64decode(image_data)
                return Image.open(io.BytesIO(image_bytes)).convert('RGB')
            
            else:
                # È un URL - scarica l'immagine
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'}
                response = requests.get(image_data, timeout=10, headers=headers)
                response.raise_for_status()
                return Image.open(io.BytesIO(response.content)).convert('RGB')
                
        except Exception as e:
            raise Exception(f"Errore nel caricamento immagine: {str(e)}")

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
            inputs = self.processor(images=images, return_tensors="pt", padding=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Estrai features
            image_features = self.model.get_image_features(**inputs)
            
            # Normalizza features
            # image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
            
            return image_features.cpu()
        
    def _extract_texts_batch(self, texts: List[str]) -> torch.Tensor:
        """
        Estrae features da un batch di testi
        
        Args:
            texts: Lista di stringhe di testo
            
        Returns:
            Tensor con features estratte
        """
        with torch.no_grad():
            # Preprocessa i testi
            inputs = self.tokenizer(texts, padding=True, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Estrai features
            text_features = self.model.get_text_features(**inputs)
            
            # Normalizza features
            # text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
            
            return text_features.cpu()

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
                image = self._decode_image_data(image_data)
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

    @serve.batch(max_batch_size=64, batch_wait_timeout_s=0.1)
    async def extract_text(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Processa un batch di richieste di estrazione features da testo
        
        Args:
            requests: Lista di richieste, ognuna per un singolo testo
                     Formato: {"text": "stringa di testo"}
        
        Returns:
            Lista di risposte per ogni richiesta
        """
        batch_size = len(requests)
        logger.info(f"Processando batch di {batch_size} richieste con modello {self.model_name}")
        
        # Prepara containers per risultati
        successful_texts = []
        successful_indices = []
        results = []
        
        # Inizializza tutti i risultati come errori
        for i in range(batch_size):
            results.append({
                "success": False,
                "error": "Non processato",
                "model": self.model_name
            })
        
        # Carica e valida tutti i testi
        for idx, request in enumerate(requests):
            try:
                # Estrai dati testo dalla richiesta
                if "text" not in request:
                    results[idx] = {
                        "success": False,
                        "error": "Campo 'text' mancante nella richiesta",
                        "model": self.model_name
                    }
                    continue
                
                text_data = request["text"]
                successful_texts.append(text_data)
                successful_indices.append(idx)
                
            except Exception as e:
                results[idx] = {
                    "success": False,
                    "error": str(e),
                    "model": self.model_name
                }
        
        # Estrai features per i testi validi (se ce ne sono)
        if successful_texts:
            try:
                text_features = self._extract_texts_batch(successful_texts)
                    
                # Aggiorna risultati per testi processati con successo
                for i, features in enumerate(text_features):
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


# Router per gestire più modelli
@serve.deployment(
    num_replicas=1,
    ray_actor_options={"num_cpus": 0.1}
)
class CLIPModelRouter:
    def __init__(self, model_handles: Dict[str, DeploymentHandle], models_config: Dict[str, str]):
        """
        Router per gestire richieste a diversi modelli CLIP
        
        Args:
            models_config: Dict con mapping nome_endpoint -> nome_modello_hf
        """
        self.models_config = models_config
        self.model_handles = model_handles
        self.start_time = time.time()
        

    async def __call__(self, request) -> Dict[str, Any]:
        """
        Instrada le richieste al modello appropriato basandosi sul path
        """
        try:
            # Estrai informazioni dalla richiesta
            path = request.url.path
            model_endpoint = path.split('/')[-1]  # ultimo segmento del path
            
            if model_endpoint == 'status':
                result = self.get_status()
                return result
            
            if model_endpoint not in self.model_handles:
                available_models = list(self.models_config.keys())
                return {
                    "error": f"Modello '{model_endpoint}' non disponibile. "
                            f"Modelli disponibili: {available_models}",
                    "available_models": available_models
                }
            
            # Parse del body della richiesta
            if hasattr(request, 'json'):
                data = await request.json()
            else:
                data = request
            
            if "image" in data and "text" in data:
                return {
                    "error": "Non possono essere presenti sia image che text nella richiesta"
                }
            
            elif "image" in data:
                model_handle = self.model_handles[model_endpoint]
                result = await model_handle.extract_image.remote(data)

            elif "text" in data:
                model_handle = self.model_handles[model_endpoint]
                result = await model_handle.extract_text.remote(data)

            else:
                return {
                    "error": "Richiesta non compilata correttamente"
                }            
            
            return result
            
        except Exception as e:
            logger.error(f"Errore nel router: {str(e)}")
            return {
                "error": f"Errore interno del server: {str(e)}"
            }


    def get_status(self) -> Dict[str, Any]:
        """
        Endpoint per ottenere lo stato dei modelli
        """
        try:
            serve_status = serve.status()

            # Informazioni sui modelli configurati
            model_status = {}
            
            for endpoint_name, model_name in self.models_config.items():
                model_status[endpoint_name] = {
                    "model_name": model_name,
                    "endpoint": f"/{endpoint_name}",
                    "autoscaling": "min_replicas=0 (lazy loading enabled)"
                }
            
            return {
                "status": "running",
                "router_uptime": time.time() - self.start_time,
                "models": model_status,
                "deployments_status": serve_status
            }
            
        except Exception as e:
            return {"error": f"Errore nel recupero status: {str(e)}"}


# Configurazione dei modelli disponibili
MODELS_CONFIG = {
    "base": "openai/clip-vit-base-patch32",
    "large": "openai/clip-vit-large-patch14", 
    # "base16": "openai/clip-vit-base-patch16",
    # "large14": "openai/clip-vit-large-patch14-336"
}

# Script per avviare il server
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Multi-Model CLIP Feature Extractor Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host del server")
    parser.add_argument("--port", default=8000, type=int, help="Porta del server")
    parser.add_argument("--models", nargs="+", 
                       choices=list(MODELS_CONFIG.keys()), 
                       default=list(MODELS_CONFIG.keys()),
                       help="Modelli da caricare")
    
    args = parser.parse_args()
    
    # Filtra modelli da caricare
    selected_models = {k: v for k, v in MODELS_CONFIG.items() if k in args.models}
    
    # Inizializza Ray
    ray.init(include_dashboard=False)
    
    # Deploy dell'applicazione
    model_handles = {}
        
    # Crea handle per ogni modello
    for endpoint_name, model_name in selected_models.items():
        model_handles[endpoint_name] = CLIPFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        print(f"Registrato modello {model_name} su endpoint /{endpoint_name}")

    router_app = CLIPModelRouter.bind(model_handles=model_handles, models_config=selected_models)
    
    serve.run(
        router_app,
        host=args.host,
        port=args.port,
        route_prefix="/"
    )
    
    print(f"🚀 Server Multi-Model CLIP avviato su http://{args.host}:{args.port}")
    print(f"📱 Modelli disponibili:")
    for endpoint, model in selected_models.items():
        print(f"  /{endpoint} -> {model}")
    
    print("\n💡 Esempio richieste POST:")
    for endpoint in selected_models.keys():
        print(f"  http://{args.host}:{args.port}/{endpoint}")
    
    print("\n📝 Formato richiesta:")
    print(json.dumps({
        "image": "https://example.com/image.jpg"
        # oppure
        # "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    }, indent=2))

    # Block until this script is killed manually with ctrl-c
    import time
    while True:
        time.sleep(10)