import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { syncOfflineOrders, getOfflineQueue } from '../utils/offlineQueue';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const { t } = useTranslation();

  const updatePendingCount = () => {
    setPendingCount(getOfflineQueue().length);
  };

  useEffect(() => {
    updatePendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      const res = await syncOfflineOrders();
      updatePendingCount();
      if (res.syncedCount > 0) {
        setSyncMessage(`Synced ${res.syncedCount} salesman offline orders with Jabalpur depot!`);
        setTimeout(() => setSyncMessage(null), 5000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      updatePendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check
    const interval = setInterval(updatePendingCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white text-xs py-2 px-3 flex items-center justify-between font-medium sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>Offline Salesman Mode: Orders cached locally on device. Will auto-sync when connected.</span>
        </div>
        {pendingCount > 0 && (
          <span className="bg-amber-800 text-white font-bold px-2 py-0.5 rounded text-[11px]">
            {pendingCount} Pending Sync
          </span>
        )}
      </div>
    );
  }

  if (syncMessage) {
    return (
      <div className="bg-emerald-600 text-white text-xs py-2 px-3 flex items-center justify-center font-medium sticky top-0 z-50 animate-fade-in shadow-sm gap-2">
        <Wifi className="w-4 h-4" />
        <span>{syncMessage}</span>
      </div>
    );
  }

  return null;
};
