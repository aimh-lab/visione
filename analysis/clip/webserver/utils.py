import faiss
import torch
from torch.nn import functional as F
from transformers import AutoTokenizer, AutoModel

class FaissWrapper():
    def __init__(self, index, ids) -> None:
        self.index = index
        self.ids = list(ids) if not isinstance(ids, list) else ids

    def search(self, feat, k=10):
        D, I = self.index.search(feat, k)
        I = I[0]
        D = D[0]
        img_ids = [self.ids[i] for i in I]
        return img_ids, D


class CLIPTextEncoder():
    def __init__(self, model_handle):
        device = 'cpu'
        self.model = AutoModel.from_pretrained(model_handle).to(device)
        self.tokenizer = AutoTokenizer.from_pretrained(model_handle)

    def get_text_embedding(self, text, normalized=False):
        with torch.no_grad():
            inputs = self.tokenizer(text, padding=True, return_tensors="pt")
            text_features = self.model.get_text_features(**inputs)
            if normalized:
                text_features = F.normalize(text_features, dim=-1)
            text_features = text_features.numpy()
        return text_features