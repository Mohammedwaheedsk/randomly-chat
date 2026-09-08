import { useState } from 'react';
import { MessageSquare, Video, Mic, Plus, X, Globe, Sparkles, ArrowRight } from 'lucide-react';
import type { ChatMode } from '@/lib/types';

interface LobbyProps {
  onStart: (config: {
    interests: string[];
    language: string;
    mode: ChatMode;
    nickname: string;
  }) => void;
  guestId: string;
}

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
];

const SUGGESTED_INTERESTS = [
  'music', 'gaming', 'movies', 'anime', 'coding', 'art',
  'travel', 'food', 'fitness', 'books', 'memes', 'philosophy',
  'science', 'sports', 'photography', 'tech',
];

export default function Lobby({ onStart, guestId }: LobbyProps) {
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [mode, setMode] = useState<ChatMode>('text');
  const [nickname, setNickname] = useState('');

  const addInterest = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/^#/, '');
    if (clean && !interests.includes(clean) && interests.length < 8) {
      setInterests([...interests, clean]);
    }
    setInterestInput('');
  };

  const removeInterest = (tag: string) => {
    setInterests(interests.filter((i) => i !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addInterest(interestInput);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl mb-3 shadow-lg shadow-teal-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Randomly</h1>
          <p className="text-gray-400 text-sm">
            You are <span className="text-teal-400 font-mono">{guestId}</span>
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nickname <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder={guestId}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
            />
          </div>

          {/* Mode selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Chat Mode</label>
            <div className="grid grid-cols-3 gap-3">
              <ModeCard
                icon={<MessageSquare className="w-5 h-5" />}
                label="Text"
                selected={mode === 'text'}
                onClick={() => setMode('text')}
              />
              <ModeCard
                icon={<Video className="w-5 h-5" />}
                label="Video"
                selected={mode === 'video'}
                onClick={() => setMode('video')}
              />
              <ModeCard
                icon={<Mic className="w-5 h-5" />}
                label="Voice"
                selected={mode === 'voice'}
                onClick={() => setMode('voice')}
              />
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Globe className="w-4 h-4 inline mr-1" />
              Language / Region
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    language === lang.code
                      ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="mr-1">{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Interests <span className="text-gray-500">(optional, up to 8)</span>
            </label>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus-within:border-teal-500 transition-colors">
                <Plus className="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={20}
                  placeholder="Add an interest..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {interests.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {interests.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-500/20 border border-teal-500/30 text-teal-300 rounded-lg text-sm"
                  >
                    #{tag}
                    <button
                      onClick={() => removeInterest(tag)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {SUGGESTED_INTERESTS.filter((s) => !interests.includes(s)).slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => addInterest(tag)}
                  className="px-2.5 py-1 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-xs hover:bg-white/10 hover:text-white transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={() => onStart({ interests, language, mode, nickname })}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-teal-400 hover:to-cyan-500 transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 group"
          >
            Start Chatting
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${
        selected
          ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-lg shadow-teal-500/10'
          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
