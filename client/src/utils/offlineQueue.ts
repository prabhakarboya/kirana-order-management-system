export interface OfflineOrder {
  clientOrderId: string;
  retailerId: string;
  retailerName?: string;
  items: Array<{ skuCode: string; qtyCases: number }>;
  source: string;
  rawMessage?: string;
  timestamp: string;
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  errorDetails?: string;
}

const DB_NAME = 'KiranaOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_orders';
const OFFLINE_QUEUE_KEY = 'kirana_offline_orders_queue';

// Open IndexedDB instance
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'clientOrderId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Memory / localStorage mirror helper for instant synchronous UI checks
function getLocalMirror(): OfflineOrder[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalMirror(queue: OfflineOrder[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

// Synchronous getter for UI badges
export function getOfflineQueue(): OfflineOrder[] {
  return getLocalMirror();
}

// Async getter from IndexedDB
export async function getOfflineOrdersFromIndexedDb(): Promise<OfflineOrder[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const orders = request.result || [];
        setLocalMirror(orders);
        resolve(orders);
      };
      request.onerror = () => resolve(getLocalMirror());
    });
  } catch {
    return getLocalMirror();
  }
}

// Queue order into IndexedDB
export function queueOfflineOrder(
  orderData: Omit<OfflineOrder, 'clientOrderId' | 'status' | 'timestamp'>
): OfflineOrder {
  const offlineOrder: OfflineOrder = {
    ...orderData,
    clientOrderId: `OFFLINE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'PENDING_SYNC',
    timestamp: new Date().toISOString(),
  };

  // 1. Update mirror immediately for synchronous UI responsiveness
  const mirror = getLocalMirror();
  mirror.push(offlineOrder);
  setLocalMirror(mirror);

  // 2. Persist asynchronously in browser IndexedDB
  openIndexedDB()
    .then((db) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(offlineOrder);
    })
    .catch((err) => {
      console.warn('IndexedDB write warning, order persisted in local storage fallback:', err);
    });

  return offlineOrder;
}

// Remove synced order from IndexedDB
async function removeOrderFromIndexedDb(clientOrderId: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(clientOrderId);
  } catch (e) {
    console.warn('Could not remove from IndexedDB:', e);
  }
}

// Sync all offline orders with server
export async function syncOfflineOrders(): Promise<{ syncedCount: number; errors: string[] }> {
  if (!navigator.onLine) return { syncedCount: 0, errors: ['Device still offline'] };

  const queue = await getOfflineOrdersFromIndexedDb();
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
          retailerId: item.retailerId,
          items: item.items,
          source: item.source || 'SALESMAN_OFFLINE',
          rawMessage: item.rawMessage || 'Salesman offline visit capture',
        }),
      });

      if (res.ok) {
        syncedCount++;
        await removeOrderFromIndexedDb(item.clientOrderId);
      } else {
        const err = await res.json();
        const msg = err.error || 'Sync failed';
        errors.push(msg);
        remaining.push({ ...item, status: 'FAILED', errorDetails: msg });
      }
    } catch (err: any) {
      const msg = err.message || 'Network sync error';
      errors.push(msg);
      remaining.push({ ...item, status: 'FAILED', errorDetails: msg });
    }
  }

  setLocalMirror(remaining);
  return { syncedCount, errors };
}
