import React, { useEffect, useState } from 'react';
import { Sparkles, MessageSquare, Bot, RefreshCw, Send, Sliders, CheckCircle, XCircle, Brain, Edit3, Wand2, Copy, Check } from 'lucide-react';
import { HealthStatus, StyleProfile } from '../types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'polish' | 'chat' | 'quiz' | 'rewrite' | 'seed'>('dashboard');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Polish / Grammar & Vocab Fix State
  const [polishInput, setPolishInput] = useState('');
  const [polishOutput, setPolishOutput] = useState<{ refined: string; explanation: string } | null>(null);
  const [polishAction, setPolishAction] = useState<string>('fix_vocab');
  const [isPolishing, setIsPolishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chatbot State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'bot'; text: string; explanation?: string }[]>([
    { sender: 'bot', text: "👋 Hi! I'm Echo powered by Llama 3.2. I learn your writing style, fix paragraph mistakes, and generate smart replies. How can I help you today?" }
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

  const fetchData = async () => {
    setLoading(true);
    try {
      chrome.runtime.sendMessage({ action: 'GET_HEALTH' }, (res) => {
        if (res && res.success) {
          setHealth(res.data);
        } else {
          setHealth(null);
        }
      });

      chrome.runtime.sendMessage({ action: 'GET_PROFILE' }, (res) => {
        if (res && res.success) {
          setProfile(res.data);
        }
        setLoading(false);
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePolishDraft = (actionType: string = polishAction) => {
    if (!polishInput.trim()) return;
    setIsPolishing(true);
    chrome.runtime.sendMessage(
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

    chrome.runtime.sendMessage(
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
    chrome.runtime.sendMessage(
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

    chrome.runtime.sendMessage(
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
    chrome.runtime.sendMessage({ action: 'EXPORT_PROFILE' }, (res) => {
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
        chrome.runtime.sendMessage({ action: 'IMPORT_PROFILE', payload: parsed }, (res) => {
          if (res && res.success) {
            alert(`Profile imported! ${res.data.imported_count || 0} sample messages added.`);
            fetchData();
          }
        });
      } catch (err) {
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

    chrome.runtime.sendMessage(
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
    chrome.runtime.sendMessage({ action: 'RESET_PROFILE' }, (res) => {
      setIsResetting(false);
      if (res && res.success) {
        fetchData();
      }
    });
  };

  const activeModelName = health?.active_model || health?.ollama?.active_model || 'llama3.2';

  return (
    <div className="w-[400px] p-4 bg-slate-950/80 text-slate-100 min-h-[560px] flex flex-col font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-xl shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm text-white tracking-wide">Echo</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                Llama 3.2
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Personalized Copilot • 100% Local</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 rounded-full border border-white/10 text-[11px] backdrop-blur-md">
          {health?.status === 'online' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-emerald-300 font-semibold">{activeModelName.split(':')[0]} Online</span>
            </>
          ) : (
            <>
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-300 font-medium">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Glassmorphic Navigation Tabs */}
      <div className="flex bg-slate-900/60 p-1 rounded-xl my-3 border border-white/10 backdrop-blur-md overflow-x-auto gap-0.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'dashboard'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Brain className="w-3 h-3" />
          Profile
        </button>

        <button
          onClick={() => setActiveTab('polish')}
          className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'polish'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25'
              : 'text-emerald-400 hover:text-emerald-300 hover:bg-white/5'
          }`}
        >
          <Wand2 className="w-3 h-3" />
          Polish
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'chat'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Bot className="w-3 h-3" />
          Chat
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'quiz'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Sliders className="w-3 h-3" />
          Quiz
        </button>

        <button
          onClick={() => setActiveTab('rewrite')}
          className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'rewrite'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Edit3 className="w-3 h-3" />
          Ghost
        </button>

        <button
          onClick={() => setActiveTab('seed')}
          className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
            activeTab === 'seed'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          Train
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* POLISH DRAFT TAB */}
        {activeTab === 'polish' && (
          <div className="space-y-2.5">
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/25 rounded-xl">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-xs">
                <Wand2 className="w-3.5 h-3.5" />
                <span>Fix Mistakes & Upgrade Vocabulary</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Paste any paragraph with typos or grammar errors to polish with Llama 3.2.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-slate-300">
                <label className="font-semibold text-[11px]">Draft Paragraph:</label>
                <span className="text-[10px] text-slate-400">Preserves your voice</span>
              </div>
              <textarea
                value={polishInput}
                onChange={(e) => setPolishInput(e.target.value)}
                placeholder="Paste or write your message here (e.g. paragraph with vocabulary or grammar mistakes)..."
                className="w-full h-24 bg-slate-900/80 border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 resize-none backdrop-blur-sm"
              />
            </div>

            <div className="flex flex-wrap gap-1">
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
                  className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-lg border transition-all ${
                    polishAction === pill.id
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/30'
                      : 'bg-slate-900/60 text-slate-300 border-white/10 hover:bg-slate-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePolishDraft(polishAction)}
              disabled={isPolishing || !polishInput.trim()}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {isPolishing ? 'Refining with Llama 3.2...' : 'Polish Message Now'}
            </button>

            {polishOutput && (
              <div className="p-3 bg-slate-900/90 border border-emerald-500/30 rounded-xl space-y-1.5 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    ✓ Polished Output
                  </span>
                  <button
                    onClick={handleCopyPolish}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs text-white leading-relaxed select-text">{polishOutput.refined}</p>
                <p className="text-[10px] text-slate-400 italic pt-1 border-t border-white/10">
                  {polishOutput.explanation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* CHATBOT TAB */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-[340px] bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden p-3 backdrop-blur-md">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-2">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs max-w-[88%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white ml-auto rounded-br-none shadow-md shadow-indigo-500/20'
                      : 'bg-slate-900/80 border border-white/10 text-slate-200 mr-auto rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {isChatting && (
                <div className="p-2.5 rounded-xl text-xs bg-slate-900/80 border border-white/10 text-indigo-300 mr-auto rounded-bl-none animate-pulse">
                  Echo is thinking with Llama 3.2...
                </div>
              )}
            </div>

            <div className="flex gap-1.5 pt-2 border-t border-white/10">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ask Echo or draft a message..."
                className="flex-1 bg-slate-900/90 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSendChatMessage}
                disabled={isChatting || !chatInput.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shadow-md shadow-indigo-500/20"
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
            <div className="p-3 bg-gradient-to-r from-indigo-950/60 to-violet-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-between backdrop-blur-md">
              <div>
                <span className="text-xs text-indigo-300 block font-medium">Learned Sent Messages</span>
                <span className="text-xl font-extrabold text-white">
                  {profile?.total_messages_learned || 0}
                </span>
              </div>
              <button
                onClick={fetchData}
                className="p-2 text-indigo-300 hover:bg-indigo-900/40 rounded-lg transition-colors"
                title="Refresh Profile"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Top Emojis & Greetings Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl backdrop-blur-md">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">Top Emojis</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile?.top_emojis && profile.top_emojis.length > 0 ? (
                    profile.top_emojis.map((e, idx) => (
                      <span key={idx} className="bg-slate-800/80 text-base px-1.5 py-0.5 rounded border border-white/5" title={`${e.count} times`}>
                        {e.emoji}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">None recorded</span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl backdrop-blur-md">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">Top Greetings</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile?.top_greetings && profile.top_greetings.length > 0 ? (
                    profile.top_greetings.map((g, idx) => (
                      <span key={idx} className="bg-indigo-950/60 text-indigo-300 text-xs px-2 py-0.5 rounded border border-indigo-500/30 font-semibold">
                        {g.greeting}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">hey, yo</span>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-3 bg-slate-900/60 border border-white/10 rounded-xl space-y-2 text-xs backdrop-blur-md">
              <div className="flex justify-between items-center text-slate-300">
                <span>Avg Sentence Length:</span>
                <span className="font-semibold text-indigo-300">{profile?.avg_sentence_length || 0} words</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Punctuation Style:</span>
                <span className="font-medium text-slate-400">
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
                className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded-xl text-[11px] font-semibold transition-all"
              >
                📥 Export Persona
              </button>
              <label className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 rounded-xl text-[11px] font-semibold transition-all text-center cursor-pointer">
                📤 Import JSON
                <input type="file" accept=".json" onChange={handleImportProfile} className="hidden" />
              </label>
            </div>

            <button
              onClick={handleReset}
              disabled={isResetting || !profile?.total_messages_learned}
              className="w-full py-1.5 bg-rose-950/30 hover:bg-rose-900/50 disabled:opacity-40 text-rose-300 border border-rose-800/40 rounded-xl text-[11px] font-semibold transition-all"
            >
              {isResetting ? 'Clearing style data...' : 'Clear Style Profile Data'}
            </button>
          </div>
        )}

        {/* QUIZ TAB */}
        {activeTab === 'quiz' && (
          <div className="space-y-3">
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl backdrop-blur-md">
              <h2 className="text-xs font-bold text-indigo-200 mb-1">⚡ Quick Persona Setup</h2>
              <p className="text-[11px] text-slate-400">Instantly train Llama 3.2 to mimic your personal style.</p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">1. Default Greeting:</label>
              <div className="flex gap-1.5">
                {['hey', 'yo', 'hi', 'wassup'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setQuizGreeting(g)}
                    className={`flex-1 py-1 text-xs rounded-lg border font-medium ${
                      quizGreeting === g ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-300 border-white/10'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">2. Go-to Emoji:</label>
              <div className="flex gap-1.5">
                {['👍', '🔥', '😂', '💀', '🙏'].map((e) => (
                  <button
                    key={e}
                    onClick={() => setQuizEmoji(e)}
                    className={`flex-1 py-1 text-base rounded-lg border ${
                      quizEmoji === e ? 'bg-indigo-600 border-indigo-500 shadow-md' : 'bg-slate-900 border-white/10'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">3. Typing Preference:</label>
              <button
                onClick={() => setQuizLowercase(!quizLowercase)}
                className="w-full py-1.5 text-xs rounded-lg border bg-slate-900 text-slate-200 border-white/10 flex items-center justify-between px-3"
              >
                <span>Informal lowercase typing</span>
                <span className={`font-bold ${quizLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {quizLowercase ? 'ENABLED' : 'DISABLED'}
                </span>
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">4. Sample messages (sent elsewhere):</label>
              <textarea
                value={quizSamples}
                onChange={(e) => setQuizSamples(e.target.value)}
                placeholder="e.g., hey bro sounds good!\ncatch ya at 5pm\nyeah fr fr"
                className="w-full h-16 bg-slate-900 border border-white/10 rounded-xl p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              onClick={handleQuizSubmit}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/25"
            >
              {quizSaved ? '✓ Persona Quiz Saved!' : 'Save & Seed Persona'}
            </button>
          </div>
        )}

        {/* GHOST REWRITE TAB */}
        {activeTab === 'rewrite' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Select Persona Style / Ghost Mode:</label>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[
                  { id: 'user', label: 'My Style' },
                  { id: 'genz', label: 'Gen-Z Slang' },
                  { id: 'executive', label: 'Executive Formal' },
                  { id: 'emoji_heavy', label: 'Emoji Heavy' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setGhostMode(m.id as any)}
                    className={`py-1 text-[11px] font-medium rounded-lg border transition-all ${
                      ghostMode === m.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-white/10'
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
                className="w-full h-20 bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              onClick={handleRewrite}
              disabled={isRewriting || !rewriteInput.trim()}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25"
            >
              <Sparkles className="w-4 h-4" />
              {isRewriting ? 'Rewriting with Llama 3.2...' : 'Rewrite in Ghost Mode'}
            </button>

            {rewriteOutput && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl">
                <span className="text-[11px] text-indigo-300 font-semibold block mb-1">Rewritten Output:</span>
                <p className="text-xs text-white leading-relaxed">{rewriteOutput}</p>
              </div>
            )}
          </div>
        )}

        {/* TRAIN / SEED TAB */}
        {activeTab === 'seed' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">
                Train Echo with past messages (1 message per line):
              </label>
              <textarea
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="hey bro! sup?\nyeah sounds like a plan 🔥\nlet's catch up tomorrow around 5pm"
                className="w-full h-24 bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <button
              onClick={handleSeed}
              disabled={isSeeding || !seedInput.trim()}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25"
            >
              <Send className="w-4 h-4" />
              {isSeeding ? 'Learning messages...' : 'Train Persona Now'}
            </button>

            {seedMessage && (
              <div className="p-2.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-emerald-300 font-medium text-center">
                {seedMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-white/10 mt-3 flex items-center justify-between text-[10px] text-slate-500">
        <span>Echo v1.2 • Glassmorphic</span>
        <span>Model: {activeModelName}</span>
      </div>
    </div>
  );
}
