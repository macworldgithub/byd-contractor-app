import { getQueue, flushOfflineQueue } from '../utils/offlineQueue';
import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { authApi, integrationApi, pushApi, offlineApi, evidenceApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { usePWA } from '../contexts/PWAContext';
import { Settings, RefreshCw, Key, Check, AlertCircle, Bell, BellOff, Smartphone, Download, Share, Wifi, CheckCircle2, Globe, Shield, Play } from 'lucide-react';
import { formatDateTime, timeAgo } from '../utils/helpers';

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'super_admin', 'site_admin'].includes(user?.role);
  const isSuper = user?.role === 'super_admin';
  const { canInstall, isInstalled, isIOS, isOnline, installApp } = usePWA();
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollResult, setPollResult] = useState(null);

  // Integration Config State (Super Admin / Admin)
  const [intConfig, setIntConfig] = useState({
    api_url: '',
    api_key: '',
    webhook_secret: '',
    outbound_webhook_url: '',
    webhook_url: 'https://byd-panel.omnisuiteai.com/api/contractor/integrations/webhook',
    polling_interval_minutes: 10,
    auto_poll_enabled: true
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [pendingWork, setPendingWork] = useState([]);
  const [retryingWork, setRetryingWork] = useState(false);
  useEffect(() => {
    const refresh = () => getQueue().then(setPendingWork).catch(() => {});
    refresh();
    window.addEventListener('byd-queue-change', refresh);
    return () => window.removeEventListener('byd-queue-change', refresh);
  }, []);
  const retryWork = async () => {
    setRetryingWork(true);
    try { await flushOfflineQueue(offlineApi, evidenceApi); }
    catch (error) { alert(error.message); }
    finally { setRetryingWork(false); }
  };

  useEffect(() => {
    if (isSuper) {
      integrationApi.getConfig().then(data => {
        if (data) setIntConfig(data);
      }).catch(() => {});
    }
  }, [isSuper]);

  const [pushStatus, setPushStatus] = useState(
    ('Notification' in window && Notification.permission === 'granted') ? 'enabled' : 'disabled'
  );
  const [pushLoading, setPushLoading] = useState(false);

  // VAPID helper
  const urlB64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
  };

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in your browser.');
      return;
    }
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permission denied.');

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { publicKey } = await pushApi.getVapidKey();
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicKey)
        });
      }

      await pushApi.subscribe(sub, navigator.userAgent);
      setPushStatus('enabled');
      alert('Successfully enabled push notifications!');
    } catch (e) { alert(e.message); }
    setPushLoading(false);
  };

  const handleTestPush = async () => {
    setPushLoading(true);
    try {
      await pushApi.sendTest({
        title: 'Test Notification',
        body: 'Push notifications are working!',
      });
    } catch (e) { alert(e.message); }
    setPushLoading(false);
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError('Passwords do not match');
      return;
    }
    setPwLoading(true);
    setPwError('');
    setPwMsg('');
    try {
      await authApi.changePassword(pwForm.current_password, pwForm.new_password);
      setPwMsg('Password changed successfully!');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e) { setPwError(e.message); }
    setPwLoading(false);
  };

  const handleSyncStatus = async () => {
    setSyncLoading(true);
    try {
      const res = await integrationApi.syncStatus();
      setSyncStatus(res);
    } catch (e) { alert(e.message); }
    setSyncLoading(false);
  };

  const handleManualPoll = async () => {
    setPollLoading(true);
    setPollResult(null);
    try {
      const res = await integrationApi.poll();
      if (res.status === 'error') throw new Error(res.error || 'Polling failed');
      setPollResult(res);
      await handleSyncStatus();
    } catch (e) { alert(`Polling sync error: ${e.message}`); }
    setPollLoading(false);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigMsg('');
    try {
      const response = await integrationApi.saveConfig(intConfig);
      setIntConfig(response.config);
      setConfigMsg('Integration settings saved successfully!');
    } catch (e) { alert(`Failed to save settings: ${e.message}`); }
    setConfigSaving(false);
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem', width: '100%' }}>
        <div className="card">
          <div className="card-header"><h2 className="card-title">Pending work ({pendingWork.length})</h2><button className="btn btn-ghost btn-sm" disabled={!isOnline || retryingWork || !pendingWork.length} onClick={retryWork}>{retryingWork ? 'Syncing...' : 'Retry sync'}</button></div>
          {!pendingWork.length && <p>All saved work has been synced.</p>}
          {pendingWork.map(action => <div key={action.client_action_id} style={{ marginTop: 12 }}><strong>{action.action_type.replaceAll('_', ' ')}</strong><p>Job {action.job_id} - {formatDateTime(action.queued_at)}</p>{action.last_error && <p role="alert" style={{ color: 'var(--byd-red)' }}>{action.last_error}</p>}</div>)}
        </div>

        {/* Account Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Account Details</span>
            <Settings size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="avatar lg">{user?.name?.slice(0, 2).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
              <span className="badge" style={{ marginTop: 4, background: 'var(--byd-red-muted)', color: 'var(--byd-red-light)' }}>
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Last login: {timeAgo(user?.last_login_at)}
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Change Password</span>
            <Key size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          {pwMsg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}><Check size={16} />{pwMsg}</div>}
          {pwError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} />{pwError}</div>}
          <form onSubmit={handlePwChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input id="pw-current" className="form-input" type="password" required
                value={pwForm.current_password}
                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input id="pw-new" className="form-input" type="password" required minLength={8}
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input id="pw-confirm" className="form-input" type="password" required
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
            <button id="pw-submit" type="submit" className="btn btn-primary" disabled={pwLoading}>
              {pwLoading ? 'Saving...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Push Notifications */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Push Notifications</span>
            <Bell size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Receive real-time alerts for urgent issues and job updates on this device.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pushStatus === 'enabled' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>
                  <Check size={16} /> Enabled on this device
                </div>
                <button className="btn btn-ghost" onClick={handleTestPush} disabled={pushLoading}>
                  Send Test Notification
                </button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <BellOff size={16} /> Currently disabled
                </div>
                <button className="btn btn-primary" onClick={handleSubscribe} disabled={pushLoading}>
                  {pushLoading ? 'Enabling...' : 'Enable Notifications'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* PWA & App Installation */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">App Installation &amp; PWA</span>
            <Smartphone size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Install the BYD Contractor Hub directly to your device for standalone window mode, rapid offline caching, and push sync.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isInstalled ? (
                  <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                ) : (
                  <Smartphone size={18} style={{ color: '#f59e0b' }} />
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isInstalled ? 'Installed as App' : 'Browser Mode'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isInstalled ? 'Running in standalone window mode' : 'Running inside web browser'}
                  </div>
                </div>
              </div>
              <span className={`badge ${isInstalled ? 'badge-completed' : 'badge-new'}`}>
                {isInstalled ? 'Standalone' : 'Web'}
              </span>
            </div>

            {/* Offline Cache Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={18} style={{ color: isOnline ? '#10b981' : '#f59e0b' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isOnline ? 'Online & Synced' : 'Offline Mode Active'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Saved job data and pending work stay on this device
                  </div>
                </div>
              </div>
              <span className="badge badge-completed">Active</span>
            </div>

            {/* Action button / Instructions */}
            {canInstall && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={installApp}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Download size={16} />
                <span>Install App to Device</span>
              </button>
            )}

            {!canInstall && !isInstalled && !isIOS && (
              <div style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} style={{ color: '#ef4444' }} /> Desktop &amp; Web Installation:
                </div>
                On Chrome or Edge, click the <strong>Install</strong> icon in the address bar (top right) or open browser menu <strong>⋮ &gt; 'Install BYD Contractor'</strong>.
              </div>
            )}

            {isIOS && !isInstalled && (
              <div style={{ padding: '10px 12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.25)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Share size={14} /> iOS Safari Installation:
                </div>
                Tap the <strong>Share</strong> button at the bottom of Safari, scroll down and tap <strong>'Add to Home Screen'</strong> ➕.
              </div>
            )}

            {isInstalled && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
                PWA installed. Open jobs online once to make them available offline.
              </div>
            )}
          </div>
        </div>

        {/* Integration Status & Controls */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={18} color="var(--byd-red)" /> Delivery Centre Integration &amp; Polling
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                id="sync-status-btn"
                className="btn btn-ghost btn-sm"
                onClick={handleSyncStatus}
                disabled={syncLoading}
              >
                <RefreshCw size={14} className={syncLoading ? 'spin' : ''} />
                {syncLoading ? 'Checking...' : 'Check Status'}
              </button>
              {isAdmin && (
                <button
                  id="sync-poll-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handleManualPoll}
                  disabled={pollLoading}
                >
                  <Play size={14} className={pollLoading ? 'spin' : ''} />
                  {pollLoading ? 'Polling...' : 'Run Polling Sync Now'}
                </button>
              )}
            </div>
          </div>

          {pollResult && (
            <div className="alert alert-success" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <Check size={16} />
              <span>
                Polling completed: <strong>{pollResult.created_jobs ?? 0}</strong> jobs auto-created, <strong>{pollResult.updated_jobs ?? 0}</strong> updated, <strong>{pollResult.synced_back_jobs ?? 0}</strong> synced back to Delivery Centre.
              </span>
            </div>
          )}

          {/* Super Admin API Configuration */}
          {isSuper && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={16} color="var(--byd-red)" /> Two-Way API &amp; Webhook Credentials (Super Admin)
              </div>
              {configMsg && <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}><Check size={16} />{configMsg}</div>}
              <form onSubmit={handleSaveConfig} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group">
                  <label className="form-label">Delivery Centre API URL</label>
                  <input
                    className="form-input"
                    type="url"
                    value={intConfig.api_url}
                    onChange={e => setIntConfig(c => ({ ...c, api_url: e.target.value }))}
                    placeholder="Leave blank to use the shared Delivery Centre database"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Delivery Centre API Key / Bearer Token</label>
                  <input
                    className="form-input"
                    type="password"
                    value={intConfig.api_key}
                    onChange={e => setIntConfig(c => ({ ...c, api_key: e.target.value }))}
                    placeholder={intConfig.api_key_configured ? 'Configured - leave blank to retain' : 'API key for remote polling'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="outbound-webhook">Outbound Delivery Centre Webhook</label>
                  <input id="outbound-webhook" className="form-input" type="url" value={intConfig.outbound_webhook_url || ''} onChange={e => setIntConfig(c => ({ ...c, outbound_webhook_url: e.target.value }))} placeholder="https://.../api/contractor/integrations/webhook" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="webhook-secret">Webhook Authentication Secret</label>
                  <input id="webhook-secret" className="form-input" type="password" autoComplete="new-password" value={intConfig.webhook_secret || ''} onChange={e => setIntConfig(c => ({ ...c, webhook_secret: e.target.value }))} placeholder={intConfig.webhook_secret_configured ? 'Configured - leave blank to retain' : 'Shared secret for signed webhooks'} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="polling-interval">Polling Interval (minutes)</label>
                  <input id="polling-interval" className="form-input" type="number" min="5" max="15" value={intConfig.polling_interval_minutes} onChange={e => setIntConfig(c => ({ ...c, polling_interval_minutes: Number(e.target.value) }))} />
                  <label><input type="checkbox" checked={intConfig.auto_poll_enabled} onChange={e => setIntConfig(c => ({ ...c, auto_poll_enabled: e.target.checked }))} /> Enable automatic polling</label>
                </div>
                <div className="form-group">
                  <label className="form-label">Incoming Webhook Endpoint</label>
                  <input
                    className="form-input"
                    type="text"
                    value={intConfig.webhook_url}
                    onChange={e => setIntConfig(c => ({ ...c, webhook_url: e.target.value }))}
                    readOnly
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.75rem', paddingBottom: 6 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={configSaving}>
                    {configSaving ? 'Saving...' : 'Save API Credentials'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {syncStatus && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="fade-in">
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  ['Total Syncs', syncStatus.total_sync_events ?? syncStatus.total_syncs],
                  ['Successful', syncStatus.success_count ?? syncStatus.successful],
                  ['Failed', syncStatus.failed_count ?? syncStatus.failed],
                  ['System Health', syncStatus.health ?? 'Healthy'],
                  ['Last Sync', formatDateTime(syncStatus.last_sync_at)],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{val ?? '—'}</div>
                  </div>
                ))}
              </div>

              {syncStatus.recent_logs?.length > 0 && (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Direction</th><th>Event</th><th>Status</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                      {syncStatus.recent_logs.map((log, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.direction?.replace(/_/g, ' ')}</td>
                          <td style={{ color: 'var(--text-primary)', fontSize: '0.82rem' }}>{log.event}</td>
                          <td>
                            <span className={`badge ${log.status === 'success' ? 'badge-completed' : 'badge-urgent'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{timeAgo(log.synced_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
