import { useState } from 'react';
import { Shield, Users, MessageSquare, Video, Sparkles, AlertTriangle } from 'lucide-react';

interface AgeGateProps {
  onConfirm: () => void;
}

export default function AgeGate({ onConfirm }: AgeGateProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl mb-4 shadow-lg shadow-teal-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Randomly</h1>
          <p className="text-gray-400 text-lg">Talk to strangers. Stay anonymous.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
            <MessageSquare className="w-6 h-6 text-teal-400 mx-auto mb-2" />
            <p className="text-sm text-gray-300">Text Chat</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
            <Video className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-sm text-gray-300">Video Call</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
            <Users className="w-6 h-6 text-teal-400 mx-auto mb-2" />
            <p className="text-sm text-gray-300">Voice Chat</p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-3 mb-6">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold mb-1">18+ Content Notice</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                This platform connects you with random strangers anonymously. You may encounter
                mature content or behavior. By continuing, you confirm you are at least 18 years old.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <div className="flex-shrink-0 w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold mb-1">Community Guidelines</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Be respectful. No harassment, illegal content, or spam. Use the report button
                to flag inappropriate behavior. Sessions are anonymous and not stored.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer mb-6 group">
            <div className="relative">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-6 h-6 bg-white/10 border-2 border-gray-600 rounded-lg peer-checked:bg-teal-500 peer-checked:border-teal-500 transition-all flex items-center justify-center">
                {confirmed && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-gray-300 text-sm">I confirm I am 18 years or older and agree to the community guidelines.</span>
          </label>

          <button
            onClick={onConfirm}
            disabled={!confirmed}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-teal-400 hover:to-cyan-500 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Start Chatting
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          By using Randomly, you accept full responsibility for your interactions.
        </p>
      </div>
    </div>
  );
}
