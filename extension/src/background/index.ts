// Echo Extension Background Service Worker (NVIDIA Llama API + Built-in "Own Mind" NLP Memory Engine)
console.log('🚀 [Echo Background] Service Worker initialized with NVIDIA Llama + Own Mind NLP.');

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_API_KEY = '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';
const NVIDIA_MODELS = [
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.2-1b-instruct'
];
const LOCAL_BACKEND_URL = 'http://localhost:8000';

async function callLocalBackend(endpoint: string, method = 'GET', body?: any, timeoutMs = 2500): Promise<any | null> {
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

interface StyleProfile {
  total_messages_learned: number;
  avg_sentence_length: number;
  top_emojis: { emoji: string; count: number }[];
  top_greetings: { greeting: string; count: number }[];
  punctuation_habits: Record<string, number>;
}

// -------------------------------------------------------------
// 1. Chrome Local Storage Persona & Corpus Management
// -------------------------------------------------------------
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
// 2. Direct NVIDIA Cloud LLM API Client
// -------------------------------------------------------------
async function callNvidiaLLM(messages: { role: string; content: string }[], temperature = 0.7, maxTokens = 250): Promise<string | null> {
  for (const model of NVIDIA_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

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
      } else {
        console.warn(`[Echo NVIDIA] ${model} returned status:`, res.status);
      }
    } catch (err) {
      console.warn(`[Echo NVIDIA] Failed with ${model}:`, err);
    }
  }
  return null;
}

// -------------------------------------------------------------
// 3. "Own Mind" NLP & Memory Corpus Reasoning Engine
//    (Runs when offline / LLM downtime occurs)
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

function generateOwnMindSuggestions(incoming: string, profile: StyleProfile, learned: string[], contactName?: string): any[] {
  const intent = analyzeIntent(incoming);
  const matchedPast = findSimilarMemoryReplies(incoming, learned);
  
  const topGreeting = profile.top_greetings?.[0]?.greeting || 'hey';
  const topEmoji = profile.top_emojis?.[0]?.emoji || '👍';
  const secondEmoji = profile.top_emojis?.[1]?.emoji || '🔥';
  const isLowercase = (profile.punctuation_habits?.lowercase_only || 0) > 3;

  const adapt = (str: string) => isLowercase ? str.toLowerCase() : str;

  const options: { text: string; confidence: 'high' | 'medium' | 'learning'; reason: string }[] = [];

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
    options.push({ text: adapt(`checked it, looks great! ${secondEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Positive confirmation' });
  } else {
    options.push({ text: adapt(`sounds good! let's do that ${topEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Style-adapted affirmation' });
    options.push({ text: adapt(`got it, let me get back to you soon`), confidence: 'medium', reason: 'Own Mind NLP: Context reply' });
    options.push({ text: adapt(`haha awesome ${secondEmoji}`), confidence: 'medium', reason: 'Own Mind NLP: Engaging continuation' });
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

  // Common grammar & vocabulary corrections
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

  // Capitalize sentence beginnings
  cleaned = cleaned.replace(/(^\s*|\.\s+)([a-z])/g, (match, prefix, char) => prefix + char.toUpperCase());

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
// 4. Message Request Handlers (Local Backend + Direct NVIDIA API + Own Mind)
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

      // 2. Fallback to direct NVIDIA & Chrome storage profile
      const profile = await getProfile();
      sendResponse({
        success: true,
        data: {
          status: 'online',
          active_model: 'Llama 3.1 8B (NVIDIA Cloud + Own Mind NLP)',
          ollama: {
            status: 'online',
            active_model: 'Llama 3.1 8B',
            has_llm: true,
            has_embedding: true
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
      // 1. Try local backend
      const localProf = await callLocalBackend('/api/profile', 'GET', undefined, 1200);
      if (localProf) {
        sendResponse({ success: true, data: localProf });
        return;
      }

      // 2. Fallback to Chrome local storage
      const profile = await getProfile();
      sendResponse({ success: true, data: profile });
    })();
    return true;
  }

  // 3. SUGGEST_REPLIES (Local Backend RAG -> NVIDIA Llama -> Own Mind Memory fallback)
  if (action === 'SUGGEST_REPLIES') {
    (async () => {
      const incoming = (payload?.incoming_message || '').trim();
      const contactName = payload?.contact_name || '';
      const isRetry = payload?.is_retry || false;
      const history = payload?.conversation_history || [];
      const currentDraft = payload?.current_draft || '';

      // 1. Try Local Backend with RAG vector search and instant templates
      const localSuggest = await callLocalBackend('/api/suggest', 'POST', {
        incoming_message: incoming,
        contact_name: contactName,
        conversation_history: history,
        is_retry: isRetry,
        current_draft: currentDraft
      }, isRetry ? 6000 : 4000);

      if (localSuggest && localSuggest.suggestions && localSuggest.suggestions.length > 0) {
        sendResponse({
          success: true,
          data: localSuggest
        });
        return;
      }

      // 2. Direct NVIDIA Cloud LLM Fallback
      const profile = await getProfile();
      const learned = await getLearnedMessages();

      const historyText = history.map((m: any) => `${m.sender === 'me' ? 'You' : 'Contact'}: ${m.text}`).join('\n');
      const draftText = currentDraft ? `\nUser draft in input: "${currentDraft}"` : '';

      const systemPrompt = `You are Echo, a personalized messaging copilot.
User's natural style:
- Average sentence length: ${profile.avg_sentence_length} words
- Favorite emojis: ${profile.top_emojis?.map(e => e.emoji).join(' ')}
- Preferred greeting: ${profile.top_greetings?.[0]?.greeting || 'hey'}
- Lowercase preference: ${(profile.punctuation_habits?.lowercase_only || 0) > 3}

Task: Generate EXACTLY 3 distinct reply suggestions to the incoming message.
Format strictly as a JSON list of 3 strings:
["Option 1", "Option 2", "Option 3"]
Output ONLY the JSON list.`;

      const userPrompt = `${historyText ? `Recent Chat Dialogue:\n${historyText}\n\n` : ''}${draftText}
Incoming Message: "${incoming}"
${isRetry ? 'Generate 3 FRESH, distinct creative reply ideas.' : 'Generate 3 natural reply options.'}`;

      const raw = await callNvidiaLLM([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], isRetry ? 0.85 : 0.65, 180);

      let suggestions: any[] = [];
      if (raw) {
        try {
          const sIdx = raw.indexOf('[');
          const eIdx = raw.lastIndexOf(']');
          if (sIdx !== -1 && eIdx !== -1) {
            const parsed = JSON.parse(raw.substring(sIdx, eIdx + 1));
            if (Array.isArray(parsed) && parsed.length > 0) {
              suggestions = parsed.slice(0, 3).map((txt, idx) => ({
                text: String(txt),
                confidence: 'high',
                reason: idx === 0 ? 'NVIDIA Llama: Persona & chat context matched' : (isRetry ? 'NVIDIA Llama: Fresh creative variation' : 'NVIDIA Llama: Style suggestion')
              }));
            }
          }
        } catch (e) {
          console.warn('[Echo] JSON parse fallback:', e);
        }
      }

      // 3. Fallback to Own Mind NLP Reasoning Engine
      if (!suggestions || suggestions.length === 0) {
        console.log('🧠 [Echo] Activating Own Mind NLP Reasoning Engine from memory corpus.');
        suggestions = generateOwnMindSuggestions(incoming, profile, learned, contactName);
      }

      sendResponse({
        success: true,
        data: {
          incoming_message: incoming,
          suggestions
        }
      });
    })();
    return true;
  }

  // 4. REFINE_VOCAB (Grammar, Typos, Vocabulary Polish)
  if (action === 'REFINE_VOCAB') {
    (async () => {
      const text = (payload?.text || '').trim();
      const reqAction = payload?.action || 'fix_vocab';

      // 1. Try Local Backend
      const localRefine = await callLocalBackend('/api/refine', 'POST', { text, action: reqAction }, 5000);
      if (localRefine && localRefine.refined) {
        sendResponse({ success: true, data: localRefine });
        return;
      }

      // 2. Direct NVIDIA Cloud LLM
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

      const raw = await callNvidiaLLM([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Draft to polish:\n"""${text}"""` }
      ], 0.3, 250);

      let refined = text;
      let explanation = 'Polished vocabulary & grammar.';

      if (raw && raw.includes('REFINED:')) {
        const parts = raw.split('REFINED:')[1].split('EXPLANATION:');
        refined = parts[0].trim();
        explanation = (parts[1] || '').trim() || 'Enhanced vocabulary & corrected grammar with NVIDIA Llama.';
      } else if (raw) {
        refined = raw.trim();
        explanation = 'Refined with NVIDIA Llama.';
      } else {
        // 3. Fallback to Own Mind NLP rule-based refiner
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

  // 5. CHAT_WITH_ECHO
  if (action === 'CHAT_WITH_ECHO') {
    (async () => {
      const msg = (payload?.message || '').trim();

      // 1. Try Local Backend
      const localChat = await callLocalBackend('/api/chat', 'POST', { message: msg }, 5000);
      if (localChat && localChat.reply) {
        sendResponse({ success: true, data: localChat });
        return;
      }

      // 2. Direct NVIDIA Cloud LLM
      const profile = await getProfile();
      const systemPrompt = `You are Echo, an intelligent writing copilot and chatbot powered by NVIDIA Llama. Be helpful, concise, natural, and friendly. Adapt to user's tone: ${profile.top_greetings?.[0]?.greeting || 'hey'}, ${profile.top_emojis?.map(e => e.emoji).join(' ')}.`;

      const raw = await callNvidiaLLM([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: msg }
      ], 0.7, 300);

      const reply = raw || `👋 [Echo Own Mind] Got it! I'm ready to help you draft, polish paragraphs, or suggest contextual replies based on your learned memory.`;
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
      const localRewrite = await callLocalBackend('/api/rewrite', 'POST', { text, ghost_mode: mode }, 5000);
      if (localRewrite && localRewrite.rewritten) {
        sendResponse({ success: true, data: localRewrite });
        return;
      }

      // 2. Direct NVIDIA Cloud LLM
      let prompt = `Rewrite this draft: "${text}"`;
      let system = `Rewrite in the user's natural personal style.`;
      if (mode === 'genz') system = `Rewrite in ultra-casual Gen-Z internet slang with lowercase and modern emojis (fr, deadass, lowkey, 💀, 🔥).`;
      if (mode === 'executive') system = `Rewrite in an executive, clear, professional business tone.`;
      if (mode === 'emoji_heavy') system = `Rewrite in an enthusiastic, warm tone with lots of vibrant, expressive emojis.`;

      const raw = await callNvidiaLLM([
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ], 0.7, 250);

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
        // Sync with local backend
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
        
        // Count emojis
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

      // Sync with local backend
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
      // Sync with local backend
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
      // Sync with local backend
      callLocalBackend('/api/profile/import', 'POST', imported);

      if (imported?.profile) await setStoredData('style_profile', imported.profile);
      if (imported?.sample_messages) await setStoredData('learned_messages', imported.sample_messages);
      sendResponse({ success: true, data: { imported_count: imported?.sample_messages?.length || 0 } });
    })();
    return true;
  }
});
