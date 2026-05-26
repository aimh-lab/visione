import base64
import io
from typing import List, Dict, Any, Union
from urllib.parse import urlparse
from PIL import Image
import requests
import requests_cache

requests_cache.install_cache('feature_xtractor_cache', expire_after=60)

def decode_image_data(image_data: str) -> Image.Image:
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
