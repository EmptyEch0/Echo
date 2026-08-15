import numpy as np
from typing import List, Dict, Any
import database

def cosine_similarity(a: List[float], b: List[float]) -> float:
    arr_a = np.array(a, dtype=np.float32)
    arr_b = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(arr_a)
    norm_b = np.linalg.norm(arr_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(arr_a, arr_b) / (norm_a * norm_b))

def find_similar_past_messages(query_embedding: List[float], top_k: int = 3, contact_id: str = "") -> List[str]:
    records = database.get_messages_with_embeddings(contact_id=contact_id)
    if not records or not query_embedding:
        return []
        
    scored = []
    for r in records:
        emb = r.get("embedding")
        weight = r.get("weight", 1.0)
        if emb and len(emb) == len(query_embedding):
            score = cosine_similarity(query_embedding, emb) * (0.8 + 0.2 * weight)
            scored.append((score, r["content"]))
            
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]
