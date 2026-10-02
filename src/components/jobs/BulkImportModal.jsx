import { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { jobsApi } from '../../api/client';

export default function BulkImportModal({ onClose, onImported }) {
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' or 'file'
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const sampleCsv = `Model,VIN,Due Date,Priority,Tasks,Notes
BYD Atto 3,LC0CE4EC8P000001,2026-10-15,normal,"Tint 2 Front;Ceramic Coating;Interior Clean",Customer requested early morning pickup
BYD Seal,LC0CE4EC8P000002,2026-10-16,urgent,"Window Tint;Floor Mats;Pre-delivery Inspection",Urgent VIP delivery
BYD Dolphin,LC0CE4EC8P000003,2026-10-18,normal,"Fit Dashcam;Wash & Vacuum",Standard preparation`;

  const parseCsv = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one job record.');

    // Simple robust CSV line splitter handling quoted commas
    const parseLine = (line) => {
      const row = [];
      let inQuote = false;
      let curr = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          row.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      row.push(curr.trim());
      return row;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
    const jobs = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (!row || row.length === 0 || !row[0]) continue;

      const record = {};
      headers.forEach((h, idx) => {
        record[h] = row[idx] || '';
      });

      const model = record['model'] || record['modelname'] || record['vehicle'] || 'BYD Vehicle';
      const vin = record['vin'] || record['fullvin'] || record['last6vin'] || `VIN-IMPORT-${Date.now()}-${i}`;
      const dueDate = record['duedate'] || record['due'] || record['deliverydate'] || undefined;
      const priority = ['urgent', 'high', 'low'].includes(record['priority']?.toLowerCase()) ? record['priority'].toLowerCase() : 'normal';
      const description = record['notes'] || record['description'] || '';

      const tasksRaw = record['tasks'] || record['checklist'] || '';
      const checklist = tasksRaw
        .split(/[;\n|]/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(title => ({ title }));

      jobs.push({
        model_name: model,
        full_vin: vin,
        due_date: dueDate,
        priority,
        description,
        checklist,
        status: 'requested',
        site_location: 'Fairfield'
      });
    }

    return jobs;
  };

  const parseJson = (text) => {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.cards || []);
    if (!arr.length) throw new Error('JSON does not contain any job objects.');

    return arr.map(item => ({
      model_name: item.model_name || item.name || item.vehicle || 'BYD Vehicle',
      full_vin: item.full_vin || item.vin || item.id || `VIN-${Date.now()}`,
      due_date: item.due_date || item.due || undefined,
      description: item.description || item.desc || '',
      priority: item.priority || (item.is_urgent ? 'urgent' : 'normal'),
      is_urgent: Boolean(item.is_urgent || item.priority === 'urgent'),
      checklist: Array.isArray(item.checklist)
        ? item.checklist.map(t => typeof t === 'string' ? { title: t } : { title: t.title || t.name })
        : (item.checkItems || []).map(t => ({ title: t.name || t.title })),
      status: item.status || 'requested',
      site_location: item.site_location || 'Fairfield'
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setRawText(evt.target.result || '');
      setActiveTab('paste');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rawText.trim()) {
      setError('Please paste or upload job data first.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      let parsedJobs = [];
      const trimmed = rawText.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        parsedJobs = parseJson(trimmed);
      } else {
        parsedJobs = parseCsv(trimmed);
      }

      if (!parsedJobs.length) throw new Error('No valid jobs found in input.');

      const resp = await jobsApi.bulkImport(parsedJobs);
      setResult(resp);
      if (resp.imported_count > 0 && typeof onImported === 'function') {
        onImported(resp);
      }
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} color="var(--byd-red)" />
            <h3>Bulk Migration &amp; Import (Trello / CSV)</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <CheckCircle2 size={24} color="#10b981" />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Import Completed!</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Successfully imported <strong>{result.imported_count}</strong> of {result.total_submitted} jobs.
                  {result.failed_count > 0 && <span style={{ color: 'var(--byd-red)', marginLeft: 8 }}>({result.failed_count} failed)</span>}
                </div>
              </div>
            </div>

            {result.results && result.results.length > 0 && (
              <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>#</th><th>VIN</th><th>Status</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td style={{ fontFamily: 'monospace' }}>{r.full_vin || '—'}</td>
                        <td>
                          {r.success
                            ? <span style={{ color: '#10b981', fontWeight: 600 }}>Success</span>
                            : <span style={{ color: 'var(--byd-red)', fontWeight: 600 }}>Failed</span>
                          }
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>{r.error || (r.job_id ? `Job ID: ${r.job_id.slice(0, 8)}...` : 'OK')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                className={`btn btn-sm ${activeTab === 'paste' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('paste')}
              >
                <FileText size={14} /> Paste CSV / JSON
              </button>
              <label className={`btn btn-sm ${activeTab === 'file' ? 'btn-primary' : 'btn-ghost'}`} style={{ cursor: 'pointer' }}>
                <Upload size={14} /> Upload File (.csv, .json)
                <input type="file" accept=".csv,.json,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRawText(sampleCsv)}
                style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
              >
                Load Sample CSV
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <textarea
                className="form-textarea"
                style={{ minHeight: 220, fontFamily: 'monospace', fontSize: '0.78rem' }}
                placeholder={`Paste your Trello board export JSON or CSV here...\n\nExample CSV:\n${sampleCsv}`}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Accepts comma-separated values (Model, VIN, Due Date, Priority, Tasks, Notes) or Trello JSON export cards.
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleImport}
                disabled={loading || !rawText.trim()}
              >
                {loading ? 'Processing Import...' : 'Import Jobs'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
