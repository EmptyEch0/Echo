# Echo — Intelligent AI Communication Copilot

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success)](https://developer.chrome.com/docs/extensions/mv3/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)

**Echo** is an intelligent, privacy-first AI messaging copilot that learns your personal writing style and generates context-aware replies across **WhatsApp Web**, **Instagram Direct**, **Telegram Web**, **Discord**, and **X (Twitter)**.

---

## ✨ Features

- **Personalized Voice Learning**: Passively learns your sentence length, favorite emojis, preferred greetings, and casing habits.
- **Ultra-Glassmorphic In-Chat Floating Bar**: Seamlessly injected above the chat composer with 0-latency instant responses.
- **🪄 Polish & Fix Mistakes**: Instant modal to fix spelling, grammatical errors, and upgrade vocabulary with one click.
- **👻 Ghost Mode Tone Rewrite**: Rewrite drafts into `Casual`, `Gen-Z`, `Executive`, or `Emoji Heavy` styles.
- **🤖 Dedicated Copilot Drawer**: Floating assistant for live brainstorming, writing assistance, and quick persona seeding.
- **⚡ 3-Tier Resilient Architecture**:
  1. **Tier 1 (Local FastAPI + RAG)**: Local vector embeddings and SQLite memory.
  2. **Tier 2 (NVIDIA Cloud LLM)**: Direct Llama 3.1/3.3 inference for high-speed cloud replies.
  3. **Tier 3 (Own Mind NLP Engine)**: 100% offline rule-based and corpus fallback if offline.

---

## 📁 Repository Structure

```
.
├── backend/                  # FastAPI local backend & RAG engine
│   ├── main.py               # API endpoints
│   ├── config.py             # App configurations & model tiers
│   ├── database.py           # SQLite message storage & persona profiles
│   ├── style_engine.py       # Metrics analysis & prompt construction
│   ├── vector_store.py       # Cosine similarity vector search
│   ├── llm_client.py         # NVIDIA / Ollama client
│   ├── test_backend.py       # Integration tests
│   └── requirements.txt      # Python dependencies
├── extension/                # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/       # Service worker (NVIDIA + Own Mind NLP)
│   │   ├── content/          # Multi-platform content script & styling
│   │   ├── popup/            # React popup dashboard
│   │   └── types/            # TypeScript definitions
│   ├── manifest.json         # Extension manifest
│   ├── package.json          # Node dependencies
│   ├── tailwind.config.js    # Tailwind configuration
│   └── vite.config.ts        # Vite build & bundle configuration
└── start_backend.bat         # Quick start launcher for Windows
```

---

## 🚀 Quick Start

### 1. Build the Chrome Extension

```bash
cd extension
npm install
npm run build
```

This compiles all assets into `extension/dist`.

### 2. Load the Extension into Google Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** (top-right switch).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder.

### 3. (Optional) Run the Local Python Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```
*Or simply double-click `start_backend.bat` on Windows.*

---

## 🛠️ Tech Stack

- **Extension**: TypeScript, React 18, Vite, TailwindCSS, Lucide Icons, Chrome Extension Manifest V3
- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLite, NumPy, Pydantic
- **AI Models**: Meta Llama 3.1 / 3.2 / 3.3, Nomic Embed Text, Own Mind NLP Engine

---

## 🔒 Privacy

Echo is designed privacy-first. All learned persona parameters, style habits, and vector embeddings are stored locally on your device.
