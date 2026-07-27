import requests
import json
import base64
import time
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional, Union
from concurrent.futures import ThreadPoolExecutor

from torch import cosine_similarity
import torch

class CLIPMultiModelClient:
    def __init__(self, server_url: str = "http://localhost:8000"):
        self.server_url = server_url.rstrip('/')

        # asks the serve for available models using the get_status endpoint
        self.available_models = self.get_available_models()
    
    def encode_image_to_base64(self, image_path: str) -> str:
        """Converte un'immagine locale in base64"""
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded_string}"
    
    def extract_features(
        self,
        data: Union[str, Dict[str, str]],
        type: str,
        model: str = "base",
        task: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Invia una richiesta di estrazione per una singola modalità.
        
        Args:
            data: Valore singolo oppure mapping per le modalità combinate.
            type: image, text, video, image+text oppure video+audio.
            model: Nome del modello da utilizzare.
            task: Ruolo query/document richiesto da Omni-Embed.
            
        Returns:
            Risposta del server con features estratte
        """
        endpoint = f"{self.server_url}/{model}"
        supported_types = {"image", "text", "video", "image+text", "video+audio"}
        if type not in supported_types:
            raise ValueError(f"Unsupported extraction type: {type}")
        if model == "omni_embed_nemotron_3B" and task is None:
            raise ValueError("Task is required for omni_embed_nemotron_3B")

        if type in {"image", "text", "video"}:
            if not isinstance(data, str):
                raise ValueError(f"Data for '{type}' must be a string")
            payload = {type: data}
        else:
            if not isinstance(data, dict):
                raise ValueError(f"Data for '{type}' must be a dictionary")
            required_fields = type.split("+")
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                raise ValueError(
                    f"Missing fields for '{type}': {', '.join(missing_fields)}"
                )
            payload = {field: data[field] for field in required_fields}

        if task is not None:
            if task not in {"query", "document"}:
                raise ValueError("Task must be 'query' or 'document'")
            payload["task"] = task
        
        try:
            response = requests.post(
                endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        
        except requests.RequestException as e:
            return {"success": False, "error": f"Errore nella richiesta: {str(e)}"}

    def extract_video_features_parallel(
        self,
        videos: List[str],
        model: str = "base",
        max_workers: int = 4,
        task: Optional[str] = None,
        include_audio: bool = False,
    ) -> List[Dict[str, Any]]:
        """Estrae features da URL video in parallelo."""
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(
                    self.extract_features,
                    video,
                    "video" if not include_audio else "video+audio",
                    model,
                    task,
                )
                for video in videos
            ]
            return [future.result() for future in futures]
    
    def extract_image_features_parallel(
        self,
        images: List[str],
        model: str = "base",
        max_workers: int = 10,
        task: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Estrae features da multiple immagini in parallelo
        
        Args:
            images: Lista di URL o stringhe base64
            model: Nome del modello da utilizzare
            max_workers: Numero massimo di richieste parallele
            
        Returns:
            Lista di risposte del server
        """
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(self.extract_features, image, 'image', model, task)
                for image in images
            ]
            results = [future.result() for future in futures]
        
        return results
    
    def extract_text_features_parallel(
        self,
        texts: List[str],
        model: str = "base",
        max_workers: int = 10,
        task: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Estrae features da multiple stringhe di testo in parallelo
        
        Args:
            texts: Lista di stringhe di testo
            model: Nome del modello da utilizzare
            max_workers: Numero massimo di richieste parallele
            
        Returns:
            Lista di risposte del server
        """
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(self.extract_features, text, 'text', model, task)
                for text in texts
            ]
            results = [future.result() for future in futures]
        
        return results
    
    def get_available_models(self) -> List[str]:
        """Ottiene la lista dei modelli disponibili dal server"""
        try:
            response = requests.get(f"{self.server_url}/status", timeout=10)
            response.raise_for_status()
            data = response.json()
            models = list(data['models'].keys())
            return models
        except requests.RequestException as e:
            print(f"⚠️  Errore nel recupero dei modelli disponibili: {str(e)}")
            return []
        

def test_video_extraction(models=["omni_embed_nemotron_3B"]):
    """Test con un singolo video su diversi modelli"""
    client = CLIPMultiModelClient(server_url="http://localhost:2222")
    
    test_video = "https://visione.isti.cnr.it:43333/v3c/03606/video?start=56.39&end=58.992"

    print("🔧 Test singolo video su modelli diversi")
    print(f"🎥  Video: {test_video[:60]}...")
    
    available_models = client.get_available_models()
    print(f"📱 Modelli disponibili: {available_models}")

    assert set(models).issubset(set(available_models)), f"Modelli richiesti {models} non tutti disponibili {available_models}"
    
    for model in models:  # Test primi 2 modelli
        print(f"\n🤖 Testing modello: {model}")
        
        start_time = time.time()
        result = client.extract_features(test_video, 'video', model, task='document')
        end_time = time.time()
        
        print(f"⏱️  Tempo: {end_time - start_time:.2f}s")
        
        if result.get("success"):
            print(f"✅ Successo! Features dim: {result['feature_dim']}")
            print(f"📊 Prime 5 features: {result['features'][:5]}")
        else:
            print(f"❌ Errore: {result.get('error', 'Errore sconosciuto')}")

def test_single_image(models=["dinov2_base"]):
    """Test con una singola immagine su diversi modelli"""
    client = CLIPMultiModelClient(server_url="http://localhost:2222")
    
    # test_image = "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/512px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
    test_image = "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg"

    print("🔧 Test singola immagine su modelli diversi")
    print(f"🖼️  Immagine: {test_image[:60]}...")
    
    available_models = client.get_available_models()
    print(f"📱 Modelli disponibili: {available_models}")

    assert set(models).issubset(set(available_models)), f"Modelli richiesti {models} non tutti disponibili {available_models}"
    
    for model in models:  # Test primi 2 modelli
        print(f"\n🤖 Testing modello: {model}")
        
        start_time = time.time()
        result = client.extract_features(test_image, 'image', model, task='document')
        end_time = time.time()
        
        print(f"⏱️  Tempo: {end_time - start_time:.2f}s")
        
        if result.get("success"):
            print(f"✅ Successo! Features dim: {result['feature_dim']}")
            print(f"📊 Prime 5 features: {result['features'][:5]}")
        else:
            print(f"❌ Errore: {result.get('error', 'Errore sconosciuto')}")

def test_single_text():
    """Test con una singola stringa di testo su diversi modelli"""
    client = CLIPMultiModelClient()
    
    test_text = "Un bellissimo paesaggio naturale con alberi e un lago"
    
    print("🔧 Test singolo testo su modelli diversi")
    print(f"📜 Testo: {test_text[:60]}...")
    
    available_models = client.get_available_models()
    print(f"📱 Modelli disponibili: {available_models}")
    
    for model in available_models[:2]:  # Test primi 2 modelli
        print(f"\n🤖 Testing modello: {model}")
        
        start_time = time.time()
        result = client.extract_features(test_text, 'text', model)
        end_time = time.time()
        
        print(f"⏱️  Tempo: {end_time - start_time:.2f}s")
        
        if result.get("success"):
            print(f"✅ Successo! Features dim: {result['feature_dim']}")
            print(f"📊 Prime 5 features: {result['features'][:5]}")
        else:
            print(f"❌ Errore: {result.get('error', 'Errore sconosciuto')}")

def test_text_to_video_retrieval(model="omni_embed_nemotron_3B"):
    """Test di retrieval testo -> video"""
    client = CLIPMultiModelClient(server_url="http://localhost:2222")
    
    test_text = "A person speaking french"
    test_videos = [f"https://visione.isti.cnr.it:43333/v3c/04572.mp4?start={s}&end={s+10}" for s in range(0, 300, 10)]  # 3 video segmenti
    
    print("🔧 Test retrieval testo -> video")
    print(f"📜 Testo: {test_text[:60]}...")
    
    available_models = client.get_available_models()
    print(f"📱 Modelli disponibili: {available_models}")
    
    assert model in available_models, f"Modello richiesto {model} non disponibile {available_models}"
    
    # Estrazione features per il testo
    text_result = client.extract_features(test_text, 'text', model, task='query')
    
    if not text_result.get("success"):
        print(f"❌ Errore nell'estrazione features testo: {text_result.get('error', 'Errore sconosciuto')}")
        return
    
    text_features = text_result['features']
    
    # Estrazione features per i video
    video_results = client.extract_video_features_parallel(test_videos, model, max_workers=3, task='document')
    
    # Calcolo similarità e ranking
    video_features = [res['features'] for res in video_results if res.get("success")]
    video_features_torch = torch.tensor(video_features)
    text_features_torch = torch.tensor(text_features)

    # Calcolo similarità e ranking
    similarities = torch.cosine_similarity(text_features_torch.unsqueeze(0), video_features_torch).squeeze(0).tolist()

    # Ordina i video per similarità decrescente
    ranked_videos = sorted(zip(test_videos, similarities), key=lambda x: x[1], reverse=True)
    print(f"🎥 Video ordinati per similarità:")
    for i, (video, similarity) in enumerate(ranked_videos[:5]):  # Mostra i primi 5
        print(f"   {i+1}. {video} (Similarità: {similarity:.4f})")

def test_batch_processing(model="openclip_clip_vit_l_14"):
    """Test del batching automatico di Ray Serve"""
    client = CLIPMultiModelClient(server_url="http://localhost:2222")

    available_models = client.get_available_models()
    print(f"📱 Modelli disponibili: {available_models}")

    assert model in available_models, f"Modello richiesto {model} non tutti disponibili {available_models}"
    
    # external_image = client.encode_image_to_base64('src/extractor/demo.jpeg')
    # corrupt the base64 of the image
    # external_image = external_image[:47] + external_image[49:]

    # Immagini di test diverse
    test_images = [
        "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg",
        # "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/256px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
        # "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Vd-Orig.png/256px-Vd-Orig.png",
        # "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/256px-React-icon.svg.png",
        # "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/256px-Python-logo-notext.svg.png",
        # "https://invalid-url-test.com/should-fail.jpg",  # Questo fallirà
        # external_image
    ]
    test_images = test_images * 3
    
    test_texts = [
        "Un bellissimo paesaggio naturale con alberi e un lago",
        "Un logo di React",
        "Il logo di Python",
        "Un'immagine che non esiste per testare gli errori"
    ]
    test_texts = test_texts * 3

    print("\n🚀 Test batching automatico Ray Serve")
    print(f"📦 Invio {len(test_images) + len(test_texts)} richieste in parallelo")
    
    start_time = time.time()
    results_images = client.extract_image_features_parallel(test_images, model=model, max_workers=16, task='document')
    results_texts = client.extract_text_features_parallel(test_texts, model=model, max_workers=16, task='query')
    end_time = time.time()
    
    print(f"⏱️  Tempo totale: {end_time - start_time:.2f}s")
    print(f"📊 Risultati:")
    
    successful = 0
    failed = 0
    
    for i, result in enumerate(results_images):
        if result.get("success"):
            successful += 1
            print(f"  ✅ Immagine {i+1}: Features dim {result['feature_dim']}")
            print(f"📊 Prime 5 features: {result['features'][:5]}")
        else:
            failed += 1
            print(f"  ❌ Immagine {i+1}: {result.get('error', 'Errore')}")

    for i, result in enumerate(results_texts):
        if result.get("success"):
            successful += 1
            print(f"  ✅ Testo {i+1}: Features dim {result['feature_dim']}")
            print(f"📊 Prime 5 features: {result['features'][:5]}")
        else:
            failed += 1
            print(f"  ❌ Testo {i+1}: {result.get('error', 'Errore')}")
    
    print(f"\n📈 Riassunto: {successful} successi, {failed} errori")
    print(f"🚄 Throughput: {(len(test_images) + len(test_texts))/(end_time - start_time):.1f} requests/sec")

def test_model_comparison():
    """Confronta le performance di modelli diversi"""
    client = CLIPMultiModelClient()
    
    test_image = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Vd-Orig.png/256px-Vd-Orig.png"
    models_to_test = ["base", "large"]  # Testa solo questi per velocità
    
    print("\n📊 Confronto performance modelli")
    
    results = {}
    for model in models_to_test:
        print(f"\n🤖 Testing {model}...")
        
        # Test con 5 richieste identiche per misurare performance
        images = [test_image] * 5
        
        start_time = time.time()
        model_results = client.extract_image_features_parallel(images, model, max_workers=3)
        end_time = time.time()
        
        successful_results = [r for r in model_results if r.get("success")]
        
        if successful_results:
            feature_dim = successful_results[0]["feature_dim"]
            avg_time = (end_time - start_time) / len(images)
            
            results[model] = {
                "feature_dim": feature_dim,
                "avg_time_per_image": avg_time,
                "success_rate": len(successful_results) / len(model_results)
            }
            
            print(f"  📏 Feature dim: {feature_dim}")
            print(f"  ⏱️  Tempo medio per immagine: {avg_time:.3f}s")
            print(f"  ✅ Success rate: {results[model]['success_rate']:.1%}")
        else:
            print(f"  ❌ Tutti i test sono falliti per {model}")
    
    # Confronto finale
    if len(results) > 1:
        print("\n🏆 Confronto finale:")
        for model, stats in results.items():
            print(f"  {model}: {stats['feature_dim']}D features, "
                  f"{stats['avg_time_per_image']:.3f}s/img, "
                  f"{stats['success_rate']:.1%} success")

def benchmark_scaling():
    """Test di scalabilità con batch crescenti"""
    client = CLIPMultiModelClient()
    
    test_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Vd-Orig.png/128px-Vd-Orig.png"
    batch_sizes = [1, 5, 10, 20, 50]
    
    print("\n📈 Test scalabilità Ray Serve batching")
    
    for batch_size in batch_sizes:
        test_batch = [test_url] * batch_size
        
        start_time = time.time()
        results = client.extract_image_features_parallel(test_batch, "base", max_workers=min(batch_size, 20))
        end_time = time.time()
        
        processing_time = end_time - start_time
        successful = sum(1 for r in results if r.get("success"))
        throughput = successful / processing_time if processing_time > 0 else 0
        
        print(f"  Batch {batch_size:2d}: {processing_time:.2f}s, "
              f"{successful}/{batch_size} successi, "
              f"{throughput:.1f} img/s")

if __name__ == "__main__":
    print("🧪 Client Test Multi-Model CLIP Feature Extractor\n")
    
    try:
        # # Test singola immagine
        # test_single_image(models=["omni_embed_nemotron_3B"])
        # print("\n" + "="*60 + "\n")
        
        # Test batching
        test_batch_processing(model="openclip_clip_vit_h_14")

        # Test video extraction
        # test_video_extraction(models=["omni_embed_nemotron_3B"])
        # test_video_extraction(models=["qwen_embedding_8B"])
        # test_text_to_video_retrieval(model="omni_embed_nemotron_3B")

        print("\n" + "="*60 + "\n")

        # test_single_text()
        
        # # Confronto modelli
        # test_model_comparison()
        # print("\n" + "="*60 + "\n")
        
        # # Test scalabilità
        # benchmark_scaling()
        
    except KeyboardInterrupt:
        print("\n\n🛑 Test interrotto dall'utente")
    except Exception as e:
        print(f"\n\n❌ Errore durante i test: {e}")
        import traceback
        traceback.print_exc()