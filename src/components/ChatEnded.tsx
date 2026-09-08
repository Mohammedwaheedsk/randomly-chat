import { RotateCcw, Sparkles } from 'lucide-react';

interface ChatEndedProps {
  reason: string;
  onNewChat: () => void;
  onHome: () => void;
}

export default function ChatEnded({ reason, onNewChat, onHome }: ChatEndedProps) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 w-96 h-96 bg-gray-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-gray-500" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Chat Ended</h2>
        <p className="text-gray-400 mb-8">{reason}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onNewChat}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-teal-400 hover:to-cyan-500 transition-all shadow-lg shadow-teal-500/20"
          >
            <RotateCcw className="w-5 h-5" />
            New Chat
          </button>
          <button
            onClick={onHome}
            className="flex-1 py-3.5 bg-white/5 border border-white/10 text-gray-300 font-semibold rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
