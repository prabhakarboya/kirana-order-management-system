import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Mic,
  Camera,
  ArrowRight,
  ClipboardPaste,
  HelpCircle,
  AlertCircle,
  FileText,
  Volume2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AiParseResponse } from '../types';

export const AiCapture: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const SAMPLE_MESSAGE =
    'bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti';

  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSimulatingAudio, setIsSimulatingAudio] = useState(false);

  const handlePasteSample = () => {
    setRawText(SAMPLE_MESSAGE);
  };

  const handleSimulateVoice = () => {
    setIsSimulatingAudio(true);
    setTimeout(() => {
      setRawText(SAMPLE_MESSAGE);
      setIsSimulatingAudio(false);
    }, 1500);
  };

  const handleSimulatePhoto = () => {
    setLoading(true);
    setTimeout(() => {
      setRawText(SAMPLE_MESSAGE);
      setLoading(false);
    }, 1200);
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      if (res.ok) {
        const data: AiParseResponse = await res.json();
        // Save parsed response to sessionStorage for confirm screen
        sessionStorage.setItem('ai_order_draft', JSON.stringify(data));
        navigate('/ai-capture/confirm');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to parse order message');
      }
    } catch {
      setError('Network error: Unable to contact AI parser server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Multimodal Order Transcription</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('aiCapture')}</h1>
        <p className="text-xs text-slate-500 mt-1">
          Turns unstructured WhatsApp texts, Hindi audio notes, and handwritten list photos into verified SKU orders.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Input Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <form onSubmit={handleParse} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-700">Order Message Text (Hindi / Hinglish)</label>
              <button
                type="button"
                onClick={handlePasteSample}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 transition"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>{t('sampleOrderBtn')}</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g. bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti"
              className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
              required
            />
          </div>

          {/* Multimodal Alternate Inputs (Voice Note & Photo list) */}
          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleSimulateVoice}
              disabled={isSimulatingAudio}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <Mic className={`w-4 h-4 ${isSimulatingAudio ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
              <span>{isSimulatingAudio ? 'Transcribing Hindi Audio...' : 'Simulate Hindi Voice Note'}</span>
            </button>

            <button
              type="button"
              onClick={handleSimulatePhoto}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <Camera className="w-4 h-4 text-slate-500" />
              <span>Simulate Photo of List</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !rawText.trim()}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'AI Parsing Order...' : 'Parse & Match SKUs'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Process Walkthrough Card */}
      <div className="mt-6 bg-slate-50 rounded-2xl border border-slate-200/80 p-5">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>How AI Capture Works in Kirana Order</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">1. Hinglish Extraction</div>
            Extracts quantities and units (peti vs piece) using local Jabalpur kirana dialect dictionaries.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">2. Learned Retailer Aliases</div>
            Checks retailer-specific past corrections before matching general catalog codes.
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">3. Human-in-the-Loop</div>
            Never places an order automatically. Asks questions if units are ambiguous or stock is zero.
          </div>
        </div>
      </div>
    </div>
  );
};
