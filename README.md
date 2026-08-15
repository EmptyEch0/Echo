# 🗣️ Echo — Your Personal AI Communication Copilot

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success)](https://developer.chrome.com/docs/extensions/mv3/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg)](https://reactjs.org/)

**Echo** is a smart, private AI assistant that helps you chat faster and better. It learns **your personal writing style** (your favorite emojis, greetings, sentence length, and tone) and suggests smart replies directly inside your messaging apps.

Instead of sounding like a robotic AI, **Echo sounds just like you!**

---

## 🌟 What is Echo & Why Use It?

When chatting with friends, colleagues, or clients, you often type similar replies or spend time fixing typos and rephrasing messages.

Generic AI tools sound stiff and unnatural. **Echo is different:**
- 🧠 **Learns How You Talk**: Automatically picks up your natural texting habits (e.g., if you prefer casual lowercase, specific emojis like 👍/🔥, or short greetings like "hey" or "yo").
- ⚡ **Instant Smart Suggestions**: Shows 3 natural reply choices right above your chat box as soon as a message arrives. Click one, and it enters the chat box instantly.
- 🪄 **Fix Grammar & Typos in 1 Click**: Got a messy sentence? Hit "Polish" to fix all grammar mistakes while keeping your authentic tone.
- 🔒 **100% Privacy-First**: Your messages and persona stay on your computer.

---

## 📱 Supported Platforms

Echo works across popular desktop web apps:
- 💬 **WhatsApp Web**
- 📸 **Instagram Direct Messages**
- ✈️ **Telegram Web**
- 🎮 **Discord**
- 🐦 **X (formerly Twitter)**

---

## 🚀 Key Features

### 1. 💡 Smart In-Chat Reply Bar
A clean, floating glass bar appears right above your message box:
- Generates 3 unique replies for the current conversation.
- Gives you confidence scores and reasons (e.g., *"Matched your past reply"* or *"Friendly greeting style"*).
- Includes a **🔄 Refresh** button to generate fresh ideas on the fly.

### 2. 🪄 Polish & Grammar Refiner
Paste or select any draft message to polish:
- **Fix Grammar & Vocab**: Corrects typos, spelling errors, and awkward phrasing.
- **Professional**: Converts casual text into clear business language.
- **Short & Punchy**: Tightens long paragraphs into crisp messages.
- **Casual**: Makes text relaxed and friendly.
- **Elaborate**: Expands short bullet points into full sentences.

### 3. 👻 Ghost Mode (Tone Switcher)
Want to change how you sound? Rewrite any text in 4 modes:
- **My Style**: Matches your personal voice.
- **Gen-Z Slang**: Casual internet slang with modern emojis (`fr`, `deadass`, `💀`, `🔥`).
- **Executive**: Clear, polite, and professional tone.
- **Emoji Heavy**: Enthusiastic and warm with expressive emojis.

### 4. ⚡ Quick Persona Setup Quiz
Don't want to wait for Echo to learn over time? Take a 30-second quiz in the popup to set your favorite greeting, default emojis, and casing style immediately.

### 5. 🤖 Floating Copilot Drawer & Chatbot
Open the built-in AI assistant anywhere in your chat to brainstorm ideas, ask for advice, or draft important emails.

---

## 🛠️ How Echo Works (3-Tier Engine)

Echo is built to always work, whether you run a local backend or not:

1. **Tier 1 — Local Backend (FastAPI + SQLite + Vector Memory)**:
   Uses vector embeddings to find similar things you said in the past and matches your exact style.
2. **Tier 2 — Direct Cloud LLM (Meta Llama 3.1 & 3.3)**:
   Connects directly to high-speed Llama models for instant intelligence with zero setup.
3. **Tier 3 — "Own Mind" Offline NLP Engine**:
   Even if the internet drops, Echo has a built-in rule-based NLP engine that keeps giving you smart suggestions offline.

---

## 📦 How to Install & Run in 3 Steps

### Step 1: Clone the Repository
```bash
git clone https://github.com/EmptyEch0/Echo.git
cd Echo
```

### Step 2: Build the Extension
```bash
cd extension
npm install
npm run build
```
*(This creates a `dist` folder inside `extension`)*

### Step 3: Load into Google Chrome
1. Open Google Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the **`extension/dist`** folder.

🎉 **Done!** Open WhatsApp Web or Instagram and start chatting with Echo!

---

### (Optional) Run the Local Python Backend
To enable local SQLite memory and local vector search:
```bash
cd backend
pip install -r requirements.txt
python main.py
```
*(On Windows, you can also just double-click `start_backend.bat`)*

---

## 📂 Project Structure

```
Echo/
├── backend/                  # Python FastAPI Backend
│   ├── main.py               # All API routes & endpoints
│   ├── database.py           # SQLite database for messages & persona
│   ├── style_engine.py       # Style extractor & prompt builder
│   ├── vector_store.py       # Semantic vector similarity search
│   ├── llm_client.py         # LLM connector (NVIDIA / Ollama)
│   └── requirements.txt      # Python dependencies
├── extension/                # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/       # Background service worker (Llama + Own Mind)
│   │   ├── content/          # Multi-platform floating bar & content script
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
- **No Data Selling**: Echo does not track you or sell your data.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
