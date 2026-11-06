import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';

import { Login } from './pages/Login';
import { Catalogue } from './pages/Catalogue';
import { Cart } from './pages/Cart';
import { AiCapture } from './pages/AiCapture';
import { ConfirmAiOrder } from './pages/ConfirmAiOrder';
import { OrderHistory } from './pages/OrderHistory';
import { DeskOrders } from './pages/DeskOrders';
import { DeskOrderDetail } from './pages/DeskOrderDetail';
import { DeskDashboard } from './pages/DeskDashboard';

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold text-slate-500">Connecting to Jabalpur FMCG Depot...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <OfflineBanner />
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Catalogue />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/ai-capture" element={<AiCapture />} />
          <Route path="/ai-capture/confirm" element={<ConfirmAiOrder />} />
          <Route path="/orders" element={<OrderHistory />} />

          {/* Desk Routes */}
          <Route path="/desk" element={<DeskOrders />} />
          <Route path="/desk/orders/:id" element={<DeskOrderDetail />} />
          <Route path="/desk/dashboard" element={<DeskDashboard />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
