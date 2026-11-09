import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const Cart: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, summary, loadingSummary, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (!items.length) return;

    // Check stock availability
    const hasInsufficientStock = summary?.items.some((i) => !i.stockSufficient);
    if (hasInsufficientStock) {
      setErrorMessage('Cannot place order: One or more items exceed warehouse stock. Please adjust quantities.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    // Salesman Offline Mode Support: queue locally if device has no signal!
    if (!navigator.onLine) {
      const { queueOfflineOrder } = await import('../utils/offlineQueue');
      const offline = queueOfflineOrder({
        retailerId: user?.retailer?.id || 'RET-OFFLINE',
        items,
        source: 'SALESMAN_OFFLINE',
        rawMessage: 'Salesman offline visit order',
      });
      setOrderSuccess({
        orderNumber: offline.clientOrderId,
        retailerName: user?.retailer?.shopName || 'Kirana Store',
        grandTotal: summary?.grandTotal || 0,
        totalSavings: summary?.totalSavings || 0,
        isOfflineQueued: true,
      });
      clearCart();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          source: 'APP',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setOrderSuccess(data.order);
        clearCart();
      } else {
        setErrorMessage(data.error || 'Failed to place order');
      }
    } catch {
      setErrorMessage('Network error: Unable to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Order Placed Successfully!</h1>
        <p className="text-sm text-slate-600 mt-1">
          Order Number: <span className="font-mono font-bold text-slate-900">{orderSuccess.orderNumber}</span>
        </p>
        <p className="text-xs text-slate-500 mt-2">
          Your order has been queued for Jabalpur depot review and next morning dispatch.
        </p>

        <div className="mt-6 p-4 bg-white rounded-xl border border-slate-200 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Retailer:</span>
            <span className="font-semibold text-slate-800">{orderSuccess.retailerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Billed:</span>
            <span className="font-bold text-slate-900">₹{orderSuccess.grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Scheme Savings:</span>
            <span className="font-bold text-emerald-600">₹{orderSuccess.totalSavings.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/orders"
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition"
          >
            View My Orders
          </Link>
          <Link
            to="/"
            className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm transition"
          >
            Continue Ordering
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Add items from catalogue or use AI order capture to transcribe a message.
        </p>
        <div className="flex flex-col gap-2.5">
          <Link
            to="/"
            className="py-3 px-5 rounded-xl bg-emerald-600 text-white font-semibold text-sm shadow-sm hover:bg-emerald-700 transition"
          >
            Explore Catalogue
          </Link>
          <Link
            to="/ai-capture"
            className="py-3 px-5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
          >
            Try AI Order Capture
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('cart')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review live schemes, GST calculation, and credit check
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Cart
        </button>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Item Lines */}
        <div className="lg:col-span-2 space-y-4">
          {summary?.items.map((line) => {
            const isOutOfStock = !line.stockSufficient;

            return (
              <div
                key={line.skuCode}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition ${
                  isOutOfStock ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">{line.skuCode}</span>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      {line.skuName || (line.skuCode === 'SKU-BS-075'
                        ? 'Glucose biscuit 75 g, case of 96'
                        : line.skuCode === 'SKU-DT-1KG'
                        ? 'Detergent powder 1 kg, case of 20'
                        : line.skuCode === 'SKU-TE-250'
                        ? 'Tea leaf 250 g, case of 40'
                        : line.skuCode)}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Rate: ₹{line.unitCasePrice.toFixed(2)} / case ({t('gstExcluded')})
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromCart(line.skuCode)}
                    className="text-slate-400 hover:text-rose-600 transition p-1"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Live Working Explanation of Scheme */}
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Scheme Working:</span>
                    <span>{line.explanation}</span>
                    {line.freeCases > 0 && (
                      <span className="block font-semibold text-emerald-700 mt-0.5">
                        +{line.freeCases} Free Case dispatched at ₹0 cost!
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Alert Warning if physical warehouse stock is breached */}
                {line.stockWarning && (
                  <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{line.stockWarning}</span>
                  </div>
                )}

                {/* Quantity Controls & Line Total */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(line.skuCode, line.qtyCases - 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm w-12 text-center">
                      {line.qtyCases} {t('cases')}
                    </span>
                    <button
                      onClick={() => updateQuantity(line.skuCode, line.qtyCases + 1)}
                      className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-slate-900">
                      ₹{line.lineTotal.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Base ₹{line.netBaseAmount.toFixed(2)} + GST ({line.gstRate}%) ₹{line.gstAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary & Scheme Savings */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm sticky top-20">
            <h2 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Order Summary</span>
            </h2>

            {summary && (
              <div className="space-y-3 text-xs">
                {/* Total Scheme Savings Line (Required by Brief) */}
                {summary.totalSavings > 0 && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                      {t('youSaved')}
                    </div>
                    <div className="text-xl font-black text-emerald-700 mt-0.5">
                      ₹{summary.totalSavings.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">
                      (Includes cash discounts + free goods value)
                    </div>
                  </div>
                )}

                <div className="flex justify-between py-1 text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span>₹{summary.subtotal.toFixed(2)}</span>
                </div>

                {summary.discountTotal > 0 && (
                  <div className="flex justify-between py-1 text-emerald-600 font-semibold">
                    <span>Slab Discount:</span>
                    <span>-₹{summary.discountTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between py-1 text-slate-600">
                  <span>GST Total ({t('gstExcluded')} on price):</span>
                  <span>+₹{summary.gstTotal.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-bold text-sm text-slate-900">{t('grandTotal')}:</span>
                  <span className="font-black text-xl text-slate-900">
                    ₹{summary.grandTotal.toFixed(2)}
                  </span>
                </div>

                {/* Credit Check Status */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>{t('creditAvailable')}:</span>
                    <span className="font-semibold text-slate-800">
                      ₹{summary.creditAvailable.toFixed(2)}
                    </span>
                  </div>

                  {summary.creditExceeded && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] mt-2">
                      <span className="font-bold block">Credit Limit Exceeded:</span>
                      Order exceeds limit by ₹{summary.creditShortfall?.toFixed(2)}. Requires desk approval.
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting || loadingSummary}
                  className="w-full mt-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>{submitting ? 'Submitting Order...' : t('placeOrder')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
