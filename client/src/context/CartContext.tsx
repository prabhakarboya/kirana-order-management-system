import React, { createContext, useContext, useState, useEffect } from 'react';
import { OrderCalculationSummary } from '../types';

export interface CartItem {
  skuCode: string;
  qtyCases: number;
}

interface CartContextType {
  items: CartItem[];
  summary: OrderCalculationSummary | null;
  loadingSummary: boolean;
  addToCart: (skuCode: string, qty?: number) => void;
  updateQuantity: (skuCode: string, qty: number) => void;
  removeFromCart: (skuCode: string) => void;
  clearCart: () => void;
  loadItems: (items: CartItem[]) => void;
  totalCartCases: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('kirana_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [summary, setSummary] = useState<OrderCalculationSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    localStorage.setItem('kirana_cart', JSON.stringify(items));
    if (items.length > 0) {
      calculateLiveSchemes(items);
    } else {
      setSummary(null);
    }
  }, [items]);

  const calculateLiveSchemes = async (currentItems: CartItem[]) => {
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/orders/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: currentItems }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Failed to calculate schemes:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const addToCart = (skuCode: string, qty: number = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.skuCode === skuCode);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qtyCases: updated[idx].qtyCases + qty };
        return updated;
      }
      return [...prev, { skuCode, qtyCases: qty }];
    });
  };

  const updateQuantity = (skuCode: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(skuCode);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.skuCode === skuCode ? { ...i, qtyCases: qty } : i))
    );
  };

  const removeFromCart = (skuCode: string) => {
    setItems((prev) => prev.filter((i) => i.skuCode !== skuCode));
  };

  const clearCart = () => {
    setItems([]);
    setSummary(null);
  };

  const loadItems = (newItems: CartItem[]) => {
    setItems(newItems);
  };

  const totalCartCases = items.reduce((acc, curr) => acc + curr.qtyCases, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        summary,
        loadingSummary,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        loadItems,
        totalCartCases,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
