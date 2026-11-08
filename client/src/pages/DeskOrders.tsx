import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Sparkles,
  ChevronRight,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrderRecord } from '../types';

export const DeskOrders: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, search]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/desk/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } finally {
      setLoading(false);
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            Review Needed
          </span>
        );
      case 'CREDIT_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Credit Hold
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
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Order Desk Review Queue</h1>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
              Jabalpur Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Incoming orders from WhatsApp AI, salesman notebook sync, and direct retailer app
          </p>
        </div>

        <Link
          to="/desk/dashboard"
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
        >
          <span>View Inactivity & Van Loading</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, retailer name, or raw text..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          {['ALL', 'PENDING_DESK_REVIEW', 'CREDIT_HOLD', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL'
                ? 'All Orders'
                : st === 'PENDING_DESK_REVIEW'
                ? 'Pending Desk'
                : st === 'CREDIT_HOLD'
                ? 'Credit Hold'
                : st === 'APPROVED'
                ? 'Approved'
                : 'Rejected'}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200"></div>
          ))}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
          <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h2 className="text-sm font-bold text-slate-800">No Orders in this Queue</h2>
          <p className="text-xs text-slate-500 mt-1">All orders have been processed or matched.</p>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/desk/orders/${order.id}`}
            className="block bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {order.orderNumber}
                  </span>
                  {getStatusBadge(order.status)}
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Source: {order.source}
                  </span>
                  {order.tallyExported && (
                    <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                      Exported to Tally
                    </span>
                  )}
                </div>

                <div className="font-bold text-slate-800 text-base mt-1">
                  {order.retailerName}
                </div>

                {order.rawMessage && (
                  <div className="mt-1.5 text-xs text-slate-600 line-clamp-1 italic bg-slate-50 p-1.5 rounded font-mono">
                    "{order.rawMessage}"
                  </div>
                )}
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <span className="text-base font-black text-slate-900">
                  ₹{order.grandTotal.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {order.lines.length} {order.lines.length === 1 ? 'line' : 'lines'} • {order.totalSavings > 0 ? `Saved ₹${order.totalSavings.toFixed(0)}` : 'Standard'}
                </span>
                <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5 mt-1">
                  <span>Review Order</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
