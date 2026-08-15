import time
import requests
import json
import os
import sys

# Configure UTF-8 for Windows console output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import settings

def benchmark_ollama():
    print("=" * 60)
    print("⚡ ECHO LOCAL MODEL LATENCY BENCHMARK")
    print(f"Ollama Base URL: {settings.OLLAMA_BASE_URL}")
    print("=" * 60)

    # 1. Test Ollama Reachability & List Models
    try:
        r = requests.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=5)
        if r.status_code != 200:
            print("❌ Ollama server returned status:", r.status_code)
            return
        installed_models = [m["name"] for m in r.json().get("models", [])]
        print(f"✅ Ollama Online. Installed Models: {installed_models}\n")
    except Exception as e:
        print("❌ Failed to reach Ollama at", settings.OLLAMA_BASE_URL, ":", e)
        print("Please start Ollama service (`ollama serve`) and try again.")
        return

    # 2. Benchmark Embedding Model (nomic-embed-text)
    embed_model = settings.EMBEDDING_MODEL
    print(f"--- 🔍 1. Benchmarking Embedding Model: '{embed_model}' ---")
    sample_text = "Are we still meeting today at 5pm to review the project status?"
    start_t = time.time()
    try:
        res = requests.post(f"{settings.OLLAMA_BASE_URL}/api/embeddings", json={
            "model": embed_model,
            "prompt": sample_text
        }, timeout=10)
        dur_ms = round((time.time() - start_t) * 1000, 2)
        if res.status_code == 200 and res.json().get("embedding"):
            emb_len = len(res.json()["embedding"])
            print(f"  [SUCCESS] Embedding Vector Dim: {emb_len} | Latency: {dur_ms} ms")
        else:
            print(f"  [WARNING] Status {res.status_code} — {res.text}")
    except Exception as e:
        print(f"  [ERROR]: {e}")

    # 3. Benchmark Triage / Fast Tier Model (llama3.2:1b)
    triage_model = settings.TRIAGE_MODEL
    print(f"\n--- ⚡ 2. Benchmarking Triage / Fast Tier Model: '{triage_model}' ---")
    triage_prompt = 'Incoming Chat Message: "hey bro are you free?"\nDoes this chat message require or benefit from a personal reply? Respond ONLY with YES or NO.'
    start_t = time.time()
    try:
        res = requests.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json={
            "model": triage_model,
            "prompt": triage_prompt,
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": 5}
        }, timeout=10)
        dur_ms = round((time.time() - start_t) * 1000, 2)
        if res.status_code == 200:
            resp_txt = res.json().get("response", "").strip()
            print(f"  [SUCCESS] Triage Output: '{resp_txt}' | Latency: {dur_ms} ms")
        else:
            print(f"  [WARNING] Status {res.status_code} — {res.text}")
    except Exception as e:
        print(f"  [ERROR]: {e}")

    # 4. Benchmark Full Tier Model (qwen3.5:4b)
    full_model = settings.FULL_LLM_MODEL
    print(f"\n--- 🧠 3. Benchmarking Full Tier Generation Model: '{full_model}' ---")
    persona_prompt = """
You are acting as an AI clone of the user's natural personal messaging style.
- Target Average Sentence Length: ~8 words.
- Preferred Greetings: hey, yo.
- Favorite Emojis: 👍 🔥.
- Style Trait: Prefers informal lowercase typing.

Incoming Message: "Are we still meeting today at 5?"
Task: Generate EXACTLY 3 distinct reply suggestions as a JSON array of 3 strings.
"""
    start_t = time.time()
    try:
        res = requests.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json={
            "model": full_model,
            "prompt": persona_prompt,
            "stream": False,
            "options": {"temperature": 0.7, "top_p": 0.9}
        }, timeout=60)
        dur_ms = round((time.time() - start_t) * 1000, 2)
        if res.status_code == 200:
            resp_txt = res.json().get("response", "").strip()
            eval_count = res.json().get("eval_count", 0)
            eval_dur = res.json().get("eval_duration", 1) / 1e9
            tok_per_sec = round(eval_count / max(0.001, eval_dur), 2)
            print(f"  [SUCCESS] Output: {resp_txt[:60]}...")
            print(f"  [METRICS] Total Latency: {dur_ms} ms | Throughput: {tok_per_sec} tokens/sec")
        else:
            print(f"  [WARNING] Status {res.status_code} — {res.text}")
    except Exception as e:
        print(f"  [ERROR]: {e}")

    print("\n" + "=" * 60)
    print("✨ BENCHMARK COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    benchmark_ollama()
