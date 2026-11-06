import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  RefreshCw,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AiParseResponse, AiParsedItem } from '../types';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const ConfirmAiOrder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadItems } = useCart();

  const [parseData, setParseData] = useState<AiParseResponse | null>(null);
  const [items, setItems] = useState<AiParsedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rawDraft = sessionStorage.getItem('ai_order_draft');
    if (!rawDraft) {
      navigate('/ai-capture');
      return;
    }
    const data: AiParseResponse = JSON.parse(rawDraft);
    setParseData(data);
    setItems(data.items);
  }, [navigate]);

  const handleUpdateUnit = (index: number, newUnit: 'case' | 'piece') => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      target.detectedUnit = newUnit;
      target.clarificationQuestion = undefined;
      target.resolvedCases = newUnit === 'case' ? target.requestedQty : 1;
      updated[index] = target;
      return updated;
    });
  };

  const handleSelectAlternativeSku = (index: number, altSkuCode: string, altSkuName: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      target.skuCode = altSkuCode;
      target.skuName = altSkuName;
      target.confidence = 0.99; // Manually corrected
      updated[index] = target;
      return updated;
    });
  };

  const handleUpdateQuantity = (index: number, qty: number) => {
    if (qty < 0) return;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], resolvedCases: qty, requestedQty: qty };
      return updated;
    });
  };

  const handleConfirmAndProceed = async () => {
    // Filter out unmapped or zero items
    const validLines = items.filter((i) => i.skuCode && i.resolvedCases > 0);
    if (!validLines.length) {
      setError('Please resolve at least one SKU to proceed.');
      return;
    }

    // Check if any out-of-stock items are still included
    const hasOutOfStock = validLines.some((i) => i.stockStatus === 'OUT_OF_STOCK');
    if (hasOutOfStock) {
      const proceedAnyway = window.confirm(
        'Warning: Your order contains out-of-stock items (such as Tea Leaf). These items will be flagged for desk review and may be cut. Do you want to proceed?'
      );
      if (!proceedAnyway) return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Place order directly via API with AI_TEXT source
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validLines.map((l) => ({ skuCode: l.skuCode, qtyCases: l.resolvedCases })),
          source: 'AI_TEXT',
          rawMessage: parseData?.rawMessage,
        }),
      });

      if (res.ok) {
        sessionStorage.removeItem('ai_order_draft');
        navigate('/orders');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit captured order');
      }
    } catch {
      setError('Network error: Unable to submit order to server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!parseData) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Back Button */}
      <Link
        to="/ai-capture"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Raw Message Input</span>
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Confirm AI Order Capture</h1>
          <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
            Human Verification Required
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Review transcribed SKU mappings, resolve ambiguous units, and verify stock availability before submission.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Raw Original Message Card */}
      <div className="mb-6 p-4 rounded-xl bg-slate-100 border border-slate-200 text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Original Message Transcript
        </div>
        <div className="font-mono text-slate-800 font-medium italic">
          "{parseData.rawMessage}"
        </div>
      </div>

      {/* Extracted Lines */}
      <div className="space-y-4">
        {items.map((item, idx) => {
          const confidencePct = Math.round(item.confidence * 100);
          const isLowConfidence = confidencePct < 85;
          const isOutOfStock = item.stockStatus === 'OUT_OF_STOCK';

          return (
            <div
              key={idx}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition ${
                isOutOfStock
                  ? 'border-rose-300 bg-rose-50/20'
                  : item.detectedUnit === 'unclear'
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Row: Original Words & Confidence */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                      Original Words:
                    </span>
                    <span className="font-medium text-slate-800 text-sm font-mono">
                      "{item.originalText}"
                    </span>
                  </div>
                </div>

                {/* Confidence Level Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      confidencePct >= 90
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : confidencePct >= 75
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {t('aiConfidence')}: {confidencePct}%
                  </span>
                </div>
              </div>

              {/* Matched SKU Details */}
              <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Resolved SKU Item
                  </label>
                  <div className="text-sm font-bold text-slate-900">
                    {item.skuName || 'Unmapped Item (Select alternative below)'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{item.skuCode}</div>

                  {/* Out-of-Stock Alert */}
                  {isOutOfStock && (
                    <div className="mt-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                      <span>Warehouse Stock: 0 Cases (Stock-out alert)</span>
                    </div>
                  )}
                </div>

                {/* Quantity & Unit Controls */}
                <div className="flex items-center justify-start md:justify-end gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      Quantity (Cases)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={item.resolvedCases}
                        onChange={(e) => handleUpdateQuantity(idx, parseInt(e.target.value) || 0)}
                        className="w-20 p-2 border border-slate-200 rounded-xl font-bold text-sm text-center focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-slate-600">{t('cases')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clarification Question (Never guess unclear units!) */}
              {item.clarificationQuestion && (
                <div className="mt-3.5 p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-900 text-xs">
                  <div className="font-bold flex items-center gap-1.5 mb-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-700" />
                    <span>Unit Ambiguity Detected (Asking, Never Guessing):</span>
                  </div>
                  <div className="mb-2 text-slate-800">{item.clarificationQuestion}</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateUnit(idx, 'case')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition"
                    >
                      Ship as Full Peti (Cases)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateUnit(idx, 'piece')}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg text-xs transition"
                    >
                      Loose Pieces
                    </button>
                  </div>
                </div>
              )}

              {/* Suggested Alternatives (Always 2 alternative SKUs) */}
              {item.alternativeSkus && item.alternativeSkus.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">Wrong SKU? Select alternative:</span>
                  {item.alternativeSkus.map((alt) => (
                    <button
                      key={alt.skuCode}
                      type="button"
                      onClick={() => handleSelectAlternativeSku(idx, alt.skuCode, alt.skuName)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 text-xs transition"
                    >
                      <span>{alt.skuName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation & Submit Action Bar */}
      <div className="mt-8 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">
            Total Validated Items: <span className="font-bold text-slate-800">{items.length}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Human verification ensures zero retyping errors in Tally
          </div>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleConfirmAndProceed}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{submitting ? 'Placing Order...' : 'Confirm & Place Order'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
