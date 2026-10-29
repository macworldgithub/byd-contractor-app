let database;
export function accountId() {
  const token = localStorage.getItem('byd_token');
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; }
  catch { return null; }
}

function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('byd-contractor-offline', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
    request.onblocked = () => reject(new Error('Close other app tabs to update offline storage.'));
  });
  return database;
}

export async function storeRecord(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').put({ key, value });
    tx.oncomplete = () => resolve(value);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Unable to save offline. Check available device storage.'));
  });
}

export async function readRecord(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').get(key);
    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

export async function listRecords(prefix) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').getAll();
    request.onsuccess = () => resolve(request.result.filter(item => item.key.startsWith(prefix)));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecord(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export async function cacheResponse(path, value, owner = accountId()) {
  if (!owner) return;
  await storeRecord(`${owner}:cache:${path}`, value);
  if (/^\/api\/contractor\/jobs\?/.test(path) && Array.isArray(value)) {
    await Promise.all(value.map(job => storeRecord(`${owner}:cache:/api/contractor/jobs/${job.id}`, job)));
  }
}

export async function cachedResponse(path, owner = accountId()) {
  if (!owner) return undefined;
  const cached = await readRecord(`${owner}:cache:${path}`);
  if (cached !== undefined) return cached;
  if (/^\/api\/contractor\/jobs\?/.test(path)) {
    const records = await listRecords(`${owner}:cache:/api/contractor/jobs/`);
    const jobs = records.filter(r => /^\/api\/contractor\/jobs\/[^/]+$/.test(r.key.split(':cache:')[1])).map(r => r.value);
    const params = new URLSearchParams(path.split('?')[1]);
    const filtered = jobs.filter(job => ['status', 'priority'].every(key => !params.get(key) || job[key] === params.get(key)) && (!params.get('is_urgent') || job.is_urgent) && (!params.get('issue_flag') || job.issue_flag) && (!params.get('contractor_id') || job.assigned_contractor_id === params.get('contractor_id')));
    const skip = Number(params.get('skip') || 0);
    return filtered.slice(skip, skip + Number(params.get('limit') || 200));
  }
  return undefined;
}

export async function encryptFile(file, owner) {
  let key = await readRecord(`${owner}:media-key`);
  if (!key) {
    const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const db = await openDatabase();
    // A read/write transaction serializes key creation across tabs and uploads.
    key = await new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const request = store.get(`${owner}:media-key`);
      let selected;
      request.onsuccess = () => {
        selected = request.result?.value || candidate;
        if (!request.result) store.put({ key: `${owner}:media-key`, value: selected });
      };
      tx.oncomplete = () => resolve(selected);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await file.arrayBuffer());
  return { encrypted, iv, fileName: file.name, fileType: file.type };
}

export async function decryptFile(payload, owner) {
  const key = await readRecord(`${owner}:media-key`);
  if (!key) throw new Error('Offline media key is missing.');
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.iv }, key, payload.encrypted);
  return new File([data], payload.fileName, { type: payload.fileType });
}
