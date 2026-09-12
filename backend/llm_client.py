import time
import requests
import json
import re
import random
from typing import List, Optional, Dict, Any
from config import settings

# Fast in-memory cache for Ollama reachability to eliminate 25s hangs
_ollama_reachable_cache = {"reachable": False, "last_check": 0.0, "models": []}

def is_ollama_online(timeout: float = 0.6) -> bool:
    """Fast check with 10-second cache to see if local Ollama daemon is active."""
    global _ollama_reachable_cache
    now = time.time()
    if now - _ollama_reachable_cache["last_check"] < 10.0:
        return _ollama_reachable_cache["reachable"]
    
    try:
        res = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=timeout)
        if res.status_code == 200:
            raw_models = res.json().get("models", [])
            _ollama_reachable_cache["models"] = [m["name"] for m in raw_models]
            _ollama_reachable_cache["reachable"] = True
            _ollama_reachable_cache["last_check"] = now
            return True
    except Exception:
        pass

    _ollama_reachable_cache["reachable"] = False
    _ollama_reachable_cache["models"] = []
    _ollama_reachable_cache["last_check"] = now
    return False

def strip_thinking_tags(text: str) -> str:
    """Safely strip closed and unclosed <think>...</think> reasoning blocks from output."""
    if not text:
        return ""
    # Strip closed <think>...</think>
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE)
    # Strip unclosed <think>... at the end of output if truncated
    cleaned = re.sub(r'<think>[\s\S]*$', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()

def clean_repetitive_text(text: str) -> str:
    """Detect and remove consecutive repeated phrases in LLM output."""
    if not text:
        return ""
    # Remove obvious immediate duplicate sentences/phrases
    cleaned = text.strip()
    # Match repeating chunks (e.g. 'phrase phrase' or 'abc! abc!')
    pattern = r'(\b.+?\b[\s.!?]+)\1+'
    cleaned = re.sub(pattern, r'\1', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()

def call_ollama_chat_api(messages: List[Dict[str, str]], model: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 120, timeout: float = 6.0) -> Optional[str]:
    """First-class call to Ollama /api/chat with think: False and repeat_penalty for ultra-fast response."""
    if not is_ollama_online(timeout=0.5):
        return None

    target_model = model or settings.PRIMARY_LLM_MODEL
    url = f"{settings.OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": target_model,
        "messages": messages,
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": max_tokens,
            "repeat_penalty": 1.15,
            "num_ctx": 1024,
            "think": False
        }
    }
    try:
        res = requests.post(url, json=payload, timeout=timeout)
        if res.status_code == 200:
            content = res.json().get("message", {}).get("content", "").strip()
            cleaned = clean_repetitive_text(strip_thinking_tags(content))
            if cleaned:
                print(f"[Echo Ollama Chat] Generated with {target_model} (think=false)")
                return cleaned
    except Exception as e:
        print(f"[Echo Ollama Chat Error with {target_model}]: {e}")
    return None

def call_ollama_api(prompt: str, system_prompt: str = "", model: Optional[str] = None, temperature: float = 0.7, max_tokens: int = 120, timeout: float = 6.0) -> Optional[str]:
    """Call local Ollama with think: False (tries /api/chat first, falls back to /api/generate)."""
    if not is_ollama_online(timeout=0.5):
        return None

    target_model = model or settings.PRIMARY_LLM_MODEL

    # 1. First try native /api/chat
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    chat_res = call_ollama_chat_api(messages, model=target_model, temperature=temperature, max_tokens=max_tokens, timeout=timeout)
    if chat_res:
        return chat_res

    # 2. Fall back to /api/generate
    url = f"{settings.OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": target_model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": max_tokens,
            "repeat_penalty": 1.15,
            "num_ctx": 1024,
            "think": False
        }
    }
    try:
        res = requests.post(url, json=payload, timeout=timeout)
        if res.status_code == 200:
            content = res.json().get("response", "").strip()
            cleaned = clean_repetitive_text(strip_thinking_tags(content))
            if cleaned:
                print(f"[Echo Ollama Generate] Generated with {target_model} (think=false)")
                return cleaned
    except Exception as e:
        print(f"[Echo Ollama Generate Error with {target_model}]: {e}")

    return None

def call_nvidia_api(messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 150) -> Optional[str]:
    """Direct call to NVIDIA Cloud Llama API as fast fallback."""
    if not settings.NVIDIA_API_KEY:
        return None
    url = f"{settings.NVIDIA_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    models = [settings.NVIDIA_MODEL, "meta/llama-3.1-8b-instruct"]
    
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
            res = requests.post(url, headers=headers, json=payload, timeout=3.5)
            if res.status_code == 200:
                content = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if content:
                    return strip_thinking_tags(content)
        except Exception as e:
            print(f"[NVIDIA API Error with {m}]: {e}")
            break
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
    if not is_ollama_online(timeout=0.4):
        return None
    url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
    try:
        res = requests.post(url, json={"model": settings.EMBEDDING_MODEL, "prompt": text}, timeout=1.5)
        if res.status_code == 200:
            return res.json().get("embedding")
    except Exception:
        pass
    return None

def check_ollama_health() -> Dict[str, Any]:
    # 1. Check Local Ollama first (Priority for local laptop AI)
    try:
        if is_ollama_online(timeout=0.6):
            models = _ollama_reachable_cache.get("models", [])
            matched_model = find_best_model_match(settings.PRIMARY_LLM_MODEL, models)
            if not matched_model and models:
                non_embed = [m for m in models if "embed" not in m.lower()]
                matched_model = non_embed[0] if non_embed else models[0]
                
            active_model = matched_model or settings.PRIMARY_LLM_MODEL
            return {
                "status": "online",
                "models": models,
                "active_model": f"Ollama ({active_model})",
                "model_name": active_model,
                "has_llm": True,
                "has_embedding": any("embed" in m.lower() for m in models),
                "engine": "ollama_local"
            }
    except Exception:
        pass

    # 2. Check NVIDIA Cloud API fallback
    if settings.NVIDIA_API_KEY:
        try:
            r = requests.get(f"{settings.NVIDIA_BASE_URL}/models", headers={"Authorization": f"Bearer {settings.NVIDIA_API_KEY}"}, timeout=4)
            if r.status_code == 200:
                return {
                    "status": "online",
                    "models": [settings.NVIDIA_MODEL],
                    "active_model": settings.NVIDIA_MODEL,
                    "model_name": settings.NVIDIA_MODEL,
                    "has_llm": True,
                    "has_embedding": False,
                    "engine": "nvidia_cloud"
                }
        except Exception:
            pass

    # 3. Fallback to Own Mind NLP
    return {
        "status": "online",
        "models": ["own-mind-nlp"],
        "active_model": "Own Mind NLP (Corpus Memory)",
        "model_name": "own-mind-nlp",
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

def generate_tiered_llm_response(prompt: str, system_prompt: str = "", tier: str = "full", temperature: float = 0.7, max_tokens: int = 150, is_chat: bool = False) -> str:
    """Tries Local Ollama (llama3.2:1b with think: false) -> then secondary model (qwen3.5:4b) -> then NVIDIA Cloud API -> then falls back cleanly."""
    # 1. Try local primary Ollama model (e.g. llama3.2:1b)
    ollama_res = call_ollama_api(prompt, system_prompt=system_prompt, model=settings.PRIMARY_LLM_MODEL, temperature=temperature, max_tokens=max_tokens)
    if ollama_res:
        return clean_repetitive_text(ollama_res)

    # 1b. Try secondary Ollama model if primary failed and it's different
    if settings.FULL_LLM_MODEL and settings.FULL_LLM_MODEL != settings.PRIMARY_LLM_MODEL:
        ollama_res2 = call_ollama_api(prompt, system_prompt=system_prompt, model=settings.FULL_LLM_MODEL, temperature=temperature, max_tokens=max_tokens)
        if ollama_res2:
            return clean_repetitive_text(ollama_res2)

    # 2. Try NVIDIA Cloud Llama API as fallback
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    nvidia_res = call_nvidia_api(messages, temperature=temperature, max_tokens=max_tokens)
    if nvidia_res:
        return clean_repetitive_text(nvidia_res)

    # 3. Fallback depending on whether it's chat or suggestions
    if is_chat:
        return "I'm Echo, your smart messaging copilot! I'm here to help you draft messages, refine tone, or fix grammar. Let me know what you'd like to write."
    return '["sounds good! let\'s do that 👍", "let me check and ping you shortly", "haha awesome! 🔥"]'

def generate_llm_response(prompt: str, system_prompt: str = "", temperature: float = 0.7, max_tokens: int = 250, is_chat: bool = False) -> str:
    return generate_tiered_llm_response(prompt, system_prompt, tier="full", temperature=temperature, max_tokens=max_tokens, is_chat=is_chat)
