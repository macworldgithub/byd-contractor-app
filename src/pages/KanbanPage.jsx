import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { jobsApi } from '../api/client';
import { STATUS_LABELS, STATUS_ORDER, STATUS_DOT_COLORS, PRIORITY_LABELS, taskProgress, timeAgo } from '../utils/helpers';
import CreateJobModal from '../components/jobs/CreateJobModal';
import { contractorsApi } from '../api/client';

export default function KanbanPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [contractors, setContractors] = useState([]);
  const [movingJob, setMovingJob] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [jData, cData] = await Promise.all([
        jobsApi.list({ limit: 500 }),
        contractorsApi.list(),
      ]);
      setJobs(Array.isArray(jData) ? jData : []);
      setContractors(Array.isArray(cData) ? cData : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleMoveStatus = async (jobId, newStatus) => {
    setMovingJob(jobId);
    try {
      await jobsApi.updateStatus(jobId, newStatus);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    } catch (e) { alert(e.message); }
    setMovingJob(null);
  };

  const jobsByStatus = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s);
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Kanban Board</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Job
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner lg" />
        </div>
      ) : (
        <div className="kanban-board fade-in">
          {STATUS_ORDER.map(status => (
            <div key={status} className="kanban-column">
              <div className="kanban-column-header">
                <div className="kanban-column-title">
                  <span className="column-dot" style={{ background: STATUS_DOT_COLORS[status] }} />
                  {STATUS_LABELS[status]}
                </div>
                <span className="kanban-column-count">{jobsByStatus[status]?.length || 0}</span>
              </div>

              <div className="kanban-cards">
                {jobsByStatus[status]?.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No jobs
                  </div>
                ) : jobsByStatus[status].map(job => (
                  <KanbanCard
                    key={job.id}
                    job={job}
                    currentStatus={status}
                    onView={() => navigate(`/jobs/${job.id}`)}
                    onMove={handleMoveStatus}
                    isMoving={movingJob === job.id}
                    statusOrder={STATUS_ORDER}
                  />
                ))}
              </div>
            </div>
          ))}
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

function KanbanCard({ job, currentStatus, onView, onMove, isMoving, statusOrder }) {
  const [showMenu, setShowMenu] = useState(false);
  const prog = taskProgress(job.checklist);
  const curIdx = statusOrder.indexOf(currentStatus);
  const nextStatus = statusOrder[curIdx + 1];
  const prevStatus = statusOrder[curIdx - 1];

  return (
    <div className={`job-card${job.is_urgent ? ' urgent' : ''}`} style={{ opacity: isMoving ? 0.6 : 1 }}>
      {job.issue_flag && <div className="issue-flag-dot" />}

      <div className="job-card-top">
        <div className="job-card-vin">{job.last_6_vin}</div>
        <span className={`badge badge-${job.priority}`}>{PRIORITY_LABELS[job.priority]}</span>
      </div>

      <div className="job-card-model">{job.model_name}</div>
      {job.description && <div className="job-card-desc">{job.description}</div>}

      {job.checklist?.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${prog}%` }} />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {job.checklist.filter(t => t.completed).length}/{job.checklist.length} tasks
          </div>
        </div>
      )}

      <div className="job-card-meta">
        <div className="job-card-contractor">
          {job.assigned_contractor_name
            ? <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> {job.assigned_contractor_name}</>
            : <span style={{ color: 'var(--byd-red)', fontSize: '0.68rem' }}>Unassigned</span>
          }
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{timeAgo(job.updated_at)}</div>
      </div>

      {/* Actions */}
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
