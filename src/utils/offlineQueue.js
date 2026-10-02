// Offline sync queue persisted in localStorage
const QUEUE_KEY = 'byd_offline_queue';

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToQueue(action) {
  const queue = getQueue();
  queue.push({
    ...action,
    client_action_id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queued_at: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function getQueueSize() {
  return getQueue().length;
}

export function removeFromQueue(actionIds = []) {
  if (!actionIds.length) return;
  const idSet = new Set(actionIds);
  const remaining = getQueue().filter(item => !idSet.has(item.client_action_id));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

let isFlushing = false;

export async function flushOfflineQueue(offlineApi) {
  if (isFlushing) return null;
  const queue = getQueue();
  if (!queue.length) return { processed: 0, succeeded: 0, failed: 0 };

  isFlushing = true;
  try {
    const res = await offlineApi.sync(queue);
    if (res && Array.isArray(res.results)) {
      const succeededIds = res.results
        .filter(r => r.success)
        .map(r => r.client_action_id);
      removeFromQueue(succeededIds);
    } else if (res && res.succeeded > 0) {
      clearQueue();
    }
    return res;
  } catch (err) {
    console.warn('[OfflineQueue] Flush failed (will retry on next reconnection):', err);
    return null;
  } finally {
    isFlushing = false;
  }
}

export function initOfflineSync(offlineApi, onSyncComplete) {
  const handler = async () => {
    if (navigator.onLine && getQueueSize() > 0) {
      const result = await flushOfflineQueue(offlineApi);
      if (result && result.succeeded > 0 && typeof onSyncComplete === 'function') {
        onSyncComplete(result);
      }
    }
  };

  window.addEventListener('online', handler);
  // Periodic background check every 30s
  const interval = setInterval(handler, 30000);

  // Initial trigger if online
  if (navigator.onLine && getQueueSize() > 0) {
    handler();
  }

  return () => {
    window.removeEventListener('online', handler);
    clearInterval(interval);
  };
}
