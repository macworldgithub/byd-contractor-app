import { useEffect, useState } from 'react';
import { Briefcase, Clock, CheckCircle, AlertTriangle, TrendingUp, Users, Layers, Zap, RefreshCw, ArrowRight } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { analyticsApi, jobsApi, timeApi } from '../api/client';
import { useAuth, useIsAdmin } from '../contexts/AuthContext';
import { formatDuration, formatDate, timeAgo, STATUS_LABELS, taskProgress } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLog, setActiveLog] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [urgentJobs, setUrgentJobs] = useState([]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [dash, active, jobs, urgent, blocked] = await Promise.all([
          analyticsApi.dashboard(),
          timeApi.getActive(),
          jobsApi.list({ limit: 5 }),
          jobsApi.list({ is_urgent: true, limit: 8 }),
          jobsApi.list({ issue_flag: true, limit: 8 }),
        ]);
        setDashboard(dash);
        setActiveLog(active?.active_log || null);
        setRecentJobs(Array.isArray(jobs) ? jobs : []);
        // Merge urgent + flagged, deduplicate by id
        const allEscalated = [...(Array.isArray(urgent) ? urgent : []), ...(Array.isArray(blocked) ? blocked : [])];
        const seen = new Set();
        setUrgentJobs(allEscalated.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Live timer for active clock-in
  useEffect(() => {
    if (!activeLog?.clock_in) { setElapsed(0); return; }
    const start = new Date(activeLog.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeLog]);

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-screen" style={{ height: '60vh' }}>
          <div className="spinner lg" />
          <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
        </div>
      </AppLayout>
    );
  }

  const stats = dashboard || {};

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>
            Good {getGreeting()},{' '}
            <span style={{ color: 'var(--byd-red)' }}>{user?.name?.split(' ')[0] || 'there'}</span>
          </h1>
          <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isAdmin && (
            <button className="btn btn-ghost" onClick={() => navigate('/kanban')}>
              <Layers size={16} /> Kanban Board
            </button>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/jobs')}>
            <Briefcase size={16} /> View All Jobs
          </button>
        </div>
      </div>

      {/* Active Clock Banner */}
      {activeLog && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', animation: 'pulseDot 2s infinite' }} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENTLY CLOCKED IN</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Job: {activeLog.job_id?.slice(-8)?.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
            {formatDuration(elapsed)}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/jobs/${activeLog.job_id}`)}>
            View Job →
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <StatCard
          icon={<Briefcase size={20} />}
          label="Total Jobs"
          value={stats.total_jobs ?? '—'}
          color="var(--byd-red)"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="In Progress"
          value={stats.in_progress_jobs ?? '—'}
          color="#8b5cf6"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Completed Today"
          value={stats.completed_today ?? '—'}
          color="#10b981"
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Urgent / Flagged"
          value={(stats.urgent_jobs ?? 0) + (stats.flagged_jobs ?? 0)}
          color="var(--byd-red)"
          highlight
        />
        {isAdmin && (
          <>
            <StatCard icon={<Users size={20} />} label="Active Contractors" value={stats.active_contractors ?? '—'} color="#3b82f6" />
            <StatCard icon={<TrendingUp size={20} />} label="Avg Time/Job" value={stats.avg_time_per_job_seconds ? formatDuration(stats.avg_time_per_job_seconds) : '—'} color="#f59e0b" small />
          </>
        )}
      </div>

      {/* Two column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
        {/* Recent Jobs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Jobs</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/jobs')}>View All</button>
          </div>
          {recentJobs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <div className="empty-state-icon"><Briefcase size={24} /></div>
              <h3>No jobs yet</h3>
            </div>
          ) : recentJobs.map(job => (
            <MiniJobRow key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
          ))}
        </div>

        {/* Urgent Jobs (admin) or Pipeline Status */}
        {isAdmin ? (
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--byd-red)' }}>
                ⚠ Urgent &amp; Flagged
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/jobs?is_urgent=true')}>View All</button>
            </div>
            {urgentJobs.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><CheckCircle size={24} /></div>
                <h3 style={{ color: '#10b981' }}>All clear!</h3>
                <p>No urgent or flagged jobs</p>
              </div>
            ) : urgentJobs.slice(0, 5).map(job => (
              <MiniJobRow key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} urgent />
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pipeline Status</span>
            </div>
            {Object.entries(stats.jobs_by_status || {}).map(([status, count]) => (
              <PipelineRow key={status} status={status} count={count} total={stats.total_jobs || 1} />
            ))}
          </div>
        )}
      </div>

      {/* Escalation Queue (Admin only) */}
      {isAdmin && urgentJobs.length > 0 && (
        <EscalationQueue jobs={urgentJobs} navigate={navigate} />
      )}
    </AppLayout>
  );
}

// ---- Sub-components ----

function StatCard({ icon, label, value, color, highlight, small }) {
  return (
    <div className="stat-card" style={{ '--accent': color }}>
      <div className="stat-icon" style={{ background: `${color}1a`, color }}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: small ? '1.25rem' : undefined, color: highlight ? 'var(--byd-red)' : undefined }}>
        {value}
      </div>
    </div>
  );
}

function MiniJobRow({ job, onClick, urgent }) {
  const progress = taskProgress(job.checklist);
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--surface-border)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      className="mini-job-row"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {job.model_name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>VIN: {job.last_6_vin}</div>
      </div>
      <span className={`badge badge-${job.status}`}>{STATUS_LABELS[job.status] || job.status}</span>
      {urgent && job.issue_flag && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--byd-red)', display: 'block', flexShrink: 0 }} />}
    </div>
  );
}

function PipelineRow({ status, count, total }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{STATUS_LABELS[status] || status}</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{count}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---- Escalation Queue Widget ----
function EscalationQueue({ jobs, navigate }) {
  const urgent = jobs.filter(j => j.priority === 'urgent' || j.priority === 'critical');
  const flagged = jobs.filter(j => j.issue_flag);
  const blocked = jobs.filter(j => j.status === 'blocked');

  const sections = [
    { label: 'Critical / Urgent', color: '#ef4444', items: urgent, icon: '🚨' },
    { label: 'Issue Flagged', color: '#f59e0b', items: flagged, icon: '⚠️' },
    { label: 'Blocked', color: '#8b5cf6', items: blocked, icon: '🔒' },
  ].filter(s => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div
      className="card"
      style={{
        marginTop: '1.5rem',
        border: '1px solid rgba(239,68,68,0.2)',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.04), var(--surface-elevated))'
      }}
    >
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
          <AlertTriangle size={18} /> Escalation Queue
          <span style={{
            background: '#ef4444', color: 'white', borderRadius: 999,
            padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700
          }}>{jobs.length}</span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/jobs')}>
          View All Jobs <ArrowRight size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {sections.map(({ label, color, items, icon }) => (
          <div key={label} style={{
            background: `${color}0d`, border: `1px solid ${color}30`,
            borderRadius: 'var(--radius)', padding: '0.875rem'
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color, letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {icon} {label.toUpperCase()} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {items.slice(0, 4).map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    cursor: 'pointer', padding: '0.35rem 0.5rem',
                    borderRadius: 6, transition: 'background 0.15s'
                  }}
                  className="mini-job-row"
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.model_name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>···{job.last_6_vin}</div>
                  </div>
                  <ArrowRight size={12} color={color} />
                </div>
              ))}
              {items.length > 4 && (
                <div style={{ fontSize: '0.72rem', color, textAlign: 'center', padding: '0.25rem', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => navigate('/jobs')}>
                  +{items.length - 4} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
