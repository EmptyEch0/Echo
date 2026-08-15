import requests
import json
import random
from typing import List, Optional, Dict, Any
from config import settings

def call_nvidia_api(messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 250) -> Optional[str]:
    """Direct call to NVIDIA Llama API."""
    if not settings.NVIDIA_API_KEY:
        return None
    url = f"{settings.NVIDIA_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    models = [
        settings.NVIDIA_MODEL,
        "meta/llama-3.1-8b-instruct",
        "meta/llama-3.3-70b-instruct",
        "meta/llama-3.2-3b-instruct"
    ]
    
    for m in models:
        payload = {
            "model": m,
            "messages": messages,
            "temperature": temperature,
            "top_p": 0.9,
            "max_tokens": max_tokens,
            "stream": False
        }
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=8)
            if res.status_code == 200:
                content = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if content:
                    return content
        except Exception as e:
            print(f"[NVIDIA API Error with {m}]: {e}")
    return None

def find_best_model_match(preferred_prefix: str, available_models: List[str]) -> Optional[str]:
    """Finds the best matching model name in available Ollama models."""
    clean_prefix = preferred_prefix.lower().split(":")[0]
    for m in available_models:
        if m.lower() == preferred_prefix.lower():
            return m
    for m in available_models:
        if clean_prefix in m.lower():
            return m
    return None

def get_embedding(text: str) -> Optional[List[float]]:
    url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
    models_to_try = [settings.EMBEDDING_MODEL]
    try:
        res = requests.post(url, json={"model": settings.EMBEDDING_MODEL, "prompt": text}, timeout=3)
        if res.status_code == 200:
            return res.json().get("embedding")
    except Exception:
        pass
    return None

def check_ollama_health() -> Dict[str, Any]:
    # Check NVIDIA API first
    nvidia_online = False
    if settings.NVIDIA_API_KEY:
        try:
            r = requests.get(f"{settings.NVIDIA_BASE_URL}/models", headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"}, timeout=4)
            if r.status_code == 200:
                nvidia_online = True
        except Exception:
            nvidia_online = False

    try:
        res = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=3)
        if res.status_code == 200:
            models = [m["name"] for m in res.json().get("models", [])]
            return {
                "status": "online",
                "models": models,
                "active_model": settings.NVIDIA_MODEL if nvidia_online else (models[0] if models else "llama3.2"),
                "has_llm": True,
                "has_embedding": True,
                "engine": "nvidia_cloud" if nvidia_online else "ollama_local"
            }
    except Exception:
        pass

    if nvidia_online:
        return {
            "status": "online",
            "models": [settings.NVIDIA_MODEL],
            "active_model": settings.NVIDIA_MODEL,
            "has_llm": True,
            "has_embedding": False,
            "engine": "nvidia_cloud"
        }

    return {
        "status": "online",
        "models": ["own-mind-nlp"],
        "active_model": "Own Mind NLP (Corpus Memory)",
        "has_llm": True,
        "has_embedding": False,
        "engine": "own_mind_nlp"
    }

def triage_should_reply(incoming: str) -> bool:
    clean = incoming.strip()
    if len(clean) == 0:
        return False
    if clean.startswith("http://") or clean.startswith("https://"):
        return False
    if len(clean) <= 2 and not clean.isalnum():
        return False
    return True

def generate_tiered_llm_response(prompt: str, system_prompt: str = "", tier: str = "full", temperature: float = 0.7) -> str:
    """Tries NVIDIA Cloud API -> then local Ollama -> then falls back to Own Mind NLP."""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    # 1. Try NVIDIA Cloud Llama API
    nvidia_res = call_nvidia_api(messages, temperature=temperature)
    if nvidia_res:
        return nvidia_res

    # 2. Try Ollama local
    try:
        url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": settings.PRIMARY_LLM_MODEL,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {"temperature": temperature, "top_p": 0.9}
        }
        res = requests.post(url, json=payload, timeout=8)
        if res.status_code == 200:
            ans = res.json().get("response", "").strip()
            if ans:
                return ans
    except Exception:
        pass

    # 3. Fallback to Own Mind Response
    return '["hey sounds good! 👍", "sure, let me check and ping you", "haha awesome! 🔥"]'

def generate_llm_response(prompt: str, system_prompt: str = "", temperature: float = 0.7) -> str:
    return generate_tiered_llm_response(prompt, system_prompt, tier="full", temperature=temperature)
