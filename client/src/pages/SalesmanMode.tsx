import React, { useState, useEffect } from 'react';
import {
  Users,
  Store,
  MapPin,
  Phone,
  CreditCard,
  Plus,
  Minus,
  CheckCircle,
  Clock,
  WifiOff,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { queueOfflineOrder, syncOfflineOrders, getOfflineQueue } from '../utils/offlineQueue';

interface RetailerVisit {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  lastOrderAt: string | null;
}

interface SkuVisitItem {
  code: string;
  name: string;
  brand: string;
  unitLabel: string;
  dealerPricePerCase: number;
  stockCases: number;
  scheme?: {
    id: string;
    title: string;
    description: string;
    type: string;
  };
}

export const SalesmanMode: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [retailers, setRetailers] = useState<RetailerVisit[]>([]);
  const [salesmanInfo, setSalesmanInfo] = useState<{ name: string; territory: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerVisit | null>(null);
  const [catalog, setCatalog] = useState<SkuVisitItem[]>([]);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  const fetchRetailers = async () => {
    try {
      const res = await fetch('/api/salesman/my-retailers');
      if (res.ok) {
        const data = await res.json();
        setRetailers(data.retailers || []);
        setSalesmanInfo(data.salesman || { name: 'Vikram Singh', territory: 'Jabalpur Beat 1' });
      }
    } catch {
      // offline fallback
      setSalesmanInfo({ name: 'Vikram Singh', territory: 'Jabalpur Beat 1 (Offline Mode)' });
    } finally {
      setLoading(false);
      setOfflinePendingCount(getOfflineQueue().length);
    }
  };

  useEffect(() => {
    fetchRetailers();
  }, []);

  const handleSelectShop = async (retailer: RetailerVisit) => {
    setSelectedRetailer(retailer);
    setCartQuantities({});
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/salesman/retailer/${retailer.id}`);
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog || []);
      }
    } catch {
      // Offline fallback: Use default catalog
      setCatalog([
        {
          code: 'SKU-BS-075',
          name: 'Glucose biscuit 75 g, case of 96',
          brand: 'Parle',
          unitLabel: 'case of 96',
          dealerPricePerCase: 777.6,
          stockCases: 340,
          scheme: {
            id: 'SCH-001',
            title: 'Buy 10 cases get 1 free',
            description: 'Buy 10 cases get 1 free case',
            type: 'FREE_GOODS',
          },
        },
        {
          code: 'SKU-DT-1KG',
          name: 'Detergent powder 1 kg, case of 20',
          brand: 'Wheel',
          unitLabel: 'case of 20',
          dealerPricePerCase: 2030.0,
          stockCases: 85,
          scheme: {
            id: 'SCH-002',
            title: '3% off 5 or more cases',
            description: '3% slab discount for 5+ cases',
            type: 'SLAB_DISCOUNT',
          },
        },
        {
          code: 'SKU-TE-250',
          name: 'Tea leaf 250 g, case of 40',
          brand: 'Red Label',
          unitLabel: 'case of 40',
          dealerPricePerCase: 4720.0,
          stockCases: 0,
        },
      ]);
    }
  };

  const handleUpdateQty = (skuCode: string, delta: number) => {
    setCartQuantities((prev) => {
      const current = prev[skuCode] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [skuCode]: updated };
    });
  };

  const calculateOrderTotal = () => {
    let total = 0;
    for (const [skuCode, qty] of Object.entries(cartQuantities)) {
      if (qty > 0) {
        const sku = catalog.find((s) => s.code === skuCode);
        if (sku) {
          total += sku.dealerPricePerCase * qty * 1.18; // approx incl GST
        }
      }
    }
    return total;
  };

  const handleSubmitOrder = async (forceOffline = false) => {
    if (!selectedRetailer) return;

    const items = Object.entries(cartQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([skuCode, qtyCases]) => ({ skuCode, qtyCases }));

    if (items.length === 0) {
      setErrorMessage('Please add at least one case to place an order.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const isOffline = forceOffline || !navigator.onLine;

    if (isOffline) {
      const queued = queueOfflineOrder({
        retailerId: selectedRetailer.id,
        retailerName: selectedRetailer.shopName,
        items,
        source: 'SALESMAN_OFFLINE',
        rawMessage: `Offline visit capture by ${salesmanInfo?.name || 'Salesman'}`,
      });

      setSuccessMessage(
        `✓ Order ${queued.clientOrderId} saved in device IndexedDB! Will sync automatically when network connects.`
      );
      setCartQuantities({});
      setOfflinePendingCount(getOfflineQueue().length);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailerId: selectedRetailer.id,
          items,
          source: 'SALESMAN_VISIT',
          rawMessage: `Shop visit order recorded by salesman ${salesmanInfo?.name || ''}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(`✓ Order ${data.order?.orderNumber} created successfully! (Status: ${data.order?.status})`);
        setCartQuantities({});
        fetchRetailers();
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to place salesman order.');
      }
    } catch {
      // Fallback to offline queue
      const queued = queueOfflineOrder({
        retailerId: selectedRetailer.id,
        retailerName: selectedRetailer.shopName,
        items,
        source: 'SALESMAN_OFFLINE',
        rawMessage: `Offline visit capture by ${salesmanInfo?.name || 'Salesman'}`,
      });
      setSuccessMessage(
        `Network error encountered. Order ${queued.clientOrderId} safely queued in IndexedDB for auto-sync.`
      );
      setCartQuantities({});
      setOfflinePendingCount(getOfflineQueue().length);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncNow = async () => {
    setSubmitting(true);
    const res = await syncOfflineOrders();
    setOfflinePendingCount(getOfflineQueue().length);
    setSubmitting(false);
    if (res.syncedCount > 0) {
      setSuccessMessage(`Successfully synchronized ${res.syncedCount} offline orders with Jabalpur central server!`);
      fetchRetailers();
    } else if (res.errors.length > 0) {
      setErrorMessage(`Sync warning: ${res.errors.join(', ')}`);
    }
  };

  const filteredRetailers = retailers.filter(
    (r) =>
      r.shopName.toLowerCase().includes(search.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Salesman Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-2 border border-indigo-500/30">
            <Users className="w-3.5 h-3.5" />
            <span>Salesman Beat Order Mode</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{salesmanInfo?.name || 'Salesman Portal'}</h1>
          <p className="text-slate-300 text-xs mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            <span>Territory: {salesmanInfo?.territory || 'Jabalpur Beat 1'}</span>
            <span className="mx-1">•</span>
            <span>{retailers.length} Assigned Kirana Shops</span>
          </p>
        </div>

        {/* Offline Queue Badge & Manual Sync */}
        <div className="flex items-center gap-2">
          {offlinePendingCount > 0 && (
            <button
              onClick={handleSyncNow}
              disabled={submitting}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
            >
              <Clock className="w-4 h-4 animate-spin" />
              <span>Sync {offlinePendingCount} Offline Orders</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Shop Selector vs Shop Ordering */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Kirana Shops */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="w-4 h-4 text-indigo-600" />
              <span>Assigned Shops</span>
            </h2>
            <span className="text-xs font-bold text-slate-500">{filteredRetailers.length}</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search shop or owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredRetailers.map((r) => {
              const isSelected = selectedRetailer?.id === r.id;
              const creditPct = Math.min(100, Math.round((r.creditUsed / (r.creditLimit || 1)) * 100));

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectShop(r)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition text-left ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{r.shopName}</h3>
                      <p className="text-[11px] text-slate-500">{r.ownerName} • {r.address}</p>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                  </div>

                  {/* Credit Bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Credit Avail:</span>
                    <span className="font-bold text-emerald-700">₹{r.creditAvailable.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full ${creditPct > 90 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                      style={{ width: `${creditPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Shop Ordering Session */}
        <div className="lg:col-span-2">
          {!selectedRetailer ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
              <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Select a Kirana Shop to Start Order</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Pick a shop from your beat route on the left to see their live stock, customized dealer prices, and current trade schemes.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              {/* Active Retailer Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Active Shop Visit
                  </span>
                  <h2 className="text-xl font-black text-slate-900 mt-1">{selectedRetailer.shopName}</h2>
                  <p className="text-xs text-slate-500">
                    {selectedRetailer.ownerName} • Phone: {selectedRetailer.phone}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-medium block">Credit Available</span>
                  <span className="text-base font-black text-emerald-600">
                    ₹{selectedRetailer.creditAvailable.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Feedback messages */}
              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {errorMessage}
                </div>
              )}

              {/* Product SKU Counter */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Distributor Master Catalog & Schemes
                </h3>

                {catalog.map((sku) => {
                  const qty = cartQuantities[sku.code] || 0;
                  const isOutOfStock = sku.stockCases <= 0;

                  return (
                    <div
                      key={sku.code}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{sku.name}</span>
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                              Stock Out
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                              {sku.stockCases} Cases in Warehouse
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Rate: <span className="font-bold text-slate-800">₹{sku.dealerPricePerCase.toFixed(2)} / case</span>
                          <span className="mx-2">•</span>
                          {sku.scheme ? (
                            <span className="text-indigo-600 font-bold inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {sku.scheme.title}
                            </span>
                          ) : (
                            <span>No active scheme</span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(sku.code, -1)}
                          disabled={qty === 0}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center disabled:opacity-40"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center font-black text-sm text-slate-800">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(sku.code, 1)}
                          disabled={isOutOfStock}
                          className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-semibold text-slate-500 ml-1">Cases</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-slate-500">Estimated Total (incl. GST):</span>
                  <div className="text-lg font-black text-slate-900">
                    ₹{calculateOrderTotal().toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Simulate Offline Submit */}
                  <button
                    type="button"
                    onClick={() => handleSubmitOrder(true)}
                    disabled={submitting}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                    title="Simulate placing order with zero signal, queueing directly in device IndexedDB"
                  >
                    <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>Queue Offline</span>
                  </button>

                  {/* Standard Order Submit */}
                  <button
                    type="button"
                    onClick={() => handleSubmitOrder(false)}
                    disabled={submitting}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                  >
                    <span>Submit Visit Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
