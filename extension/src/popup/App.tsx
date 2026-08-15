import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  Bot,
  RefreshCw,
  Send,
  Sliders,
  XCircle,
  Brain,
  Edit3,
  Wand2,
  Copy,
  Check,
  Droplets,
  SlidersHorizontal
} from 'lucide-react';
import { HealthStatus, StyleProfile } from '../types';

// Safe messaging helper to prevent runtime exceptions if background worker restarts
function safeSendMessage(message: any, callback?: (response: any) => void) {
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.id &&
      typeof chrome.runtime.sendMessage === 'function'
    ) {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime?.lastError) {
          if (callback) callback(null);
          return;
        }
        if (callback) callback(res);
      });
    } else {
      if (callback) callback(null);
    }
  } catch {
    if (callback) callback(null);
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'polish' | 'chat' | 'quiz' | 'rewrite' | 'seed'>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Dynamic Transparency Control State
  const [glassOpacity, setGlassOpacity] = useState<number>(72);
  const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);

  // Polish / Grammar & Vocab Fix State
  const [polishInput, setPolishInput] = useState('');
  const [polishOutput, setPolishOutput] = useState<{ refined: string; explanation: string } | null>(null);
  const [polishAction, setPolishAction] = useState<string>('fix_vocab');
  const [isPolishing, setIsPolishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chatbot State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'bot'; text: string; explanation?: string }[]>([
    {
      sender: 'bot',
      text: "👋 Hi! I'm Echo powered by Llama 3.2. I learn your writing style, fix paragraph mistakes, and generate smart replies. How can I help you today?"
    }
  ]);
  const [isChatting, setIsChatting] = useState(false);

  // Quiz State
  const [quizGreeting, setQuizGreeting] = useState('hey');
  const [quizEmoji, setQuizEmoji] = useState('👍');
  const [quizLowercase, setQuizLowercase] = useState(true);
  const [quizSamples, setQuizSamples] = useState('');
  const [quizSaved, setQuizSaved] = useState(false);

  // Rewrite state
  const [rewriteInput, setRewriteInput] = useState('');
  const [rewriteOutput, setRewriteOutput] = useState('');
  const [ghostMode, setGhostMode] = useState<'user' | 'genz' | 'executive' | 'emoji_heavy'>('user');
  const [isRewriting, setIsRewriting] = useState(false);

  // Seed state
  const [seedInput, setSeedInput] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Apply glass opacity to CSS variable and persist
  const handleOpacityChange = (val: number) => {
    const clamped = Math.max(10, Math.min(100, val));
    setGlassOpacity(clamped);
    document.documentElement.style.setProperty('--echo-glass-opacity', (clamped / 100).toFixed(2));
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ echo_glass_opacity: clamped });
      }
      localStorage.setItem('echo_glass_opacity', String(clamped));
    } catch {}
  };

  const fetchData = () => {
    setLoading(true);
    safeSendMessage({ action: 'GET_HEALTH' }, (res) => {
      if (res && res.success) {
        setHealth(res.data);
      } else {
        setHealth(null);
      }
    });

    safeSendMessage({ action: 'GET_PROFILE' }, (res) => {
      if (res && res.success) {
        setProfile(res.data);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    // Load stored opacity setting
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['echo_glass_opacity'], (res) => {
          if (res && res.echo_glass_opacity) {
            handleOpacityChange(Number(res.echo_glass_opacity));
          } else {
            const localVal = localStorage.getItem('echo_glass_opacity');
            if (localVal) handleOpacityChange(Number(localVal));
          }
        });
      } else {
        const localVal = localStorage.getItem('echo_glass_opacity');
        if (localVal) handleOpacityChange(Number(localVal));
      }
    } catch {}

    fetchData();
  }, []);

  const handlePolishDraft = (actionType: string = polishAction) => {
    if (!polishInput.trim()) return;
    setIsPolishing(true);
    safeSendMessage(
      { action: 'REFINE_VOCAB', payload: { text: polishInput, action: actionType } },
      (res) => {
        setIsPolishing(false);
        if (res && res.success && res.data?.refined) {
          setPolishOutput({
            refined: res.data.refined,
            explanation: res.data.explanation || 'Refined with Llama 3.2'
          });
        }
      }
    );
  };

  const handleCopyPolish = () => {
    if (polishOutput?.refined) {
      navigator.clipboard.writeText(polishOutput.refined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text }]);
    setIsChatting(true);

    safeSendMessage(
      { action: 'CHAT_WITH_ECHO', payload: { message: text } },
      (res) => {
        setIsChatting(false);
        if (res && res.success && res.data?.reply) {
          setChatMessages((prev) => [...prev, { sender: 'bot', text: res.data.reply }]);
        } else {
          setChatMessages((prev) => [...prev, { sender: 'bot', text: 'Error reaching Echo. Ensure local backend is running.' }]);
        }
      }
    );
  };

  const handleRewrite = () => {
    if (!rewriteInput.trim()) return;
    setIsRewriting(true);
    safeSendMessage(
      { action: 'REWRITE_TEXT', payload: { text: rewriteInput, ghost_mode: ghostMode } },
      (res) => {
        setIsRewriting(false);
        if (res && res.success && res.data?.rewritten) {
          setRewriteOutput(res.data.rewritten);
        } else {
          setRewriteOutput('Error rewriting text. Ensure local backend is running.');
        }
      }
    );
  };

  const handleQuizSubmit = () => {
    const samples = quizSamples
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    safeSendMessage(
      {
        action: 'SEED_MESSAGES',
        payload: {
          messages: samples.length > 0 ? samples : ['hey sounds good!', 'sure let me check'],
          greetings: [quizGreeting],
          favorite_emojis: [quizEmoji],
          lowercase_pref: quizLowercase,
        },
      },
      (res) => {
        if (res && res.success) {
          setQuizSaved(true);
          fetchData();
          setTimeout(() => setQuizSaved(false), 3000);
        }
      }
    );
  };

  const handleExportProfile = () => {
    safeSendMessage({ action: 'EXPORT_PROFILE' }, (res) => {
      if (res && res.success && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'echo_persona_profile.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        safeSendMessage({ action: 'IMPORT_PROFILE', payload: parsed }, (res) => {
          if (res && res.success) {
            alert(`Profile imported! ${res.data.imported_count || 0} sample messages added.`);
            fetchData();
          }
        });
      } catch {
        alert('Invalid JSON persona file.');
      }
    };
    reader.readAsText(file);
  };

  const handleSeed = () => {
    if (!seedInput.trim()) return;
    setIsSeeding(true);
    setSeedMessage('');
    const messages = seedInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    safeSendMessage(
      { action: 'SEED_MESSAGES', payload: { messages } },
      (res) => {
        setIsSeeding(false);
        if (res && res.success && res.data) {
          setSeedInput('');
          setSeedMessage(`Learned ${res.data.added_count || 0} new messages!`);
          fetchData();
        } else {
          setSeedMessage('Failed to learn messages. Is backend running?');
        }
      }
    );
  };

  const handleReset = () => {
    if (!confirm('Are you sure you want to clear all learned style persona data?')) return;
    setIsResetting(true);
    safeSendMessage({ action: 'RESET_PROFILE' }, (res) => {
      setIsResetting(false);
      if (res && res.success) {
        fetchData();
      }
    });
  };

  const activeModelName = health?.active_model || health?.ollama?.active_model || 'llama3.2';

  return (
    <div className="w-[400px] p-4 text-slate-900 min-h-[570px] flex flex-col font-sans select-none box-border">
      {/* Frosted Glass Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/25 border border-white/50">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm text-slate-900 tracking-tight">Echo</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-full">
                GlassMorphism
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Llama 3.2 • Privacy Copilot</p>
          </div>
        </div>

        {/* Controls Cluster: Transparency & Status */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            className="p-1.5 bg-white/70 hover:bg-white text-slate-700 rounded-full border border-white/90 shadow-sm transition-all flex items-center gap-1 text-[11px] font-semibold"
            title="Adjust Glass Transparency"
          >
            <Droplets className="w-3.5 h-3.5 text-blue-600" />
            <span>{glassOpacity}%</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/75 rounded-full border border-white/90 text-[11px] shadow-sm backdrop-blur-md">
            {health?.status === 'online' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span className="text-emerald-700 font-bold">{activeModelName.split(':')[0]}</span>
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-rose-600 font-semibold">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Transparency Adjuster Panel */}
      {showOpacitySlider && (
        <div className="mt-2.5 p-3 glass-card rounded-2xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              Glass Transparency Slider
            </span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] rounded-full font-bold">
              {glassOpacity}% Opacity
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-semibold">10% Clear</span>
            <input
              type="range"
              min="10"
              max="100"
              value={glassOpacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[10px] text-slate-500 font-semibold">100% Solid</span>
          </div>

          <div className="flex gap-1.5 pt-1">
            {[
              { label: 'Crystal', val: 35 },
              { label: 'Frosted (Recommended)', val: 65 },
              { label: 'Milky', val: 85 },
              { label: 'Solid', val: 100 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => handleOpacityChange(p.val)}
                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                  glassOpacity === p.val
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white/70 text-slate-700 border-white hover:bg-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Glassmorphic Capsule Navigation Tabs */}
      <div className="flex bg-white/60 p-1.5 rounded-full my-3 border border-white/90 backdrop-blur-md overflow-x-auto gap-1 shadow-sm">
        {[
          { id: 'dashboard', label: 'Profile', icon: Brain },
          { id: 'polish', label: 'Polish', icon: Wand2 },
          { id: 'chat', label: 'Chat', icon: Bot },
          { id: 'quiz', label: 'Quiz', icon: Sliders },
          { id: 'rewrite', label: 'Ghost', icon: Edit3 },
          { id: 'seed', label: 'Train', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-1.5 px-2.5 text-[11px] font-bold rounded-full transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* POLISH DRAFT TAB */}
        {activeTab === 'polish' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                <Wand2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fix Mistakes & Upgrade Vocabulary</span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Paste any paragraph with typos or grammar errors to polish with Llama 3.2.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-700">
                <label className="font-bold text-[11px]">Draft Paragraph:</label>
                <span className="text-[10px] text-slate-500">Preserves your natural voice</span>
              </div>
              <textarea
                value={polishInput}
                onChange={(e) => setPolishInput(e.target.value)}
                placeholder="Paste or write your message here (e.g. paragraph with vocabulary or grammar mistakes)..."
                className="w-full h-24 glass-input rounded-2xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/60 resize-none shadow-sm"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'fix_vocab', label: '✨ Fix Mistakes' },
                { id: 'formal', label: '💼 Formal' },
                { id: 'concise', label: '⚡ Concise' },
                { id: 'casual', label: '🔥 Casual' },
                { id: 'expand', label: '📝 Elaborate' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => {
                    setPolishAction(pill.id);
                    handlePolishDraft(pill.id);
                  }}
                  className={`px-3 py-1 text-[11px] font-bold rounded-full border transition-all ${
                    polishAction === pill.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/30'
                      : 'bg-white/70 text-slate-700 border-white hover:bg-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePolishDraft(polishAction)}
              disabled={isPolishing || !polishInput.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {isPolishing ? 'Refining with Llama 3.2...' : 'Polish Message Now'}
            </button>

            {polishOutput && (
              <div className="p-3.5 glass-card border-emerald-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    ✓ Polished Output
                  </span>
                  <button
                    onClick={handleCopyPolish}
                    className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-900 font-medium leading-relaxed select-text">{polishOutput.refined}</p>
                <p className="text-[10.5px] text-slate-500 italic pt-1.5 border-t border-slate-200/60">
                  {polishOutput.explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CHATBOT TAB */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-[340px] glass-panel rounded-2xl overflow-hidden p-3 shadow-sm">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-2xl text-xs max-w-[88%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ml-auto rounded-br-none shadow-md shadow-blue-500/20'
                      : 'bg-white/85 border border-white/90 text-slate-800 mr-auto rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {isChatting && (
                <div className="p-2.5 rounded-2xl text-xs bg-white/85 border border-white/90 text-blue-600 mr-auto rounded-bl-none animate-pulse font-medium">
                  Echo is thinking with Llama 3.2...
                </div>
              )}
            </div>

            <div className="flex gap-1.5 pt-2 border-t border-white/60">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ask Echo or draft a message..."
                className="flex-1 glass-input rounded-full px-3.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
              />
              <button
                onClick={handleSendChatMessage}
                disabled={isChatting || !chatInput.trim()}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-md shadow-slate-900/20"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-3">
            {/* Learned Count Summary */}
            <div className="p-3.5 glass-card rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-600 block font-semibold">Learned Sent Messages</span>
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {profile?.total_messages_learned || 0}
                </span>
              </div>
              <button
                onClick={fetchData}
                className="p-2 text-slate-700 hover:bg-white/80 rounded-full border border-white transition-all shadow-sm"
                title="Refresh Profile"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Top Emojis & Greetings Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 glass-panel rounded-2xl">
                <span className="text-[11px] text-slate-600 font-bold block mb-1">Top Emojis</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile?.top_emojis && profile.top_emojis.length > 0 ? (
                    profile.top_emojis.map((e, idx) => (
                      <span key={idx} className="bg-white/80 text-base px-2 py-0.5 rounded-full border border-white shadow-sm" title={`${e.count} times`}>
                        {e.emoji}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">None recorded</span>
                  )}
                </div>
              </div>

              <div className="p-3 glass-panel rounded-2xl">
                <span className="text-[11px] text-slate-600 font-bold block mb-1">Top Greetings</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile?.top_greetings && profile.top_greetings.length > 0 ? (
                    profile.top_greetings.map((g, idx) => (
                      <span key={idx} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-0.5 rounded-full border border-blue-200 font-bold">
                        {g.greeting}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">hey, yo</span>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-3 glass-panel rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>Avg Sentence Length:</span>
                <span className="font-bold text-blue-600">{profile?.avg_sentence_length || 0} words</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>Punctuation Style:</span>
                <span className="font-bold text-slate-600">
                  {profile?.punctuation_habits?.lowercase_only && profile.punctuation_habits.lowercase_only > 2
                    ? 'Informal Lowercase'
                    : 'Standard Casing'}
                </span>
              </div>
            </div>

            {/* Import / Export Row */}
            <div className="flex gap-2">
              <button
                onClick={handleExportProfile}
                className="flex-1 py-2 bg-white/70 hover:bg-white text-slate-800 border border-white/90 rounded-full text-[11px] font-bold transition-all shadow-sm"
              >
                📥 Export Persona
              </button>
              <label className="flex-1 py-2 bg-white/70 hover:bg-white text-slate-800 border border-white/90 rounded-full text-[11px] font-bold transition-all text-center cursor-pointer shadow-sm">
                📤 Import JSON
                <input type="file" accept=".json" onChange={handleImportProfile} className="hidden" />
              </label>
            </div>

            <button
              onClick={handleReset}
              disabled={isResetting || !profile?.total_messages_learned}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-600 border border-rose-200 rounded-full text-[11px] font-bold transition-all"
            >
              {isResetting ? 'Clearing style data...' : 'Clear Style Profile Data'}
            </button>
          </div>
        )}

        {/* QUIZ TAB */}
        {activeTab === 'quiz' && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <h2 className="text-xs font-bold text-blue-900 mb-0.5">⚡ Quick Persona Setup</h2>
              <p className="text-[11px] text-blue-700 font-medium">Instantly train Llama 3.2 to mimic your personal style.</p>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">1. Default Greeting:</label>
              <div className="flex gap-1.5">
                {['hey', 'yo', 'hi', 'wassup'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setQuizGreeting(g)}
                    className={`flex-1 py-1.5 text-xs rounded-full border font-bold transition-all ${
                      quizGreeting === g ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white/70 text-slate-700 border-white hover:bg-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">2. Go-to Emoji:</label>
              <div className="flex gap-1.5">
                {['👍', '🔥', '😂', '💀', '🙏'].map((e) => (
                  <button
                    key={e}
                    onClick={() => setQuizEmoji(e)}
                    className={`flex-1 py-1 text-base rounded-full border transition-all ${
                      quizEmoji === e ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white/70 border-white hover:bg-white'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">3. Typing Preference:</label>
              <button
                onClick={() => setQuizLowercase(!quizLowercase)}
                className="w-full py-2 text-xs rounded-2xl border bg-white/75 text-slate-800 border-white flex items-center justify-between px-3.5 shadow-sm"
              >
                <span className="font-semibold">Informal lowercase typing</span>
                <span className={`font-bold ${quizLowercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {quizLowercase ? 'ENABLED' : 'DISABLED'}
                </span>
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">4. Sample messages (sent elsewhere):</label>
              <textarea
                value={quizSamples}
                onChange={(e) => setQuizSamples(e.target.value)}
                placeholder="e.g., hey bro sounds good!\ncatch ya at 5pm\nyeah fr fr"
                className="w-full h-16 glass-input rounded-2xl p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none shadow-sm"
              />
            </div>

            <button
              onClick={handleQuizSubmit}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-md shadow-blue-500/25"
            >
              {quizSaved ? '✓ Persona Quiz Saved!' : 'Save & Seed Persona'}
            </button>
          </div>
        )}

        {/* GHOST REWRITE TAB */}
        {activeTab === 'rewrite' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1.5">Select Persona Style / Ghost Mode:</label>
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                {[
                  { id: 'user', label: 'My Style' },
                  { id: 'genz', label: 'Gen-Z Slang' },
                  { id: 'executive', label: 'Executive Formal' },
                  { id: 'emoji_heavy', label: 'Emoji Heavy' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setGhostMode(m.id as any)}
                    className={`py-1.5 text-[11px] font-bold rounded-full border transition-all ${
                      ghostMode === m.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white/70 text-slate-700 border-white hover:bg-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <textarea
                value={rewriteInput}
                onChange={(e) => setRewriteInput(e.target.value)}
                placeholder="e.g., I am confirming that I will attend the meeting..."
                className="w-full h-20 glass-input rounded-2xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none shadow-sm"
              />
            </div>

            <button
              onClick={handleRewrite}
              disabled={isRewriting || !rewriteInput.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/25"
            >
              <Sparkles className="w-4 h-4" />
              {isRewriting ? 'Rewriting with Llama 3.2...' : 'Rewrite in Ghost Mode'}
            </button>

            {rewriteOutput && (
              <div className="p-3.5 glass-card rounded-2xl">
                <span className="text-[11px] text-blue-700 font-bold block mb-1">Rewritten Output:</span>
                <p className="text-xs text-slate-900 font-medium leading-relaxed">{rewriteOutput}</p>
              </div>
            )}
          </div>
        )}

        {/* TRAIN / SEED TAB */}
        {activeTab === 'seed' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-700 font-bold block mb-1">
                Train Echo with past messages (1 message per line):
              </label>
              <textarea
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="hey bro! sup?\nyeah sounds like a plan 🔥\nlet's catch up tomorrow around 5pm"
                className="w-full h-24 glass-input rounded-2xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none shadow-sm"
              />
            </div>

            <button
              onClick={handleSeed}
              disabled={isSeeding || !seedInput.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25"
            >
              <Send className="w-4 h-4" />
              {isSeeding ? 'Learning messages...' : 'Train Persona Now'}
            </button>

            {seedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold text-center">
                {seedMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-white/60 mt-3 flex items-center justify-between text-[10.5px] text-slate-500 font-medium">
        <span>Echo v1.4 • Frosted White Glass</span>
        <span>Model: {activeModelName}</span>
      </div>
    </div>
  );
}
