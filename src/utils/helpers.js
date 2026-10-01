// Format seconds into H:MM:SS
export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Relative time (e.g., "2 hours ago")
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// Format a date string nicely
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Format datetime 
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Get user initials
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Capitalize first letter of each word
export function capitalize(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Status display mapping
export const STATUS_LABELS = {
  requested: 'Requested',
  collected: 'Collected',
  in_progress: 'In Progress',
  returned: 'Returned to BYD',
  completed: 'Completed',
  invoiced: 'Invoiced',
};

export const STATUS_ORDER = ['requested', 'collected', 'in_progress', 'returned', 'completed', 'invoiced'];

export const STATUS_COLORS = {
  requested: 'requested',
  collected: 'collected',
  in_progress: 'in_progress',
  returned: 'returned',
  completed: 'completed',
  invoiced: 'invoiced',
};

export const STATUS_DOT_COLORS = {
  requested: '#f59e0b',
  collected: '#3b82f6',
  in_progress: '#8b5cf6',
  returned: '#06b6d4',
  completed: '#10b981',
  invoiced: '#6b7280',
};

export const PRIORITY_LABELS = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

// Check task completion percentage
export function taskProgress(checklist) {
  if (!checklist?.length) return 0;
  const done = checklist.filter(t => t.completed).length;
  return Math.round((done / checklist.length) * 100);
}

// Is a date overdue?
export function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}
