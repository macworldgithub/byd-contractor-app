import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { templatesApi, contractorsApi } from '../api/client';
import { Plus, Edit3, Trash2, X, Zap, ArrowRight } from 'lucide-react';
import { timeAgo } from '../utils/helpers';
import CreateJobModal from '../components/jobs/CreateJobModal';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [activeJobTemplate, setActiveJobTemplate] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, cData] = await Promise.all([
        templatesApi.list(),
        contractorsApi.list().catch(() => [])
      ]);
      setTemplates(Array.isArray(data) ? data : []);
      setContractors(Array.isArray(cData) ? cData : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    await templatesApi.delete(id);
    load();
  };

  return (
    <AppLayout>
      <div className="page-header">
        <h1>Job Templates</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Template
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner lg" />
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Zap size={28} /></div>
          <h3>No templates yet</h3>
          <p>Create reusable job templates with pre-defined task checklists</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create Template</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }} className="fade-in">
          {templates.map(t => (
            <div key={t.id} className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{t.name}</div>
                  {t.category && <div style={{ fontSize: '0.72rem', color: 'var(--byd-red)', fontWeight: 600, marginTop: 2 }}>{t.category}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-icon" onClick={() => setEditTemplate(t)}><Edit3 size={14} /></button>
                  <button className="btn-icon" onClick={() => handleDelete(t.id)} style={{ color: 'var(--byd-red)' }}><Trash2 size={14} /></button>
                </div>
              </div>
              {t.description && <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>{t.description}</p>}
              {t.estimated_duration_minutes && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  ⏱ Est. {t.estimated_duration_minutes} min
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {t.tasks.map((task, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--byd-red)', flexShrink: 0 }} />
                    {task}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Updated {timeAgo(t.updated_at)}</span>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  onClick={() => setActiveJobTemplate(t)}
                >
                  <Zap size={12} /> Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <TemplateModal onClose={() => setShowCreate(false)} onSave={async (f) => { await templatesApi.create(f); setShowCreate(false); load(); }} />}
      {editTemplate && <TemplateModal template={editTemplate} onClose={() => setEditTemplate(null)} onSave={async (f) => { await templatesApi.update(editTemplate.id, f); setEditTemplate(null); load(); }} />}
      {activeJobTemplate && (
        <CreateJobModal
          contractors={contractors}
          initialTemplate={activeJobTemplate}
          onClose={() => setActiveJobTemplate(null)}
          onCreated={(job) => {
            setActiveJobTemplate(null);
            navigate(`/jobs/${job.id}`);
          }}
        />
      )}
    </AppLayout>
  );
}

function TemplateModal({ template, onClose, onSave }) {
  const [form, setForm] = useState({
    name: template?.name || '',
    description: template?.description || '',
    category: template?.category || 'General',
    estimated_duration_minutes: template?.estimated_duration_minutes || '',
    tasks: (template?.tasks || []).join('\n'),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave({
        ...form,
        tasks: form.tasks.split('\n').map(t => t.trim()).filter(Boolean),
        estimated_duration_minutes: form.estimated_duration_minutes ? Number(form.estimated_duration_minutes) : null,
      });
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{template ? 'Edit Template' : 'Create Template'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Template Name *</label>
            <input id="tmpl-name" className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pre-delivery Inspection" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="General" />
            </div>
            <div className="form-group">
              <label className="form-label">Est. Duration (min)</label>
              <input className="form-input" type="number" value={form.estimated_duration_minutes} onChange={e => setForm(f => ({ ...f, estimated_duration_minutes: e.target.value }))} placeholder="60" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          </div>
          <div className="form-group">
            <label className="form-label">Tasks <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(one per line)</span></label>
            <textarea
              id="tmpl-tasks"
              className="form-textarea"
              style={{ minHeight: 120 }}
              value={form.tasks}
              onChange={e => setForm(f => ({ ...f, tasks: e.target.value }))}
              placeholder={"Tint 2 Front\nCeramic Coating\nClean Interior"}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button id="tmpl-save" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : template ? 'Update' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
