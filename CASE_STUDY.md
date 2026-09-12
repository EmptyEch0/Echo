# Echo — AI Communication Copilot
**Persona Case Study • Chrome Extension (Manifest V3) • Local LLMs (Ollama) & Privacy-First Vector Memory**

**Echo** is an intelligent browser extension (an AI communication copilot) that integrates directly into your web messaging apps. It learns your personal writing style (favorite greetings, emojis, sentence length, and vocabulary) and suggests instant, authentic replies right above your chat box — eliminating the stiff, robotic tone typical of standard AI chatbots.

---

## 1. The Problem: Why Standard AI Fails in Messaging

Most people communicating across personal, professional, and team channels face four critical frictions:

1. **The "Robotic AI" Syndrome**: Standard cloud chatbots generate verbose, overly formal paragraphs (*"I hope this message finds you well..."*) that sound completely unnatural in instant messaging.
2. **Context Switching & Latency Friction**: Copy-pasting conversation threads between messaging apps and ChatGPT browser tabs breaks chat flow and takes more time than typing manually.
3. **Privacy & Corporate Data Leakage**: Sending confidential work chats or personal conversations to third-party cloud servers introduces significant privacy and compliance risks.
4. **Layout Obstruction & Editor Incompatibilities**: Standard browser extensions frequently overlap chat buttons or cause duplicate text insertions inside modern React/Lexical/Slate messaging editors.

---

## 2. Supported Messaging Platforms

Echo runs natively inside Google Chrome and Chromium browsers, injecting a floating, non-intrusive frosted glassmorphic dock directly into:

- 💬 **WhatsApp Web** (`web.whatsapp.com`)
- 📸 **Instagram Direct Messages** (`instagram.com/direct`)
- ✈️ **Telegram Web** (`web.telegram.org`)
- 🎮 **Discord Web** (`discord.com/app`)
- 🐦 **X (Twitter) DMs** (`x.com/messages`)

---

## 3. Key Features & Capabilities

### ⚡ 1-Click Smart Replies (<500ms Latency)
When messages arrive, Echo parses multi-turn dialogue context and generates 3 natural reply choices. Clicking an option or pressing **`Alt + 1 / 2 / 3`** instantly inserts it into the chat input box with **zero duplicate text repetitions**.

### 🪟 Foldable & Freely Draggable Floating Toolbar
- **1-Click Fold / Minimize (`Alt + M`)**: Shrinks the entire toolbar into an ultra-compact floating bubble `[⚡ Echo]` so it never blocks chat history or media controls.
- **Freely Draggable Anywhere**: Click and drag the `⠿ Echo` handle to reposition the toolbar anywhere on your screen. Custom coordinates are persisted across page reloads.
- **📌 Snap to Input (Dock)**: One-click button to snap the toolbar right back above the chat input.

### 🧠 Local AI-First Intelligence (Ollama `llama3.2:1b` & `qwen3.5:4b`)
- **Primary Model (`llama3.2:1b`)**: Generates contextual suggestions in under 500ms on standard laptop CPU/GPU hardware.
- **Reasoning Model (`qwen3.5:4b`)**: Handles complex threads, long-form drafting, and executive summarization.
- **Local Embeddings (`nomic-embed-text`)**: Embeds sent messages into SQLite vector storage to recall your real past replies.

### 🪄 1-Click Draft Polisher & Grammar Refiner (`Alt + P`)
Quickly draft messy thoughts with typos and refine them into 5 distinct communication styles:
- **Fix Grammar & Vocab**: Corrects spelling, grammar, and phrasing while preserving your natural voice.
- **Professional**: Converts casual text into crisp, articulate business English.
- **Short & Punchy**: Tightens long paragraphs into direct, concise messages.
- **Casual**: Relaxes tone for peer groups and friends.
- **Elaborate**: Expands short bullet points into complete, well-formed thoughts.

### 📜 "Catch Me Up" — Thread Summarizer (`Alt + S`)
Summarizes up to 30 recent messages in active conversations into 3 clear, actionable sections:
1. 📌 **Discussion Topic**
2. ❓ **Questions & Actions for You**
3. 🤝 **Decisions & Next Steps**

### 🎙️ Voice-to-Text with AI Polish
Real-time voice dictation with automatic filler word removal ("um", "like", "you know") and grammar polishing before insertion.

### 💧 Dynamic Glassmorphism Transparency
Interactive in-bar slider allowing users to adjust glass opacity from **10% (crystal clear)** to **100% (solid frosted)** to blend seamlessly with dark and light web themes.

### 🎭 Contact-Specific Relationship Memory
Learns individual relationship preferences (e.g. casual tone for friends, formal for managers) and automatically switches tones when switching chat threads.

### 🛡️ 3-Tier Resilient Architecture
1. **Tier 1 (Local Ollama + SQLite Vector Memory)**: Sub-second local inference with 100% data privacy.
2. **Tier 2 (Direct NVIDIA NIM Cloud API)**: High-speed cloud fallback if local daemon is offline.
3. **Tier 3 ("Own Mind" NLP Engine)**: Rule-based template & memory reasoning that functions completely offline without internet or an LLM.

---

## 4. Technical Architecture & Stack

| Layer | Technologies & Implementations |
| :--- | :--- |
| **Frontend / Extension UI** | Chrome Extensions (Manifest V3), TypeScript, React 18, Vite, Tailwind CSS, Custom Frosted Glassmorphic CSS System, MutationObserver DOM lifecycle. |
| **Local AI & Backend** | Python 3.11, FastAPI, Uvicorn, SQLite Vector Store (Cosine Similarity Search), Local Ollama Client (`llama3.2:1b`, `qwen3.5:4b`, `nomic-embed-text`). |
| **Cloud & Offline Resilience** | NVIDIA NIM API (Llama 3.1 / 3.3), In-Memory Cache (45s TTL), Chrome Storage Local Persona Sync, "Own Mind" Rule-Based NLP Engine. |
| **Editor Integration** | Multi-platform DOM adapter supporting React, Lexical, Slate, Draft.js, contenteditable, and textarea inputs with zero duplication. |

---

## 5. Summary in 30 Seconds

> *"Echo is an AI communication copilot for messaging platforms like WhatsApp and Instagram. Instead of producing generic, robotic paragraphs, it runs ultra-fast local LLMs (Llama 3.2 via Ollama) and learns your authentic writing style to provide 3 instant reply options directly above your chat box. It includes a draggable and foldable floating toolbar, fixes typos in 1 click, summarizes long threads, and keeps all personal messages 100% private on your machine."*

---

[← Back to Projects](http://localhost:3000/projects)
