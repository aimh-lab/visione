import asyncio
import urllib
import urllib.parse
import re
import requests
import aiohttp
from typing import List, Optional, Union
from PIL import Image
from langchain_core.embeddings import Embeddings


class RemoteEmbeddings(Embeddings):
    """Remote embedding model integration using Ray Serve backend.
    
    This class provides image embeddings using models deployed via Ray Serve.
    It supports multiple model variants and can handle both URLs and base64 images.
    
    Key init args:
        server_url: str
            Base URL of the Ray Serve server
        model: str  
            Name of model endpoint to use (e.g., qwen_embedding_8B, openclip_clip_vit_b_32, openclip_clip_vit_l_14, dinov2_base: 768)
        timeout: float
            Request timeout in seconds
            
    Example:
        .. code-block:: python
        
            from embeddings import RemoteEmbeddings
            
            # Initialize with default base model
            embed = RemoteEmbeddings(
                server_url="http://localhost:8000",
                model="base"
            )
            
            # Embed single image URL
            image_url = "https://example.com/image.jpg"
            embedding = embed.embed_query(image_url)
            print(f"Embedding dimension: {len(embedding)}")
            
            # Embed multiple images
            image_urls = [
                "https://example.com/image1.jpg",
                "https://example.com/image2.jpg"
            ]
            embeddings = embed.embed_documents(image_urls)
            print(f"Generated {len(embeddings)} embeddings")
            
            # With base64 encoded images
            with open("image.jpg", "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode()
                embedding = embed.embed_query(f"data:image/jpeg;base64,{img_b64}")
    
    Async usage:
        .. code-block:: python
        
            # Async embedding
            embedding = await embed.aembed_query(image_url)
            embeddings = await embed.aembed_documents(image_urls)
    """
    
    def __init__(
        self, 
        embedding_server_url: str = "http://localhost:8000",
        data_server_url: str = "http://localhost:3333",
        data_loader = None,
        model: str = "base",
        timeout: float = 120.0,
        max_concurrent_requests: int = 64,
        mrl_dimension: Optional[int] = None
    ):
        """Initialize CLIP embeddings client.
        
        Args:
            server_url: Base URL of the Ray Serve CLIP server
            model: CLIP model endpoint name (base, large, base16, large14)  
            timeout: Request timeout in seconds
            max_concurrent_requests: Max concurrent async requests
        """
        self.embedding_server_url = embedding_server_url.rstrip('/')
        self.data_server_url = data_server_url.rstrip('/')
        self.data_loader = data_loader
        self.model = model
        self.timeout = timeout
        self.max_concurrent_requests = max_concurrent_requests
        self.mrl_dimension = mrl_dimension
        self.endpoint_url = f"{self.embedding_server_url}/{self.model}"
        
        # Available models mapping
        self.available_models = self._get_available_models()
        
        if model not in [m['name'] for m in self.available_models]:
            raise ValueError(
                f"Model '{model}' not available. "
                # f"Available models: {list(self.available_models.keys())}"
            )
        
    def _get_available_models(self) -> List[str]:
        """Obtains model's list from server"""
        try:
            response = requests.get(f"{self.embedding_server_url}/status", timeout=10)
            response.raise_for_status()
            data = response.json()
            models = [{"name": k, "modalities": v['model_infos']['modalities']} for k, v in data['models'].items()]
            return models
        except requests.RequestException as e:
            print(f"Error while loading available models: {str(e)}")
            return []
    
    def _validate_image_input(self, image_data: str) -> str:
        """Validate and normalize image input."""
        if not isinstance(image_data, str):
            raise ValueError("Image input must be a string (URL or base64)")
        
        if not image_data.strip():
            raise ValueError("Image input cannot be empty")
            
        return image_data
    
    def _extract_features_sync(self, image_data: str = None, text_data: str = None) -> List[float]:
        """Extract features from a single image synchronously."""
        try:
            payload = {}
            if image_data is not None:
                validated_input = self._validate_image_input(image_data)
                if image_data.startswith("data:image"):
                    # it's a base64 image
                    payload.update({"image": validated_input})
                else:
                    # should be a URL, construct it
                    try:
                        url = self.data_loader.get_collection_element_url_from_id(validated_input)
                    except Exception as e:
                        url = validated_input  # fallback to original input if URL construction fails
                    payload.update({"image": url})
            if text_data is not None:
                payload.update({"text": text_data})

            response = requests.post(
                self.endpoint_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout
            )
            response.raise_for_status()
            
            result = response.json()
            
            if not result.get("success"):
                error_msg = result.get("error", "Unknown error occurred")
                raise RuntimeError(f"CLIP extraction failed for payload {payload}: {error_msg}")
                
            features = result.get("features")
            if not features:
                raise RuntimeError("No features returned from CLIP model")
            
            if self.mrl_dimension:
                features = features[:self.mrl_dimension]
                
            return features
            
        except requests.RequestException as e:
            raise RuntimeError(f"Request to CLIP server failed: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"Feature extraction failed: {str(e)}")
    
    def embed_documents(self, images: List[str]) -> List[List[float]]:
        """Embed multiple images (URLs or base64).
        
        Args:
            texts: List of image data (URLs or base64 strings)
            
        Returns:
            List of embeddings, one per image
        """
        if not images:
            return []
            
        embeddings = []
        for i, image_data in enumerate(images):
            try:
                embedding = self._extract_features_sync(image_data)
                embeddings.append(embedding)
            except Exception as e:
                # Log error but continue processing other images
                print(f"Warning: Failed to embed image {i}: {str(e)}")
                # Return zero vector as fallback 
                # (alternatively, you could raise an exception or skip)
                fallback_dim = 512 if self.model == "base" else 768
                embeddings.append([])
                
        return embeddings
    
    def embed_query(self, input_data: str = None) -> List[float]:
        """Embed a single image (URL or base64).
        
        Args:
            input_data: Image data (URL or base64 string) if input_data is starting with "image:" or a sentence if input_data is starting with "text:"
            
        Returns:
            Embedding vector as list of floats
        """
        if input_data is None or not input_data.strip():
            raise ValueError("Input data cannot be empty")
        
        if "image:" in input_data and "text:" in input_data:
            image_match = re.search(r'image:\s*(.*?)(?=;text:|$)', input_data)
            text_match = re.search(r'text:\s*(.*?)(?=;image:|$)', input_data)
            image_data = image_match.group(1).strip() if image_match else None
            text_data = text_match.group(1).strip() if text_match else None
            # print(f"Image data: {image_data}")  # Log start of image data for debugging
            # print(f"Text data: {text_data}")    # Log start of text data for debugging
            return self._extract_features_sync(image_data=image_data, text_data=text_data)
        if input_data.startswith("image:"):
            image_data = input_data[len("image:"):].strip()
            return self._extract_features_sync(image_data=image_data)
        elif input_data.startswith("text:"):
            text_data = input_data[len("text:"):].strip()
            return self._extract_features_sync(text_data=text_data)
        else:
            return self._extract_features_sync(text_data=input_data)
        
    async def aembed_documents(self, images: List[str]) -> List[List[float]]:
        """Embed multiple images asynchronously (URLs or base64).
        
        Args:
            images: List of image data (URLs or base64 strings)
            
        Returns:
            List of embeddings, one per image
        """
        if not images:
            return []
        
        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        
        async def process_single_image(i: int, image_data: str) -> List[float]:
            """Process a single image with error handling."""
            async with semaphore:
                try:
                        return await self._extract_features_async(image_data=image_data)
                except Exception as e:
                    # Log error but continue processing other images
                    print(f"Warning: Failed to embed image {i}: {str(e)}")
                    # Return empty list as fallback (consistent with sync version)
                    return []   # FIXME: Consider returning None or raising exception instead (also because probably Elastic throws error on adding empty embeddings)
        
        # Create tasks for all images
        tasks = [
            process_single_image(i, image_data) 
            for i, image_data in enumerate(images)
        ]
        
        # Execute all tasks concurrently
        embeddings = await asyncio.gather(*tasks, return_exceptions=False)
        
        return embeddings

    async def aembed_query(self, input_data: str = None) -> List[float]:
        """Embed a single image or text asynchronously.
        
        Args:
            input_data: Image data (URL or base64 string) if input_data starts with "image:" 
                or a sentence if input_data starts with "text:", or plain text
            
        Returns:
            Embedding vector as list of floats
        """
        if input_data is None or not input_data.strip():
            raise ValueError("Input data cannot be empty")
        
        if "image:" in input_data and "text:" in input_data:
            image_match = re.search(r'image:\s*(.*?)(?=;text:|$)', input_data)
            text_match = re.search(r'text:\s*(.*?)(?=;image:|$)', input_data)
            image_data = image_match.group(1).strip() if image_match else None
            text_data = text_match.group(1).strip() if text_match else None
            return await self._extract_features_async(image_data=image_data, text_data=text_data)
        if input_data.startswith("image:"):
            image_data = input_data[len("image:"):].strip()
            return await self._extract_features_async(image_data=image_data)
        elif input_data.startswith("text:"):
            text_data = input_data[len("text:"):].strip()
            return await self._extract_features_async(text_data=text_data)
        else:
            # Assume it's plain text
            return await self._extract_features_async(text_data=input_data)

    async def _extract_features_async(self, image_data: str = None, text_data: str = None) -> List[float]:
        """Extract features from a single image or text asynchronously."""
        
        try:
            payload = {}
            if image_data is not None:
                validated_input = self._validate_image_input(image_data)
                if image_data.startswith("data:image"):
                    # it's a base64 image
                    payload.update({"image": validated_input})
                else:
                    # should be a URL, construct it
                    try:
                        url = self.data_loader.get_collection_element_url_from_id(validated_input)
                    except Exception as e:
                        url = validated_input  # fallback to original input if URL construction fails
                    payload.update({"image": url})
            if text_data is not None:
                payload.update({"text": text_data})
                
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    self.endpoint_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    response.raise_for_status()
                    result = await response.json()
                    
                    if not result.get("success"):
                        error_msg = result.get("error", "Unknown error occurred")
                        raise RuntimeError(f"CLIP extraction failed for payload {payload}: {error_msg}")
                        
                    features = result.get("features")
                    if not features:
                        raise RuntimeError("No features returned from CLIP model")
                    
                    if self.mrl_dimension:
                        features = features[:self.mrl_dimension]
                        
                    return features
                    
        except aiohttp.ClientError as e:
            raise RuntimeError(f"Async request to CLIP server failed: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"Async feature extraction failed: {str(e)}")
    
    def get_server_status(self) -> dict:
        """Get status information from the CLIP server."""
        try:
            response = requests.get(f"{self.embedding_server_url}/status", timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"Failed to get server status: {str(e)}"}
        

if __name__ == "__main__":
    # Example usage
    embed = RemoteEmbeddings(
        embedding_server_url="http://localhost:3457",
        data_server_url="",
        model="dinov2_base"
    )
    
    print("Testing sync embedding...")
    # Test embedding a single image URL
    text = "A person sitting on a windowsill."
    image = "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg"
    embedding = embed.embed_query(f"image:{image};text:{text}")
    print(f"Embedding: {embedding[:5]}... (dimension: {len(embedding)})")
    
    # Test embedding multiple images
    image_urls = [
        "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg",
        "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/demo.jpeg"
    ]
    embeddings = embed.embed_documents([f"{url}" for url in image_urls])
    print(f"Embeddings: {[e[:5] for e in embeddings]}... (dimension: {len(embeddings[0]) if embeddings else 0})")

    # Test async embedding
    print("Testing async embedding...")
    async def test_async_embedding():
        embedding = await embed.aembed_query(text)
        print(f"Async Embedding: {embedding[:5]}... (dimension: {len(embedding)})")
        
        embeddings = await embed.aembed_documents([f"{url}" for url in image_urls])
        print(f"Async Embeddings: {[e[:5] for e in embeddings]}... (dimension: {len(embeddings[0]) if embeddings else 0})")

    asyncio.run(test_async_embedding())