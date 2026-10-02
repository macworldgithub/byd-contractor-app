import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, MapPin, Camera, AlertTriangle, CheckCircle,
  MessageSquare, Plus, Flag, Shield, MoreHorizontal, Edit3, Trash2,
  Video, Play, StopCircle, Timer
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import {
  jobsApi, tasksApi, timeApi, evidenceApi,
  locationApi, activityApi, contractorsApi
} from '../api/client';
import { useAuth, useIsAdmin } from '../contexts/AuthContext';
import { addToQueue } from '../utils/offlineQueue';
import {
  STATUS_LABELS, STATUS_ORDER, PRIORITY_LABELS,
  formatDate, formatDateTime, formatDuration, timeAgo, taskProgress, getInitials
} from '../utils/helpers';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [locationHistory, setLocationHistory] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeLog, setActiveLog] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [comment, setComment] = useState('');
  const [issueText, setIssueText] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [evidenceStage, setEvidenceStage] = useState('before');
  const [locationLoading, setLocationLoading] = useState(false);
  const [customBay, setCustomBay] = useState('');
  const [taskTimers, setTaskTimers] = useState({}); // { taskId: { running, startTs, accumulated } }
  const taskTimerRefs = useRef({});

  const reload = async () => {
    try {
      const [jobData, actData, evData, tlData, locData] = await Promise.all([
        jobsApi.get(id),
        activityApi.list(id).catch(() => []),
        evidenceApi.list(id).catch(() => []),
        timeApi.getLogs(id).catch(() => []),
        locationApi.history(id).catch(() => []),
      ]);
      setJob(jobData);
      setActivity(Array.isArray(actData) ? actData : []);
      setEvidence(Array.isArray(evData) ? evData : []);
      setTimeLogs(Array.isArray(tlData) ? tlData : []);
      setLocationHistory(Array.isArray(locData) ? locData : []);

      const openLog = tlData?.find?.(l => !l.clock_out);
      setActiveLog(openLog || null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
    if (isAdmin) contractorsApi.list().then(setContractors).catch(() => {});
  }, [id]);

  // Live clock timer
  useEffect(() => {
    if (!activeLog?.clock_in) { setElapsed(0); return; }
    const start = new Date(activeLog.clock_in).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeLog]);

  const isOfflineError = (err) =>
    !navigator.onLine ||
    err?.message === 'Offline' ||
    err?.message?.toLowerCase().includes('failed to fetch') ||
    err?.message?.toLowerCase().includes('networkerror');

  const handleClockIn = async () => {
    setActionLoading('clock');
    try {
      if (!navigator.onLine) throw new Error('Offline');
      await timeApi.clockIn(id);
      await reload();
    } catch (e) {
      if (isOfflineError(e)) {
        addToQueue({ action_type: 'clock_in', job_id: id, payload: { task_id: null } });
        setActiveLog({ clock_in: new Date().toISOString(), contractor_name: user?.name, job_id: id });
        alert('Clock-in saved offline. Will sync automatically when connected.');
      } else {
        alert(e.message);
      }
    }
    setActionLoading('');
  };

  const handleClockOut = async () => {
    setActionLoading('clock');
    try {
      if (!navigator.onLine) throw new Error('Offline');
      await timeApi.clockOut(id);
      await reload();
    } catch (e) {
      if (isOfflineError(e)) {
        addToQueue({ action_type: 'clock_out', job_id: id, payload: {} });
        setActiveLog(null);
        alert('Clock-out saved offline. Will sync automatically when connected.');
      } else {
        alert(e.message);
      }
    }
    setActionLoading('');
  };

  const handleTaskToggle = async (task) => {
    const nextCompleted = !task.completed;
    // Optimistic UI update
    setJob(prev => prev ? ({
      ...prev,
      checklist: prev.checklist.map(t => t.id === task.id ? { ...t, completed: nextCompleted } : t)
    }) : prev);

    try {
      if (!navigator.onLine) throw new Error('Offline');
      await tasksApi.update(id, task.id, { completed: nextCompleted });
      await reload();
    } catch (e) {
      if (isOfflineError(e)) {
        addToQueue({ action_type: 'update_task', job_id: id, payload: { task_id: task.id, completed: nextCompleted } });
      } else {
        alert(e.message);
        await reload();
      }
    }
  };

  const handleStatusChange = async (newStatus) => {
    setActionLoading('status');
    try { await jobsApi.updateStatus(id, newStatus); await reload(); } catch (e) { alert(e.message); }
    setActionLoading('');
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const msg = comment;
    setComment('');
    try {
      if (!navigator.onLine) throw new Error('Offline');
      await activityApi.addComment(id, msg);
      await reload();
    } catch (e) {
      if (isOfflineError(e)) {
        addToQueue({ action_type: 'add_comment', job_id: id, payload: { message: msg } });
        alert('Comment queued offline.');
      } else {
        alert(e.message);
      }
    }
  };

  const handleFlagIssue = async () => {
    if (!issueText.trim()) { alert('Please describe the issue'); return; }
    const text = issueText;
    setActionLoading('flag');
    try {
      if (!navigator.onLine) throw new Error('Offline');
      await activityApi.flagIssue(id, text, true, []);
      setIssueText('');
      await reload();
    } catch (e) {
      if (isOfflineError(e)) {
        addToQueue({ action_type: 'flag_issue', job_id: id, payload: { description: text, is_urgent: true } });
        setIssueText('');
        alert('Issue flagged offline. Will sync when back online.');
      } else {
        alert(e.message);
      }
    }
    setActionLoading('');
  };

  const handleResolveIssue = async () => {
    setActionLoading('resolve');
    try { await activityApi.resolveIssue(id, 'Issue resolved'); await reload(); } catch (e) { alert(e.message); }
    setActionLoading('');
  };

  const handleEvidenceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionLoading('evidence');
    try {
      await evidenceApi.upload(id, file, evidenceStage, '');
      await reload();
      e.target.value = '';
    } catch (err) { alert(err.message); }
    setActionLoading('');
  };

  // ----- Per-task timer helpers -----
  const getTaskElapsed = (taskId) => {
    const t = taskTimers[taskId];
    if (!t) return 0;
    if (t.running) return t.accumulated + Math.floor((Date.now() - t.startTs) / 1000);
    return t.accumulated;
  };

  const toggleTaskTimer = (taskId) => {
    setTaskTimers(prev => {
      const t = prev[taskId] || { running: false, startTs: null, accumulated: 0 };
      if (t.running) {
        // stop
        return { ...prev, [taskId]: { running: false, startTs: null, accumulated: t.accumulated + Math.floor((Date.now() - t.startTs) / 1000) } };
      } else {
        // start
        return { ...prev, [taskId]: { running: true, startTs: Date.now(), accumulated: t.accumulated } };
      }
    });
  };

  const resetTaskTimer = (taskId) => {
    setTaskTimers(prev => ({ ...prev, [taskId]: { running: false, startTs: null, accumulated: 0 } }));
  };

  const handleLocationCheckIn = () => {
    setLocationLoading(true);
    const locName = customBay.trim() || job?.bay_location || job?.site_location || 'BYD Fairfield';

    const saveLoc = async (data) => {
      try {
        if (!navigator.onLine) throw new Error('Offline');
        await locationApi.checkIn(id, data);
        await reload();
        setCustomBay('');
        alert('Location checked in successfully!');
      } catch (e) {
        if (isOfflineError(e)) {
          addToQueue({ action_type: 'location_checkin', job_id: id, payload: data });
          setCustomBay('');
          alert('Location saved offline. Will sync when connection is restored.');
        } else {
          alert(e.message);
        }
      } finally {
        setLocationLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          saveLoc({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            location_name: locName,
          });
        },
        () => {
          // GPS unavailable or denied, still check-in location name
          saveLoc({
            location_name: locName,
            notes: 'GPS unavailable'
          });
        },
        { timeout: 7000 }
      );
    } else {
      saveLoc({ location_name: locName });
    }
  };

  const handleAssignContractor = async (contractorId) => {
    const contractor = contractors.find(c => c.id === contractorId);
    try {
      await jobsApi.update(id, {
        assigned_contractor_id: contractorId || null,
        assigned_contractor_name: contractor?.name || null,
      });
      await reload();
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-screen" style={{ height: '60vh' }}>
          <div className="spinner lg" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout>
        <div className="empty-state">
          <h3>Job not found</h3>
          <button className="btn btn-ghost" onClick={() => navigate('/jobs')}>Back to Jobs</button>
        </div>
      </AppLayout>
    );
  }

  const progress = taskProgress(job.checklist);
  const totalLogTime = timeLogs.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);

  return (
    <AppLayout>
      {/* Back + Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/jobs')} style={{ marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to Jobs
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.6rem' }}>{job.model_name}</h1>
              <span className={`badge badge-${job.status}`}>{STATUS_LABELS[job.status]}</span>
              <span className={`badge badge-${job.priority}`}>{PRIORITY_LABELS[job.priority]}</span>
              {job.issue_flag && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(227,0,27,0.12)', border: '1px solid rgba(227,0,27,0.3)',
                  borderRadius: 999, padding: '3px 10px', fontSize: '0.72rem', color: 'var(--byd-red)', fontWeight: 700
                }}>
                  <AlertTriangle size={11} /> ISSUE FLAGGED
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span>VIN: <strong style={{ color: 'var(--text-primary)' }}>{job.full_vin}</strong></span>
              {job.rego && <span>Rego: <strong style={{ color: 'var(--text-primary)' }}>{job.rego}</strong></span>}
              {job.site_location && <span>📍 {job.site_location}{job.bay_location ? ` · ${job.bay_location}` : ''}</span>}
              {job.due_date && <span>Due: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(job.due_date)}</strong></span>}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {job.issue_flag && isAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={handleResolveIssue} disabled={actionLoading === 'resolve'}>
                <Shield size={15} /> Resolve Issue
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONTRACTOR: Large Action Buttons */}
      {!isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {activeLog ? (
            <button
              className="clock-btn clock-out"
              onClick={handleClockOut}
              disabled={actionLoading === 'clock'}
            >
              <Clock size={24} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>CLOCKED IN · {formatDuration(elapsed)}</div>
                <div>Tap to Clock Out</div>
              </div>
            </button>
          ) : (
            <button
              className="clock-btn clock-in"
              onClick={handleClockIn}
              disabled={actionLoading === 'clock'}
            >
              <Clock size={24} />
              Clock In
            </button>
          )}

          <button
            className="clock-btn"
            onClick={handleLocationCheckIn}
            disabled={locationLoading}
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', boxShadow: '0 6px 24px rgba(59,130,246,0.35)' }}
          >
            <MapPin size={24} />
            {locationLoading ? 'Getting GPS...' : 'Check-in Location'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'checklist', 'evidence', 'location', 'activity', 'time'].map(tab => (
          <button
            key={tab}
            id={`tab-${tab}`}
            className={`tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'evidence' && evidence.length > 0 && ` (${evidence.length})`}
            {tab === 'location' && locationHistory.length > 0 && ` (${locationHistory.length})`}
            {tab === 'activity' && activity.length > 0 && ` (${activity.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }} className="fade-in">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Description */}
            {job.description && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: '0.75rem' }}>Description</div>
                <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{job.description}</p>
              </div>
            )}

            {/* Status Workflow (Admins + Assigned Contractors) */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '1rem' }}>
                {isAdmin ? 'Move Status' : 'Update Job Workflow'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {STATUS_ORDER.map((s, idx) => {
                  const isCurrent = s === job.status;
                  const curIdx = STATUS_ORDER.indexOf(job.status);
                  const isNext = idx === curIdx + 1;
                  return (
                    <button
                      key={s}
                      className={`btn btn-sm ${isCurrent ? 'btn-primary' : isNext ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => !isCurrent && handleStatusChange(s)}
                      disabled={isCurrent || actionLoading === 'status'}
                      style={isNext ? { borderColor: 'var(--byd-red)', color: 'var(--byd-red)', fontWeight: 700 } : undefined}
                      title={isNext ? `Next: Move to ${STATUS_LABELS[s]}` : undefined}
                    >
                      {isCurrent ? '✓ ' : isNext ? '→ ' : ''}{STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contractor assignment */}
            {isAdmin && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: '0.75rem' }}>Assigned Contractor</div>
                <select
                  id="detail-assign-contractor"
                  className="form-select"
                  value={job.assigned_contractor_id || ''}
                  onChange={e => handleAssignContractor(e.target.value)}
                >
                  <option value="">— Unassigned —</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Issue Flagging */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '0.75rem', color: job.issue_flag ? 'var(--byd-red)' : undefined }}>
                {job.issue_flag ? '⚠ Active Issue' : 'Flag an Issue'}
              </div>
              {job.issue_flag ? (
                <div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--byd-red-light)', marginBottom: '0.75rem' }}>
                    {job.issue_description}
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Reported by {job.issue_reported_by_name} · {timeAgo(job.issue_reported_at)}
                  </div>
                  {isAdmin && (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }} onClick={handleResolveIssue}>
                      <Shield size={14} /> Resolve Issue
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    className="form-input"
                    placeholder="Describe the issue..."
                    value={issueText}
                    onChange={e => setIssueText(e.target.value)}
                  />
                  <button className="btn btn-danger btn-sm" onClick={handleFlagIssue} disabled={actionLoading === 'flag'}>
                    <Flag size={14} /> Flag
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column — meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Progress */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '0.75rem' }}>Task Progress</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.5rem' }}>
                {progress}%
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className={`progress-fill${progress === 100 ? ' green' : ''}`} style={{ width: `${progress}%` }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {job.checklist?.filter(t => t.completed).length || 0} of {job.checklist?.length || 0} tasks done
              </div>
            </div>

            {/* Time Logged */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '0.5rem' }}>Time Logged</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700 }}>
                {formatDuration(totalLogTime)}
              </div>
              {activeLog && (
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 4 }}>
                  + {formatDuration(elapsed)} live
                </div>
              )}
            </div>

            {/* Meta Info */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '0.75rem' }}>Job Details</div>
              {[
                ['Created', formatDateTime(job.created_at)],
                ['Created By', job.created_by_name],
                ['Collected', formatDateTime(job.collected_at)],
                ['In Progress', formatDateTime(job.in_progress_at)],
                ['Returned', formatDateTime(job.returned_at)],
                ['Completed', formatDateTime(job.completed_at)],
              ].filter(([, v]) => v && v !== '—').map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--surface-border)', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Checklist */}
      {activeTab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 680 }} className="fade-in">
          {job.checklist?.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><CheckCircle size={24} /></div>
              <h3>No tasks</h3>
              <p>No checklist items added to this job</p>
            </div>
          ) : job.checklist.map(task => (
            <TaskTimerItem
              key={task.id}
              task={task}
              onToggle={() => handleTaskToggle(task)}
              elapsed={getTaskElapsed(task.id)}
              timerRunning={taskTimers[task.id]?.running || false}
              onTimerToggle={() => toggleTaskTimer(task.id)}
              onTimerReset={() => resetTaskTimer(task.id)}
            />
          ))}
        </div>
      )}

      {/* Tab: Evidence */}
      {activeTab === 'evidence' && (
        <div className="fade-in">
          {/* Upload controls */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 140 }}
              value={evidenceStage}
              onChange={e => setEvidenceStage(e.target.value)}
            >
              {['before', 'during', 'after', 'issue'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>

            <label className="btn btn-primary" htmlFor="evidence-upload-photo" style={{ cursor: 'pointer' }}>
              <Camera size={16} />
              {actionLoading === 'evidence' ? 'Uploading...' : 'Photo'}
              <input
                id="evidence-upload-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleEvidenceUpload}
                disabled={actionLoading === 'evidence'}
                style={{ display: 'none' }}
              />
            </label>

            <label className="btn btn-ghost" htmlFor="evidence-upload-video" style={{ cursor: 'pointer' }}>
              <Video size={16} />
              {actionLoading === 'evidence' ? 'Uploading...' : 'Video'}
              <input
                id="evidence-upload-video"
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleEvidenceUpload}
                disabled={actionLoading === 'evidence'}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Stage filter pills */}
          {evidence.length > 0 && (
            <EvidenceGallery evidence={evidence} jobId={id} downloadUrl={evidenceApi.downloadUrl} />
          )}

          {evidence.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><Camera size={28} /></div>
              <h3>No evidence yet</h3>
              <p>Upload before/during/after photos and videos</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Location History & Check-In */}
      {activeTab === 'location' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 850 }}>
          {/* Current Location Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="var(--byd-red)" /> Current Vehicle Location
              </span>
              <span className="badge badge-normal">{job.site_location || 'BYD Fairfield'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Site Location</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{job.site_location || 'Fairfield'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bay / Workshop Area</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: job.bay_location ? 'var(--byd-red)' : 'var(--text-muted)' }}>
                  {job.bay_location || 'Not specified'}
                </div>
              </div>
            </div>

            {/* Check-in input & button */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: '1 1 200px' }}
                placeholder="Enter bay / area (e.g. Bay 4, Tint Shed, Detailing)..."
                value={customBay}
                onChange={e => setCustomBay(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleLocationCheckIn}
                disabled={locationLoading}
              >
                <MapPin size={16} />
                {locationLoading ? 'Registering GPS...' : 'Register Vehicle Location'}
              </button>
            </div>
          </div>

          {/* Location Movement History Log */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Vehicle Movement &amp; Check-In History ({locationHistory.length})</span>
            </div>
            {locationHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><MapPin size={24} /></div>
                <h3>No location check-ins yet</h3>
                <p>Location entries and GPS check-ins will appear here as the vehicle moves</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Location / Bay</th>
                      <th>GPS Coordinates</th>
                      <th>Accuracy</th>
                      <th>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationHistory.map((loc) => (
                      <tr key={loc.id}>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDateTime(loc.recorded_at)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{loc.location_name || 'Fairfield'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {loc.latitude && loc.longitude ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : '—'}
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>{loc.accuracy ? `±${Math.round(loc.accuracy)}m` : '—'}</td>
                        <td style={{ fontSize: '0.8rem' }}>{loc.recorded_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Activity */}
      {activeTab === 'activity' && (
        <div className="fade-in" style={{ maxWidth: 600 }}>
          {/* Comment box */}
          <form onSubmit={handleComment} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <input
              id="activity-comment"
              className="form-input"
              placeholder="Add a comment..."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={!comment.trim()}>
              <MessageSquare size={16} /> Post
            </button>
          </form>

          {/* Activity feed */}
          <div className="activity-feed">
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <h3>No activity yet</h3>
              </div>
            ) : activity.map(item => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Tab: Time Logs */}
      {activeTab === 'time' && (
        <div className="fade-in">
          {/* Admin: clock in/out */}
          {isAdmin && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {activeLog ? (
                <button className="btn btn-danger" onClick={handleClockOut} disabled={actionLoading === 'clock'}>
                  <Clock size={16} /> Clock Out ({formatDuration(elapsed)})
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleClockIn} disabled={actionLoading === 'clock'}>
                  <Clock size={16} /> Clock In
                </button>
              )}
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Contractor</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No time logs</td></tr>
                ) : timeLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.contractor_name}</td>
                    <td>{formatDateTime(log.clock_in)}</td>
                    <td>{log.clock_out ? formatDateTime(log.clock_out) : <span style={{ color: '#10b981', fontWeight: 600 }}>Active</span>}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                      {log.duration_seconds ? formatDuration(log.duration_seconds) : <span style={{ color: '#10b981' }}>{formatDuration(elapsed)}</span>}
                    </td>
                    <td>{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem' }}>
            Total: {formatDuration(totalLogTime + (activeLog ? elapsed : 0))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function ActivityItem({ item }) {
  const iconMap = {
    comment: <MessageSquare size={14} />,
    status_change: <CheckCircle size={14} />,
    issue_flag: <AlertTriangle size={14} color="#e3001b" />,
    issue_resolved: <Shield size={14} color="#10b981" />,
    time_log: <Clock size={14} />,
    location_update: <MapPin size={14} />,
    assignment: <Flag size={14} />,
    checklist_update: <CheckCircle size={14} />,
  };

  return (
    <div className="activity-item">
      <div className="activity-dot">
        {iconMap[item.activity_type] || <MessageSquare size={14} />}
      </div>
      <div className="activity-content">
        <div className="activity-text">
          <strong>{item.author_name}</strong> {item.message}
        </div>
        <div className="activity-time">{timeAgo(item.created_at)}</div>
      </div>
    </div>
  );
}

// ---- Evidence Gallery with video support ----
function EvidenceGallery({ evidence, jobId, downloadUrl }) {
  const [filter, setFilter] = useState('all');
  const stages = ['all', ...new Set(evidence.map(e => e.stage))];
  const filtered = filter === 'all' ? evidence : evidence.filter(e => e.stage === filter);

  return (
    <div>
      {/* Stage filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {stages.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="evidence-grid">
        {filtered.map(ev => (
          <EvidenceCard key={ev.id} ev={ev} jobId={jobId} downloadUrl={downloadUrl} />
        ))}
      </div>
    </div>
  );
}

function EvidenceCard({ ev, jobId, downloadUrl }) {
  const [expanded, setExpanded] = useState(false);
  const url = downloadUrl(jobId, ev.id);
  const isVideo = ev.media_type === 'video' || ev.content_type?.startsWith('video/');

  return (
    <>
      <div
        className="evidence-thumb"
        onClick={() => setExpanded(true)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        {isVideo ? (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', borderRadius: 'inherit'
          }}>
            <Video size={32} color="white" style={{ marginBottom: 4 }} />
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>VIDEO</span>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)', borderRadius: 'inherit'
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.5)'
              }}>
                <Play size={16} color="white" style={{ marginLeft: 2 }} />
              </div>
            </div>
          </div>
        ) : (
          <img
            src={url}
            alt={ev.caption || ev.stage}
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        <div className="stage-label">{ev.stage}</div>
      </div>

      {/* Lightbox/Modal */}
      {expanded && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 9999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setExpanded(false)}
        >
          <button
            onClick={() => setExpanded(false)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: '50%', width: 40, height: 40, cursor: 'pointer',
              color: 'white', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>

          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh' }}>
            {isVideo ? (
              <video
                src={url}
                controls
                autoPlay
                style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, outline: 'none' }}
              />
            ) : (
              <img
                src={url}
                alt={ev.caption || ev.stage}
                style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain' }}
              />
            )}
          </div>

          {(ev.caption || ev.stage) && (
            <div style={{ marginTop: '1rem', color: 'white', textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{
                background: 'rgba(255,255,255,0.1)', padding: '4px 12px',
                borderRadius: 999, marginRight: 8, textTransform: 'capitalize'
              }}>{ev.stage}</span>
              {ev.caption && <span>{ev.caption}</span>}
            </div>
          )}

          <a
            href={url}
            download
            style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            ⬇ Download original
          </a>
        </div>
      )}
    </>
  );
}

// ---- Per-Task Timer Item ----
function TaskTimerItem({ task, onToggle, elapsed, timerRunning, onTimerToggle, onTimerReset }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const totalSecs = elapsed;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const display = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;

  return (
    <div
      className={`checklist-item${task.completed ? ' completed' : ''}`}
      style={{ flexWrap: 'wrap', gap: '0.5rem' }}
    >
      <input
        type="checkbox"
        className="custom-checkbox"
        checked={task.completed}
        onChange={onToggle}
        id={`task-${task.id}`}
      />
      <div style={{ flex: 1, minWidth: 120 }}>
        <label htmlFor={`task-${task.id}`} className="checklist-title" style={{ cursor: 'pointer', display: 'block' }}>
          {task.title}
        </label>
        {task.completed && task.completed_by_name && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Done by {task.completed_by_name}
          </div>
        )}
      </div>

      {/* Timer display + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {(totalSecs > 0 || timerRunning) && (
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '0.85rem', fontWeight: 700,
            color: timerRunning ? '#10b981' : 'var(--text-secondary)',
            minWidth: 52, textAlign: 'right'
          }}>
            {display}
          </span>
        )}
        <button
          onClick={onTimerToggle}
          title={timerRunning ? 'Pause timer' : 'Start task timer'}
          style={{
            background: timerRunning ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
            border: `1px solid ${timerRunning ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
            color: timerRunning ? '#ef4444' : '#10b981',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem'
          }}
        >
          {timerRunning ? <StopCircle size={13} /> : <Timer size={13} />}
          {timerRunning ? 'Stop' : 'Timer'}
        </button>
        {totalSecs > 0 && !timerRunning && (
          <button
            onClick={onTimerReset}
            title="Reset timer"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.7rem', padding: '4px'
            }}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
