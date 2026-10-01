import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Layers, Clock,
  MoreHorizontal, Users, BarChart2, Zap, Settings,
  LogOut, X, WifiOff, CheckCircle2, ChevronRight, Activity
} from 'lucide-react';
import { useAuth, useIsAdmin } from '../../contexts/AuthContext';
import { getInitials } from '../../utils/helpers';
import { getQueueSize } from '../../utils/offlineQueue';

export default function BottomNav() {
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [queueSize, setQueueSize] = useState(getQueueSize());

  useEffect(() => {
    const interval = setInterval(() => {
      setQueueSize(getQueueSize());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close "More" drawer on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMoreOpen(false);
    logout();
    navigate('/login');
  };

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate(12); } catch (_) {}
    }
  };

  // Define mobile primary tabs based on role
  const contractorTabs = [
    { to: '/', label: 'Today', icon: LayoutDashboard, exact: true },
    { to: '/jobs', label: 'My Jobs', icon: Briefcase, exact: false },
    { to: '/settings', label: 'Profile', icon: Settings, exact: false },
  ];

  const adminTabs = [
    { to: '/', label: 'Today', icon: LayoutDashboard, exact: true },
    { to: '/jobs', label: 'Jobs', icon: Briefcase, exact: false },
    { to: '/kanban', label: 'Board', icon: Layers, exact: false },
    { to: '/time-logs', label: 'Time', icon: Clock, exact: false },
  ];

  const primaryTabs = isAdmin ? adminTabs : contractorTabs;

  const isMoreActive = ['/templates', '/users', '/analytics', '/settings', '/sync'].some(path =>
    location.pathname.startsWith(path)
  );

  return (
    <>
      {/* Fixed Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <div className="mobile-bottom-nav-inner">
          {primaryTabs.map(({ to, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === to
              : location.pathname.startsWith(to) && (to !== '/' || location.pathname === '/');

            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={triggerHaptic}
                className={`mobile-nav-tab ${isActive ? 'active' : ''}`}
                id={`mobile-tab-${label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="mobile-nav-icon-wrapper">
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  {isActive && <span className="mobile-nav-active-pill" />}
                </div>
                <span className="mobile-nav-label">{label}</span>
              </NavLink>
            );
          })}

          {/* More button (for Admin secondary routes and extras) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setMoreOpen(prev => !prev);
              }}
              className={`mobile-nav-tab ${isMoreActive || moreOpen ? 'active' : ''}`}
              id="mobile-tab-more"
              aria-expanded={moreOpen}
            >
              <div className="mobile-nav-icon-wrapper">
                <MoreHorizontal size={20} strokeWidth={isMoreActive || moreOpen ? 2.4 : 1.8} />
                {(isMoreActive || moreOpen) && <span className="mobile-nav-active-pill" />}
              </div>
              <span className="mobile-nav-label">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Slide-up "More" Drawer for Mobile */}
      {moreOpen && (
        <div className="mobile-more-overlay" onClick={() => setMoreOpen(false)}>
          <div
            className="mobile-more-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Sheet Handle */}
            <div className="mobile-more-handle-bar">
              <div className="mobile-more-handle" />
            </div>

            {/* Sheet Header */}
            <div className="mobile-more-header">
              <div className="mobile-user-profile-row">
                <div className="avatar sm">{getInitials(user?.name)}</div>
                <div className="mobile-user-meta">
                  <div className="mobile-user-name">{user?.name || 'User'}</div>
                  <div className="mobile-user-role">{user?.role?.replace('_', ' ')} · {user?.active_site || 'Fairfield'}</div>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* More Menu Items */}
            <div className="mobile-more-menu">
              <NavLink
                to="/analytics"
                className="mobile-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <div className="mobile-more-icon-box">
                  <BarChart2 size={18} />
                </div>
                <div className="mobile-more-item-info">
                  <span className="mobile-more-title">Analytics & Reports</span>
                  <span className="mobile-more-sub">Contractor output & turnaround</span>
                </div>
                <ChevronRight size={16} className="chevron" />
              </NavLink>

              <NavLink
                to="/templates"
                className="mobile-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <div className="mobile-more-icon-box">
                  <Zap size={18} />
                </div>
                <div className="mobile-more-item-info">
                  <span className="mobile-more-title">Job Templates</span>
                  <span className="mobile-more-sub">Standard task bundles & checklist</span>
                </div>
                <ChevronRight size={16} className="chevron" />
              </NavLink>

              <NavLink
                to="/users"
                className="mobile-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <div className="mobile-more-icon-box">
                  <Users size={18} />
                </div>
                <div className="mobile-more-item-info">
                  <span className="mobile-more-title">Contractor & Staff</span>
                  <span className="mobile-more-sub">Accounts & skills management</span>
                </div>
                <ChevronRight size={16} className="chevron" />
              </NavLink>

              <NavLink
                to="/sync"
                className="mobile-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <div className="mobile-more-icon-box">
                  <Activity size={18} />
                </div>
                <div className="mobile-more-item-info">
                  <span className="mobile-more-title">Sync Dashboard</span>
                  <span className="mobile-more-sub">Integration health & retry</span>
                </div>
                <ChevronRight size={16} className="chevron" />
              </NavLink>

              <NavLink
                to="/settings"
                className="mobile-more-item"
                onClick={() => setMoreOpen(false)}
              >
                <div className="mobile-more-icon-box">
                  <Settings size={18} />
                </div>
                <div className="mobile-more-item-info">
                  <span className="mobile-more-title">Hub Settings</span>
                  <span className="mobile-more-sub">API integration & password</span>
                </div>
                <ChevronRight size={16} className="chevron" />
              </NavLink>

              {queueSize > 0 && (
                <div className="mobile-more-offline-banner">
                  <WifiOff size={16} />
                  <span>{queueSize} offline actions waiting to sync</span>
                </div>
              )}

              <button
                type="button"
                className="mobile-more-logout-btn"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
