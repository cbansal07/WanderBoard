import { useState } from 'react';
import { generateItinerary } from './aiService';

interface GenerateItineraryModalProps {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  userId: string;
  onClose: () => void;
  onComplete: () => void;
}

export function GenerateItineraryModal({
  tripId,
  destination,
  startDate,
  endDate,
  userId,
  onClose,
  onComplete,
}: GenerateItineraryModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');

    const res = await generateItinerary({
      tripId,
      destination,
      startDate,
      endDate,
      userId,
      prompt,
    });

    setLoading(false);
    if (res.success) {
      onComplete();
      onClose();
    } else {
      setError(res.error || 'Failed to generate itinerary. Check API key and Vercel setup.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: 'var(--wb-ink)' }}>
            ✨ Auto-generate Itinerary
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full p-2 hover:bg-slate-100 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--wb-ink-soft)' }}>
            What kind of trip are you looking for?
          </label>
          <textarea
            className="w-full resize-none rounded-xl border p-3 text-sm focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
            style={{ borderColor: 'var(--wb-line)' }}
            rows={4}
            placeholder="e.g. A relaxing 3-day trip focused on historical sites, museums, and street food. I want to start my days at 10 AM."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="wb-btn wb-btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
            className="wb-btn wb-btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
