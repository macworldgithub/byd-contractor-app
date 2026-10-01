import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, BarChart2,
  Settings, LogOut, Layers, Clock, Zap, Activity
} from 'lucide-react';
import { useAuth, useIsAdmin } from '../../contexts/AuthContext';
import { getInitials } from '../../utils/helpers';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['contractor', 'admin', 'super_admin'] },
  { to: '/jobs', icon: Briefcase, label: 'Jobs', roles: ['contractor', 'admin', 'super_admin'] },
  { to: '/kanban', icon: Layers, label: 'Kanban Board', roles: ['admin', 'super_admin'] },
  { to: '/analytics', icon: BarChart2, label: 'Analytics', roles: ['admin', 'super_admin'] },
  { to: '/templates', icon: Zap, label: 'Templates', roles: ['admin', 'super_admin'] },
  { to: '/time-logs', icon: Clock, label: 'Time Logs', roles: ['admin', 'super_admin'] },
  { to: '/users', icon: Users, label: 'User Management', roles: ['admin', 'super_admin'] },
  { to: '/sync', icon: Activity, label: 'Sync Dashboard', roles: ['admin', 'super_admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['contractor', 'admin', 'super_admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  const visibleNav = NAV.filter(n => n.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <div>
          <div className="brand-text">BYD Fairfield</div>
          <div className="brand-sub">Contractor Hub</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Navigation</span>
        {visibleNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="user-info-card">
          <div className="avatar">{getInitials(user?.name)}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'User'}
            </div>
            <div className="user-role">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button
            className="btn-icon"
            onClick={handleLogout}
            title="Logout"
            style={{ width: 28, height: 28 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
