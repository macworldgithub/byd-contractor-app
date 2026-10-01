import { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { authApi, integrationApi, pushApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Shield, RefreshCw, Key, Check, AlertCircle, Bell, BellOff } from 'lucide-react';
import { formatDateTime, timeAgo } from '../utils/helpers';

export default function SettingsPage() {
  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const [pushStatus, setPushStatus] = useState(
    ('Notification' in window && Notification.permission === 'granted') ? 'enabled' : 'disabled'
  );
  const [pushLoading, setPushLoading] = useState(false);

  // VAPID helper
  const urlB64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
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

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: 900 }}>
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

        {/* Integration Status */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">Delivery Centre Integration</span>
            <RefreshCw size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
          <button
            id="sync-status-btn"
            className="btn btn-ghost"
            onClick={handleSyncStatus}
            disabled={syncLoading}
            style={{ marginBottom: '1rem' }}
          >
            <RefreshCw size={15} className={syncLoading ? 'spin' : ''} />
            {syncLoading ? 'Checking...' : 'Check Sync Status'}
          </button>

          {syncStatus && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="fade-in">
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  ['Total Syncs', syncStatus.total_syncs],
                  ['Successful', syncStatus.successful],
                  ['Failed', syncStatus.failed],
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
