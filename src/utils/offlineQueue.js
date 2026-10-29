import { accountId, storeRecord, listRecords, deleteRecord, encryptFile, decryptFile } from './offlineStore.js';

const prefix = owner => `${owner}:queue:`;
const countKey = owner => `byd_queue_count:${owner}`;
async function updateCount(owner) {
  const records = await listRecords(prefix(owner));
  localStorage.setItem(countKey(owner), String(records.length));
  window.dispatchEvent(new Event('byd-queue-change'));
}

export async function getQueue(owner = accountId()) {
  if (!owner) return [];
  return (await listRecords(prefix(owner))).map(r => r.value).sort((a, b) => (a.order || Date.parse(a.queued_at)) - (b.order || Date.parse(b.queued_at)));
}

export async function addToQueue(action) {
  const owner = accountId();
  if (!owner) throw new Error('Sign in before saving offline work.');
  const queued_at = new Date().toISOString();
  const order = performance.timeOrigin + performance.now();
  const payload = { ...action.payload };
  if (payload.file) {
    Object.assign(payload, await encryptFile(payload.file, owner));
    delete payload.file;
  }
  const entry = { ...action, payload, user_id: owner, client_action_id: crypto.randomUUID(), queued_at, order };
  await storeRecord(prefix(owner) + entry.client_action_id, entry);
  await updateCount(owner);
  navigator.storage?.persist?.().catch(() => {});
  return entry;
}

export function getQueueSize() {
  return Number(localStorage.getItem(countKey(accountId())) || 0);
}

export async function removeFromQueue(ids, owner = accountId()) {
  await Promise.all(ids.map(id => deleteRecord(prefix(owner) + id)));
  await updateCount(owner);
}

export async function clearQueue() {
  const owner = accountId();
  await removeFromQueue((await getQueue(owner)).map(a => a.client_action_id), owner);
}

let flushing = false;
export async function flushOfflineQueue(offlineApi, evidenceApi) {
  if (flushing || !navigator.onLine) return null;
  flushing = true;
  const owner = accountId();
  let succeeded = 0;
  let failed = 0;
  try {
    const queue = await getQueue(owner);
    // Preserve action order; stop if a prerequisite such as clock-in fails.
    for (const action of queue) {
      if (owner !== accountId()) break;
      try {
        if (action.action_type === 'upload_evidence') {
          const file = await decryptFile(action.payload, owner);
          await evidenceApi.upload(action.job_id, file, action.payload.stage, action.payload.caption, action.client_action_id, action.queued_at);
        } else {
          const result = await offlineApi.sync([action]);
          const applied = result?.results?.find(r => r.client_action_id === action.client_action_id);
          if (!applied?.success) throw new Error(applied?.message || 'Sync did not acknowledge this action');
        }
        await removeFromQueue([action.client_action_id], owner);
        succeeded++;
      } catch (error) {
        failed++;
        await storeRecord(prefix(owner) + action.client_action_id, { ...action, last_error: error.message });
        break;
      }
    }
    return { succeeded, failed };
  } finally { flushing = false; }
}

export function initOfflineSync(offlineApi, evidenceApi, onSyncComplete) {
  const handler = async () => {
    if (!navigator.onLine) return;
    try {
      const result = await flushOfflineQueue(offlineApi, evidenceApi);
      if (result?.succeeded) {
        window.dispatchEvent(new Event('byd-sync-complete'));
        onSyncComplete?.(result);
      }
    } catch (error) { console.warn('Offline sync will retry:', error.message); }
  };
  window.addEventListener('online', handler);
  const interval = setInterval(handler, 30000);
  handler();
  return () => { window.removeEventListener('online', handler); clearInterval(interval); };
}
