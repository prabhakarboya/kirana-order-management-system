import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Sparkles,
  ClipboardList,
  Layers,
  Store,
  ShieldCheck,
  Globe,
  RefreshCw,
  BarChart3,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, demoSwitch } = useAuth();
  const { totalCartCases } = useCart();
  const location = useLocation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'hi' ? 'en' : 'hi';
    i18n.changeLanguage(nextLang);
  };

  const isDesk = user?.role === 'DESK';
  const isSalesman = user?.role === 'SALESMAN';

  return (
    <>
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-sm shadow-emerald-200">
              K
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight tracking-tight flex items-center gap-1.5">
                {t('appName')}
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded uppercase">
                  Jabalpur
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-none">
                {isDesk
                  ? 'Order Desk: Priya Jain'
                  : isSalesman
                  ? `Salesman: ${user?.name || 'Rajesh Sharma'}`
                  : (user?.retailer?.shopName || 'Sharma General Store')}
              </div>
            </div>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              title="Toggle Hindi / English"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{i18n.language === 'hi' ? 'EN' : 'हिंदी'}</span>
            </button>

            {/* Evaluation Role Switcher (Controlled Reviewer Access) */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold border border-slate-200">
              <button
                onClick={() => demoSwitch('RETAILER')}
                className={`px-2 py-1 rounded-lg transition ${
                  user?.role === 'RETAILER'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Retailer
              </button>
              <button
                onClick={() => demoSwitch('SALESMAN')}
                className={`px-2 py-1 rounded-lg transition ${
                  user?.role === 'SALESMAN'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Salesman
              </button>
              <button
                onClick={() => demoSwitch('DESK')}
                className={`px-2 py-1 rounded-lg transition ${
                  user?.role === 'DESK'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Desk
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Large tap targets for 3G kirana shops) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 sm:hidden">
        <div className="grid grid-cols-4 h-16">
          <Link
            to="/"
            className={`flex flex-col items-center justify-center text-xs font-medium transition ${
              location.pathname === '/' ? 'text-emerald-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span>{t('catalogue')}</span>
          </Link>

          <Link
            to="/ai-capture"
            className={`flex flex-col items-center justify-center text-xs font-medium transition ${
              location.pathname.startsWith('/ai-capture')
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500'
            }`}
          >
            <Sparkles className="w-5 h-5 mb-0.5 text-amber-500" />
            <span>AI Order</span>
          </Link>

          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center text-xs font-medium relative transition ${
              location.pathname === '/cart' ? 'text-emerald-600 font-bold' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5 mb-0.5" />
              {totalCartCases > 0 && (
                <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalCartCases}
                </span>
              )}
            </div>
            <span>{t('cart')}</span>
          </Link>

          {isDesk ? (
            <Link
              to="/desk"
              className={`flex flex-col items-center justify-center text-xs font-medium transition ${
                location.pathname.startsWith('/desk') ? 'text-blue-600 font-bold' : 'text-slate-500'
              }`}
            >
              <ShieldCheck className="w-5 h-5 mb-0.5 text-blue-600" />
              <span>Desk</span>
            </Link>
          ) : (
            <Link
              to="/orders"
              className={`flex flex-col items-center justify-center text-xs font-medium transition ${
                location.pathname === '/orders' ? 'text-emerald-600 font-bold' : 'text-slate-500'
              }`}
            >
              <ClipboardList className="w-5 h-5 mb-0.5" />
              <span>{t('myOrders')}</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Desktop Sub-navigation for larger screens */}
      <div className="hidden sm:block bg-slate-100 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-11 text-sm font-medium">
          <div className="flex space-x-6">
            <Link
              to="/"
              className={`flex items-center gap-1.5 py-2 border-b-2 transition ${
                location.pathname === '/'
                  ? 'border-emerald-600 text-emerald-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>{t('catalogue')}</span>
            </Link>

            <Link
              to="/ai-capture"
              className={`flex items-center gap-1.5 py-2 border-b-2 transition ${
                location.pathname.startsWith('/ai-capture')
                  ? 'border-emerald-600 text-emerald-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t('aiCapture')}</span>
            </Link>

            <Link
              to="/orders"
              className={`flex items-center gap-1.5 py-2 border-b-2 transition ${
                location.pathname === '/orders'
                  ? 'border-emerald-600 text-emerald-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>{t('myOrders')}</span>
            </Link>

            {(isSalesman || isDesk) && (
              <Link
                to="/salesman"
                className={`flex items-center gap-1.5 py-2 border-b-2 transition ${
                  location.pathname === '/salesman'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent text-indigo-600 hover:text-indigo-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Salesman Visits</span>
              </Link>
            )}

            {isDesk && (
              <>
                <Link
                  to="/desk"
                  className={`flex items-center gap-1.5 py-2 border-b-2 transition ${
                    location.pathname === '/desk'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-blue-600 hover:text-blue-800'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('deskQueue')}</span>
                </Link>

                <Link
                  to="/desk/dashboard"
                  className={`flex items-center gap-1.5 py-2 border-b-2 transition ${
                    location.pathname === '/desk/dashboard'
                      ? 'border-blue-600 text-blue-700 font-semibold'
                      : 'border-transparent text-blue-600 hover:text-blue-800'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>{t('dashboard')}</span>
                </Link>
              </>
            )}
          </div>

          <Link
            to="/cart"
            className="flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition"
          >
            <div className="relative">
              <ShoppingBag className="w-4 h-4" />
              {totalCartCases > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalCartCases}
                </span>
              )}
            </div>
            <span>
              {t('cart')} ({totalCartCases} {t('cases')})
            </span>
          </Link>
        </div>
      </div>
    </>
  );
};
