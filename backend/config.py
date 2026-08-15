import os
from pydantic import BaseModel

class Settings(BaseModel):
    NVIDIA_BASE_URL: str = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "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")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    TRIAGE_MODEL: str = os.getenv("TRIAGE_MODEL", "llama3.2")
    FAST_LLM_MODEL: str = os.getenv("FAST_LLM_MODEL", "llama3.2")
    PRIMARY_LLM_MODEL: str = os.getenv("PRIMARY_LLM_MODEL", "meta/llama-3.1-8b-instruct")
    FULL_LLM_MODEL: str = os.getenv("FULL_LLM_MODEL", "meta/llama-3.1-8b-instruct")
    FALLBACK_LLM_MODEL: str = os.getenv("FALLBACK_LLM_MODEL", "llama3.2")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
    DB_PATH: str = os.getenv("DB_PATH", "echo_data.db")
    PORT: int = int(os.getenv("PORT", 8000))

settings = Settings()
