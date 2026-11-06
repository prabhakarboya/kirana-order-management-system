import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Users,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Package,
  Calendar,
  PhoneCall,
  Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DeskDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/desk/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <Link
        to="/desk"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Order Queue</span>
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Distributor Operations Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Company A, Jabalpur • Inactivity alerts, dispatch van loading, and salesman routing
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Pending Desk Authorizations</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{data?.pendingDeskCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting human review</div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Inactive Retailers (&gt;14 Days)</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{data?.inactiveRetailers?.length || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">At risk of churn or competitor loss</div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Approved Orders for Van Dispatch</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{data?.approvedOrdersCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Ready for warehouse picking</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Retailers with No Order in 14 Days */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-600" />
              <h2 className="font-bold text-sm text-slate-900">{t('inactiveRetailers')}</h2>
            </div>
            <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
              Action Required
            </span>
          </div>

          <div className="space-y-3">
            {data?.inactiveRetailers?.map((ret: any) => (
              <div
                key={ret.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{ret.shopName}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    {ret.ownerName} • {ret.address}
                  </div>
                  <div className="text-rose-600 text-[10px] font-semibold mt-1">
                    Last Order:{' '}
                    {ret.lastOrderDate
                      ? new Date(ret.lastOrderDate).toLocaleDateString('en-IN')
                      : 'Never placed'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Salesman: {ret.salesmanName}
                  </div>
                  <a
                    href={`tel:${ret.phone}`}
                    className="inline-flex items-center gap-1 mt-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200"
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Call Shop</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Van Loading Aggregation List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">{t('vanLoadingList')}</h2>
            </div>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Total Pickup Cases
            </span>
          </div>

          <div className="space-y-3">
            {data?.vanLoadingSummary?.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">
                No approved orders awaiting loading.
              </div>
            ) : (
              data?.vanLoadingSummary?.map((item: any) => (
                <div
                  key={item.skuCode}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex justify-between items-center text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{item.skuName}</div>
                    <div className="text-[10px] font-mono text-slate-400">{item.skuCode}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900">
                      {item.totalCases + item.freeCases} {t('cases')}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      ({item.totalCases} Billed + {item.freeCases} Free Scheme)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
