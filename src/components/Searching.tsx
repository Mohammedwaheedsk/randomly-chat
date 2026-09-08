import { useEffect, useState } from 'react';
import { Loader2, X, Users, Clock } from 'lucide-react';
import type { ChatMode } from '@/lib/types';

interface SearchingProps {
  mode: ChatMode;
  interests: string[];
  language: string;
  onCancel: () => void;
  estimatedWait: number;
}

export default function Searching({ mode, interests, language, onCancel, estimatedWait }: SearchingProps) {
  const [dots, setDots] = useState('');
  const [waitTime, setWaitTime] = useState(estimatedWait);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    const waitInterval = setInterval(() => {
      setWaitTime((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(dotInterval);
      clearInterval(waitInterval);
    };
  }, []);

  const modeLabel = mode === 'video' ? 'Video' : mode === 'voice' ? 'Voice' : 'Text';

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center">
        {/* Animated radar */}
        <div className="relative w-48 h-48 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-teal-500/20" />
          <div className="absolute inset-4 rounded-full border-2 border-teal-500/30" />
          <div className="absolute inset-8 rounded-full border-2 border-teal-500/40" />
          <div className="absolute inset-12 rounded-full border-2 border-teal-500/50" />
          <div className="absolute inset-0 rounded-full border-t-2 border-teal-400 animate-spin" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Looking for a stranger{dots}
        </h2>
        <p className="text-gray-400 mb-6">
          {modeLabel} chat · {language.toUpperCase()}
        </p>

        {interests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {interests.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-teal-500/20 border border-teal-500/30 text-teal-300 rounded-lg text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 mb-8 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>~{waitTime}s wait</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Users className="w-4 h-4" />
            <span>Searching globally</span>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
