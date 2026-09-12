// Echo Extension Background Service Worker (Ollama llama3.2:1b + FastAPI + NVIDIA Llama + Own Mind NLP)
console.log('🚀 [Echo Background] Service Worker initialized with Smart Persona Brain + Ollama (llama3.2:1b).');

const LOCAL_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.2:1b';

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_API_KEY = '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';
const NVIDIA_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.2-1b-instruct'
];
const LOCAL_BACKEND_URL = 'http://localhost:8000';

function cleanRepetitiveText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip duplicate phrases (e.g. repeated sentences)
  cleaned = cleaned.replace(/(\b.+?\b[\s.!?]+)\1+/gi, '$1').trim();
  return cleaned;
}

// High-speed In-Memory Suggestions Cache (45s TTL for sub-1ms tab switching)
interface CacheEntry {
  timestamp: number;
  data: any;
}
const suggestionsCache = new Map<string, CacheEntry>();

function getCachedSuggestion(key: string): any | null {
  const entry = suggestionsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > 45000) {
    suggestionsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSuggestion(key: string, data: any) {
  if (suggestionsCache.size > 80) {
    const oldestKey = suggestionsCache.keys().next().value;
    if (oldestKey) suggestionsCache.delete(oldestKey);
  }
  suggestionsCache.set(key, { timestamp: Date.now(), data });
}

// -------------------------------------------------------------
// 0. Sub-5ms Instant Response Templates
// -------------------------------------------------------------
const INSTANT_TEMPLATES: Record<string, string[]> = {
  'ok': ['sounds good!', 'got it 👍', 'kk cool'],
  'okay': ['sure thing', 'sounds good 👍', 'kk'],
  'k': ['sounds good 👍', 'got it', 'cool cool'],
  'thanks': ['anytime!', 'no problem at all!', 'you got it 👍'],
  'thank you': ['happy to help!', 'no problem at all', 'anytime!'],
  'thx': ['anytime 👍', 'no worries!', 'you got it!'],
  'where are you': ['on my way!', 'almost there!', 'just heading out now'],
  'are you free': ["yeah what's up?", 'busy right now, call in 10?', 'free in a bit!'],
  'you free': ["yeah what's up?", "in a bit, what's up?", 'free now!'],
  'good morning': ['gm! hope you have a great day', 'morning!', 'gm bro ☕'],
  'gm': ['gm! ☕', 'morning! how are you?', 'gm bro'],
  'goodnight': ['gn! sleep well', 'gn night!', 'catch ya tomorrow 👍'],
  'gn': ['gn! sleep well', 'night!', 'catch ya tomorrow'],
  'hahaha': ['lol right?! 😂', 'haha fr', 'dead 💀'],
  'haha': ['haha fr 😂', 'lol literally', 'haha awesome 🔥'],
  'lol': ['haha literally', 'fr fr 😂', 'lmao'],
  'lmao': ['fr 💀', 'literally haha 😂', 'lmao so true'],
  'sounds good': ['perfect! see ya then 👍', 'awesome!', 'deal! 🔥'],
  'see you': ['see ya! 👍', 'cya soon!', 'take care!']
};

function getInstantReply(incoming: string): any[] | null {
  const clean = incoming.toLowerCase().replace(/[,.!?]/g, '').trim();
  for (const [key, replies] of Object.entries(INSTANT_TEMPLATES)) {
    if (clean === key || clean.startsWith(`${key} `) || clean.endsWith(` ${key}`)) {
      return replies.map((r, i) => ({
        text: r,
        confidence: 'high',
        reason: i === 0 ? `Instant match for "${key}"` : 'Quick conversational variation'
      }));
    }
  }
  return null;
}

// -------------------------------------------------------------
// 1. API Communication Helpers
// -------------------------------------------------------------
async function callLocalBackend(endpoint: string, method = 'GET', body?: any, timeoutMs = 10000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${LOCAL_BACKEND_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Local backend offline or timed out; will fall back seamlessly
  }
  return null;
}

// Direct call to local Ollama (llama3.2:1b / qwen3.5:4b) with think: false
async function callOllamaLLM(prompt: string, systemPrompt = '', model = DEFAULT_OLLAMA_MODEL, temperature = 0.65, timeoutMs = 12000, maxTokens = 80): Promise<string | null> {
  // 1. Try native Ollama /api/chat first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(`${LOCAL_OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
        think: false,
        options: {
          temperature: temperature,
          top_p: 0.9,
          num_predict: maxTokens,
          repeat_penalty: 1.15,
          num_ctx: 1024,
          think: false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      let text = (data.message?.content || '').trim();
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
      text = cleanRepetitiveText(text);
      if (text) {
        console.log(`[Echo Ollama Chat Direct] Generated with ${model} (think=false):`, text);
        return text;
      }
    }
  } catch (err) {
    // Chat endpoint timed out or failed; try generate endpoint below
  }

  // 2. Fall back to /api/generate
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${LOCAL_OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        system: systemPrompt,
        stream: false,
        think: false,
        options: {
          temperature: temperature,
          top_p: 0.9,
          num_predict: maxTokens,
          repeat_penalty: 1.15,
          num_ctx: 1024,
          think: false,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      let text = (data.response || '').trim();
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/gi, '').trim();
      text = cleanRepetitiveText(text);
      if (text) {
        console.log(`[Echo Ollama Direct] Generated with ${model} (think=false):`, text);
        return text;
      }
    }
  } catch (err) {
    // Direct Ollama offline or timed out
  }
  return null;
}

// Check if Ollama is running and what models are available
async function checkDirectOllamaHealth(): Promise<{ isOnline: boolean; model: string; models: string[] } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${LOCAL_OLLAMA_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      const matched = models.find((m: string) => m.toLowerCase().includes('llama3.2:1b'))
        || models.find((m: string) => m.toLowerCase().includes('llama3.2'))
        || models.find((m: string) => m.toLowerCase().includes('qwen'))
        || models.find((m: string) => !m.toLowerCase().includes('embed'))
        || models[0] || DEFAULT_OLLAMA_MODEL;
      return { isOnline: true, model: matched, models };
    }
  } catch (e) {
    // Direct Ollama offline
  }
  return null;
}

// Direct NVIDIA Cloud LLM API Client fallback
async function callNvidiaLLM(messages: { role: string; content: string }[], temperature = 0.7, maxTokens = 200): Promise<string | null> {
  for (const model of NVIDIA_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          top_p: 0.9,
          max_tokens: maxTokens,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[Echo NVIDIA] Responded with model: ${model}`);
          return content;
        }
      }
    } catch (err) {
      // Failed with model
    }
  }
  return null;
}

// -------------------------------------------------------------
// 2. Chrome Local Storage Persona & Corpus Management
// -------------------------------------------------------------
interface StyleProfile {
  total_messages_learned: number;
  avg_sentence_length: number;
  top_emojis: { emoji: string; count: number }[];
  top_greetings: { greeting: string; count: number }[];
  punctuation_habits: Record<string, number>;
}

async function getStoredData<T>(key: string, defaultValue: T): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (res) => {
      resolve(res[key] !== undefined ? res[key] : defaultValue);
    });
  });
}

async function setStoredData(key: string, value: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

async function getProfile(): Promise<StyleProfile> {
  return await getStoredData<StyleProfile>('style_profile', {
    total_messages_learned: 12,
    avg_sentence_length: 7.5,
    top_emojis: [{ emoji: '👍', count: 8 }, { emoji: '🔥', count: 5 }, { emoji: '😂', count: 4 }],
    top_greetings: [{ greeting: 'hey', count: 10 }, { greeting: 'yo', count: 6 }],
    punctuation_habits: { lowercase_only: 6 }
  });
}

async function getLearnedMessages(): Promise<string[]> {
  return await getStoredData<string[]>('learned_messages', [
    'hey bro sounds good!',
    'sure let me check and ping you',
    'yeah sounds like a plan 🔥',
    'awesome see ya 👍',
    'haha nice one',
    'sounds good let us catch up tomorrow'
  ]);
}

// -------------------------------------------------------------
// 3. "Own Mind" NLP & Memory Corpus Reasoning Engine
//    (Runs when completely offline)
// -------------------------------------------------------------
function analyzeIntent(text: string): string {
  const t = text.toLowerCase().trim();
  if (/^(hi|hey|hello|yo|wassup|sup|good morning|good evening)\b/.test(t) || t === 'hey' || t === 'hi') {
    return 'greeting';
  }
  if (/\b(meet|meeting|call|catch up|zoom|hang out|when|free|available|time|schedule)\b/.test(t) || t.includes('?')) {
    return 'scheduling_question';
  }
  if (/\b(thanks|thank you|thx|appreciate|cheers)\b/.test(t)) {
    return 'gratitude';
  }
  if (/\b(ok|okay|cool|awesome|great|nice|perfect|done|sure|deal)\b/.test(t)) {
    return 'agreement';
  }
  if (/\b(did you|check|review|update|status|look at|see)\b/.test(t)) {
    return 'status_inquiry';
  }
  if (/\b(bye|cya|talk later|goodnight|gn|see you)\b/.test(t)) {
    return 'closing';
  }
  return 'general';
}

function findSimilarMemoryReplies(incoming: string, learned: string[]): string[] {
  const words = new Set(incoming.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const scored = learned.map(msg => {
    const msgWords = msg.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    let overlap = 0;
    for (const w of msgWords) {
      if (words.has(w)) overlap += 1;
    }
    return { msg, score: overlap };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).map(s => s.msg).slice(0, 2);
}

function generateOwnMindSuggestions(incoming: string, profile: StyleProfile, learned: string[], _contactName?: string, formality: string = 'casual'): any[] {
  const intent = analyzeIntent(incoming);
  const matchedPast = findSimilarMemoryReplies(incoming, learned);
  
  const topGreeting = profile.top_greetings?.[0]?.greeting || 'hey';
  const topEmoji = profile.top_emojis?.[0]?.emoji || '👍';
  const secondEmoji = profile.top_emojis?.[1]?.emoji || '🔥';
  const isLowercase = (profile.punctuation_habits?.lowercase_only || 0) > 3;

  const adapt = (str: string) => (isLowercase && formality !== 'formal') ? str.toLowerCase() : str;

  const options: { text: string; confidence: 'high' | 'medium' | 'learning'; reason: string }[] = [];

  if (formality === 'formal') {
    if (intent === 'greeting') {
      options.push({ text: `Hello! Hope you are having a productive day.`, confidence: 'high', reason: 'Formal professional greeting' });
      options.push({ text: `Good day! Thank you for reaching out.`, confidence: 'high', reason: 'Polite business greeting' });
      options.push({ text: `Greetings, how may I assist you today?`, confidence: 'medium', reason: 'Articulate professional opening' });
    } else if (intent === 'scheduling_question') {
      options.push({ text: `Yes, that proposed time works well for me.`, confidence: 'high', reason: 'Formal confirmation' });
      options.push({ text: `Let me consult my calendar and follow up shortly.`, confidence: 'high', reason: 'Professional coordination' });
      options.push({ text: `Could you please suggest an alternate time slot?`, confidence: 'medium', reason: 'Polite rescheduling request' });
    } else if (intent === 'gratitude') {
      options.push({ text: `You are very welcome, glad to assist.`, confidence: 'high', reason: 'Formal gratitude acknowledgement' });
      options.push({ text: `Happy to help anytime.`, confidence: 'high', reason: 'Professional closing' });
      options.push({ text: `Thank you as well for your collaboration.`, confidence: 'medium', reason: 'Business courtesy' });
    } else {
      options.push({ text: `Understood, let us proceed as discussed.`, confidence: 'high', reason: 'Formal agreement' });
      options.push({ text: `Thank you for the update, will review and reply soon.`, confidence: 'high', reason: 'Professional acknowledgement' });
      options.push({ text: `Sounds agreeable to me, thank you.`, confidence: 'medium', reason: 'Formal concurrence' });
    }
  } else if (formality === 'concise') {
    if (intent === 'greeting') {
      options.push({ text: `Hey! What's up?`, confidence: 'high', reason: 'Concise direct greeting' });
      options.push({ text: `Morning!`, confidence: 'high', reason: 'Short greeting' });
      options.push({ text: `Hey 👍`, confidence: 'medium', reason: 'Minimal greeting' });
    } else if (intent === 'scheduling_question') {
      options.push({ text: `Sounds good 👍`, confidence: 'high', reason: 'Punchy agreement' });
      options.push({ text: `Free then.`, confidence: 'high', reason: 'Direct confirmation' });
      options.push({ text: `Let's do it.`, confidence: 'medium', reason: 'Short scheduling' });
    } else if (intent === 'gratitude') {
      options.push({ text: `Anytime 👍`, confidence: 'high', reason: 'Short gratitude' });
      options.push({ text: `No problem.`, confidence: 'high', reason: 'Direct response' });
      options.push({ text: `You got it.`, confidence: 'medium', reason: 'Punchy response' });
    } else {
      options.push({ text: `Got it 👍`, confidence: 'high', reason: 'Punchy acknowledgement' });
      options.push({ text: `Will check shortly.`, confidence: 'high', reason: 'Direct update' });
      options.push({ text: `Sounds good.`, confidence: 'medium', reason: 'Concise agreement' });
    }
  } else if (formality === 'genz') {
    if (intent === 'greeting') {
      options.push({ text: `yooo wassup 💀`, confidence: 'high', reason: 'Gen-Z slang greeting' });
      options.push({ text: `hey bestie fr 🔥`, confidence: 'high', reason: 'Gen-Z warm opening' });
      options.push({ text: `yo valid`, confidence: 'medium', reason: 'Gen-Z casual greeting' });
    } else if (intent === 'scheduling_question') {
      options.push({ text: `bet let's do it 🔥`, confidence: 'high', reason: 'Gen-Z affirmative' });
      options.push({ text: `lowkey down for that`, confidence: 'high', reason: 'Gen-Z confirmation' });
      options.push({ text: `deadass free whenever 💀`, confidence: 'medium', reason: 'Gen-Z scheduling' });
    } else if (intent === 'gratitude') {
      options.push({ text: `anytime bestie 🫡`, confidence: 'high', reason: 'Gen-Z gratitude' });
      options.push({ text: `no cap anytime 🔥`, confidence: 'high', reason: 'Gen-Z response' });
      options.push({ text: `valid fr 💀`, confidence: 'medium', reason: 'Gen-Z acknowledgement' });
    } else {
      options.push({ text: `fr sounds good 🔥`, confidence: 'high', reason: 'Gen-Z agreement' });
      options.push({ text: `deadass haha 💀`, confidence: 'high', reason: 'Gen-Z reaction' });
      options.push({ text: `bet, on it rn`, confidence: 'medium', reason: 'Gen-Z confirmation' });
    }
  } else {
    // Casual
    if (matchedPast.length > 0) {
      options.push({
        text: adapt(matchedPast[0]),
        confidence: 'high',
        reason: `Matched learned memory corpus: "${matchedPast[0]}"`
      });
    }

    if (intent === 'greeting') {
      options.push({ text: adapt(`${topGreeting}! how's it going? ${topEmoji}`), confidence: 'high', reason: 'Own Mind NLP: Friendly greeting matching your persona' });
      options.push({ text: adapt(`yo! what's up?`), confidence: 'medium', reason: 'Own Mind NLP: Casual greeting' });
      options.push({ text: adapt(`hey there! hope all is well ${secondEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Warm greeting' });
    } else if (intent === 'scheduling_question') {
      options.push({ text: adapt(`yeah sounds good! let's do it ${topEmoji}`), confidence: 'high', reason: 'Own Mind NLP: Scheduling affirmation' });
      options.push({ text: adapt(`let me check my schedule and ping you in a bit`), confidence: 'medium', reason: 'Own Mind NLP: Thoughtful scheduling' });
      options.push({ text: adapt(`sure! what time works best for you?`), confidence: 'medium', reason: 'Own Mind NLP: Direct coordination' });
    } else if (intent === 'gratitude') {
      options.push({ text: adapt(`anytime! glad to help ${topEmoji}`), confidence: 'high', reason: 'Own Mind NLP: Natural gratitude response' });
      options.push({ text: adapt(`no worries at all!`), confidence: 'medium', reason: 'Own Mind NLP: Relaxed response' });
      options.push({ text: adapt(`you got it ${secondEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Upbeat response' });
    } else if (intent === 'status_inquiry') {
      options.push({ text: adapt(`yes, taking a look right now! ${topEmoji}`), confidence: 'high', reason: 'Own Mind NLP: Status acknowledgement' });
      options.push({ text: adapt(`on it, will update you shortly`), confidence: 'medium', reason: 'Own Mind NLP: Direct response' });
      options.push({ text: adapt(`checked it, looks great! ${secondEmoji}`), confidence: 'medium', reason: 'Positive confirmation' });
    } else {
      options.push({ text: adapt(`sounds good! let's do that ${topEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Style-adapted affirmation' });
      options.push({ text: adapt(`got it, let me get back to you soon`), confidence: 'medium', reason: 'Own Mind NLP: Context reply' });
      options.push({ text: adapt(`haha awesome ${secondEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Engaging continuation' });
    }
  }

  // Deduplicate and ensure exactly 3 distinct options
  const uniqueTexts = new Set<string>();
  const finalOptions: any[] = [];
  for (const o of options) {
    if (!uniqueTexts.has(o.text)) {
      uniqueTexts.add(o.text);
      finalOptions.push(o);
    }
    if (finalOptions.length >= 3) break;
  }

  return finalOptions;
}

// Rule-Based NLP Grammar & Vocabulary Refiner (Fallback when offline)
function ruleBasedRefine(text: string, action = 'fix_vocab'): { refined: string; explanation: string } {
  let cleaned = text.trim();

  const rules: [RegExp, string][] = [
    [/\bi is\b/gi, 'I am'],
    [/\bi wants\b/gi, 'I want'],
    [/\bi does\b/gi, 'I do'],
    [/\bi has\b/gi, 'I have'],
    [/\bhe are\b/gi, 'he is'],
    [/\bthey is\b/gi, 'they are'],
    [/\bwe is\b/gi, 'we are'],
    [/\bdiscus\b/gi, 'discuss'],
    [/\bdeatils\b/gi, 'details'],
    [/\bteh\b/gi, 'the'],
    [/\bwanna\b/gi, action === 'formal' ? 'would like to' : 'want to'],
    [/\bgonna\b/gi, action === 'formal' ? 'going to' : 'gonna'],
    [/\bu\b/gi, 'you'],
    [/\bur\b/gi, 'your'],
    [/\br\b/gi, 'are'],
    [/\bpls\b/gi, 'please'],
    [/\bthx\b/gi, 'thanks']
  ];

  for (const [pattern, replacement] of rules) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = cleaned.replace(/(^\s*|\.\s+)([a-z])/g, (_match, prefix, char) => prefix + char.toUpperCase());

  if (action === 'formal') {
    cleaned = cleaned.replace(/\bhey\b/gi, 'Hello').replace(/\byo\b/gi, 'Dear');
    if (!/[.!?]$/.test(cleaned)) cleaned += '.';
    return { refined: cleaned, explanation: "Own Mind NLP: Converted to professional tone with fixed grammar." };
  } else if (action === 'concise') {
    return { refined: cleaned, explanation: "Own Mind NLP: Shortened and tightened phrasing." };
  }

  if (!/[.!?]$/.test(cleaned)) cleaned += '.';
  return { refined: cleaned, explanation: "Own Mind NLP: Corrected grammatical agreement, spelling typos & vocabulary." };
}

// -------------------------------------------------------------
// 4. Message Request Handlers (Ollama qwen3.5:4b -> FastAPI -> NVIDIA -> Own Mind)
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action, payload } = message;

  // 1. GET_HEALTH
  if (action === 'GET_HEALTH') {
    (async () => {
      // 1. Try local FastAPI backend first
      const localHealth = await callLocalBackend('/api/health', 'GET', undefined, 1200);
      if (localHealth) {
        sendResponse({ success: true, data: localHealth });
        return;
      }

      // 2. Try direct Ollama connection (qwen3.5:4b on localhost:11434)
      const directOllama = await checkDirectOllamaHealth();
      const profile = await getProfile();

      if (directOllama && directOllama.isOnline) {
        sendResponse({
          success: true,
          data: {
            status: 'online',
            active_model: `Ollama (${directOllama.model})`,
            ollama: {
              status: 'online',
              active_model: directOllama.model,
              models: directOllama.models,
              has_llm: true,
              has_embedding: directOllama.models.some(m => m.includes('embed'))
            },
            total_messages_learned: profile.total_messages_learned
          }
        });
        return;
      }

      // 3. Fallback to direct NVIDIA & Chrome storage profile
      sendResponse({
        success: true,
        data: {
          status: 'online',
          active_model: 'Meta Llama (NVIDIA Cloud + Own Mind NLP)',
          ollama: {
            status: 'offline',
            active_model: 'None',
            has_llm: true,
            has_embedding: false
          },
          total_messages_learned: profile.total_messages_learned
        }
      });
    })();
    return true;
  }

  // 2. GET_PROFILE
  if (action === 'GET_PROFILE') {
    (async () => {
      const localProf = await callLocalBackend('/api/profile', 'GET', undefined, 1200);
      if (localProf) {
        sendResponse({ success: true, data: localProf });
        return;
      }

      const profile = await getProfile();
      sendResponse({ success: true, data: profile });
    })();
    return true;
  }

  // 3. SUGGEST_REPLIES (Cache -> Instant Templates -> Backend -> Direct Ollama -> NVIDIA -> Own Mind)
  if (action === 'SUGGEST_REPLIES') {
    (async () => {
      const incoming = (payload?.incoming_message || '').trim();
      const contactName = payload?.contact_name || '';
      const formality = (payload?.formality || 'casual').toLowerCase();
      const isRetry = payload?.is_retry || false;
      const history = payload?.conversation_history || [];
      const currentDraft = payload?.current_draft || '';

      if (!incoming) {
        sendResponse({ success: false, error: 'Empty message' });
        return;
      }

      const cacheKey = `${incoming.toLowerCase()}_${contactName}_${formality}_${currentDraft}_${isRetry}`;

      // 0a. Check In-Memory Cache (Sub-1ms fast path)
      if (!isRetry) {
        const cached = getCachedSuggestion(cacheKey);
        if (cached) {
          sendResponse({ success: true, data: cached });
          return;
        }
      }

      // 0b. Check Instant Response Templates only for casual/neutral
      if (!isRetry && !currentDraft && (formality === 'casual' || formality === 'neutral')) {
        const instantOptions = getInstantReply(incoming);
        if (instantOptions) {
          const resData = {
            incoming_message: incoming,
            suggestions: instantOptions
          };
          setCachedSuggestion(cacheKey, resData);
          sendResponse({ success: true, data: resData });
          return;
        }
      }

      // 1. Try Local FastAPI Backend with RAG vector search
      const localSuggest = await callLocalBackend('/api/suggest', 'POST', {
        incoming_message: incoming,
        contact_name: contactName,
        formality: formality,
        conversation_history: history,
        is_retry: isRetry,
        current_draft: currentDraft
      }, isRetry ? 12000 : 8000);

      if (localSuggest && localSuggest.suggestions && localSuggest.suggestions.length > 0) {
        setCachedSuggestion(cacheKey, localSuggest);
        sendResponse({
          success: true,
          data: localSuggest
        });
        return;
      }

      // 2. Prepare Context & Persona Prompts with Tone-Specific Instructions
      const profile = await getProfile();
      const learned = await getLearnedMessages();

      const historyText = history.map((m: any) => `${m.sender === 'me' ? 'You' : 'Contact'}: ${m.text}`).join('\n');
      const draftText = currentDraft ? `\nUser's rough draft in chatbox: "${currentDraft}" (Offer polished continuations or alternatives)` : '';

      const topEmoji = profile.top_emojis?.[0]?.emoji || '👍';
      const secondEmoji = profile.top_emojis?.[1]?.emoji || '🔥';
      const topGreeting = profile.top_greetings?.[0]?.greeting || 'hey';
      const lowercasePref = (profile.punctuation_habits?.lowercase_only || 0) > 3;

      let toneRule = "Tone: Casual, warm, relaxed conversational texting.";
      let maxWords = 8;
      if (formality === 'formal') {
        toneRule = "Tone: Professional, articulate, polite business English. Proper capitalization and formal phrasing.";
        maxWords = 14;
      } else if (formality === 'concise') {
        toneRule = "Tone: Ultra-concise, direct, punchy (2 to 5 words max). No filler words.";
        maxWords = 5;
      } else if (formality === 'genz') {
        toneRule = "Tone: Gen-Z slang, modern internet speak, lowercase, expressive emojis (fr, lol, deadass, bet, ngl, 💀, 🔥).";
        maxWords = 8;
      }

      // Extract real few-shot samples
      const sampleTexts = learned.slice(-5).map(m => ` - "${m}"`).join('\n');

      const systemPrompt = `You are Echo — an ultra-realistic, personalized messaging AI copilot.
${toneRule}
Task: Generate EXACTLY 3 distinct, high-quality reply suggestions to the incoming message matching this exact tone and personality.

User Natural Style Persona:
- Brevity: Short & punchy (~${maxWords} words max per reply).
- Preferred Greeting: "${topGreeting}"
- Favorite Emojis: ${topEmoji} ${secondEmoji}
- Lowercase preference: ${(lowercasePref && formality !== 'formal') ? 'Prefers casual lowercase' : 'Standard casing'}
${sampleTexts ? `\nReal Examples of how this user naturally messages:\n${sampleTexts}` : ''}

Strict Output Format:
Respond ONLY with a valid JSON array of 3 distinct string options:
["Option 1", "Option 2", "Option 3"]`;

      const userPrompt = `${historyText ? `Recent Chat Context:\n${historyText}\n\n` : ''}${draftText}
Incoming Message: "${incoming}"
${isRetry ? 'Generate 3 FRESH, distinct creative reply ideas.' : 'Generate 3 natural reply options.'}`;

      let suggestions: any[] = [];

      // 3. Direct Local Ollama (llama3.2:1b / qwen3.5:4b) with think: false
      const ollamaRaw = await callOllamaLLM(userPrompt, systemPrompt, DEFAULT_OLLAMA_MODEL, isRetry ? 0.75 : 0.65, 8000, 65);
      if (ollamaRaw) {
        try {
          const sIdx = ollamaRaw.indexOf('[');
          const eIdx = ollamaRaw.lastIndexOf(']');
          if (sIdx !== -1 && eIdx !== -1) {
            const parsed = JSON.parse(ollamaRaw.substring(sIdx, eIdx + 1));
            if (Array.isArray(parsed) && parsed.length > 0) {
              suggestions = parsed.slice(0, 3).map((txt, idx) => ({
                text: cleanRepetitiveText(String(txt).trim().replace(/^["']|["']$/g, '')),
                confidence: 'high',
                reason: `Ollama (${formality}): ${idx === 0 ? 'Direct reaction' : (idx === 1 ? 'Action continuation' : 'Tone matched')}`
              }));
            }
          }
        } catch (e) {
          console.warn('[Echo Ollama] JSON parse fallback:', e);
        }
      }

      // 4. Direct NVIDIA Cloud LLM Fallback
      if (!suggestions || suggestions.length === 0) {
        const raw = await callNvidiaLLM([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], isRetry ? 0.85 : 0.65, 90);

        if (raw) {
          try {
            const sIdx = raw.indexOf('[');
            const eIdx = raw.lastIndexOf(']');
            if (sIdx !== -1 && eIdx !== -1) {
              const parsed = JSON.parse(raw.substring(sIdx, eIdx + 1));
              if (Array.isArray(parsed) && parsed.length > 0) {
                suggestions = parsed.slice(0, 3).map((txt, idx) => ({
                  text: cleanRepetitiveText(String(txt).trim().replace(/^["']|["']$/g, '')),
                  confidence: 'high',
                  reason: `NVIDIA (${formality}): ${idx === 0 ? 'Direct reaction' : (isRetry ? 'Fresh creative variation' : 'Style suggestion')}`
                }));
              }
            }
          } catch (e) {
            console.warn('[Echo] JSON parse fallback:', e);
          }
        }
      }

      // 5. Fallback to Own Mind NLP Reasoning Engine
      if (!suggestions || suggestions.length === 0) {
        console.log('🧠 [Echo] Activating Own Mind NLP Reasoning Engine from memory corpus.');
        suggestions = generateOwnMindSuggestions(incoming, profile, learned, contactName);
      }

      const responseData = {
        incoming_message: incoming,
        suggestions
      };

      setCachedSuggestion(cacheKey, responseData);

      sendResponse({
        success: true,
        data: responseData
      });
    })();
    return true;
  }

  // 4. REFINE_VOCAB (Grammar, Typos, Vocabulary Polish with think: false)
  if (action === 'REFINE_VOCAB') {
    (async () => {
      const text = (payload?.text || '').trim();
      const reqAction = payload?.action || 'fix_vocab';

      // 1. Try Local Backend
      const localRefine = await callLocalBackend('/api/refine', 'POST', { text, action: reqAction }, 16000);
      if (localRefine && localRefine.refined) {
        sendResponse({ success: true, data: localRefine });
        return;
      }

      let instruction = 'Carefully fix all spelling errors, grammatical mistakes, and enhance vocabulary with natural fluency.';
      if (reqAction === 'formal') instruction = 'Rewrite this draft in a clear, polished, professional business tone.';
      if (reqAction === 'concise') instruction = 'Shorten and tighten this message to be direct and punchy without losing meaning.';
      if (reqAction === 'casual') instruction = 'Rewrite this draft in a friendly, relaxed conversational tone.';
      if (reqAction === 'expand') instruction = 'Elaborate this draft into a complete, well-written message.';

      const systemPrompt = `You are an expert writing and vocabulary editor. ${instruction}
Respond in this exact format:
REFINED:
<Write improved text here>
EXPLANATION:
<Write 1-sentence brief summary of corrections>`;

      const userPrompt = `Draft to polish:\n"""${text}"""`;

      // 2. Try Direct Local Ollama (qwen3.5:4b) with think: false
      let raw = await callOllamaLLM(userPrompt, systemPrompt, DEFAULT_OLLAMA_MODEL, 0.3, 16000, 250);

      // 3. Try Direct NVIDIA Cloud LLM fallback
      if (!raw) {
        raw = await callNvidiaLLM([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], 0.3, 220);
      }

      let refined = text;
      let explanation = 'Polished vocabulary & grammar.';

      if (raw && raw.includes('REFINED:')) {
        const parts = raw.split('REFINED:')[1].split('EXPLANATION:');
        refined = parts[0].trim();
        explanation = (parts[1] || '').trim() || 'Enhanced vocabulary & corrected grammar with Ollama (Qwen 3.5).';
      } else if (raw) {
        refined = raw.trim();
        explanation = 'Refined with Ollama (Qwen 3.5).';
      } else {
        // 4. Fallback to Own Mind NLP rule-based refiner
        const ownMind = ruleBasedRefine(text, reqAction);
        refined = ownMind.refined;
        explanation = ownMind.explanation;
      }

      sendResponse({
        success: true,
        data: {
          original: text,
          refined,
          explanation,
          action: reqAction
        }
      });
    })();
    return true;
  }

  // 5. CHAT_WITH_ECHO (AI Copilot chat)
  if (action === 'CHAT_WITH_ECHO') {
    (async () => {
      const msg = (payload?.message || '').trim();

      // 1. Try Local Backend
      const localChat = await callLocalBackend('/api/chat', 'POST', { message: msg }, 18000);
      if (localChat && localChat.reply) {
        sendResponse({ success: true, data: localChat });
        return;
      }

      const profile = await getProfile();
      const systemPrompt = `You are Echo, an intelligent writing companion and chat copilot powered by Ollama Qwen 3.5. Provide helpful, accurate, concise, and context-aware responses. Answer questions directly, help draft or polish messages, and offer smart communication ideas. Tone: ${profile.top_greetings?.[0]?.greeting || 'hey'}, ${profile.top_emojis?.map(e => e.emoji).join(' ')}.`;

      // 2. Try Direct Local Ollama (qwen3.5:4b) with think: false & num_predict: 300
      let reply = await callOllamaLLM(msg, systemPrompt, DEFAULT_OLLAMA_MODEL, 0.7, 18000, 300);

      // 3. Try Direct NVIDIA Cloud LLM
      if (!reply) {
        reply = await callNvidiaLLM([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: msg }
        ], 0.7, 280);
      }

      if (!reply) {
        reply = `👋 [Echo Copilot] I'm ready to help you draft, polish messages, or suggest smart replies. What would you like to write?`;
      }

      sendResponse({ success: true, data: { reply } });
    })();
    return true;
  }

  // 6. REWRITE_TEXT (Ghost Modes)
  if (action === 'REWRITE_TEXT') {
    (async () => {
      const text = (payload?.text || '').trim();
      const mode = payload?.ghost_mode || 'user';

      // 1. Try Local Backend
      const localRewrite = await callLocalBackend('/api/rewrite', 'POST', { text, ghost_mode: mode }, 16000);
      if (localRewrite && localRewrite.rewritten) {
        sendResponse({ success: true, data: localRewrite });
        return;
      }

      let prompt = `Rewrite this draft: "${text}"`;
      let system = `Rewrite in the user's natural personal style.`;
      if (mode === 'genz') system = `Rewrite in ultra-casual Gen-Z internet slang with lowercase and modern emojis (fr, deadass, lowkey, 💀, 🔥).`;
      if (mode === 'executive') system = `Rewrite in an executive, clear, professional business tone.`;
      if (mode === 'emoji_heavy') system = `Rewrite in an enthusiastic, warm tone with lots of vibrant, expressive emojis.`;

      // 2. Try Direct Local Ollama (qwen3.5:4b) with think: false
      let raw = await callOllamaLLM(prompt, system, DEFAULT_OLLAMA_MODEL, 0.7, 16000, 250);

      // 3. Try Direct NVIDIA Cloud LLM
      if (!raw) {
        raw = await callNvidiaLLM([
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ], 0.7, 250);
      }

      sendResponse({
        success: true,
        data: {
          original: text,
          rewritten: raw || ruleBasedRefine(text, mode === 'executive' ? 'formal' : 'casual').refined,
          mode
        }
      });
    })();
    return true;
  }

  // 7. LEARN_MESSAGE (Passive learning into memory corpus)
  if (action === 'LEARN_MESSAGE') {
    (async () => {
      const content = (payload?.content || '').trim();
      if (content.length > 2) {
        callLocalBackend('/api/learn', 'POST', {
          sender: 'user',
          content,
          platform: payload?.platform || 'whatsapp',
          weight: payload?.weight || 1.0,
          contact_id: payload?.contact_id || ''
        });

        const learned = await getLearnedMessages();
        learned.push(content);
        if (learned.length > 200) learned.shift();
        await setStoredData('learned_messages', learned);

        const profile = await getProfile();
        profile.total_messages_learned += 1;
        
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
        const matches = content.match(emojiRegex) || [];
        for (const e of matches) {
          const existing = profile.top_emojis.find(item => item.emoji === e);
          if (existing) existing.count += 1;
          else profile.top_emojis.push({ emoji: e, count: 1 });
        }
        profile.top_emojis.sort((a, b) => b.count - a.count);

        await setStoredData('style_profile', profile);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  // 8. SEED_MESSAGES
  if (action === 'SEED_MESSAGES') {
    (async () => {
      const messages = payload?.messages || [];
      const greetings = payload?.greetings || [];
      const emojis = payload?.favorite_emojis || [];
      const lowercasePref = payload?.lowercase_pref;

      callLocalBackend('/api/seed', 'POST', payload);

      const learned = await getLearnedMessages();
      for (const m of messages) {
        if (m.trim()) learned.push(m.trim());
      }
      await setStoredData('learned_messages', learned);

      const profile = await getProfile();
      profile.total_messages_learned += messages.length;

      if (greetings.length > 0) {
        profile.top_greetings = greetings.map((g: string) => ({ greeting: g, count: 10 }));
      }
      if (emojis.length > 0) {
        profile.top_emojis = emojis.map((e: string) => ({ emoji: e, count: 10 }));
      }
      if (lowercasePref !== undefined) {
        profile.punctuation_habits.lowercase_only = lowercasePref ? 15 : 0;
      }

      await setStoredData('style_profile', profile);
      sendResponse({ success: true, data: { added_count: messages.length } });
    })();
    return true;
  }

  // 9. RESET_PROFILE
  if (action === 'RESET_PROFILE') {
    (async () => {
      callLocalBackend('/api/reset', 'POST');

      await setStoredData('learned_messages', []);
      await setStoredData('style_profile', {
        total_messages_learned: 0,
        avg_sentence_length: 7.0,
        top_emojis: [],
        top_greetings: [{ greeting: 'hey', count: 1 }],
        punctuation_habits: {}
      });
      sendResponse({ success: true });
    })();
    return true;
  }

  // 10. EXPORT_PROFILE
  if (action === 'EXPORT_PROFILE') {
    (async () => {
      const localExport = await callLocalBackend('/api/profile/export', 'GET', undefined, 1500);
      if (localExport) {
        sendResponse({ success: true, data: localExport });
        return;
      }

      const profile = await getProfile();
      const learned = await getLearnedMessages();
      sendResponse({
        success: true,
        data: {
          profile,
          sample_messages: learned
        }
      });
    })();
    return true;
  }

  // 11. IMPORT_PROFILE
  if (action === 'IMPORT_PROFILE') {
    (async () => {
      const imported = payload;
      callLocalBackend('/api/profile/import', 'POST', imported);

      if (imported?.profile) await setStoredData('style_profile', imported.profile);
      if (imported?.sample_messages) await setStoredData('learned_messages', imported.sample_messages);
      sendResponse({ success: true, data: { imported_count: imported?.sample_messages?.length || 0 } });
    })();
    return true;
  }

  // 12. SUMMARIZE_THREAD (1-Click "Catch Me Up" for multi-turn messages)
  if (action === 'SUMMARIZE_THREAD') {
    (async () => {
      const messages = payload?.messages || [];
      const contactName = payload?.contact_name || '';

      if (!messages || messages.length === 0) {
        sendResponse({ success: false, error: 'No messages provided to summarize' });
        return;
      }

      // 1. Try Local Backend
      const localSum = await callLocalBackend('/api/summarize', 'POST', {
        messages,
        contact_name: contactName
      }, 18000);

      if (localSum && localSum.summary) {
        sendResponse({ success: true, data: localSum });
        return;
      }

      // 2. Direct Ollama / NVIDIA fallback
      const lines = messages.slice(-30).map((m: any) => `${m.sender === 'me' ? 'You' : 'Contact'}: ${m.text}`).join('\n');
      const systemPrompt = "You are Echo — an ultra-intelligent messaging analyst. Summarize conversation threads clearly, crisply, and accurately into 3 formatted sections.";
      const userPrompt = `Conversation Thread:
"""
${lines}
"""

Task: Provide an executive 3-section summary formatted with exact bullet points:
TOPIC:
• <1-2 bullet points on the core discussion>

ACTIONS & QUESTIONS FOR YOU:
• <1-2 bullet points listing questions asked to 'You' or tasks pending your response (or 'None')>

DECISIONS & NEXT STEPS:
• <1-2 bullet points on agreements, times, dates, or next actions>`;

      let raw = await callOllamaLLM(userPrompt, systemPrompt, DEFAULT_OLLAMA_MODEL, 0.3, 18000, 250);
      if (!raw) {
        raw = await callNvidiaLLM([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], 0.3, 250);
      }

      if (!raw) {
        // Fallback summary generator
        const total = messages.length;
        const lastMsg = messages[messages.length - 1]?.text || 'No recent message';
        raw = `TOPIC:\n• Ongoing conversation with ${contactName || 'contact'} (${total} recent messages).\n\nACTIONS & QUESTIONS FOR YOU:\n• Latest incoming message: "${lastMsg}".\n\nDECISIONS & NEXT STEPS:\n• Review above messages to reply or schedule next steps.`;
      }

      sendResponse({
        success: true,
        data: {
          summary: raw.trim(),
          total_messages_analyzed: messages.length,
          contact_name: contactName
        }
      });
    })();
    return true;
  }

  // 13. AUTOCOMPLETE_TEXT (Fast Ghost text prediction)
  if (action === 'AUTOCOMPLETE_TEXT') {
    (async () => {
      const prefix = (payload?.prefix || '').trim();
      const context = payload?.context || '';
      const contactName = payload?.contact_name || '';

      if (!prefix || prefix.length < 2) {
        sendResponse({ success: true, data: { completion: '' } });
        return;
      }

      // 1. Try Local Backend
      const localAuto = await callLocalBackend('/api/autocomplete', 'POST', {
        prefix,
        context,
        contact_name: contactName
      }, 3500);

      if (localAuto && localAuto.completion !== undefined) {
        sendResponse({ success: true, data: localAuto });
        return;
      }

      // 2. Direct fast Ollama fallback
      const systemPrompt = "You are an inline ghost text autocompletion engine. Predict ONLY the immediate remaining continuation of the user's unfinished sentence in 3 to 8 words. Return ONLY the continuation text.";
      const userPrompt = `${context ? `Context: ${context}\n` : ''}User typed: "${prefix}"\nContinuation:`;
      
      let comp = await callOllamaLLM(userPrompt, systemPrompt, DEFAULT_OLLAMA_MODEL, 0.4, 4000, 30);
      if (!comp) {
        // Simple rule fallback
        const pLower = prefix.toLowerCase();
        if (pLower.startsWith('sounds')) comp = 'good! let me check and get back to you';
        else if (pLower.startsWith('let me')) comp = 'know if you need any more details';
        else if (pLower.startsWith('thanks')) comp = 'for letting me know! 👍';
        else comp = '';
      }
      const cleaned = (comp || '').replace(/^["']|["']$/g, '').replace(new RegExp(`^${prefix}`, 'i'), '').trim();
      sendResponse({ success: true, data: { prefix, completion: cleaned } });
    })();
    return true;
  }

  // 14. TRANSLATE_TEXT (for /trans command)
  if (action === 'TRANSLATE_TEXT') {
    (async () => {
      const text = (payload?.text || '').trim();
      const targetLang = payload?.target_lang || 'English';

      const systemPrompt = `You are a professional translator. Translate the given text accurately and naturally into ${targetLang}. Return ONLY the translated text without notes.`;
      let raw = await callOllamaLLM(`Text to translate:\n"""${text}"""`, systemPrompt, DEFAULT_OLLAMA_MODEL, 0.3, 12000, 180);
      if (!raw) {
        raw = await callNvidiaLLM([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ], 0.3, 180);
      }
      sendResponse({
        success: true,
        data: {
          original: text,
          translated: raw?.trim() || text,
          target_lang: targetLang
        }
      });
    })();
    return true;
  }

  // 15. GET_CONTACT_TONE & SET_CONTACT_TONE
  if (action === 'GET_CONTACT_TONE') {
    (async () => {
      const contactId = payload?.contact_id || '';
      if (!contactId) {
        sendResponse({ success: true, data: { preferred_tone: 'casual' } });
        return;
      }
      const localTone = await callLocalBackend(`/api/contact_tone?contact_id=${encodeURIComponent(contactId)}`, 'GET', undefined, 1200);
      if (localTone) {
        sendResponse({ success: true, data: localTone });
        return;
      }

      const storedTones = await getStoredData<Record<string, any>>('contact_tones', {});
      const pref = storedTones[contactId] || { preferred_tone: 'casual', notes: '' };
      sendResponse({ success: true, data: pref });
    })();
    return true;
  }

  if (action === 'SET_CONTACT_TONE') {
    (async () => {
      const { contact_id, preferred_tone, notes } = payload || {};
      if (contact_id) {
        callLocalBackend('/api/contact_tone', 'POST', { contact_id, preferred_tone, notes });

        const storedTones = await getStoredData<Record<string, any>>('contact_tones', {});
        storedTones[contact_id] = { preferred_tone, notes: notes || '', updated_at: new Date().toISOString() };
        await setStoredData('contact_tones', storedTones);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  // 16. GET_SNIPPETS & SAVE_SNIPPET & DELETE_SNIPPET
  if (action === 'GET_SNIPPETS') {
    (async () => {
      const localSnippets = await callLocalBackend('/api/snippets', 'GET', undefined, 1200);
      if (localSnippets && Array.isArray(localSnippets)) {
        sendResponse({ success: true, data: localSnippets });
        return;
      }

      const defaultSnippets = [
        { shortcut: '/cal', content: "Here's my booking link: https://calendly.com/your-name/30min - feel free to pick a time!", description: "Meeting / Calendar Link" },
        { shortcut: '/meet', content: "Let's hop on Google Meet: https://meet.google.com/abc-defg-hij", description: "Google Meet Link" },
        { shortcut: '/loc', content: "My office address: 100 Innovation Blvd, Tech Park, Suite 400", description: "Office Location Address" },
        { shortcut: '/bank', content: "Payment Details - UPI ID: user@upi | Bank A/C: 1234567890 (IFSC: HDFC0001234)", description: "Payment / Bank Info" },
        { shortcut: '/phone', content: "You can reach me directly at: +1 (555) 019-2834", description: "Phone Number" }
      ];

      const storedSnippets = await getStoredData<any[]>('custom_snippets', defaultSnippets);
      sendResponse({ success: true, data: storedSnippets });
    })();
    return true;
  }

  if (action === 'SAVE_SNIPPET') {
    (async () => {
      const { shortcut, content, description } = payload || {};
      if (shortcut && content) {
        callLocalBackend('/api/snippets', 'POST', { shortcut, content, description });

        const storedSnippets = await getStoredData<any[]>('custom_snippets', []);
        const idx = storedSnippets.findIndex(s => s.shortcut.toLowerCase() === shortcut.toLowerCase());
        if (idx !== -1) {
          storedSnippets[idx] = { shortcut, content, description };
        } else {
          storedSnippets.push({ shortcut, content, description });
        }
        await setStoredData('custom_snippets', storedSnippets);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  if (action === 'DELETE_SNIPPET') {
    (async () => {
      const { shortcut } = payload || {};
      if (shortcut) {
        callLocalBackend(`/api/snippets?shortcut=${encodeURIComponent(shortcut)}`, 'DELETE');

        let storedSnippets = await getStoredData<any[]>('custom_snippets', []);
        storedSnippets = storedSnippets.filter(s => s.shortcut.toLowerCase() !== shortcut.toLowerCase());
        await setStoredData('custom_snippets', storedSnippets);
      }
      sendResponse({ success: true });
    })();
    return true;
  }
});
