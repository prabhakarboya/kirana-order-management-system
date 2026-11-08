import React, { useState, useRef } from 'react';
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
  Upload,
  Square,
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

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePasteSample = () => {
    setRawText(SAMPLE_MESSAGE);
  };

  // Real Photo Upload & Multimodal OCR
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/ai/parse-photo', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data: AiParseResponse = await res.json();
        sessionStorage.setItem('ai_order_draft', JSON.stringify(data));
        navigate('/ai-capture/confirm');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to process handwritten photo slip.');
      }
    } catch {
      setError('Network error: Unable to contact multimodal OCR server.');
    } finally {
      setLoading(false);
    }
  };

  // Real Web MediaRecorder Microphone Audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // If mic blocked or unavailable, fall back gracefully to demo transcription
      setError('Microphone access denied or not supported. Falling back to sample audio note.');
      handleSampleVoiceNote();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const uploadAudioBlob = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('audio', blob, 'voice_note.webm');

    try {
      const res = await fetch('/api/ai/parse-audio', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data: AiParseResponse = await res.json();
        sessionStorage.setItem('ai_order_draft', JSON.stringify(data));
        navigate('/ai-capture/confirm');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to transcribe audio note.');
      }
    } catch {
      setError('Network error: Unable to reach audio transcription service.');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleVoiceNote = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/parse-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('ai_order_draft', JSON.stringify(data));
        navigate('/ai-capture/confirm');
      }
    } finally {
      setLoading(false);
    }
  };

  // Text Parsing
  const handleParseText = async (e: React.FormEvent) => {
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
        sessionStorage.setItem('ai_order_draft', JSON.stringify(data));
        navigate('/ai-capture/confirm');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to parse order message.');
      }
    } catch {
      setError('Network error: Unable to contact AI parser server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Multimodal Gemini AI Transcription Engine</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('aiCapture')}</h1>
        <p className="text-xs text-slate-500 mt-1">
          Transcribes WhatsApp texts, live Hindi voice notes, and photos of handwritten order slips into validated SKU orders.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Text Input Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <form onSubmit={handleParseText} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-700">Order Message Text (Hindi / Hinglish)</label>
              <button
                type="button"
                onClick={handlePasteSample}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition"
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

          {/* Multimodal Actions (Voice Recording & Photo Upload) */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition animate-pulse shadow-sm"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Recording ({recordingSeconds}s) - Transcribing...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
              >
                <Mic className="w-4 h-4 text-emerald-600" />
                <span>Record Hindi Voice Note</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Upload Photo of Handwritten Slip</span>
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

      {/* Explanatory Architecture Box */}
      <div className="mt-6 bg-slate-50 rounded-2xl border border-slate-200/80 p-5">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Multimodal Pipeline for Company A (Jabalpur)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs text-slate-600">
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">1. Hinglish & Dialect Model</div>
            Parses local terms like <em>"peti"</em> (cases) vs <em>"khula"</em> (pieces) and applies learned retailer aliases.
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">2. Ambiguity Prevention</div>
            When units are unclear (e.g. 5 biscuit), asks question—<strong>never guesses</strong>.
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-900 mb-1">3. Human-in-the-Loop</div>
            Orders are never committed directly to Tally until human verification on confirm screen.
          </div>
        </div>
      </div>
    </div>
  );
};
