// Echo Multi-Platform Web Content Script (WhatsApp, Instagram, Telegram, Discord, X)
console.log('✨ [Echo Copilot v1.4] Initialized on', window.location.hostname);

let currentIncomingMessage = '';
let isGenerating = false;
let isLearningActive = true;
let isAssistantOpen = false;
let isPolishModalOpen = false;
let isOpacityPopoverOpen = false;
let glassOpacity = 72; // default 72% opacity (28% transparency)

// Helper: Safely send message to background service worker with full lifecycle handling
function sendToBackground(action: string, payload?: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      if (
        typeof chrome === 'undefined' ||
        !chrome.runtime ||
        !chrome.runtime.id ||
        typeof chrome.runtime.sendMessage !== 'function'
      ) {
        resolve(null);
        return;
      }
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch {
      // Gracefully resolve on context invalidation without throwing
      resolve(null);
    }
  });
}

// -------------------------------------------------------------
// Transparency & Opacity Customization Controller
// -------------------------------------------------------------
function applyGlassOpacity(opacityVal: number) {
  glassOpacity = Math.max(10, Math.min(100, opacityVal));
  const decimal = (glassOpacity / 100).toFixed(2);
  
  // Set root CSS variable for all injected glass elements
  document.documentElement.style.setProperty('--echo-glass-opacity', decimal);

  // Update all in-page transparency slider input values & percentage labels
  const sliders = document.querySelectorAll<HTMLInputElement>('.echo-transparency-slider');
  sliders.forEach((s) => {
    s.value = String(glassOpacity);
  });
  const badges = document.querySelectorAll<HTMLElement>('.echo-opacity-badge');
  badges.forEach((b) => {
    b.innerText = `${glassOpacity}%`;
  });

  // Save to Chrome Storage and localStorage fallback
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ echo_glass_opacity: glassOpacity });
    }
    localStorage.setItem('echo_glass_opacity', String(glassOpacity));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function initGlassOpacity() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['echo_glass_opacity'], (res) => {
        if (res && res.echo_glass_opacity) {
          applyGlassOpacity(Number(res.echo_glass_opacity));
        } else {
          const localVal = localStorage.getItem('echo_glass_opacity');
          if (localVal) applyGlassOpacity(Number(localVal));
          else applyGlassOpacity(72);
        }
      });
    } else {
      const localVal = localStorage.getItem('echo_glass_opacity');
      if (localVal) applyGlassOpacity(Number(localVal));
      else applyGlassOpacity(72);
    }
  } catch {
    applyGlassOpacity(72);
  }

  // Real-time synchronization when opacity is adjusted in the popup or other views
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.echo_glass_opacity) {
          applyGlassOpacity(Number(changes.echo_glass_opacity.newValue));
        }
      });
    }
  } catch {
    // Ignore
  }
}

function getPlatformName(): string {
  const host = window.location.hostname;
  if (host.includes('whatsapp.com')) return 'whatsapp';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('telegram.org')) return 'telegram';
  if (host.includes('discord.com')) return 'discord';
  if (host.includes('x.com') || host.includes('twitter.com')) return 'x';
  return 'web';
}

// Extract active contact name or chat header title across platforms
function extractActiveContactName(): string {
  try {
    const platform = getPlatformName();
    if (platform === 'whatsapp') {
      const headerNode = document.querySelector('#main header');
      if (headerNode) {
        const titleEl = headerNode.querySelector('span[title], span._ao3e, div._am88, div[role="button"] span');
        if (titleEl) return titleEl.getAttribute('title') || (titleEl as HTMLElement).innerText || '';
      }
    } else if (platform === 'instagram') {
      const titleEl = document.querySelector('div[role="main"] header h2, div[role="main"] header span, header h1, div[role="main"] header a');
      if (titleEl) return (titleEl as HTMLElement).innerText?.trim() || '';
    } else if (platform === 'telegram') {
      const titleEl = document.querySelector('.chat-info .peer-title, .top-header .name, .chat-title');
      if (titleEl) return (titleEl as HTMLElement).innerText || '';
    } else if (platform === 'discord') {
      const titleEl = document.querySelector('h3[class*="title"], header[class*="header"]');
      if (titleEl) return (titleEl as HTMLElement).innerText || '';
    } else if (platform === 'x') {
      const titleEl = document.querySelector('div[data-testid="Conversation-Header"] span, div[data-testid="detailHeader"] span');
      if (titleEl) return (titleEl as HTMLElement).innerText || '';
    }
  } catch {
    // Fail silently without affecting host site
  }
  return '';
}

// Extract recent multi-turn conversation context (dialogue history)
function extractConversationContext(): { sender: string; text: string }[] {
  const messages: { sender: string; text: string }[] = [];
  try {
    const platform = getPlatformName();
    if (platform === 'whatsapp') {
      const chatMain = document.querySelector('#main');
      if (chatMain) {
        const msgRows = chatMain.querySelectorAll('div[data-id], div.message-in, div.message-out');
        const recentRows = Array.from(msgRows).slice(-10);
        for (const row of recentRows) {
          const isOut = row.classList.contains('message-out') || (row.getAttribute('data-id') || '').includes('true_');
          const textEl = row.querySelector('.copyable-text, .selectable-text, span.selectable-text');
          const text = textEl?.textContent?.trim() || (textEl as HTMLElement)?.innerText?.trim() || '';
          if (text && text.length > 0 && !text.startsWith('📷') && !text.startsWith('🎤') && !text.startsWith('📹')) {
            messages.push({
              sender: isOut ? 'me' : 'them',
              text: text
            });
          }
        }
      }
    } else if (platform === 'instagram') {
      const rows = document.querySelectorAll('div[role="row"], div[role="listitem"], div[data-testid="message-content"]');
      const recentRows = Array.from(rows).slice(-12);
      for (const row of recentRows) {
        const aria = (row.getAttribute('aria-label') || '').toLowerCase();
        const isOut = aria.includes('you') || aria.includes('sent');
        const textNodes = row.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        for (const tn of Array.from(textNodes)) {
          const text = tn.textContent?.trim() || (tn as HTMLElement)?.innerText?.trim() || '';
          if (text && text.length > 0 && !text.includes('Seen') && !text.includes('Active') && !text.includes('Attachment') && !text.startsWith('📷') && !text.startsWith('🎤')) {
            messages.push({ sender: isOut ? 'me' : 'them', text });
            break;
          }
        }
      }
    } else if (platform === 'telegram') {
      const rows = document.querySelectorAll('.message, .message-content');
      const recentRows = Array.from(rows).slice(-10);
      for (const row of recentRows) {
        const isOut = row.classList.contains('own') || row.classList.contains('is-out');
        const textNode = row.querySelector('.text-content, .message-text');
        const text = textNode?.textContent?.trim() || (textNode as HTMLElement)?.innerText?.trim() || '';
        if (text) {
          messages.push({ sender: isOut ? 'me' : 'them', text });
        }
      }
    } else if (platform === 'discord') {
      const rows = document.querySelectorAll('li[class*="messageListItem"], div[class*="messageListItem"]');
      const recentRows = Array.from(rows).slice(-10);
      for (const row of recentRows) {
        const textNode = row.querySelector('div[class*="messageContent"]');
        const text = textNode?.textContent?.trim() || (textNode as HTMLElement)?.innerText?.trim() || '';
        if (text) {
          messages.push({ sender: 'them', text });
        }
      }
    }
  } catch {
    // Context extraction error ignored
  }
  return messages;
}

// Extract latest incoming message across platforms
function extractLatestIncomingMessage(): string {
  try {
    const platform = getPlatformName();
    if (platform === 'whatsapp') {
      const nodes = document.querySelectorAll('.message-in .copyable-text, [data-id*="false_"] .selectable-text, div.message-in span.selectable-text');
      if (nodes.length > 0) {
        for (let i = nodes.length - 1; i >= 0; i--) {
          const text = nodes[i].textContent?.trim() || (nodes[i] as HTMLElement).innerText?.trim() || '';
          if (text && !text.startsWith('📷') && !text.startsWith('🎤') && !text.startsWith('📹')) {
            return text;
          }
        }
      }
    } else if (platform === 'instagram') {
      const rows = document.querySelectorAll('div[role="row"], div[role="listitem"]');
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i] as HTMLElement;
        const aria = (row.getAttribute('aria-label') || '').toLowerCase();
        if (aria.includes('you') || aria.includes('sent')) continue;
        
        const textNodes = row.querySelectorAll('span[dir="auto"], div[dir="auto"], div[aria-label]');
        for (const tn of Array.from(textNodes)) {
          const text = tn.textContent?.trim() || (tn as HTMLElement)?.innerText?.trim() || '';
          if (text && text.length > 0 && !text.includes('Seen') && !text.includes('Active') && !text.includes('Attachment') && !text.startsWith('📷') && !text.startsWith('🎤')) {
            return text;
          }
        }
      }
    } else if (platform === 'telegram') {
      const nodes = document.querySelectorAll('.message:not(.own) .text-content, .message-content:not(.is-out)');
      if (nodes.length > 0) {
        return nodes[nodes.length - 1].textContent?.trim() || '';
      }
    } else if (platform === 'discord') {
      const nodes = document.querySelectorAll('div[class*="messageContent"]');
      if (nodes.length > 0) {
        return nodes[nodes.length - 1].textContent?.trim() || '';
      }
    } else if (platform === 'x') {
      const nodes = document.querySelectorAll('div[data-testid="tweetText"], div[data-testid="messageEntry"]');
      if (nodes.length > 0) {
        return nodes[nodes.length - 1].textContent?.trim() || '';
      }
    }
  } catch {
    // Fail silently without affecting host site
  }
  return '';
}

// Get text currently inside active chat input box
function getCurrentInputText(): string {
  const platform = getPlatformName();
  let inputContainer: HTMLElement | null = null;

  if (platform === 'whatsapp') {
    inputContainer = document.querySelector('footer div[contenteditable="true"]');
  } else if (platform === 'instagram') {
    inputContainer = document.querySelector('div[contenteditable="true"][role="textbox"], textarea[placeholder*="Message"], div[role="textbox"]');
  } else if (platform === 'telegram') {
    inputContainer = document.querySelector('#editable-message-text, .input-message-input[contenteditable="true"]');
  } else if (platform === 'discord') {
    inputContainer = document.querySelector('div[role="textbox"][contenteditable="true"]');
  } else if (platform === 'x') {
    inputContainer = document.querySelector('div[data-testid="dmComposerTextInput"], div[aria-label="Start a new message"][contenteditable="true"]');
  }

  if (!inputContainer) {
    inputContainer = document.querySelector('div[contenteditable="true"], textarea');
  }

  if (inputContainer) {
    if (inputContainer.tagName.toLowerCase() === 'textarea') {
      return (inputContainer as HTMLTextAreaElement).value.trim();
    }
    return inputContainer.textContent?.trim() || '';
  }
  return '';
}

// Fill chat text input field across platforms with React state sync
function fillTextInput(text: string) {
  const platform = getPlatformName();
  let inputContainer: HTMLElement | null = null;

  if (platform === 'whatsapp') {
    inputContainer = document.querySelector('footer div[contenteditable="true"]');
  } else if (platform === 'instagram') {
    inputContainer = document.querySelector('div[contenteditable="true"][role="textbox"], textarea[placeholder*="Message"], div[role="textbox"]');
  } else if (platform === 'telegram') {
    inputContainer = document.querySelector('#editable-message-text, .input-message-input[contenteditable="true"]');
  } else if (platform === 'discord') {
    inputContainer = document.querySelector('div[role="textbox"][contenteditable="true"], div[class*="slateTextArea"]');
  } else if (platform === 'x') {
    inputContainer = document.querySelector('div[data-testid="dmComposerTextInput"], div[aria-label="Start a new message"][contenteditable="true"]');
  }

  if (!inputContainer) {
    inputContainer = document.querySelector('div[contenteditable="true"], textarea');
  }

  if (inputContainer) {
    let targetEl: HTMLElement = inputContainer;
    const innerLeaf = inputContainer.querySelector('span[data-slate-leaf="true"], span[data-slate-string="true"], span[dir="auto"], p');
    if (innerLeaf) {
      targetEl = innerLeaf as HTMLElement;
    }

    targetEl.focus();

    if (inputContainer.tagName.toLowerCase() === 'textarea') {
      const ta = inputContainer as HTMLTextAreaElement;
      ta.value = text;
      ta.selectionStart = ta.value.length;
      ta.selectionEnd = ta.value.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(targetEl);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('selectAll', false, undefined);
        document.execCommand('insertText', false, text);
      } catch {
        targetEl.innerText = text;
      }

      // Dispatch React event cascade
      inputContainer.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true }));
      inputContainer.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
      inputContainer.dispatchEvent(new Event('change', { bubbles: true }));

      // Invoke React props handler directly if available
      try {
        const reactKey = Object.keys(inputContainer).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (reactKey) {
          const props = (inputContainer as any)[reactKey];
          if (props?.onInput) props.onInput({ target: inputContainer, currentTarget: inputContainer });
          if (props?.onChange) props.onChange({ target: inputContainer, currentTarget: inputContainer });
        }
      } catch {
        // Ignore react internal error
      }
    }
  }
}

// Find footer or chat composer wrapper to anchor Echo Bar cleanly ABOVE the input
function findFooterNode(): HTMLElement | null {
  const platform = getPlatformName();
  if (platform === 'whatsapp') {
    const f = document.querySelector('footer');
    if (f) return f as HTMLElement;
  }
  if (platform === 'instagram') {
    const footer = document.querySelector('div[role="main"] footer');
    if (footer) return footer as HTMLElement;

    const input = document.querySelector('div[contenteditable="true"][role="textbox"], textarea[placeholder*="Message"], div[role="textbox"]');
    if (input) {
      let curr = input.parentElement;
      while (curr && curr.parentElement && curr !== document.body) {
        if (curr.classList.contains('x1n2onr6') || curr.getAttribute('role') === 'main' || curr.clientWidth > 400) {
          return curr;
        }
        curr = curr.parentElement;
      }
      return input.closest('form') || input.parentElement?.parentElement || input.parentElement;
    }
  }
  if (platform === 'telegram') {
    const f = document.querySelector('.chat-input, .input-message-container');
    if (f) return f as HTMLElement;
  }
  if (platform === 'discord') {
    const f = document.querySelector('form[class*="form"], form');
    if (f) return f as HTMLElement;
  }
  if (platform === 'x') {
    const f = document.querySelector('div[data-testid="dmComposer"], form');
    if (f) return f as HTMLElement;
  }

  // Universal Fallback: find any footer, form, or input container
  const footerOrForm = document.querySelector('footer, form');
  if (footerOrForm) return footerOrForm as HTMLElement;

  const anyInput = document.querySelector('div[contenteditable="true"], textarea');
  if (anyInput) {
    if (anyInput.parentElement?.parentElement) return anyInput.parentElement.parentElement;
    if (anyInput.parentElement) return anyInput.parentElement;
  }

  return null;
}

// Open Dedicated Glassmorphic Polish / Grammar & Vocab Refiner Modal
function openPolishModal(initialText?: string) {
  let modal = document.getElementById('echo-polish-modal');
  const draft = initialText !== undefined ? initialText : getCurrentInputText();

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'echo-polish-modal';
    modal.className = 'echo-glass-modal';
    modal.innerHTML = `
      <div class="echo-glass-card echo-polish-card">
        <div class="echo-glass-card-header">
          <div class="echo-header-title">
            <span class="echo-glow-icon">🪄</span>
            <div>
              <h3>Polish & Fix Mistakes</h3>
              <p>Powered by NVIDIA Llama & Own Mind NLP</p>
            </div>
          </div>
          <div class="echo-header-controls">
            <!-- Glass Opacity Quick Slider -->
            <div class="echo-opacity-control" title="Adjust Glass Transparency">
              <span class="echo-opacity-icon">💧</span>
              <input type="range" min="10" max="100" value="${glassOpacity}" class="echo-transparency-slider" />
              <span class="echo-opacity-badge">${glassOpacity}%</span>
            </div>
            <button id="echo-polish-close" class="echo-btn-close">✕</button>
          </div>
        </div>

        <div class="echo-polish-body">
          <label class="echo-field-label">Your Draft Message / Paragraph:</label>
          <textarea id="echo-polish-input" class="echo-glass-textarea" placeholder="Paste or type your draft here (e.g. paragraph with typos or grammar mistakes)..."></textarea>

          <div class="echo-pill-row">
            <button class="echo-action-pill active" data-action="fix_vocab">✨ Fix Grammar & Vocab</button>
            <button class="echo-action-pill" data-action="formal">💼 Professional</button>
            <button class="echo-action-pill" data-action="concise">⚡ Short & Punchy</button>
            <button class="echo-action-pill" data-action="casual">🔥 Casual</button>
            <button class="echo-action-pill" data-action="expand">📝 Elaborate</button>
          </div>

          <div id="echo-polish-result-container" class="echo-polish-result" style="display:none;">
            <div class="echo-result-header">
              <span class="echo-badge-refined">✓ Polished Output</span>
              <span id="echo-polish-explanation" class="echo-explanation-text"></span>
            </div>
            <div id="echo-polish-output-text" class="echo-output-box"></div>
          </div>
        </div>

        <div class="echo-glass-card-footer">
          <button id="echo-btn-do-refine" class="echo-btn-primary">
            <span>✨ Polish Message</span>
          </button>
          <button id="echo-btn-apply-chat" class="echo-btn-success" style="display:none;">
            <span>✍️ Apply to Chat</span>
          </button>
          <button id="echo-btn-copy-polish" class="echo-btn-secondary" style="display:none;">
            <span>📋 Copy</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('echo-polish-close')?.addEventListener('click', () => {
      modal!.style.display = 'none';
      isPolishModalOpen = false;
    });

    // Opacity slider event listener in modal
    const modalSlider = modal.querySelector<HTMLInputElement>('.echo-transparency-slider');
    modalSlider?.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      applyGlassOpacity(val);
    });

    // Pill selection handler
    const pills = modal.querySelectorAll('.echo-action-pill');
    pills.forEach((p) => {
      p.addEventListener('click', (e) => {
        pills.forEach((btn) => btn.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        runPolishAction();
      });
    });

    // Refine Button Action
    const runPolishAction = async () => {
      const inputEl = document.getElementById('echo-polish-input') as HTMLTextAreaElement;
      const text = inputEl.value.trim();
      if (!text) {
        inputEl.focus();
        return;
      }

      const activePill = modal!.querySelector('.echo-action-pill.active') as HTMLElement;
      const actionType = activePill?.getAttribute('data-action') || 'fix_vocab';

      const btnPrimary = document.getElementById('echo-btn-do-refine');
      const resultContainer = document.getElementById('echo-polish-result-container');
      const outputText = document.getElementById('echo-polish-output-text');
      const explanationText = document.getElementById('echo-polish-explanation');
      const applyBtn = document.getElementById('echo-btn-apply-chat');
      const copyBtn = document.getElementById('echo-btn-copy-polish');

      if (btnPrimary) {
        btnPrimary.innerHTML = `<span class="echo-spinner"></span> Refining...`;
        (btnPrimary as HTMLButtonElement).disabled = true;
      }

      const res = await sendToBackground('REFINE_VOCAB', { text, action: actionType });

      if (btnPrimary) {
        btnPrimary.innerHTML = `<span>✨ Polish Message</span>`;
        (btnPrimary as HTMLButtonElement).disabled = false;
      }

      if (res && res.success && res.data?.refined) {
        if (resultContainer && outputText && explanationText) {
          resultContainer.style.display = 'block';
          outputText.innerText = res.data.refined;
          explanationText.innerText = res.data.explanation || 'Refined vocabulary & grammar.';
        }
        if (applyBtn) applyBtn.style.display = 'inline-flex';
        if (copyBtn) copyBtn.style.display = 'inline-flex';
      }
    };

    document.getElementById('echo-btn-do-refine')?.addEventListener('click', runPolishAction);

    // Apply to chat button
    document.getElementById('echo-btn-apply-chat')?.addEventListener('click', () => {
      const outputText = document.getElementById('echo-polish-output-text')?.innerText || '';
      if (outputText) {
        fillTextInput(outputText);
        modal!.style.display = 'none';
        isPolishModalOpen = false;
      }
    });

    // Copy to clipboard
    document.getElementById('echo-btn-copy-polish')?.addEventListener('click', () => {
      const outputText = document.getElementById('echo-polish-output-text')?.innerText || '';
      if (outputText) {
        navigator.clipboard.writeText(outputText);
        const copyBtn = document.getElementById('echo-btn-copy-polish');
        if (copyBtn) {
          const orig = copyBtn.innerHTML;
          copyBtn.innerHTML = '<span>✓ Copied!</span>';
          setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
        }
      }
    });
  }

  // Pre-fill input if provided
  const inputEl = document.getElementById('echo-polish-input') as HTMLTextAreaElement;
  if (inputEl) {
    if (draft) {
      inputEl.value = draft;
    }
  }

  modal.style.display = 'flex';
  isPolishModalOpen = true;

  if (draft && draft.length > 3) {
    document.getElementById('echo-btn-do-refine')?.click();
  }
}

// Toggle Floating Assistant & Persona Quiz Drawer Overlay
function toggleAssistantDrawer() {
  let drawer = document.getElementById('echo-assistant-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'echo-assistant-drawer';
    drawer.className = 'echo-glass-drawer';
    drawer.innerHTML = `
      <div class="echo-drawer-header">
        <div class="echo-header-title">
          <span class="echo-glow-icon">🤖</span>
          <span>Echo Copilot (Llama 3.2)</span>
        </div>
        <div class="echo-header-controls">
          <div class="echo-opacity-control" title="Adjust Glass Transparency">
            <span class="echo-opacity-icon">💧</span>
            <input type="range" min="10" max="100" value="${glassOpacity}" class="echo-transparency-slider" />
            <span class="echo-opacity-badge">${glassOpacity}%</span>
          </div>
          <button id="echo-drawer-close" class="echo-btn-close">✕</button>
        </div>
      </div>
      
      <!-- Persona Onboarding Quiz Section -->
      <div class="echo-drawer-quiz-section">
        <div class="echo-quiz-headline">⚡ <strong>Persona Quick-Tune</strong></div>
        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <select id="echo-quiz-greeting" class="echo-glass-select">
            <option value="hey">Greeting: hey</option>
            <option value="yo">Greeting: yo</option>
            <option value="hi">Greeting: hi</option>
            <option value="wassup">Greeting: wassup</option>
          </select>
          <select id="echo-quiz-emoji" class="echo-glass-select">
            <option value="👍">Emoji: 👍</option>
            <option value="🔥">Emoji: 🔥</option>
            <option value="😂">Emoji: 😂</option>
            <option value="💀">Emoji: 💀</option>
          </select>
        </div>
        <input type="text" id="echo-quiz-samples" class="echo-glass-input" placeholder="Paste 2-3 sample messages sent elsewhere..." />
        <button id="echo-btn-quiz-save" class="echo-btn-primary echo-btn-sm" style="width:100%; margin-top:4px;">
          💾 Seed & Train Persona
        </button>
      </div>

      <div class="echo-drawer-body" id="echo-drawer-chat">
        <div class="echo-chat-msg echo-chat-bot">
          👋 Hi! I'm Echo. Ask me for ideas, drafting advice, or paste a message to fix!
        </div>
      </div>
      <div class="echo-drawer-actions">
        <button id="echo-btn-drawer-polish" class="echo-btn-emerald">
          🪄 Polish Input Text
        </button>
      </div>
      <div class="echo-drawer-footer">
        <input type="text" id="echo-drawer-input" class="echo-glass-input" placeholder="Ask Echo or draft a reply..." />
        <button id="echo-drawer-send" class="echo-btn-send">Send</button>
      </div>
    `;
    document.body.appendChild(drawer);

    document.getElementById('echo-drawer-close')?.addEventListener('click', () => {
      drawer!.style.display = 'none';
      isAssistantOpen = false;
    });

    const drawerSlider = drawer.querySelector<HTMLInputElement>('.echo-transparency-slider');
    drawerSlider?.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      applyGlassOpacity(val);
    });

    // Handle Quiz Submission
    document.getElementById('echo-btn-quiz-save')?.addEventListener('click', async () => {
      const g = (document.getElementById('echo-quiz-greeting') as HTMLSelectElement).value;
      const e = (document.getElementById('echo-quiz-emoji') as HTMLSelectElement).value;
      const rawSamples = (document.getElementById('echo-quiz-samples') as HTMLInputElement).value;
      const samples = rawSamples.split('\n').map(s => s.trim()).filter(s => s.length > 0);

      const chatBody = document.getElementById('echo-drawer-chat');
      if (chatBody) {
        chatBody.innerHTML += `<div class="echo-chat-msg echo-chat-bot">⏳ Training persona with selections...</div>`;
      }

      const res = await sendToBackground('SEED_MESSAGES', {
        messages: samples.length > 0 ? samples : ['hey sounds good!', 'sure let me check'],
        greetings: [g],
        favorite_emojis: [e],
        lowercase_pref: true
      });

      if (chatBody) {
        if (res && res.success) {
          chatBody.innerHTML += `<div class="echo-chat-msg echo-chat-bot">🎉 <strong>Persona Seeded!</strong> Echo will now use '${g}' and '${e}' naturally!</div>`;
          chatBody.scrollTop = chatBody.scrollHeight;
        } else {
          chatBody.innerHTML += `<div class="echo-chat-msg echo-chat-bot">⚠️ Failed to save persona.</div>`;
        }
      }
    });

    const handleSendChat = async () => {
      const inputEl = document.getElementById('echo-drawer-input') as HTMLInputElement;
      const text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = '';

      const chatBody = document.getElementById('echo-drawer-chat');
      if (chatBody) {
        chatBody.innerHTML += `<div class="echo-chat-msg echo-chat-user">${text}</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;

        chatBody.innerHTML += `<div class="echo-chat-msg echo-chat-bot" id="echo-typing"><span class="echo-spinner"></span> Thinking...</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;
      }

      const res = await sendToBackground('CHAT_WITH_ECHO', { message: text });
      const typingEl = document.getElementById('echo-typing');
      if (typingEl) typingEl.remove();

      if (chatBody && res && res.success && res.data?.reply) {
        chatBody.innerHTML += `<div class="echo-chat-msg echo-chat-bot">${res.data.reply}</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    };

    document.getElementById('echo-drawer-send')?.addEventListener('click', handleSendChat);
    document.getElementById('echo-drawer-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSendChat();
    });

    document.getElementById('echo-btn-drawer-polish')?.addEventListener('click', () => {
      const draft = getCurrentInputText();
      openPolishModal(draft);
    });

    drawer.style.display = 'flex';
    isAssistantOpen = true;
  } else {
    isAssistantOpen = !isAssistantOpen;
    drawer.style.display = isAssistantOpen ? 'flex' : 'none';
  }
}

// Toggle In-Bar Transparency Adjuster Popover
function toggleOpacityPopover() {
  let popover = document.getElementById('echo-opacity-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'echo-opacity-popover';
    popover.className = 'echo-glass-popover';
    popover.innerHTML = `
      <div class="echo-popover-header">
        <span>✨ Glass Transparency</span>
        <span class="echo-opacity-badge">${glassOpacity}%</span>
      </div>
      <div class="echo-popover-slider-row">
        <span style="font-size: 11px;">10%</span>
        <input type="range" min="10" max="100" value="${glassOpacity}" class="echo-transparency-slider echo-popover-slider" />
        <span style="font-size: 11px;">100%</span>
      </div>
      <div class="echo-popover-presets">
        <button class="echo-preset-pill" data-val="35">Crystal (35%)</button>
        <button class="echo-preset-pill" data-val="65">Frosted (65%)</button>
        <button class="echo-preset-pill" data-val="88">Milky (88%)</button>
      </div>
    `;

    const bar = document.getElementById('echo-ai-bar');
    if (bar) {
      bar.appendChild(popover);
    } else {
      document.body.appendChild(popover);
    }

    const slider = popover.querySelector<HTMLInputElement>('.echo-transparency-slider');
    slider?.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      applyGlassOpacity(val);
    });

    const presetBtns = popover.querySelectorAll<HTMLElement>('.echo-preset-pill');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const val = Number((e.currentTarget as HTMLElement).getAttribute('data-val') || '72');
        applyGlassOpacity(val);
      });
    });

    isOpacityPopoverOpen = true;
  } else {
    isOpacityPopoverOpen = !isOpacityPopoverOpen;
    popover.style.display = isOpacityPopoverOpen ? 'block' : 'none';
  }
}

// Inject Floating Echo Luminous Frosted Glassmorphic Bar
function injectEchoBar() {
  const footerNode = findFooterNode();
  if (!footerNode) return;

  let bar = document.getElementById('echo-ai-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'echo-ai-bar';
    bar.className = 'echo-glass-bar';
    bar.innerHTML = `
      <div class="echo-bar-brand" title="Echo Copilot • Frosted White Glassmorphism">
        <div class="echo-brand-glow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </div>
        <span class="echo-brand-name">Echo</span>
      </div>

      <div class="echo-suggestions-container" id="echo-suggestions">
        <span class="echo-loading">
          <span class="echo-sparkle">✨</span> Click 🔄 for smart ideas
        </span>
      </div>

      <div class="echo-bar-tools">
        <button type="button" class="echo-btn-pill echo-btn-polish" id="echo-polish-btn" title="Fix grammar & upgrade vocabulary in your draft message">
          🪄 Polish
        </button>
        <button type="button" class="echo-btn-pill" id="echo-assistant-btn" title="Open Echo Copilot Assistant">
          🤖 Copilot
        </button>
        <button type="button" class="echo-btn-icon" id="echo-opacity-btn" title="Adjust Glass Transparency (10% - 100%)">
          💧
        </button>
        <button type="button" class="echo-btn-icon ${isLearningActive ? 'active' : 'inactive'}" id="echo-incognito-btn" title="Toggle Passive Persona Learning">
          ${isLearningActive ? '🛡️' : '🙈'}
        </button>
        <button type="button" class="echo-btn-icon echo-btn-refresh" id="echo-refresh-btn" title="Retry / Generate fresh ideas for the active message">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
    `;

    // Capture-phase event delegation for rock-solid interaction
    bar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const refreshBtn = target.closest('#echo-refresh-btn');
      const polishBtn = target.closest('#echo-polish-btn');
      const assistantBtn = target.closest('#echo-assistant-btn');
      const opacityBtn = target.closest('#echo-opacity-btn');
      const incognitoBtn = target.closest('#echo-incognito-btn');

      if (refreshBtn) {
        e.preventDefault();
        e.stopPropagation();
        triggerReplyGeneration(true);
      } else if (polishBtn) {
        e.preventDefault();
        e.stopPropagation();
        openPolishModal();
      } else if (assistantBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleAssistantDrawer();
      } else if (opacityBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleOpacityPopover();
      } else if (incognitoBtn) {
        e.preventDefault();
        e.stopPropagation();
        isLearningActive = !isLearningActive;
        (incognitoBtn as HTMLElement).innerText = isLearningActive ? '🛡️' : '🙈';
        incognitoBtn.className = `echo-btn-icon ${isLearningActive ? 'active' : 'inactive'}`;
      }
    }, true);
  }

  // Anchor immediately before active footerNode
  if (bar.nextElementSibling !== footerNode) {
    footerNode.parentNode?.insertBefore(bar, footerNode);
  }
}

// Render Suggestions into UI with Confidence & Explainability Tooltips
function renderSuggestions(suggestions: any[]) {
  const container = document.getElementById('echo-suggestions');
  if (!container) return;

  if (!suggestions || suggestions.length === 0) {
    suggestions = [
      { text: 'hey! sounds good 👍', confidence: 'medium', reason: 'Default smart response' },
      { text: 'sure, let me check and reply', confidence: 'medium', reason: 'Default smart response' },
      { text: 'haha awesome!', confidence: 'medium', reason: 'Default smart response' }
    ];
  }

  container.innerHTML = '';
  suggestions.forEach((item) => {
    const text = typeof item === 'string' ? item : item.text;
    const confidence = typeof item === 'object' ? item.confidence || 'medium' : 'medium';
    const reason = typeof item === 'object' ? item.reason || 'Smart suggestion' : 'Smart suggestion';

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `echo-chip echo-conf-${confidence}`;
    
    // Confidence glowing indicator dot
    const dot = document.createElement('span');
    dot.className = `echo-dot echo-dot-${confidence}`;

    const textSpan = document.createElement('span');
    textSpan.className = 'echo-chip-text';
    textSpan.innerText = text;

    chip.appendChild(dot);
    chip.appendChild(textSpan);
    chip.title = `💡 [Why this suggestion?]\n${reason}\n\nClick to insert into reply.`;

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fillTextInput(text);
    });
    container.appendChild(chip);
  });
}

// Trigger Reply Generation & Smart Retry
async function triggerReplyGeneration(force = false) {
  const latestIncoming = extractLatestIncomingMessage();
  const currentDraft = getCurrentInputText();
  const container = document.getElementById('echo-suggestions');
  const contactName = extractActiveContactName();
  const conversationHistory = extractConversationContext();

  const queryMessage = latestIncoming || (currentDraft ? `Regarding: ${currentDraft}` : "hey what's up?");

  if (queryMessage === currentIncomingMessage && !force && !isGenerating) {
    return;
  }

  currentIncomingMessage = queryMessage;
  isGenerating = true;

  if (container) {
    container.innerHTML = `
      <span class="echo-loading">
        <span class="echo-spinner"></span> Echoing ideas${contactName ? ` for ${contactName.split(' ')[0]}` : ''}...
      </span>
    `;
  }

  const response: any = await sendToBackground('SUGGEST_REPLIES', {
    incoming_message: queryMessage,
    contact_name: contactName,
    conversation_history: conversationHistory,
    is_retry: force,
    current_draft: currentDraft,
  });

  isGenerating = false;

  if (response && response.success && response.data?.suggestions && response.data.suggestions.length > 0) {
    renderSuggestions(response.data.suggestions);
  } else {
    renderSuggestions([
      { text: 'hey! sounds good 👍', confidence: 'medium', reason: 'Context-aligned reply' },
      { text: 'sure, let me check and get back to you', confidence: 'medium', reason: 'Context-aligned reply' },
      { text: 'haha awesome!', confidence: 'medium', reason: 'Context-aligned reply' }
    ]);
  }
}

// Sent Message Listener for Real-Time Passive Learning
function setupSentMessageListener() {
  const handleMessageSend = async () => {
    if (!isLearningActive) {
      return;
    }

    const sentText = getCurrentInputText();
    const contactName = extractActiveContactName();
    if (sentText && sentText.length > 2) {
      console.log('💬 [Echo] Passively learning sent message for', contactName, ':', sentText);
      await sendToBackground('LEARN_MESSAGE', {
        sender: 'user',
        content: sentText,
        platform: getPlatformName(),
        contact_id: contactName,
        weight: 1.0,
      });
    }
  };

  document.addEventListener(
    'keydown',
    async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        await handleMessageSend();
      }
    },
    true
  );

  document.addEventListener(
    'click',
    async (e) => {
      const target = e.target as HTMLElement;
      if (target && (target.closest('button[aria-label="Send"]') || target.closest('span[data-icon="send"]') || target.closest('button[type="submit"]'))) {
        await handleMessageSend();
      }
    },
    true
  );
}

// DOM Observer for Chat Window Changes (Debounced)
let debounceTimer: any = null;

function debouncedScan() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      injectEchoBar();
      triggerReplyGeneration();
    } catch {
      // Ignored
    }
  }, 400);
}

function initObserver() {
  try {
    const observer = new MutationObserver(() => {
      debouncedScan();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  } catch (e) {
    console.error('✨ [Echo] Observer error:', e);
  }
}

// Run Initialization
initGlassOpacity();
setTimeout(() => {
  try {
    injectEchoBar();
    setupSentMessageListener();
    initObserver();
  } catch {
    // Ignored
  }
}, 1000);
