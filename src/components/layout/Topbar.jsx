import { Search, Bell, WifiOff, X, AlertTriangle, ChevronRight, ShieldAlert, CheckCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials, timeAgo } from '../../utils/helpers';
import { getQueueSize } from '../../utils/offlineQueue';
import { jobsApi } from '../../api/client';

export default function Topbar() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const queueSize = getQueueSize();
  const isOnline = navigator.onLine;

  const fetchAlerts = async () => {
    try {
      const [urgentJobs, allJobs] = await Promise.all([
        jobsApi.list({ is_urgent: true, limit: 15 }).catch(() => []),
        jobsApi.list({ limit: 50 }).catch(() => []),
      ]);
      const flagged = Array.isArray(allJobs) ? allJobs.filter((j) => j.issue_flag) : [];
      const combined = [
        ...(Array.isArray(urgentJobs) ? urgentJobs.map((j) => ({ ...j, alertType: 'urgent' })) : []),
        ...flagged.map((j) => ({ ...j, alertType: 'issue' })),
      ];
      // deduplicate by id
      const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());
      setAlerts(unique);
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(search.trim())}`);
      setSearchOpen(false);
    }
  };

  const openJob = (jobId) => {
    setNotifOpen(false);
    navigate(`/jobs/${jobId}`);
  };

  return (
    <header className="topbar">
      {/* Mobile Top Header (Displayed on mobile) */}
      <div className="mobile-topbar-header">
        <div className="mobile-topbar-left">
          <div className="mobile-brand-meta">
            BYD FAIRFIELD · CONTRACTOR HUB
          </div>
          <div className="mobile-greeting-title">
            BYD <span className="mobile-user-highlight">Contractor Hub</span>
          </div>
        </div>

        <div className="mobile-topbar-right">
          <button
            className="mobile-icon-btn"
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          <button
            className="mobile-icon-btn notification-btn"
            id="mobile-notifications-btn"
            aria-label="Notifications"
            onClick={() => setNotifOpen((prev) => !prev)}
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {alerts.length > 0 && <span className="notification-dot" />}
          </button>

          <div className="mobile-user-avatar" onClick={() => navigate('/settings')}>
            {getInitials(user?.name)}
          </div>
        </div>
      </div>

      {/* Mobile Expandable Search */}
      {searchOpen && (
        <form onSubmit={handleSearch} className="mobile-search-bar fade-in">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search jobs, VINs, models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <button type="button" className="btn-icon sm" onClick={() => setSearchOpen(false)}>
            <X size={16} />
          </button>
        </form>
      )}

      {/* Desktop Search Bar (Displayed on desktop/tablet) */}
      <form onSubmit={handleSearch} className="topbar-search desktop-only">
        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          id="global-search"
          type="text"
          placeholder="Search jobs, VINs, models, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      {/* Desktop Topbar Actions */}
      <div className="topbar-actions desktop-only" style={{ position: 'relative' }}>
        {!isOnline && (
          <div className="offline-badge">
            <WifiOff size={13} />
            Offline {queueSize > 0 && `(${queueSize} queued)`}
          </div>
        )}

        <button
          className="notification-btn"
          id="notifications-btn"
          aria-label="Notifications"
          onClick={() => setNotifOpen((prev) => !prev)}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <Bell size={16} />
          {alerts.length > 0 && <span className="notification-dot" />}
        </button>
      </div>

      {/* Interactive Notification Popover */}
      {notifOpen && (
        <div
          ref={notifRef}
          className="fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 16,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--surface-card, #ffffff)',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16)',
            border: '1px solid var(--surface-border, rgba(0,0,0,0.08))',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--surface-border, #f0f0f0)',
            background: 'var(--surface-bg, #fafafa)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Notifications &amp; Alerts</span>
              {alerts.length > 0 && (
                <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.68rem', fontWeight: 700 }}>
                  {alerts.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setNotifOpen(false)}
              className="btn-icon sm"
              style={{ padding: 4 }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle size={28} style={{ margin: '0 auto 8px', color: '#10b981' }} />
                <p style={{ fontSize: '0.84rem', fontWeight: 500, margin: 0 }}>All caught up</p>
                <p style={{ fontSize: '0.74rem', margin: '4px 0 0' }}>No pending alerts or urgent jobs</p>
              </div>
            ) : (
              alerts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openJob(item.id)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--surface-border, #f0f0f0)',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-bg, #f9fafb)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ marginTop: 2 }}>
                    {item.is_urgent ? (
                      <ShieldAlert size={18} style={{ color: '#dc2626' }} />
                    ) : (
                      <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.model_name}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {timeAgo(item.updated_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      VIN: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.last_6_vin || item.full_vin?.slice(-6)}</span>
                    </div>
                    {item.issue_description && (
                      <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 3 }}>
                        • {item.issue_description}
                      </div>
                    )}
                    {item.is_urgent && !item.issue_description && (
                      <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 3 }}>
                        • Urgent job flagged from Delivery Centre
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
                </div>
              ))
            )}
          </div>

          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--surface-border, #f0f0f0)',
            background: 'var(--surface-bg, #fafafa)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.74rem',
          }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.74rem', padding: '2px 6px' }}
              onClick={() => {
                setNotifOpen(false);
                navigate('/settings');
              }}
            >
              Push Notification Settings →
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.74rem', padding: '2px 6px' }}
              onClick={() => {
                setNotifOpen(false);
                navigate('/kanban');
              }}
            >
              View Kanban
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
