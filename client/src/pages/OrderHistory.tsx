import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  ChevronRight,
  Package,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrderRecord } from '../types';
import { useCart } from '../context/CartContext';

export const OrderHistory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loadItems } = useCart();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders/my-orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRepeatOrder = async (orderId: string) => {
    setRepeatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/repeat`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        loadItems(data.items);
        navigate('/cart');
      }
    } finally {
      setRepeatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'PENDING_DESK_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Desk Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('myOrders')}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Order history, live Jabalpur warehouse dispatch status, and 1-tap reordering
        </p>
      </div>

      {loading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-white rounded-2xl border border-slate-200"></div>
          ))}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">No Orders Placed Yet</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Browse the catalogue or send an AI order message to place your first dispatch.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-emerald-700 transition"
          >
            Go to Catalogue
          </button>
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow transition"
          >
            {/* Order Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {order.orderNumber}
                  </span>
                  {getStatusBadge(order.status)}
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Source: {order.source}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* 1-Tap Repeat Order Button */}
              <button
                onClick={() => handleRepeatOrder(order.id)}
                disabled={repeatingId === order.id}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition self-start sm:self-auto"
                title="Loads all items into cart"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${repeatingId === order.id ? 'animate-spin' : ''}`} />
                <span>{repeatingId === order.id ? 'Loading Cart...' : t('repeatOrder')}</span>
              </button>
            </div>

            {/* Order Line Items */}
            <div className="mt-3 space-y-2">
              {order.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                  <div>
                    <span className="font-semibold text-slate-800">{line.skuName}</span>
                    <div className="text-[11px] text-slate-500">
                      {line.qtyCases} {t('cases')} @ ₹{line.unitPrice.toFixed(2)}
                      {line.freeCases > 0 && (
                        <span className="text-emerald-700 font-bold ml-1.5">
                          (+{line.freeCases} Free)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-bold text-slate-900">
                    ₹{line.lineTotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Raw Message if AI Text */}
            {order.rawMessage && (
              <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600">
                <span className="font-bold text-slate-500 block">Original WhatsApp / Voice Text:</span>
                <span className="font-mono italic">"{order.rawMessage}"</span>
              </div>
            )}

            {/* Totals & Savings */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div className="flex items-center gap-2">
                {order.totalSavings > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    {t('youSaved')}: ₹{order.totalSavings.toFixed(2)}
                  </span>
                )}
                {order.tallyExported && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono">
                    Tally: {order.tallyVoucherNo}
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-slate-500 mr-2">Grand Total:</span>
                <span className="text-base font-black text-slate-900">
                  ₹{order.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
