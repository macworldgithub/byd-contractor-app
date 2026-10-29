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

export async function flushOfflineQueue(offlineApi, evidenceApi) {
  if (isFlushing) return null;
  const queue = getQueue();
  if (!queue.length) return { processed: 0, succeeded: 0, failed: 0 };

  isFlushing = true;
  let succeeded = 0;
  let failed = 0;

  try {
    // 1. Separate evidence upload actions from standard batch actions
    const standardActions = [];
    const evidenceActions = [];

    for (const item of queue) {
      if (item.action_type === 'upload_evidence') {
        evidenceActions.push(item);
      } else {
        standardActions.push(item);
      }
    }

    // 2. Process standard actions via offlineApi.sync
    if (standardActions.length > 0 && offlineApi) {
      try {
        const res = await offlineApi.sync(standardActions);
        if (res && Array.isArray(res.results)) {
          const succeededIds = res.results
            .filter(r => r.success)
            .map(r => r.client_action_id);
          removeFromQueue(succeededIds);
          succeeded += succeededIds.length;
          failed += (standardActions.length - succeededIds.length);
        } else if (res && res.succeeded > 0) {
          removeFromQueue(standardActions.map(a => a.client_action_id));
          succeeded += standardActions.length;
        }
      } catch (syncErr) {
        console.warn('[OfflineQueue] Batch sync error:', syncErr);
        failed += standardActions.length;
      }
    }

    // 3. Process queued evidence photo/video uploads
    if (evidenceActions.length > 0 && evidenceApi) {
      for (const evItem of evidenceActions) {
        try {
          const { stage, caption, fileName, fileType, fileData } = evItem.payload || {};
          if (fileData) {
            const blobRes = await fetch(fileData);
            const blob = await blobRes.blob();
            const file = new File([blob], fileName || 'evidence.jpg', { type: fileType || 'image/jpeg' });
            await evidenceApi.upload(evItem.job_id, file, stage || 'before', caption || '');
            removeFromQueue([evItem.client_action_id]);
            succeeded++;
          }
        } catch (evErr) {
          console.warn('[OfflineQueue] Evidence upload error:', evErr);
          failed++;
        }
      }
    }

    return { processed: queue.length, succeeded, failed };
  } catch (err) {
    console.warn('[OfflineQueue] Flush failed (will retry on next reconnection):', err);
    return null;
  } finally {
    isFlushing = false;
  }
}

export function initOfflineSync(offlineApi, evidenceApi, onSyncComplete) {
  const handler = async () => {
    if (navigator.onLine && getQueueSize() > 0) {
      const result = await flushOfflineQueue(offlineApi, evidenceApi);
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
