import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { adminApi } from '../api/client';
import { Plus, Edit3, Key, Trash2, X, AlertCircle } from 'lucide-react';
import { formatDate, timeAgo, getInitials } from '../utils/helpers';

const ROLES = ['contractor', 'admin', 'super_admin'];

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listUsers(roleFilter || undefined);
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [roleFilter]);

  const handleCreate = async (form) => {
    const res = await adminApi.createUser(form);
    if (res.temp_password) setTempPassword(res.temp_password);
    setShowCreate(false);
    load();
  };

  const handleResetPw = async (uid) => {
    const res = await adminApi.resetPassword(uid);
    setTempPassword(res.temp_password);
  };

  const handleDeactivate = async (uid) => {
    if (!confirm('Deactivate this user?')) return;
    await adminApi.deactivateUser(uid);
    load();
  };

  const handleUpdate = async (uid, form) => {
    await adminApi.updateUser(uid, form);
    setEditUser(null);
    load();
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      {tempPassword && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem', justifyContent: 'space-between' }}>
          <div>
            <strong>Temporary Password:</strong>{' '}
            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.1em' }}>
              {tempPassword}
            </code>
            {' '}— share this with the user securely.
          </div>
          <button onClick={() => setTempPassword('')} className="btn btn-ghost btn-sm"><X size={14} /></button>
        </div>
      )}

      {/* Role filter */}
      <div className="filters-bar">
        <button className={`filter-chip${!roleFilter ? ' active' : ''}`} onClick={() => setRoleFilter('')}>All Roles</button>
        {ROLES.map(r => (
          <button key={r} className={`filter-chip${roleFilter === r ? ' active' : ''}`} onClick={() => setRoleFilter(r)}>
            {r.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner lg" />
        </div>
      ) : (
        <div className="table-container fade-in">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                        {getInitials(u.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: u.role === 'super_admin' ? 'rgba(227,0,27,0.15)' : u.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
                      color: u.role === 'super_admin' ? 'var(--byd-red-light)' : u.role === 'admin' ? '#60a5fa' : '#9ca3af',
                    }}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: u.active ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>
                      {u.active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{timeAgo(u.last_login_at)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatDate(u.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-icon" onClick={() => setEditUser(u)} title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button className="btn btn-icon" onClick={() => handleResetPw(u.id)} title="Reset Password">
                        <Key size={14} />
                      </button>
                      <button className="btn btn-icon" onClick={() => handleDeactivate(u.id)} title="Deactivate" style={{ color: 'var(--byd-red)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <UserModal onClose={() => setShowCreate(false)} onSave={handleCreate} roles={ROLES} />}
      {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} onSave={(f) => handleUpdate(editUser.id, f)} roles={ROLES} />}
    </AppLayout>
  );
}

function UserModal({ user, onClose, onSave, roles }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'contractor',
    password: '',
    active: user?.active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!user;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = isEdit
        ? { name: form.name, role: form.role, active: form.active }
        : { name: form.name, email: form.email, role: form.role, password: form.password || undefined };
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? 'Edit User' : 'Create User'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} />{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input id="user-name" className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
          </div>
          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input id="user-email" className="form-input" required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Role</label>
            <select id="user-role" className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
              {roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to auto-generate)</span></label>
              <input className="form-input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Optional" />
            </div>
          )}
          {isEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="user-active" checked={form.active} onChange={e => set('active', e.target.checked)} />
              <label htmlFor="user-active" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>Active account</label>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button id="user-save" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
