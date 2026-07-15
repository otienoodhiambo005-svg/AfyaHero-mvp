'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

// Types
type FieldType = 'text' | 'textarea' | 'number' | 'select';
interface Field {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
}
interface Form {
  id: string;
  name: string;
  fields: Field[];
}

export default function FormBuilder({ specialty = 'General' }: { specialty?: string }) {
  const [forms, setForms] = useState<Form[]>([]);
  const [editing, setEditing] = useState<Form | null>(null);
  const [loading, setLoading] = useState(false);

  // Expose a global async getter for other modules (EMR, admin)
  useEffect(() => {
    (window as any).getSpecialtyForms = async (spec?: string) => {
      const specKey = spec || specialty;
      try {
        const { data, error } = await supabase
          .from('specialty_forms')
          .select('*')
          .eq('specialty', specKey)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((r: any) => ({ id: r.id, name: r.name, fields: r.fields || [] }));
      } catch (err) {
        logger.error('getSpecialtyForms error', { error: err, specialty: specKey });
        return [];
      }
    };
  }, [specialty]);

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specialty_forms')
        .select('*')
        .eq('specialty', specialty)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setForms((data || []).map((r: any) => ({ id: r.id, name: r.name, fields: r.fields || [] })));
    } catch (err) {
      logger.error('loadForms error', { error: err, specialty });
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, [specialty]);

  // Load forms for specialty from Supabase
  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const startNew = () => setEditing({ id: Date.now().toString(), name: '', fields: [] });

  const saveForm = async () => {
    if (!editing) return;
    const trimmed = editing.name.trim();
    if (!trimmed) {
      // minimal client validation; callers can improve UX later
      alert('Form name is required');
      return;
    }

    try {
      await supabase.from('specialty_forms').upsert({ id: editing.id, specialty, name: trimmed, fields: editing.fields });
      await loadForms();
      setEditing(null);
    } catch (err) {
      logger.error('saveForm error', { error: err, formId: editing.id, specialty });
      alert('Failed to save form');
    }
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Delete this form?')) return;
    try {
      await supabase.from('specialty_forms').delete().eq('id', id).eq('specialty', specialty);
      await loadForms();
    } catch (err) {
      logger.error('deleteForm error', { error: err, formId: id, specialty });
      alert('Failed to delete form');
    }
  };

  const _addField = () => {
    if (!editing) return;
    setEditing({ ...editing, fields: [...editing.fields, { id: Date.now().toString(), label: '', type: 'text' }] });
  };

  const updateField = (fid: string, field: Partial<Field>) => {
    if (!editing) return;
    setEditing({ ...editing, fields: editing.fields.map(f => f.id === fid ? { ...f, ...field } : f) });
  };

  const removeField = (fid: string) => {
    if (!editing) return;
    setEditing({ ...editing, fields: editing.fields.filter(f => f.id !== fid) });
  };

  const addOption = (fid: string) => {
    if (!editing) return;
    setEditing({ ...editing, fields: editing.fields.map(f => f.id === fid ? { ...f, options: [...(f.options || []), ''] } : f) });
  };

  const updateOption = (fid: string, idx: number, value: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: editing.fields.map(f => {
        if (f.id === fid) {
          const opts = f.options ? [...f.options] : [];
          opts[idx] = value;
          return { ...f, options: opts };
        }
        return f;
      })
    });
  };

  const removeOption = (fid: string, idx: number) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: editing.fields.map(f => {
        if (f.id === fid && f.options) {
          const opts = [...f.options];
          opts.splice(idx, 1);
          return { ...f, options: opts };
        }
        return f;
      })
    });
  };

  return (
    <div className="bg-content-bg dark:bg-charcoal rounded-3xl border border-fog dark:border-charcoal shadow-card overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-fog dark:border-charcoal flex items-center justify-between bg-paper dark:bg-charcoal">
        <h3 className="text-lg font-bold text-forest dark:text-white font-outfit">{specialty} Form Builder</h3>
        <button aria-label="Create new form" onClick={startNew} className="inline-flex items-center gap-2 bg-emerald text-white hover:bg-emerald/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 rounded-md px-3 py-2 min-h-[48px]">
          <Plus className="w-4 h-4" /> {/* i18n key: form.action.new */}New Form
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="p-8 text-sm text-slate">Loading…</div>
        ) : editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Form Name</label>
              <input
                aria-label="Form name"
                type="text"
                className="w-full border border-fog dark:border-charcoal rounded-md py-2 px-3 text-sm bg-content-bg dark:bg-charcoal text-forest dark:text-white"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              {editing.fields.map((f) => (
                <div key={f.id} className="border border-fog dark:border-charcoal rounded-md p-3 space-y-2 bg-content-bg dark:bg-charcoal">
                  <div className="flex justify-between items-center">
                    <select
                      aria-label="Field type"
                      className="border border-fog dark:border-charcoal rounded-lg py-1 px-2 text-xs bg-content-bg dark:bg-charcoal text-forest dark:text-white"
                      value={f.type}
                      onChange={e => updateField(f.id, { type: e.target.value as FieldType })}
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="number">Number</option>
                      <option value="select">Select</option>
                    </select>
                    <button aria-label="Remove field" onClick={() => removeField(f.id)} className="text-rose-500 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 rounded-md">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    aria-label="Field label"
                    type="text"
                    placeholder="Field label"
                    className="w-full border border-fog dark:border-charcoal rounded-md py-2 px-3 text-sm bg-content-bg dark:bg-charcoal text-forest dark:text-white"
                    value={f.label}
                    onChange={e => updateField(f.id, { label: e.target.value })}
                  />

                  {f.type === 'select' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">Options</span>
                        <button aria-label="Add option" onClick={() => addOption(f.id)} className="text-emerald p-1 focus-visible:outline-none rounded-md">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {f.options?.map((opt, oi) => (
                        <div key={oi} className="flex gap-2 items-center">
                          <input
                            aria-label={`Option ${oi + 1}`}
                            type="text"
                            className="flex-1 border border-fog dark:border-charcoal rounded-md py-1 px-2 text-sm bg-content-bg dark:bg-charcoal text-forest dark:text-white"
                            value={opt}
                            onChange={e => updateOption(f.id, oi, e.target.value)}
                          />
                          <button aria-label={`Remove option ${oi + 1}`} onClick={() => removeOption(f.id, oi)} className="text-rose-500 p-1">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button aria-label="Save form" onClick={saveForm} className="bg-emerald text-white px-4 py-2 rounded-md min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald">{/* i18n key: form.action.save */}Save</button>
              <button aria-label="Cancel editing" onClick={() => setEditing(null)} className="px-4 py-2 rounded-md border border-fog dark:border-charcoal">{/* i18n key: form.action.cancel */}Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {forms.length === 0 ? (
              <div className="text-center text-slate-500 py-20">
                <p>No forms created for this specialty yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {forms.map(f => (
                  <div key={f.id} className="flex justify-between items-center p-3 border border-fog dark:border-charcoal rounded-md bg-content-bg dark:bg-charcoal">
                    <span className="font-medium text-forest dark:text-white">{f.name}</span>
                    <div className="flex gap-2">
                      <button aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)} className="text-slate-500 hover:text-emerald">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button aria-label={`Delete ${f.name}`} onClick={() => deleteForm(f.id)} className="text-rose-500 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
