import { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { analyticsApi, contractorsApi } from '../api/client';
import { formatDuration, capitalize, STATUS_LABELS } from '../utils/helpers';
import { BarChart2, TrendingUp, Clock, CheckCircle, Download } from 'lucide-react';
import Pagination, { usePagination } from '../components/common/Pagination';

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
        <div className="analytics-export-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport('csv')} disabled={!!exportLoading}>
            <Download size={14} /> CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport('xlsx')} disabled={!!exportLoading}>
            <Download size={14} /> Excel
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => handleExport('pdf')} disabled={!!exportLoading}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {/* Analytics Responsive Filters Card */}
      <div className="card analytics-filters-card">
        <div className="analytics-filters-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="analytics-contractor">Contractor</label>
            <select
              id="analytics-contractor"
              aria-label="Filter by contractor"
              className="form-select"
              value={contractorId}
              onChange={e => setContractorId(e.target.value)}
            >
              <option value="">All contractors</option>
              {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="analytics-model">Model</label>
            <input
              id="analytics-model"
              aria-label="Filter by model"
              className="form-input"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="All models"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="analytics-status">Status</label>
            <select
              id="analytics-status"
              aria-label="Filter by status"
              className="form-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="analytics-from">From</label>
            <input
              id="analytics-from"
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="analytics-to">To</label>
            <input
              id="analytics-to"
              type="date"
              className="form-input"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>

          <div className="form-group analytics-clear-wrap">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', minHeight: 40 }}
              onClick={() => { setDateFrom(''); setDateTo(''); setContractorId(''); setModel(''); setStatus(''); }}
            >
              Clear
            </button>
          </div>
        </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {/* Jobs by contractor (Paginated) */}
            <JobsByContractorTable jobsByContractor={data.jobs_by_contractor} />

            {/* Jobs by model (Paginated) */}
            <JobsByModelTable jobsByModel={data.jobs_by_model} />
          </div>

          <div className="card">
            <h2 className="card-title">Completion trends</h2>
            {!data.completion_trends?.length && <p>No completions in this period.</p>}
            {(data.completion_trends || []).map(point => <div key={point.date} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{point.date}</span><strong>{point.completed}</strong></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${100 * point.completed / Math.max(1, ...data.completion_trends.map(p => p.completed))}%` }} /></div>
            </div>)}
          </div>

          {/* Jobs by Period (Paginated) */}
          <JobsByPeriodTable
            periodData={period === 'week' ? data.jobs_per_week : data.jobs_per_month}
            period={period}
            onPeriodChange={setPeriod}
          />

          {/* Average Time per Task / Checklist Item (Paginated) */}
          <AverageTimePerTaskTable taskData={data.average_time_per_task} />

          {/* Jobs Completed per VIN (Paginated) */}
          <CompletedPerVinTable completedData={data.completed_per_vin} />
        </div>
      )}
    </AppLayout>
  );
}

function JobsByContractorTable({ jobsByContractor }) {
  const entries = useMemo(() => {
    return Object.entries(jobsByContractor || {}).sort((a, b) => b[1] - a[1]);
  }, [jobsByContractor]);

  const { currentPage, pageSize, totalItems, paginatedItems, onPageChange } = usePagination(entries, 6);

  if (!entries.length) return null;

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div className="card-title">Jobs by Contractor</div>
        <span className="badge badge-normal">{entries.length} contractors</span>
      </div>
      <div className="table-container table-compact" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr><th>Contractor</th><th>Jobs</th></tr>
          </thead>
          <tbody>
            {paginatedItems.map(([name, count]) => (
              <tr key={name}>
                <td style={{ color: 'var(--text-primary)' }}>{name}</td>
                <td style={{ fontWeight: 700, color: 'var(--byd-red)' }}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
        compact
      />
    </div>
  );
}

function JobsByModelTable({ jobsByModel }) {
  const entries = useMemo(() => {
    return Object.entries(jobsByModel || {}).sort((a, b) => b[1] - a[1]);
  }, [jobsByModel]);

  const { currentPage, pageSize, totalItems, paginatedItems, onPageChange } = usePagination(entries, 6);

  if (!entries.length) return null;

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <div className="card-title">Jobs by Model</div>
        <span className="badge badge-normal">{entries.length} models</span>
      </div>
      <div className="table-container table-compact" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr><th>Model</th><th>Jobs</th></tr>
          </thead>
          <tbody>
            {paginatedItems.map(([model, count]) => (
              <tr key={model}>
                <td style={{ color: 'var(--text-primary)' }}>{model}</td>
                <td style={{ fontWeight: 700, color: 'var(--byd-red)' }}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
        compact
      />
    </div>
  );
}

function JobsByPeriodTable({ periodData, period, onPeriodChange }) {
  const rows = useMemo(() => periodData || [], [periodData]);
  const { currentPage, pageSize, totalItems, paginatedItems, onPageChange } = usePagination(rows, 8);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Jobs by period</h2>
        <select
          className="form-select"
          aria-label="Report period"
          value={period}
          onChange={e => onPeriodChange(e.target.value)}
          style={{ width: 'auto', minWidth: 110 }}
        >
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Contractor</th>
              <th>Model</th>
              <th>Status</th>
              <th>Jobs</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No records for this period</td></tr>
            ) : paginatedItems.map((row, index) => (
              <tr key={index}>
                <td>{row.period}</td>
                <td>{row.contractor}</td>
                <td>{row.model}</td>
                <td>{STATUS_LABELS[row.status] || row.status}</td>
                <td style={{ fontWeight: 600, color: 'var(--byd-red)' }}>{row.jobs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function AverageTimePerTaskTable({ taskData }) {
  const rows = useMemo(() => taskData || [], [taskData]);
  const { currentPage, pageSize, totalItems, paginatedItems, onPageChange } = usePagination(rows, 8);

  if (!rows.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} color="var(--byd-red)" /> Average Time per Task Type
        </span>
        <span className="badge badge-normal">{rows.length} Task Types</span>
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
            {paginatedItems.map((item) => (
              <tr key={item.task_title}>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.task_title}</td>
                <td style={{ fontWeight: 700, color: 'var(--byd-red)' }}>{item.avg_minutes} mins</td>
                <td style={{ color: 'var(--text-muted)' }}>{item.total_completed} jobs</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function CompletedPerVinTable({ completedData }) {
  const rows = useMemo(() => completedData || [], [completedData]);
  const { currentPage, pageSize, totalItems, paginatedItems, onPageChange, onPageSizeChange } = usePagination(rows, 10);

  if (!rows.length) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Jobs Completed per VIN ({rows.length})</span>
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
            {paginatedItems.map((item) => (
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
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[5, 10, 25, 50]}
      />
    </div>
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
