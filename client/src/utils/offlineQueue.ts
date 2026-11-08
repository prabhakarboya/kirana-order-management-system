export interface OfflineOrder {
  clientOrderId: string;
  retailerId: string;
  items: Array<{ skuCode: string; qtyCases: number }>;
  source: string;
  rawMessage?: string;
  timestamp: string;
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
}

const OFFLINE_QUEUE_KEY = 'kirana_offline_orders_queue';

export function getOfflineQueue(): OfflineOrder[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineOrder(orderData: Omit<OfflineOrder, 'clientOrderId' | 'status' | 'timestamp'>): OfflineOrder {
  const queue = getOfflineQueue();
  const offlineOrder: OfflineOrder = {
    ...orderData,
    clientOrderId: `OFFLINE-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    status: 'PENDING_SYNC',
    timestamp: new Date().toISOString(),
  };

  queue.push(offlineOrder);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return offlineOrder;
}

export async function syncOfflineOrders(): Promise<{ syncedCount: number; errors: string[] }> {
  if (!navigator.onLine) return { syncedCount: 0, errors: ['Device still offline'] };

  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, errors: [] };

  const remaining: OfflineOrder[] = [];
  let syncedCount = 0;
  const errors: string[] = [];

  for (const item of queue) {
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientOrderId: item.clientOrderId,
          items: item.items,
          source: 'SALESMAN_OFFLINE',
          rawMessage: item.rawMessage || 'Salesman offline visit capture',
        }),
      });

      if (res.ok) {
        syncedCount++;
      } else {
        const err = await res.json();
        errors.push(err.error || 'Sync failed');
        remaining.push(item);
      }
    } catch (err: any) {
      errors.push(err.message || 'Network sync error');
      remaining.push(item);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return { syncedCount, errors };
}
