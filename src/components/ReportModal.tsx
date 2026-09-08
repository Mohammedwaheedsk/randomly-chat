import { useState } from 'react';
import { X, Flag } from 'lucide-react';

interface ReportModalProps {
  reportedId: string;
  onSubmit: (reason: string, details: string) => void;
  onClose: () => void;
}

const REASONS = [
  'Harassment or bullying',
  'Nudity or sexual content',
  'Hate speech',
  'Spam or scam',
  'Threats of violence',
  'Underage user',
  'Other',
];

export default function ReportModal({ reportedId, onSubmit, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit(reason, details);
    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Flag className="w-8 h-8 text-teal-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Report Submitted</h3>
          <p className="text-gray-400 text-sm">Thank you. Our moderation team will review this report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-400" />
            <h3 className="text-white text-lg font-semibold">Report User</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Report <span className="text-amber-400 font-mono">{reportedId}</span> for:
        </p>

        <div className="space-y-2 mb-4">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all ${
                reason === r
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          placeholder="Additional details (optional)..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors text-sm resize-none mb-4"
          rows={3}
        />

        <button
          onClick={handleSubmit}
          disabled={!reason}
          className="w-full py-3 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
