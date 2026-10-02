import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, AlertCircle, Clock, Calendar, Filter } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { jobsApi, contractorsApi } from '../api/client';
import {
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_DOT_COLORS,
  PRIORITY_LABELS,
  taskProgress,
  timeAgo,
  formatDate,
  formatDuration,
  isOverdue,
} from '../utils/helpers';
import CreateJobModal from '../components/jobs/CreateJobModal';

export default function KanbanPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [contractors, setContractors] = useState([]);
  const [movingJob, setMovingJob] = useState(null);
  const [search, setSearch] = useState('');
  const [filterContractor, setFilterContractor] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [jData, cData] = await Promise.all([
        jobsApi.list({ limit: 500 }),
        contractorsApi.list().catch(() => []),
      ]);
      setJobs(Array.isArray(jData) ? jData : []);
      setContractors(Array.isArray(cData) ? cData : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleMoveStatus = async (jobId, newStatus) => {
    if (!jobId || !newStatus) return;
    setMovingJob(jobId);
    try {
      await jobsApi.updateStatus(jobId, newStatus);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
      );
    } catch (e) {
      alert(e.message);
    }
    setMovingJob(null);
  };

  const handleDragStart = (e, jobId) => {
    e.dataTransfer.setData('text/plain', jobId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e, status) => {
    if (dragOverColumn === status) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const jobId = e.dataTransfer.getData('text/plain');
    if (!jobId) return;

    const currentJob = jobs.find((j) => j.id === jobId);
    if (currentJob && currentJob.status !== targetStatus) {
      await handleMoveStatus(jobId, targetStatus);
    }
  };

  // Filtered jobs
  const filteredJobs = jobs.filter((job) => {
    if (urgentOnly && !job.is_urgent && job.priority !== 'urgent') return false;
    if (filterContractor && job.assigned_contractor_id !== filterContractor) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchVin = (job.full_vin || '').toLowerCase().includes(q) || (job.last_6_vin || '').toLowerCase().includes(q);
      const matchModel = (job.model_name || '').toLowerCase().includes(q);
      const matchContractor = (job.assigned_contractor_name || '').toLowerCase().includes(q);
      const matchDesc = (job.description || '').toLowerCase().includes(q);
      if (!matchVin && !matchModel && !matchContractor && !matchDesc) return false;
    }
    return true;
  });

  const jobsByStatus = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = filteredJobs.filter((j) => j.status === s);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1>Kanban Board</h1>
          <p className="page-sub">Drag and drop jobs across workflow stages or filter by contractor &amp; urgency.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Job
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-border)',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ height: 34, fontSize: '0.82rem', padding: '0 8px' }}
            placeholder="Search by VIN, Model, Contractor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {contractors.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ height: 34, fontSize: '0.82rem', width: 170 }}
              value={filterContractor}
              onChange={(e) => setFilterContractor(e.target.value)}
            >
              <option value="">All Contractors</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={urgentOnly}
            onChange={(e) => setUrgentOnly(e.target.checked)}
          />
          <span style={{ color: urgentOnly ? 'var(--byd-red)' : 'var(--text-muted)', fontWeight: urgentOnly ? 600 : 400 }}>
            Urgent Only
          </span>
        </label>

        {(search || filterContractor || urgentOnly) && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.75rem', height: 32, padding: '0 8px' }}
            onClick={() => {
              setSearch('');
              setFilterContractor('');
              setUrgentOnly(false);
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner lg" />
        </div>
      ) : (
        <div className="kanban-board fade-in">
          {STATUS_ORDER.map((status) => {
            const isTarget = dragOverColumn === status;
            return (
              <div
                key={status}
                className="kanban-column"
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={(e) => handleDragLeave(e, status)}
                onDrop={(e) => handleDrop(e, status)}
                style={{
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  background: isTarget ? 'rgba(225, 27, 34, 0.04)' : undefined,
                  borderColor: isTarget ? 'var(--byd-red)' : undefined,
                }}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span className="column-dot" style={{ background: STATUS_DOT_COLORS[status] }} />
                    {STATUS_LABELS[status]}
                  </div>
                  <span className="kanban-column-count">{jobsByStatus[status]?.length || 0}</span>
                </div>

                <div className="kanban-cards">
                  {jobsByStatus[status]?.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {isTarget ? 'Drop here to update' : 'No jobs in this stage'}
                    </div>
                  ) : (
                    jobsByStatus[status].map((job) => (
                      <KanbanCard
                        key={job.id}
                        job={job}
                        currentStatus={status}
                        onView={() => navigate(`/jobs/${job.id}`)}
                        onMove={handleMoveStatus}
                        isMoving={movingJob === job.id}
                        statusOrder={STATUS_ORDER}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
    </AppLayout>
  );
}

function KanbanCard({ job, currentStatus, onView, onMove, isMoving, statusOrder, onDragStart }) {
  const prog = taskProgress(job.checklist);
  const curIdx = statusOrder.indexOf(currentStatus);
  const nextStatus = statusOrder[curIdx + 1];
  const prevStatus = statusOrder[curIdx - 1];
  const overdue = isOverdue(job.due_date);

  return (
    <div
      className={`job-card${job.is_urgent ? ' urgent' : ''}`}
      draggable={!isMoving}
      onDragStart={onDragStart}
      style={{
        opacity: isMoving ? 0.6 : 1,
        cursor: 'grab',
      }}
    >
      {job.issue_flag && <div className="issue-flag-dot" title="Issue flagged" />}

      <div className="job-card-top">
        <div className="job-card-vin" title={`Full VIN: ${job.full_vin || 'N/A'}`}>
          {job.last_6_vin || (job.full_vin ? job.full_vin.slice(-6) : 'NO VIN')}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          {job.is_urgent && (
            <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '0.65rem', fontWeight: 700 }}>
              URGENT
            </span>
          )}
          <span className={`badge badge-${job.priority}`}>{PRIORITY_LABELS[job.priority]}</span>
        </div>
      </div>

      <div className="job-card-model">{job.model_name}</div>
      {job.description && <div className="job-card-desc">{job.description}</div>}

      {/* Due Date & Delivery Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '0.4rem 0 0.5rem 0' }}>
        {job.due_date && (
          <div style={{
            fontSize: '0.68rem',
            color: overdue ? 'var(--byd-red)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: overdue ? 600 : 400
          }}>
            <Calendar size={11} /> Due: {formatDate(job.due_date)} {overdue && '(Overdue)'}
          </div>
        )}
        {job.delivery_date_time && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> Delivery: {formatDate(job.delivery_date_time)}
          </div>
        )}
      </div>

      {/* Itemized Tasks Progress */}
      {job.checklist?.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${prog}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
            <span>{job.checklist.filter((t) => t.completed).length}/{job.checklist.length} tasks</span>
            <span>{prog}%</span>
          </div>
        </div>
      )}

      {/* Meta: Contractor & Time Tracked */}
      <div className="job-card-meta">
        <div className="job-card-contractor">
          {job.assigned_contractor_name ? (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />{' '}
              {job.assigned_contractor_name}
            </>
          ) : (
            <span style={{ color: 'var(--byd-red)', fontSize: '0.68rem' }}>Unassigned</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {job.total_time_seconds > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 2 }} title="Total time tracked">
              ⏱ {formatDuration(job.total_time_seconds)}
            </span>
          )}
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{timeAgo(job.updated_at)}</span>
        </div>
      </div>

      {/* Quick Move and View Actions */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.6rem' }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 1, fontSize: '0.72rem', padding: '4px' }}
          onClick={onView}
        >
          View
        </button>
        {prevStatus && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.72rem', padding: '4px 8px' }}
            onClick={() => onMove(job.id, prevStatus)}
            title={`Move to ${STATUS_LABELS[prevStatus]}`}
            disabled={isMoving}
          >
            ←
          </button>
        )}
        {nextStatus && (
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1, fontSize: '0.72rem', padding: '4px' }}
            onClick={() => onMove(job.id, nextStatus)}
            disabled={isMoving}
          >
            → {STATUS_LABELS[nextStatus]}
          </button>
        )}
      </div>
    </div>
  );
}
