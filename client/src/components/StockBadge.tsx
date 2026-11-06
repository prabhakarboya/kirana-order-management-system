import React from 'react';
import { useTranslation } from 'react-i18next';

interface StockBadgeProps {
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  count?: number;
}

export const StockBadge: React.FC<StockBadgeProps> = ({ status, count }) => {
  const { t } = useTranslation();

  if (status === 'OUT_OF_STOCK') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
        <span className="w-1.5 h-1.5 mr-1.5 bg-rose-500 rounded-full animate-pulse"></span>
        {t('outOfStock')} (0 {t('cases')})
      </span>
    );
  }

  if (status === 'LOW_STOCK') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        <span className="w-1.5 h-1.5 mr-1.5 bg-amber-500 rounded-full"></span>
        {t('lowStock')} {count !== undefined ? `(${count} left)` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
      <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full"></span>
      {t('inStock')} {count !== undefined ? `(${count} ${t('cases')})` : ''}
    </span>
  );
};
