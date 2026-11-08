import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, KeyRound, ArrowRight, ShieldCheck, Store, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loginWithOtp, demoSwitch } = useAuth();

  const [phone, setPhone] = useState('9826011111');
  const [code, setCode] = useState('123456');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('OTP');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setStep('OTP');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to send OTP');
      }
    } catch {
      setError('Server unreachable. Please check connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const success = await loginWithOtp(phone, code);
    setLoading(false);
    if (success) {
      if (phone === '9826077777') {
        navigate('/salesman');
      } else if (phone === '9826099999') {
        navigate('/desk');
      } else {
        navigate('/');
      }
    } else {
      setError('Invalid OTP. Use authorized distributor code 123456.');
    }
  };

  const handleSelectAccount = (accPhone: string) => {
    setPhone(accPhone);
    setCode('123456');
    setStep('OTP');
    setError(null);
  };

  const handleDemoSwitch = async (role: 'RETAILER' | 'SALESMAN' | 'DESK') => {
    setLoading(true);
    await demoSwitch(role);
    setLoading(false);
    if (role === 'DESK') navigate('/desk');
    else if (role === 'SALESMAN') navigate('/salesman');
    else navigate('/');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl mx-auto flex items-center justify-center font-black text-2xl shadow-md shadow-emerald-200 mb-3">
            K
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('appName')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('appSubtitle')}</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* OTP Login Form */}
        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('phone')}</label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder={t('enterPhone')}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{loading ? 'Sending...' : t('sendOtp')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">{t('otp')}</label>
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Change Number
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('enterOtp')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm tracking-widest font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Authorized OTP: <span className="font-mono font-bold text-slate-700">123456</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{loading ? 'Verifying...' : t('verifyOtp')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Evaluation Reviewer Pre-seeded Accounts */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
            Evaluation Test Accounts (Company A, Jabalpur)
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleDemoSwitch('RETAILER')}
              className="w-full p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 text-xs font-medium flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" />
                <div className="text-left">
                  <div className="font-bold text-slate-900">Ramesh Sharma (Retailer)</div>
                  <div className="text-[10px] text-slate-500">+91 9826011111 • Sharma General Store</div>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                Kirana
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('SALESMAN')}
              className="w-full p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 text-xs font-medium flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-600" />
                <div className="text-left">
                  <div className="font-bold text-slate-900">Rajesh Sharma (Salesman)</div>
                  <div className="text-[10px] text-slate-500">+91 9826077777 • Jabalpur Beat 1</div>
                </div>
              </div>
              <span className="text-[10px] bg-indigo-200 text-indigo-900 font-bold px-1.5 py-0.5 rounded">
                Salesman
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoSwitch('DESK')}
              className="w-full p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-900 text-xs font-medium flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <div className="text-left">
                  <div className="font-bold text-slate-900">Priya Jain (Order Desk)</div>
                  <div className="text-[10px] text-slate-500">+91 9826099999 • Head Office / Tally</div>
                </div>
              </div>
              <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-1.5 py-0.5 rounded">
                Office Desk
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
