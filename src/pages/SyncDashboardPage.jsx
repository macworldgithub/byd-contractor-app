import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, AlertTriangle, Clock, Zap, Activity,
  RotateCcw, ExternalLink, Database, Wifi, WifiOff, ChevronDown, ChevronUp
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { integrationApi, jobsApi } from '../api/client';
import { formatDateTime, timeAgo } from '../utils/helpers';

export default function SyncDashboardPage() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState({});
  const [expanded, setExpanded] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [status, jobs] = await Promise.all([
        integrationApi.syncStatus().catch(() => null),
        jobsApi.list({ limit: 50 }),
      ]);
      setSyncStatus(status);
      setRecentJobs(Array.isArray(jobs) ? jobs : []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const handleRetry = async (jobId) => {
    setRetrying(r => ({ ...r, [jobId]: true }));
    try {
      await integrationApi.syncToClient(jobId);
      await load();
      alert('Sync retried successfully!');
    } catch (e) { alert(`Retry failed: ${e.message}`); }
    setRetrying(r => ({ ...r, [jobId]: false }));
  };

  const toggleExpanded = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const synced = recentJobs.filter(j => j.sync_status === 'synced' || j.dc_job_id);
  const failed = recentJobs.filter(j => j.sync_status === 'failed' || j.sync_error);
  const pending = recentJobs.filter(j => j.sync_status === 'pending' && !j.dc_job_id && !j.sync_error);
  const never = recentJobs.filter(j => !j.sync_status && !j.dc_job_id);

  const healthPct = recentJobs.length > 0
    ? Math.round((synced.length / recentJobs.length) * 100) : 100;

  const healthColor = healthPct >= 90 ? '#10b981' : healthPct >= 70 ? '#f59e0b' : '#ef4444';

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-screen" style={{ height: '60vh' }}>
          <div className="spinner lg" />
          <p style={{ color: 'var(--text-muted)' }}>Loading sync dashboard...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={28} style={{ color: 'var(--byd-red)' }} />
            Sync Dashboard
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Integration health with deliverycentre.com.au
            {lastRefresh && <span style={{ marginLeft: 8 }}>· Refreshed {timeAgo(lastRefresh)}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor: 'var(--byd-red)' }} />
            Auto-refresh (30s)
          </label>
          <button className="btn btn-ghost" onClick={load} id="sync-manual-refresh">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        {[
          { icon: <Activity size={20} />, label: 'Sync Health', value: `${healthPct}%`, color: healthColor, sub: `${synced.length} of ${recentJobs.length} synced` },
          { icon: <CheckCircle size={20} />, label: 'Synced', value: synced.length, color: '#10b981', sub: 'Sent to DC' },
          { icon: <AlertTriangle size={20} />, label: 'Failed', value: failed.length, color: '#ef4444', sub: 'Need attention', hi: failed.length > 0 },
          { icon: <Clock size={20} />, label: 'Pending', value: pending.length, color: '#f59e0b', sub: 'Awaiting sync' },
          { icon: <Database size={20} />, label: 'Not Synced', value: never.length, color: '#6b7280', sub: 'No attempt made' },
        ].map(c => (
          <div key={c.label} className="stat-card" style={{ '--accent': c.color }}>
            <div className="stat-icon" style={{ background: `${c.color}1a`, color: c.color }}>{c.icon}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color: c.hi ? c.color : undefined }}>{c.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Health Bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Overall Sync Health</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: healthColor }}>{healthPct}%</span>
        </div>
        <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-border)' }}>
          {synced.length > 0 && <div style={{ flex: synced.length, background: '#10b981' }} title={`Synced: ${synced.length}`} />}
          {pending.length > 0 && <div style={{ flex: pending.length, background: '#f59e0b' }} title={`Pending: ${pending.length}`} />}
          {failed.length > 0 && <div style={{ flex: failed.length, background: '#ef4444' }} title={`Failed: ${failed.length}`} />}
          {never.length > 0 && <div style={{ flex: Math.max(never.length, 1), background: '#374151' }} title={`Not synced: ${never.length}`} />}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {[['#10b981', 'Synced', synced.length], ['#f59e0b', 'Pending', pending.length], ['#ef4444', 'Failed', failed.length], ['#374151', 'Not synced', never.length]].map(([col, lbl, cnt]) => (
            <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }} />
              {lbl} ({cnt})
            </span>
          ))}
        </div>
      </div>

      {/* Failed */}
      {failed.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.25)', background: 'linear-gradient(135deg, rgba(239,68,68,0.04), var(--surface-elevated))' }}>
          <div className="card-header">
            <span className="card-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} /> Failed Syncs ({failed.length})
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Job</th><th>VIN</th><th>Status</th><th>Error</th><th>Action</th></tr></thead>
              <tbody>
                {failed.map(job => (
                  <tr key={job.id}>
                    <td style={{ fontWeight: 600 }}>{job.model_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{job.full_vin || job.last_6_vin}</td>
                    <td><span className={`badge badge-${job.status}`}>{job.status}</span></td>
                    <td style={{ fontSize: '0.78rem', color: '#ef4444', maxWidth: 200 }}>{job.sync_error || 'Unknown error'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRetry(job.id)} disabled={retrying[job.id]} id={`retry-sync-${job.id}`}>
                        <RotateCcw size={13} /> {retrying[job.id] ? 'Retrying...' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" onClick={() => toggleExpanded('pending')} style={{ cursor: 'pointer' }}>
            <span className="card-title" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} /> Pending Sync ({pending.length})
            </span>
            {expanded['pending'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {expanded['pending'] && (
            <div className="table-container">
              <table>
                <thead><tr><th>Job</th><th>VIN</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {pending.map(job => (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 600 }}>{job.model_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{job.full_vin || job.last_6_vin}</td>
                      <td><span className={`badge badge-${job.status}`}>{job.status}</span></td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDateTime(job.created_at)}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRetry(job.id)} disabled={retrying[job.id]} id={`force-sync-${job.id}`}>
                          <Zap size={13} /> {retrying[job.id] ? 'Syncing...' : 'Force Sync'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Jobs */}
      <div className="card">
        <div className="card-header" onClick={() => toggleExpanded('all')} style={{ cursor: 'pointer' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} /> All Jobs ({recentJobs.length})
          </span>
          {expanded['all'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
        {expanded['all'] && (
          <div className="table-container">
            <table>
              <thead><tr><th>Job</th><th>VIN</th><th>DC ID</th><th>Sync Status</th><th>Last Sync</th><th>Action</th></tr></thead>
              <tbody>
                {recentJobs.map(job => {
                  const isSynced = job.dc_job_id || job.sync_status === 'synced';
                  const isFailed = job.sync_status === 'failed' || job.sync_error;
                  return (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 600 }}>{job.model_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{job.full_vin || job.last_6_vin}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: isSynced ? '#10b981' : 'var(--text-muted)' }}>
                        {job.dc_job_id ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{job.dc_job_id} <ExternalLink size={11} /></span> : '—'}
                      </td>
                      <td>
                        {isSynced ? <SyncBadge synced /> : isFailed ? <SyncBadge failed /> : job.sync_status === 'pending' ? <SyncBadge pending /> : <SyncBadge />}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.last_synced_at ? timeAgo(job.last_synced_at) : '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRetry(job.id)} disabled={retrying[job.id]} style={{ fontSize: '0.72rem' }}>
                          <RotateCcw size={11} /> {retrying[job.id] ? '...' : 'Sync'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integration API Status */}
      {syncStatus && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={18} color="#10b981" /> Delivery Centre Integration
            </span>
            <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: 999, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>CONNECTED</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {Object.entries(syncStatus).map(([k, v]) => (
              <div key={k} style={{ fontSize: '0.8rem' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 2, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function SyncBadge({ synced, failed, pending }) {
  if (synced) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: 999, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}><CheckCircle size={11} /> Synced</span>;
  if (failed) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 999, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}><AlertTriangle size={11} /> Failed</span>;
  if (pending) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 999, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}><Clock size={11} /> Pending</span>;
  return <span style={{ background: 'rgba(107,114,128,0.12)', color: '#6b7280', borderRadius: 999, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>Not synced</span>;
}
