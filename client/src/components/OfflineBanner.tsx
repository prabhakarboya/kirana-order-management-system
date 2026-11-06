import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 4000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white text-xs py-1.5 px-3 flex items-center justify-center font-medium sticky top-0 z-50 shadow-sm">
        <WifiOff className="w-3.5 h-3.5 mr-2 animate-bounce" />
        <span>{t('offlineNotice')}</span>
      </div>
    );
  }

  if (showSyncSuccess) {
    return (
      <div className="bg-emerald-600 text-white text-xs py-1.5 px-3 flex items-center justify-center font-medium sticky top-0 z-50 animate-fade-in shadow-sm">
        <Wifi className="w-3.5 h-3.5 mr-2" />
        <span>Back online! Cached salesman orders synced with Jabalpur depot.</span>
      </div>
    );
  }

  return null;
};
