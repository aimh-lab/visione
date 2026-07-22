import json
import logging
import os
from typing import Dict, Any
import time
import ray
from ray import serve
from ray.serve.handle import DeploymentHandle

from endpoints.openclip import OpenCLIPFeatureExtractor
from endpoints.clip import CLIPFeatureExtractor
from endpoints.qwen import QwenFeatureExtractor
from endpoints.dino import DINOFeatureExtractor
from endpoints.omni import OmniFeatureExtractor
import requests_cache

# Configurazione logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ray.serve")

if os.environ.get("FEATURE_EXTRACTOR_DISABLE_CACHE") != "1":
    requests_cache.install_cache('feature_xtractor_cache', expire_after=60)
    logger.info("Abilitata cache per richieste HTTP (durata 60s)")

MEDIA_FIELDS = frozenset({"image", "text", "video", "audio"})
MODALITY_ROUTES = {
    frozenset({"image"}): ("image", "extract_image"),
    frozenset({"text"}): ("text", "extract_text"),
    frozenset({"video"}): ("video", "extract_video"),
    frozenset({"image", "text"}): ("image+text", "extract_image_text"),
    frozenset({"video", "audio"}): ("video+audio", "extract_video_audio"),
}


def resolve_request_modality(data: Dict[str, Any]) -> tuple[str, str]:
    """Return the declared modality and deployment method for a request body."""
    if not isinstance(data, dict):
        raise ValueError("Il corpo della richiesta deve essere un oggetto JSON")

    provided_media_fields = frozenset(data.keys()) & MEDIA_FIELDS
    route = MODALITY_ROUTES.get(provided_media_fields)
    if route is None:
        fields = ", ".join(sorted(provided_media_fields)) or "nessuno"
        raise ValueError(f"Combinazione di modalità non supportata: {fields}")
    return route


# Router per gestire più modelli
@serve.deployment(
    num_replicas=1,
    ray_actor_options={"num_cpus": 0.1}
)
class ModelRouter:
    def __init__(
        self,
        model_handles: Dict[str, DeploymentHandle],
        models_config: Dict[str, Dict[str, Any]],
    ):
        """
        Router per gestire richieste a diversi modelli CLIP
        
        Args:
            models_config: Dict con mapping nome_endpoint -> nome_modello_hf
        """
        self.models_config = models_config
        self.model_handles = model_handles
        self.start_time = time.time()
        self.received_requests_after_cache_delete = 0
        

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
            
            try:
                modality, method_name = resolve_request_modality(data)
            except ValueError as exc:
                return {
                    "error": str(exc)
                }

            supported_modalities = self.models_config[model_endpoint]["modalities"]
            if modality not in supported_modalities:
                return {
                    "error": f"Il modello '{model_endpoint}' non supporta la modalità '{modality}'"
                }

            model_handle = self.model_handles[model_endpoint]
            method_handle = getattr(model_handle, method_name)

            self.received_requests_after_cache_delete += 1
            if self.received_requests_after_cache_delete > 1000:
                # Reset della cache dopo 1000 richieste per evitare accumulo di dati
                requests_cache.delete(expired=True)
                self.received_requests_after_cache_delete = 0

            return await method_handle.remote(data)
            
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
            
            for endpoint_name, model_infos in self.models_config.items():
                model_status[endpoint_name] = {
                    "model_infos": model_infos,
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
    #"clip_base": {"name": "openai/clip-vit-base-patch32", "modalities": ["image", "text"]},
    #"clip_large": {"name": "openai/clip-vit-large-patch14", "modalities": ["image", "text"]},
    #"openclip_clip_vit_b_32": {"name": "hf-hub:laion/CLIP-ViT-B-32-laion2B-s34B-b79K", "modalities": ["image", "text"]},
    "openclip_clip_vit_l_14": {"name": "hf-hub:laion/CLIP-ViT-L-14-laion2B-s32B-b82K", "modalities": ["image", "text"]},
    "openclip_clip_vit_h_14": {"name": "hf-hub:laion/CLIP-ViT-H-14-laion2B-s32B-b79K", "modalities": ["image", "text"]},
    "qwen_embedding_8B": {"name": "Qwen/Qwen3-VL-Embedding-8B", "modalities": ["image", "text", "image+text", "video"]},
    #"qwen_embedding_2B": {"name": "Qwen/Qwen3-VL-Embedding-2B", "modalities": ["image", "text", "image+text", "video"]},
    "omni_embed_nemotron_3B": {
        "name": "nvidia/omni-embed-nemotron-3b",
        "modalities": ["video", "video+audio", "image", "image+text", "text"]
    },
    "dinov2_base": {"name": "facebook/dinov2-base", "modalities": ["image"]}
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
    for endpoint_name, model_info in selected_models.items():
        model_name = model_info["name"]
        if "openclip" in endpoint_name.lower():
            model_handles[endpoint_name] = OpenCLIPFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "clip" in endpoint_name.lower():
            model_handles[endpoint_name] = CLIPFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "qwen" in endpoint_name.lower():
            model_handles[endpoint_name] = QwenFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "omni" in endpoint_name.lower():
            model_handles[endpoint_name] = OmniFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "dino" in endpoint_name.lower():
            model_handles[endpoint_name] = DINOFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        print(f"Registrato modello {model_name} su endpoint /{endpoint_name}")

    router_app = ModelRouter.bind(model_handles=model_handles, models_config=selected_models)

    serve.start(http_options={"host": args.host, "port": args.port})
    serve.run(
        router_app,
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
