import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { timeApi, jobsApi } from '../api/client';
import { formatDate, formatDateTime, formatDuration, timeAgo } from '../utils/helpers';
import { Clock } from 'lucide-react';
import Pagination, { usePagination } from '../components/common/Pagination';

export default function TimeLogsPage() {
  const [logs, setLogs] = useState([]);
  const [jobs, setJobs] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeLog, setActiveLog] = useState(null);
  const pagination = usePagination(logs, 15);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const active = await timeApi.getActive();
        setActiveLog(active?.entry || null);

        const [jobData, allLogs] = await Promise.all([jobsApi.listAll(), timeApi.list()]);
        const jobMap = Object.fromEntries((jobData || []).map(job => [job.id, job]));
        setJobs(jobMap);
        allLogs.sort((a, b) => new Date(b.clock_in) - new Date(a.clock_in));
        setLogs(allLogs);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const totalSeconds = logs.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Time Logs</h1>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
          Total: {formatDuration(totalSeconds)}
        </div>
      </div>

      {activeLog && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontWeight: 600, color: '#10b981' }}>Active Session:</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {activeLog.contractor_name} on Job {jobs[activeLog.job_id]?.model_name || activeLog.job_id?.slice(-8)}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>since {formatDateTime(activeLog.clock_in)}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner lg" />
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Clock size={28} /></div>
          <h3>No time logs</h3>
          <p>Time entries will appear here as contractors clock in and out</p>
        </div>
      ) : (
        <div className="table-container fade-in">
          <table>
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Job</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(log => (
                <tr key={log.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.contractor_name}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {jobs[log.job_id]?.model_name || '—'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {jobs[log.job_id]?.last_6_vin}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{formatDateTime(log.clock_in)}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {log.clock_out
                      ? formatDateTime(log.clock_out)
                      : <span style={{ color: '#10b981', fontWeight: 600 }}>● Active</span>
                    }
                  </td>
                  <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {log.duration_seconds ? formatDuration(log.duration_seconds) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{log.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            currentPage={pagination.currentPage}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
            pageSizeOptions={[10, 15, 25, 50]}
          />
        </div>
      )}
    </AppLayout>
  );
}
