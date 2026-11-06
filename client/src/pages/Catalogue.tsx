import React, { useEffect, useState } from 'react';
import { Plus, Minus, Check, ShoppingBag, Sparkles, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SkuItem } from '../types';
import { StockBadge } from '../components/StockBadge';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export const Catalogue: React.FC = () => {
  const { t } = useTranslation();
  const { items, addToCart, updateQuantity } = useCart();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<SkuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog);
      } else {
        setError('Failed to load catalogue');
      }
    } catch {
      setError('Network error: Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const getItemQuantity = (code: string) => {
    const item = items.find((i) => i.skuCode === code);
    return item ? item.qtyCases : 0;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Retailer Info & Credit Banner */}
      {user?.retailer && (
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white rounded-2xl p-4 sm:p-5 mb-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">
              Authorized Kirana Partner
            </div>
            <h2 className="text-lg sm:text-xl font-bold">{user.retailer.shopName}</h2>
            <div className="text-xs text-emerald-100 mt-0.5">
              Salesman: {user.retailer.ownerName ? 'Rajesh Sharma' : 'Jabalpur Hub'} • Delivery Slot: Next Morning 9 AM
            </div>
          </div>
          <div className="bg-emerald-900/50 backdrop-blur-sm border border-emerald-600/40 px-3.5 py-2 rounded-xl text-right self-stretch sm:self-auto">
            <div className="text-[11px] text-emerald-200 font-medium">{t('creditAvailable')}</div>
            <div className="text-base font-bold text-emerald-100">
              ₹{(user.retailer.creditLimit - user.retailer.creditUsed).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-300">
              Limit: ₹{user.retailer.creditLimit.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* Page Title & Search/Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t('catalogue')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time warehouse stock & active distributor schemes for Jabalpur
          </p>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl h-80 border border-slate-200"></div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Catalogue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {catalog.map((sku) => {
          const inCartQty = getItemQuantity(sku.code);
          const isOutOfStock = sku.stockBadge === 'OUT_OF_STOCK';

          return (
            <div
              key={sku.code}
              className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                isOutOfStock ? 'border-slate-200 opacity-80' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Product Image & Badges */}
                <div className="relative h-44 bg-slate-100 overflow-hidden">
                  <img
                    src={sku.imageUrl}
                    alt={sku.name}
                    className={`w-full h-full object-cover transition duration-300 ${
                      isOutOfStock ? 'grayscale contrast-75' : ''
                    }`}
                  />
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                    <StockBadge status={sku.stockBadge} count={sku.stockCases} />
                    <span className="text-[10px] font-semibold bg-slate-900/80 backdrop-blur text-white px-2 py-0.5 rounded">
                      {sku.brand}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="text-[11px] font-mono text-slate-400 mb-1">{sku.code}</div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                    {sku.name}
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Packing: {sku.unitLabel} ({sku.piecesPerCase} pcs/case)
                  </div>

                  {/* Pricing Breakdown with GST clarity */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-slate-500">{t('dealerPrice')}:</span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-slate-900">
                          ₹{sku.dealerPricePerCase.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          ₹{sku.dealerPricePerPiece.toFixed(2)} {t('perPiece')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">GST ({sku.gstRate}%):</span>
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {t('gstExcluded')} (+₹{(sku.dealerPricePerCase * (sku.gstRate / 100)).toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Scheme Banner */}
                  {sku.scheme && sku.scheme.isActive ? (
                    <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-amber-900">{sku.scheme.title}</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">
                          {sku.scheme.description}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-2 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span>Standard distributor pricing applies</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Add / Quantity Button (Large Tap Target for Mobile) */}
              <div className="p-4 pt-0">
                {isOutOfStock ? (
                  <button
                    disabled
                    className="w-full py-3 bg-slate-100 text-slate-400 font-semibold rounded-xl text-sm cursor-not-allowed border border-slate-200"
                  >
                    {t('outOfStock')}
                  </button>
                ) : inCartQty === 0 ? (
                  <button
                    onClick={() => addToCart(sku.code, 1)}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {t('addToCart')} (1 {t('cases')})
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-1.5">
                    <button
                      onClick={() => updateQuantity(sku.code, inCartQty - 1)}
                      className="w-10 h-10 rounded-lg bg-white border border-emerald-200 text-emerald-800 flex items-center justify-center hover:bg-emerald-100 transition"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="text-center">
                      <span className="text-sm font-bold text-emerald-900">
                        {inCartQty} {t('cases')}
                      </span>
                      <span className="block text-[10px] text-emerald-700">
                        ({inCartQty * sku.piecesPerCase} pcs)
                      </span>
                    </div>
                    <button
                      onClick={() => updateQuantity(sku.code, inCartQty + 1)}
                      className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
