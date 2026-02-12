import json
import logging
from typing import List, Dict, Any, Union
from urllib.parse import urlparse
import time
import ray
from ray import serve
from ray.serve.handle import DeploymentHandle

from endpoints.openclip import OpenCLIPFeatureExtractor
from endpoints.clip import CLIPFeatureExtractor
from endpoints.qwen import QwenFeatureExtractor
from endpoints.dino import DINOFeatureExtractor

# Configurazione logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ray.serve")


# Router per gestire più modelli
@serve.deployment(
    num_replicas=1,
    ray_actor_options={"num_cpus": 0.1}
)
class ModelRouter:
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
    "clip_base": "openai/clip-vit-base-patch32",
    "clip_large": "openai/clip-vit-large-patch14",
    "openclip_clip_vit_b_32": "hf-hub:laion/CLIP-ViT-B-32-laion2B-s34B-b79K",
    "openclip_clip_vit_l_14": "hf-hub:laion/CLIP-ViT-L-14-laion2B-s32B-b82K",
    "qwen_embedding_8B": "Qwen/Qwen3-VL-Embedding-8B",
    "qwen_embedding_2B": "Qwen/Qwen3-VL-Embedding-2B",
    "dinov2_base": "facebook/dinov2-base"
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
        if "openclip" in endpoint_name.lower():
            model_handles[endpoint_name] = OpenCLIPFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "clip" in endpoint_name.lower():
            model_handles[endpoint_name] = CLIPFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "qwen" in endpoint_name.lower():
            model_handles[endpoint_name] = QwenFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        elif "dino" in endpoint_name.lower():
            model_handles[endpoint_name] = DINOFeatureExtractor.options(name=model_name.replace('/', '-')).bind(model_name=model_name)
        print(f"Registrato modello {model_name} su endpoint /{endpoint_name}")

    router_app = ModelRouter.bind(model_handles=model_handles, models_config=selected_models)
    
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