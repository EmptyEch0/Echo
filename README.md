# 🗣️ Echo — Your Personal AI Communication Copilot

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success)](https://developer.chrome.com/docs/extensions/mv3/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)
[![Ollama](https://img.shields.io/badge/Local%20LLM-Ollama%20(Llama%203.2)-FF6B6B.svg)](https://ollama.com/)

**Echo** is a smart, private AI assistant that helps you chat faster and better. It learns **your personal writing style** (your favorite emojis, greetings, sentence length, and tone) and suggests smart replies directly inside your messaging apps.

Instead of sounding like a robotic AI, **Echo sounds just like you!**

---

## 🌟 What is Echo & Why Use It?

When chatting with friends, colleagues, or clients, you often type similar replies or spend time fixing typos and rephrasing messages.

Generic AI tools sound stiff and unnatural. **Echo is different:**
- 🧠 **Learns How You Talk**: Automatically picks up your natural texting habits (e.g., if you prefer casual lowercase, specific emojis like 👍/🔥, or short greetings like "hey" or "yo").
- ⚡ **Instant Smart Suggestions**: Shows 3 natural reply choices right above your chat box as soon as a message arrives. Click one, and it enters the chat box instantly with zero text duplication.
- 🪟 **Foldable & Draggable**: Overlapping with chat elements? Drag the toolbar anywhere on your screen or hit **`⟨—⟩` (Alt+M)** to fold it into an ultra-compact floating bubble.
- 🪄 **Fix Grammar & Typos in 1 Click**: Got a messy sentence? Hit "Polish" to fix all grammar mistakes while keeping your authentic tone.
- 🔒 **100% Privacy-First**: Runs locally on your machine via Ollama and local SQLite vector storage.

---

## 📱 Supported Platforms

Echo works across popular desktop web apps:
- 💬 **WhatsApp Web**
- 📸 **Instagram Direct Messages**
- ✈️ **Telegram Web**
- 🎮 **Discord**
- 🐦 **X (formerly Twitter)**

---

## 🧠 Local Ollama Models Used in Echo

Echo connects directly to **Ollama** running locally on your computer for private, ultra-fast generation:

| Model | Size | Role & Why It's Used | Speed |
| :--- | :--- | :--- | :--- |
| **`llama3.2:1b`** | **1.3 GB** | **Primary Fast Generation Model** (Default). Generates smart contextual suggestions in under 500ms with zero lag on CPU or GPU. | ⚡ Ultra-Fast (<0.5s) |
| **`qwen3.5:4b`** / **`llama3.2:3b`** | **3.4 GB** | **Full Reasoning & Deep Chat Model**. Used for thread summarization ("Catch Me Up") and complex writing assistance. | 🧠 High Quality (~1.5s) |
| **`nomic-embed-text`** | **274 MB** | **Local Semantic Vector Memory**. Embeds past messages into SQLite to match your exact conversational style over time. | 🔍 Sub-50ms |

### 📥 1-Minute Ollama Setup

To run Echo completely locally:
```bash
# 1. Pull the lightning-fast 1B model (sub-second replies)
ollama pull llama3.2:1b

# 2. Pull the semantic embedding model for memory recall
ollama pull nomic-embed-text

# 3. (Optional) Pull the 4B reasoning model for long summaries
ollama pull qwen3.5:4b

# 4. Start the Ollama background daemon
ollama serve
```

---

## 🚀 Key Features & Controls

### 1. 💡 Smart In-Chat Reply Bar (Draggable & Foldable)
- **Freely Draggable**: Click & drag the brand grip `⠿ Echo` to move the toolbar anywhere on your screen.
- **1-Click Fold / Minimize (`Alt + M`)**: Shrink the bar into a compact glowing bubble when not in use. Click to unfold.
- **📌 Snap to Input (Dock)**: Click the pin button to instantly snap the bar back above your chat message box.
- **Zero-Duplicate Insertion**: Clean single-click insertion for Instagram, WhatsApp, Discord, Telegram, and X.
- **Alt+1 / Alt+2 / Alt+3**: Instantly insert suggestion #1, #2, or #3 without touching your mouse.
- **Alt+R**: Regenerate fresh ideas on the fly.

### 2. 🪄 Polish & Grammar Refiner (`Alt + P`)
Paste or select any draft message to polish:
- **Fix Grammar & Vocab**: Corrects typos, spelling errors, and awkward phrasing.
- **Professional**: Converts casual text into clear business language.
- **Short & Punchy**: Tightens long paragraphs into crisp messages.
- **Casual**: Makes text relaxed and friendly.
- **Elaborate**: Expands short bullet points into full sentences.

### 3. 📜 Catch Me Up — Thread Summarizer (`Alt + S`)
Summarizes up to 30 recent messages in active conversations into 3 clear bullets:
- 📌 Discussion Topic
- ❓ Questions & Action Items for You
- 🤝 Decisions & Next Steps

### 4. 💧 Glassmorphism Transparency Slider
Adjust glass opacity dynamically from **10% (crystal clear)** to **100% (solid frosted)** to blend with light or dark themes.

### 5. 👻 Ghost Mode & Tone Switcher
Switch between tones instantly with 1-click pills:
- **🔥 Casual**: Relaxed, friendly conversational style.
- **⚡ Concise**: Punchy, direct, minimal words.
- **💼 Formal**: Articulate business English.
- **😈 Gen-Z**: Modern internet slang (`fr`, `deadass`, `💀`, `🔥`).

---

## 🛠️ How Echo Works (3-Tier Engine)

Echo is built for 100% uptime:

1. **Tier 1 — Local Ollama + FastAPI + SQLite Vector Memory**:
   - `llama3.2:1b` + `nomic-embed-text`
   - Sub-second local responses with zero cloud dependency.
2. **Tier 2 — Direct Cloud LLM (Meta Llama 3.1 / 3.3 via NVIDIA API)**:
   - High-speed cloud fallback if Ollama daemon is offline.
3. **Tier 3 — "Own Mind" Offline Rule-Based NLP Engine**:
   - Built-in regex and template memory that works even without an LLM or internet.

---

## 📦 How to Install & Run

### Step 1: Clone Repository
```bash
git clone https://github.com/EmptyEch0/Echo.git
cd Echo
```

### Step 2: Build Chrome Extension
```bash
cd extension
npm install
npm run build
```
*(Produces the production bundle in `extension/dist`)*

### Step 3: Load in Chrome
1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the **`extension/dist`** folder.

### Step 4: Run the Local Python Backend
```bash
cd ../backend
pip install -r requirements.txt
python main.py
```
*(On Windows, you can also double-click `start_backend.bat`)*

---

## 📂 Project Structure

```
Echo/
├── backend/                  # Python FastAPI Backend
│   ├── config.py             # Config & Ollama model settings (llama3.2:1b / nomic-embed-text)
│   ├── main.py               # REST API endpoints
│   ├── database.py           # SQLite database for messages & persona
│   ├── style_engine.py       # Style extractor & prompt builder
│   ├── vector_store.py       # Semantic vector similarity search
│   ├── llm_client.py         # Ollama / NVIDIA LLM connector
│   └── requirements.txt      # Python dependencies
├── extension/                # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/       # Background service worker (Ollama direct + fallback)
│   │   ├── content/          # Foldable & draggable floating bar (content.css + whatsapp.ts)
│   │   ├── popup/            # Extension popup dashboard (React + Tailwind)
│   │   └── types/            # TypeScript type definitions
│   ├── manifest.json         # Chrome extension manifest
│   └── package.json          # Node dependencies
├── README.md                 # Project documentation
└── start_backend.bat         # 1-click Windows starter
```

---

## 🛡️ Privacy & Security

- **Your Data Stays Yours**: Your chat history, style preferences, and trained persona are saved locally in your browser storage and local database.
- **No Data Selling**: Echo does not track you or transmit your conversations to third parties.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
