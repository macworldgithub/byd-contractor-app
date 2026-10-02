import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Filter, Search, Download, RefreshCw, Upload } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { jobsApi, contractorsApi, templatesApi } from '../api/client';
import { useAuth, useIsAdmin } from '../contexts/AuthContext';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, formatDate, taskProgress, timeAgo } from '../utils/helpers';
import CreateJobModal from '../components/jobs/CreateJobModal';
import BulkImportModal from '../components/jobs/BulkImportModal';

const STATUS_OPTIONS = ['requested', 'collected', 'in_progress', 'returned', 'completed', 'invoiced'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function JobsPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(searchParams.get('is_urgent') === 'true');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [contractors, setContractors] = useState([]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (urgentOnly) params.is_urgent = true;
      const data = await jobsApi.list(params);
      let result = Array.isArray(data) ? data : [];
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(j =>
          j.model_name?.toLowerCase().includes(q) ||
          j.full_vin?.toLowerCase().includes(q) ||
          j.last_6_vin?.toLowerCase().includes(q) ||
          j.description?.toLowerCase().includes(q)
        );
      }
      setJobs(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, urgentOnly, search]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (isAdmin) contractorsApi.list().then(setContractors).catch(() => {});
  }, [isAdmin]);

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Jobs</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={loadJobs} title="Refresh jobs">
            <RefreshCw size={15} />
          </button>
          {isAdmin && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkImport(true)}>
                <Upload size={15} /> Import Trello / CSV
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> New Job
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {/* Search */}
        <div className="filters-search-box">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="jobs-search"
            className="form-input"
            style={{ paddingLeft: '2rem' }}
            type="text"
            placeholder="Search VIN, model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          id="jobs-status-filter"
          className="form-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>

        <select
          id="jobs-priority-filter"
          className="form-select"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>

        <button
          id="jobs-urgent-filter"
          className={`filter-chip${urgentOnly ? ' active' : ''}`}
          onClick={() => setUrgentOnly(v => !v)}
        >
          ⚠ Urgent Only
        </button>
      </div>

      {/* Jobs Table & Mobile Cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner lg" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Filter size={28} />
          </div>
          <h3>No jobs found</h3>
          <p>Try adjusting your filters or create a new job</p>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create Job
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="table-container fade-in jobs-desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Model / VIN</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Contractor</th>
                  <th>Progress</th>
                  <th>Due Date</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const prog = taskProgress(job.checklist);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{job.model_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{job.last_6_vin} · {job.rego || '—'}</div>
                        {job.issue_flag && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--byd-red)', fontWeight: 700 }}>⚠ ISSUE FLAGGED</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${job.status}`}>
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${job.priority}`}>
                          {PRIORITY_LABELS[job.priority] || job.priority}
                        </span>
                      </td>
                      <td style={{ color: job.assigned_contractor_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {job.assigned_contractor_name || 'Unassigned'}
                      </td>
                      <td>
                        {job.checklist?.length > 0 ? (
                          <div style={{ minWidth: 80 }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                              {job.checklist.filter(t => t.completed).length}/{job.checklist.length}
                            </div>
                            <div className="progress-bar" style={{ width: 80 }}>
                              <div className={`progress-fill${prog === 100 ? ' green' : ''}`} style={{ width: `${prog}%` }} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: job.due_date ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {formatDate(job.due_date)}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {timeAgo(job.updated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (Instant Touch Experience for Contractors) */}
          <div className="jobs-mobile-card-list fade-in">
            {jobs.map(job => {
              const prog = taskProgress(job.checklist);
              return (
                <div
                  key={job.id}
                  className={`job-mobile-card${job.is_urgent ? ' urgent' : ''}`}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <div className="job-mobile-card-header">
                    <div>
                      <div className="job-mobile-card-title">{job.model_name}</div>
                      <div className="job-mobile-card-vin">
                        VIN: {job.last_6_vin || job.full_vin?.slice(-6) || '—'} {job.rego ? `· ${job.rego}` : ''}
                      </div>
                    </div>
                    <div className="job-mobile-card-badges">
                      <span className={`badge badge-${job.status}`}>
                        {STATUS_LABELS[job.status] || job.status}
                      </span>
                      <span className={`badge badge-${job.priority}`}>
                        {PRIORITY_LABELS[job.priority] || job.priority}
                      </span>
                    </div>
                  </div>

                  {job.issue_flag && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--byd-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠ ISSUE FLAGGED {job.issue_description ? `— ${job.issue_description}` : ''}
                    </div>
                  )}

                  {job.checklist?.length > 0 && (
                    <div style={{ marginTop: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                        <span>Checklist Tasks</span>
                        <span>{job.checklist.filter(t => t.completed).length} / {job.checklist.length} done</span>
                      </div>
                      <div className="progress-bar" style={{ height: 6, margin: 0 }}>
                        <div className={`progress-fill${prog === 100 ? ' green' : ''}`} style={{ width: `${prog}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="job-mobile-card-meta">
                    <span>👤 {job.assigned_contractor_name || 'Unassigned'}</span>
                    <span>{job.due_date ? `Due ${formatDate(job.due_date)}` : `Updated ${timeAgo(job.updated_at)}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCreate && (
        <CreateJobModal
          contractors={contractors}
          onClose={() => setShowCreate(false)}
          onCreated={(job) => {
            setShowCreate(false);
            navigate(`/jobs/${job.id}`);
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImported={() => {
            loadJobs();
          }}
        />
      )}
    </AppLayout>
  );
}
