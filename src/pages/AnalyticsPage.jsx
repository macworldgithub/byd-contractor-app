import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { analyticsApi, contractorsApi } from '../api/client';
import { formatDuration, capitalize, STATUS_LABELS } from '../utils/helpers';
import { BarChart2, TrendingUp, Clock, CheckCircle, Download } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportLoading, setExportLoading] = useState('');
  const [contractors, setContractors] = useState([]);
  const [contractorId, setContractorId] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('week');
  const [error, setError] = useState('');
  const reportParams = () => Object.fromEntries(Object.entries({ date_from: dateFrom, date_to: dateTo, contractor_id: contractorId, model, status }).filter(([, value]) => value));
  useEffect(() => { contractorsApi.list().then(setContractors).catch(() => {}); }, []);

  const load = async () => {
    setLoading(true);
    try {
      setError('');
      const params = reportParams();
      const res = await analyticsApi.analytics(params);
      setData(res);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [dateFrom, dateTo, contractorId, model, status]);

  const handleExport = async (format) => {
    setExportLoading(format);
    try {
      const token = localStorage.getItem('byd_token');
      const query = new URLSearchParams(reportParams());
      const url = `${import.meta.env.VITE_API_URL || 'https://byd-panel.omnisuiteai.com'}/api/contractor/export${format !== 'csv' ? `/${format}` : ''}?${query}`;

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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="filters-bar">
        <label>Contractor <select aria-label="Filter by contractor" className="form-select" value={contractorId} onChange={e => setContractorId(e.target.value)}><option value="">All contractors</option>{contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Model <input aria-label="Filter by model" className="form-input" value={model} onChange={e => setModel(e.target.value)} placeholder="All models" /></label>
        <label>Status <select aria-label="Filter by status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>

      {/* Date filters */}
      <div className="analytics-date-filters">
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', flex: '1 1 180px' }}>
          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>From</label>
          <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', flex: '1 1 180px' }}>
          <label className="form-label" style={{ whiteSpace: 'nowrap' }}>To</label>
          <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" style={{ height: 38 }} onClick={() => { setDateFrom(''); setDateTo(''); setContractorId(''); setModel(''); setStatus(''); }}>Clear</button>
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
            <StatCard icon={<TrendingUp size={20} />} label="Completion Rate" value={data.completion_rate != null ? `${data.completion_rate}%` : '—'} />
            <StatCard icon={<Clock size={20} />} label="Avg Time/Job" value={data.avg_time_per_job_seconds != null ? formatDuration(data.avg_time_per_job_seconds) : '—'} small />
            <StatCard icon={<BarChart2 size={20} />} label="Total Hours Logged" value={data.total_time_seconds != null ? formatDuration(data.total_time_seconds) : '—'} small />
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
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

          <div className="card">
            <h2 className="card-title">Completion trends</h2>
            {!data.completion_trends?.length && <p>No completions in this period.</p>}
            {(data.completion_trends || []).map(point => <div key={point.date} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{point.date}</span><strong>{point.completed}</strong></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${100 * point.completed / Math.max(1, ...data.completion_trends.map(p => p.completed))}%` }} /></div>
            </div>)}
          </div>
          <div className="card">
            <div className="card-header"><h2 className="card-title">Jobs by period</h2><select className="form-select" aria-label="Report period" value={period} onChange={e => setPeriod(e.target.value)}><option value="week">Weekly</option><option value="month">Monthly</option></select></div>
            <div className="table-container"><table><thead><tr><th>Period</th><th>Contractor</th><th>Model</th><th>Status</th><th>Jobs</th></tr></thead><tbody>
              {(period === 'week' ? data.jobs_per_week : data.jobs_per_month)?.map((row, index) => <tr key={index}><td>{row.period}</td><td>{row.contractor}</td><td>{row.model}</td><td>{STATUS_LABELS[row.status] || row.status}</td><td>{row.jobs}</td></tr>)}
            </tbody></table></div>
          </div>

          {/* Average Time per Task / Checklist Item (Scope §5) */}
          {data.average_time_per_task && data.average_time_per_task.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={18} color="var(--byd-red)" /> Average Time per Task Type
                </span>
                <span className="badge badge-normal">{data.average_time_per_task.length} Task Types</span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Task / Service Type</th>
                      <th>Avg Duration</th>
                      <th>Tasks Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.average_time_per_task.map((item) => (
                      <tr key={item.task_title}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.task_title}</td>
                        <td style={{ fontWeight: 700, color: 'var(--byd-red)' }}>{item.avg_minutes} mins</td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.total_completed} jobs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
