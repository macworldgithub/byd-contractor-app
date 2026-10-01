import { Search, Bell, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../utils/helpers';
import { getQueueSize } from '../../utils/offlineQueue';

export default function Topbar() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const queueSize = getQueueSize();
  const isOnline = navigator.onLine;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(search.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <header className="topbar">
      {/* Mobile Top Header (Displayed on mobile) */}
      <div className="mobile-topbar-header">
        <div className="mobile-topbar-left">
          <div className="mobile-brand-meta">
            BYD FAIRFIELD · CONTRACTOR HUB
          </div>
          <h1 className="mobile-greeting-title">
            {getGreeting()}, <span className="mobile-user-highlight">{user?.name?.split(' ')[0] || 'BYD'}</span>
          </h1>
        </div>

        <div className="mobile-topbar-right">
          <div className="mobile-live-pill" title="Connected to Delivery Centre">
            <span className="live-dot-pulse" />
            <span className="live-text">Live · AEST</span>
          </div>

          <button
            className="mobile-icon-btn"
            onClick={() => setSearchOpen(prev => !prev)}
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          <button className="mobile-icon-btn notification-btn" id="mobile-notifications-btn" aria-label="Notifications">
            <Bell size={18} />
            <span className="notification-dot" />
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
            onChange={e => setSearch(e.target.value)}
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
          onChange={e => setSearch(e.target.value)}
        />
      </form>

      {/* Desktop Topbar Actions */}
      <div className="topbar-actions desktop-only">
        {!isOnline && (
          <div className="offline-badge">
            <WifiOff size={13} />
            Offline {queueSize > 0 && `(${queueSize} queued)`}
          </div>
        )}

        {/* <div className="desktop-live-status">
          <span className="live-dot-pulse" />
          <span>Live · AEST</span>
        </div> */}

        <button className="notification-btn" id="notifications-btn" aria-label="Notifications">
          <Bell size={16} />
          <span className="notification-dot" />
        </button>
      </div>
    </header>
  );
}
