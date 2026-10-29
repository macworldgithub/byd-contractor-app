import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { addToQueue, getQueue, getQueueSize, flushOfflineQueue } from '../src/utils/offlineQueue.js';
import { cacheResponse, cachedResponse, listRecords, deleteRecord, readRecord } from '../src/utils/offlineStore.js';
import api from '../src/api/client.js';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
globalThis.window = new EventTarget();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, storage: { persist: async () => true } } });
function signIn(id) { localStorage.setItem('byd_token', `header.${btoa(JSON.stringify({ sub: id, exp: 9999999999 }))}.signature`); }
beforeEach(async () => {
  for (const record of await listRecords('')) await deleteRecord(record.key);
  values.clear();
  navigator.onLine = false;
  signIn('worker-a');
});

test('saved jobs can reopen offline and stay isolated between users', async () => {
  const jobs = [{ id: 'job-1', status: 'requested', model_name: 'Seal', full_vin: 'VIN123456' }];
  await cacheResponse('/api/contractor/jobs?', jobs);
  assert.deepEqual(await cachedResponse('/api/contractor/jobs/job-1'), jobs[0]);
  signIn('worker-b');
  assert.equal(await cachedResponse('/api/contractor/jobs/job-1'), undefined);
  signIn('worker-a');
  assert.deepEqual(await cachedResponse('/api/contractor/jobs?limit=500'), jobs);
});

test('offline task clocks retain timestamps and replay in order', async () => {
  await addToQueue({ action_type: 'clock_in', job_id: 'job-1', payload: { task_id: 'task-1' } });
  await addToQueue({ action_type: 'clock_out', job_id: 'job-1', payload: {} });
  assert.equal(getQueueSize(), 2);
  const seen = [];
  navigator.onLine = true;
  const result = await flushOfflineQueue({ sync: async ([action]) => {
    seen.push(action);
    return { results: [{ client_action_id: action.client_action_id, success: true }] };
  } });
  assert.equal(result.succeeded, 2);
  assert.deepEqual(seen.map(a => a.action_type), ['clock_in', 'clock_out']);
  assert.ok(seen.every(a => a.user_id === 'worker-a' && a.queued_at));
  assert.equal((await getQueue()).length, 0);
});

test('large media uses encrypted IndexedDB storage and survives a failed upload', async () => {
  const file = new File([new Uint8Array(8 * 1024 * 1024).fill(42)], 'before.mp4', { type: 'video/mp4' });
  const entry = await addToQueue({ action_type: 'upload_evidence', job_id: 'job-1', payload: { file, stage: 'before' } });
  assert.ok(entry.payload.encrypted instanceof ArrayBuffer);
  assert.equal(entry.payload.file, undefined);
  const key = await readRecord('worker-a:media-key');
  assert.equal(key.extractable, false);
  assert.ok([...values.values()].every(value => value.length < 1000));
  navigator.onLine = true;
  await flushOfflineQueue(null, { upload: async () => { throw new Error('Connection lost'); } });
  assert.equal((await getQueue()).length, 1);
  let uploaded;
  await flushOfflineQueue(null, { upload: async (...args) => { uploaded = args; } });
  assert.equal(uploaded[1].size, file.size);
  assert.equal(uploaded[4], entry.client_action_id);
  assert.equal(uploaded[5], entry.queued_at);
  assert.equal((await getQueue()).length, 0);
});

test('failed prerequisites retain the queue and prevent out-of-order clock-out', async () => {
  await addToQueue({ action_type: 'clock_in', job_id: 'job-1', payload: {} });
  await addToQueue({ action_type: 'clock_out', job_id: 'job-1', payload: {} });
  navigator.onLine = true;
  let attempts = 0;
  await flushOfflineQueue({ sync: async ([action]) => {
    attempts++;
    return { results: [{ client_action_id: action.client_action_id, success: false, message: 'Assignment changed' }] };
  } });
  assert.equal(attempts, 1);
  assert.equal((await getQueue()).length, 2);
  assert.equal((await getQueue())[0].last_error, 'Assignment changed');
});

test('signing in as another user never replays the previous user work', async () => {
  await addToQueue({ action_type: 'add_comment', job_id: 'job-1', payload: { message: 'My note' } });
  signIn('worker-b');
  navigator.onLine = true;
  await flushOfflineQueue({ sync: async () => { throw new Error('Must not be called'); } });
  assert.equal((await getQueue()).length, 0);
  signIn('worker-a');
  assert.equal((await getQueue()).length, 1);
});

test('concurrent uploads share the same durable encryption key', async () => {
  await Promise.all(['a.jpg', 'b.jpg'].map(name => addToQueue({ action_type: 'upload_evidence', job_id: 'job-1', payload: { file: new File(['photo'], name, { type: 'image/jpeg' }) } })));
  navigator.onLine = true;
  let uploads = 0;
  await flushOfflineQueue(null, { upload: async (_, file) => { assert.equal(await file.text(), 'photo'); uploads++; } });
  assert.equal(uploads, 2);
});

test('offline pagination stops after cached jobs instead of repeating pages', async () => {
  const jobs = Array.from({ length: 1000 }, (_, id) => ({ id: String(id), status: 'requested' }));
  await cacheResponse('/api/contractor/jobs?limit=1000&skip=0', jobs);
  assert.equal((await cachedResponse('/api/contractor/jobs?limit=1000&skip=1000')).length, 0);
});

test('network failures can use cached data, while server denials cannot', async () => {
  const originalFetch = globalThis.fetch;
  try {
    await cacheResponse('/api/auth/me', { id: 'worker-a', role: 'contractor' });
    globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
    assert.equal((await api.get('/api/auth/me')).id, 'worker-a');
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Forbidden' }), { status: 403 });
    await assert.rejects(api.get('/api/auth/me'), /Forbidden/);
  } finally { globalThis.fetch = originalFetch; }
});
