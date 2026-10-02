import { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import { jobsApi, templatesApi } from '../../api/client';

const STATUS_OPTIONS = ['requested', 'collected', 'in_progress', 'returned', 'completed', 'invoiced'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function CreateJobModal({ contractors, initialTemplate = null, onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate?.id || '');
  const [form, setForm] = useState({
    model_name: '',
    full_vin: '',
    rego: '',
    description: '',
    priority: 'normal',
    status: 'requested',
    assigned_contractor_id: '',
    site_location: 'Fairfield',
    bay_location: '',
    due_date: '',
    delivery_date_time: '',
    is_urgent: false,
    template_id: initialTemplate?.id || null,
  });
  const [taskLines, setTaskLines] = useState(initialTemplate?.tasks?.join('\n') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    templatesApi.list().then(data => {
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      if (initialTemplate) {
        applyTemplate(initialTemplate);
      }
    }).catch(() => {});
  }, []);

  const applyTemplate = (t) => {
    if (!t) return;
    setSelectedTemplateId(t.id);
    if (t.tasks?.length) setTaskLines(t.tasks.join('\n'));
    if (t.description && !form.description) set('description', t.description);
    set('template_id', t.id);
  };

  const handleTemplateChange = (tmplId) => {
    setSelectedTemplateId(tmplId);
    if (!tmplId) {
      set('template_id', null);
      return;
    }
    const t = templates.find(x => x.id === tmplId);
    if (t) applyTemplate(t);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        assigned_contractor_id: form.assigned_contractor_id || null,
        checklist: taskLines.split('\n').map(t => t.trim()).filter(Boolean).map(title => ({ title })),
      };
      const job = await jobsApi.create(payload);
      onCreated(job);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Create New Job</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {templates.length > 0 && (
              <div className="form-group" style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--byd-red)' }}>
                  <Zap size={14} /> Quick-Fill from Template
                </label>
                <select
                  className="form-select"
                  value={selectedTemplateId}
                  onChange={e => handleTemplateChange(e.target.value)}
                >
                  <option value="">— Choose a template to pre-fill tasks —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.category ? `(${t.category})` : ''} · {t.tasks?.length || 0} tasks
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Model Name *</label>
                <input id="create-model" className="form-input" required value={form.model_name}
                  onChange={e => set('model_name', e.target.value)} placeholder="e.g. BYD Atto 3" />
              </div>
              <div className="form-group">
                <label className="form-label">Full VIN *</label>
                <input id="create-vin" className="form-input" required value={form.full_vin}
                  onChange={e => set('full_vin', e.target.value)} placeholder="17-character VIN" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rego</label>
                <input className="form-input" value={form.rego} onChange={e => set('rego', e.target.value)} placeholder="e.g. ABC123" />
              </div>
              <div className="form-group">
                <label className="form-label">Bay Location</label>
                <input className="form-input" value={form.bay_location} onChange={e => set('bay_location', e.target.value)} placeholder="e.g. Bay 4" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description / Notes</label>
              <textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Job details, special instructions..." />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select id="create-priority" className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select id="create-status" className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Date/Time</label>
                <input className="form-input" type="datetime-local" value={form.delivery_date_time} onChange={e => set('delivery_date_time', e.target.value)} />
              </div>
            </div>

            {contractors?.length > 0 && (
              <div className="form-group">
                <label className="form-label">Assign Contractor</label>
                <select id="create-contractor" className="form-select" value={form.assigned_contractor_id} onChange={e => set('assigned_contractor_id', e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Checklist Tasks <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(one per line)</span></label>
              <textarea
                className="form-textarea"
                value={taskLines}
                onChange={e => setTaskLines(e.target.value)}
                placeholder={"Tint 2 Front\nCeramic Coating\nInterior Detail\nPre-delivery Inspection"}
                style={{ minHeight: 100 }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="create-urgent" checked={form.is_urgent} onChange={e => set('is_urgent', e.target.checked)} />
              <label htmlFor="create-urgent" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Mark as urgent
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button id="create-job-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
