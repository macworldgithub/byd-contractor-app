import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { analyticsApi } from '../api/client';
import { formatDuration, capitalize, STATUS_LABELS } from '../utils/helpers';
import { BarChart2, TrendingUp, Clock, CheckCircle, Download } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportLoading, setExportLoading] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await analyticsApi.analytics(params);
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const handleExport = async (format) => {
    setExportLoading(format);
    try {
      const token = localStorage.getItem('byd_token');
      const url = `${import.meta.env.VITE_API_URL || 'https://byd-panel.omnisuiteai.com'}/api/contractor/export${format !== 'csv' ? `/${format}` : ''}?token=${token || ''}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Export failed');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `byd-contractor-jobs.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      alert(`Export error: ${e.message}`);
    } finally {
      setExportLoading('');
    }
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Analytics & Reports</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport('csv')} disabled={!!exportLoading}>
            <Download size={15} /> CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport('xlsx')} disabled={!!exportLoading}>
            <Download size={15} /> Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport('pdf')} disabled={!!exportLoading}>
            <Download size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Date filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>From</label>
          <input type="date" className="form-input" style={{ width: 160 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>To</label>
          <input type="date" className="form-input" style={{ width: 160 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner lg" />
        </div>
      ) : !data ? (
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart2 size={28} /></div>
          <h3>No analytics data</h3>
        </div>
      ) : (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top stats */}
          <div className="stats-grid">
            <StatCard icon={<BarChart2 size={20} />} label="Total Jobs" value={data.total_jobs ?? '—'} />
            <StatCard icon={<CheckCircle size={20} />} label="Completed" value={data.completed_jobs ?? '—'} color="#10b981" />
            <StatCard icon={<TrendingUp size={20} />} label="Completion Rate" value={data.completion_rate ? `${data.completion_rate}%` : '—'} />
            <StatCard icon={<Clock size={20} />} label="Avg Time/Job" value={data.avg_time_per_job_seconds ? formatDuration(data.avg_time_per_job_seconds) : '—'} small />
            <StatCard icon={<BarChart2 size={20} />} label="Total Hours Logged" value={data.total_time_seconds ? formatDuration(data.total_time_seconds) : '—'} small />
            <StatCard icon={<BarChart2 size={20} />} label="Overdue Jobs" value={data.overdue_jobs ?? '—'} color="#f59e0b" />
          </div>

          {/* Jobs by status */}
          {data.jobs_by_status && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>Jobs by Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(data.jobs_by_status).map(([status, count]) => {
                  const pct = data.total_jobs ? Math.round((count / data.total_jobs) * 100) : 0;
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{STATUS_LABELS[status] || status}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{count} ({pct}%)</span>
                      </div>
                      <div className="progress-bar" style={{ height: 8 }}>
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* Jobs by contractor */}
            {data.jobs_by_contractor && Object.keys(data.jobs_by_contractor).length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: '1rem' }}>Jobs by Contractor</div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr><th>Contractor</th><th>Jobs</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.jobs_by_contractor).map(([name, count]) => (
                        <tr key={name}>
                          <td style={{ color: 'var(--text-primary)' }}>{name}</td>
                          <td style={{ fontWeight: 700, color: 'var(--byd-red)' }}>{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Jobs by model */}
            {data.jobs_by_model && Object.keys(data.jobs_by_model).length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: '1rem' }}>Jobs by Model</div>
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr><th>Model</th><th>Jobs</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.jobs_by_model).map(([model, count]) => (
                        <tr key={model}>
                          <td style={{ color: 'var(--text-primary)' }}>{model}</td>
                          <td style={{ fontWeight: 700, color: 'var(--byd-red)' }}>{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Jobs Completed per VIN (Scope §5) */}
          {data.completed_per_vin && data.completed_per_vin.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Jobs Completed per VIN ({data.completed_per_vin.length})</span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Full VIN</th>
                      <th>Last 6</th>
                      <th>Vehicle Model</th>
                      <th>Contractor</th>
                      <th>Completed Date</th>
                      <th>Total Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.completed_per_vin.map((item) => (
                      <tr key={item.job_id || item.vin}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{item.vin}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--byd-red)' }}>{item.last_6_vin}</td>
                        <td>{item.model}</td>
                        <td>{item.contractor || '—'}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.completed_at ? new Date(item.completed_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.total_minutes} mins</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function StatCard({ icon, label, value, color = 'var(--byd-red)', small }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: small ? '1.2rem' : undefined }}>{value}</div>
    </div>
  );
}
