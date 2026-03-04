import hashlib

def generate_doc_id(doc_id_str: str) -> str:
    """Generate a unique ID for a document based on its ID string"""
    return hashlib.md5(doc_id_str.encode("UTF-8")).hexdigest()