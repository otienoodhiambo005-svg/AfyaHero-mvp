'use client';

import { useState, useCallback, useEffect } from 'react';
import { BrainCircuit, CheckCircle, AlertTriangle, ChevronDown, File, X, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragAndDropUploader } from '@/components/shared/DragAndDropUploader';
import LabResultsInterpretation from '@/components/lab/LabResultsInterpretation';

type ResultTab = 'Enter Results' | 'Pending Verification' | 'Verified Today';

interface CBCField {
  name: string;
  param: string;
  unit: string;
  ref: string;
  value: string;
  flag: '' | 'H' | 'L' | 'HH' | 'LL';
}

interface PendingVerification {
  /** Lab request UUID for PATCH /api/lab/orders verify */
  id: string;
  labId: string;
  patient: string;
  test: string;
  keyResults: string;
  flag: 'Normal' | 'Abnormal' | 'Critical';
  tech: string;
  time: string;
}

interface DeltaCheck {
  labId: string;
  patient: string;
  param: string;
  previous: string;
  current: string;
  change: string;
  alert: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPersistedLabRequest(id: string): boolean {
  return UUID_RE.test(id);
}

const deltaChecks: DeltaCheck[] = [
  { labId: 'LAB-2848', patient: 'Fatuma Wanjiru', param: 'Haemoglobin', previous: '9.8 g/dL (5 Jan)', current: '5.2 g/dL', change: '-47%', alert: 'Significant decrease — acute blood loss or haemolysis?' },
  { labId: 'LAB-2841', patient: 'Hassan Ali', param: 'Potassium (K⁺)', previous: '4.2 mEq/L (10 Jan)', current: '6.8 mEq/L', change: '+62%', alert: 'Rapid rise — renal failure, cell lysis, or sampling issue?' },
];

const flagColors: Record<PendingVerification['flag'], string> = {
  Critical: 'bg-danger/5 text-danger border border-danger/20',
  Abnormal: 'bg-warning/5 text-warning border border-warning/20',
  Normal:   'bg-success/5 text-success border border-success/20',
};

const getFieldFlag = (value: string, param: string): CBCField['flag'] => {
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  if (param === 'wbc' && num > 11) return 'H';
  if (param === 'hb' && num < 6) return 'LL';
  if (param === 'hb' && num < 12) return 'L';
  if (param === 'plt' && num < 150) return 'L';
  if (param === 'mcv' && (num < 80 || num > 100)) return num < 80 ? 'L' : 'H';
  return '';
};

const TAB_LIST: ResultTab[] = ['Enter Results', 'Pending Verification', 'Verified Today'];

export default function LabResultsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ResultTab>('Enter Results');
  const [pendingRows, setPendingRows] = useState<PendingVerification[]>([]);
  const [verifiedTodayCount, setVerifiedTodayCount] = useState(0);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [cbcValues, setCbcValues] = useState<Record<string, string>>({
    hb: '5.2', wbc: '14.2', plt: '210', mcv: '72', mch: '23', mchc: '30',
  });
  const [aiFlag, setAiFlag] = useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const loadResultsQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await fetch('/api/lab/results', { credentials: 'include' });
      const data = (await res.json()) as {
        pending?: PendingVerification[];
        verifiedTodayCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setQueueError(data.error ?? 'Unable to load verification queue.');
        setPendingRows([]);
        setVerifiedTodayCount(0);
        return;
      }
      setPendingRows(Array.isArray(data.pending) ? data.pending : []);
      setVerifiedTodayCount(typeof data.verifiedTodayCount === 'number' ? data.verifiedTodayCount : 0);
    } catch {
      setQueueError('Network error while loading lab results.');
      setPendingRows([]);
      setVerifiedTodayCount(0);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResultsQueue();
  }, [loadResultsQueue]);

  const patchVerify = useCallback(async (requestId: string): Promise<void> => {
    const res = await fetch('/api/lab/orders', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action: 'verify' }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? 'Verification failed');
    }
  }, []);

  const handleVerifyOne = useCallback(
    async (row: PendingVerification) => {
      if (!isPersistedLabRequest(row.id)) {
        setMutationError('This row is not linked to a saved lab request.');
        return;
      }
      setMutationBusy(true);
      setMutationError(null);
      try {
        await patchVerify(row.id);
        await loadResultsQueue();
      } catch (e) {
        setMutationError(e instanceof Error ? e.message : 'Could not verify results.');
      } finally {
        setMutationBusy(false);
      }
    },
    [loadResultsQueue, patchVerify],
  );

  const handleVerifyAll = useCallback(async () => {
    const targets = pendingRows.filter((r) => isPersistedLabRequest(r.id));
    if (targets.length === 0) return;
    setMutationBusy(true);
    setMutationError(null);
    try {
      for (const row of targets) {
        await patchVerify(row.id);
      }
      await loadResultsQueue();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : 'Could not verify all results.');
      await loadResultsQueue();
    } finally {
      setMutationBusy(false);
    }
  }, [loadResultsQueue, patchVerify, pendingRows]);

  const handleFilesSelected = useCallback((files: File[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => 
      f.type.startsWith('image/') || 
      f.type === 'application/pdf' ||
      f.name.endsWith('.csv') ||
      f.name.endsWith('.txt') ||
      f.name.endsWith('.xls') ||
      f.name.endsWith('.xlsx')
    );
    if (validFiles.length > 0) {
      handleFilesSelected(validFiles);
    }
  }, [handleFilesSelected]);

  const handleCbcChange = (param: string, val: string): void => {
    setCbcValues((prev) => ({ ...prev, [param]: val }));
    setAiFlag(param === 'wbc' && parseFloat(val) > 11);
  };

  const cbcFields: Array<{ label: string; param: string; unit: string; ref: string }> = [
    { label: 'Haemoglobin', param: 'hb',   unit: 'g/dL',       ref: '12.0–16.0' },
    { label: 'WBC',         param: 'wbc',  unit: '× 10³/µL',   ref: '4.0–11.0' },
    { label: 'Platelets',   param: 'plt',  unit: '× 10³/µL',   ref: '150–400' },
    { label: 'MCV',         param: 'mcv',  unit: 'fL',         ref: '80–100' },
    { label: 'MCH',         param: 'mch',  unit: 'pg',         ref: '27–32' },
    { label: 'MCHC',        param: 'mchc', unit: 'g/dL',       ref: '32–36' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Results Entry</h1>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/5 border border-warning/20 text-warning text-sm font-medium w-fit">
          <AlertTriangle className="w-4 h-4" aria-hidden />
          {queueLoading ? (
            <>
              Pending Verification
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-label="Loading count" />
            </>
          ) : (
            <>Pending Verification ({pendingRows.length})</>
          )}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-content-border overflow-x-auto">
        {TAB_LIST.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={cn(
              'px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-500 hover:text-ink'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Enter Results */}
      {activeTab === 'Enter Results' && (
        <div className="space-y-5">
          {/* Sample Select */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Select Sample</label>
            <div className="relative w-full max-w-sm">
              <select className="w-full pl-3 pr-8 py-2.5 rounded-lg bg-content-bg border border-content-border text-ink text-sm appearance-none focus:outline-none focus:border-violet-500/50">
                <option>LAB-2841 — CBC — Hassan Ali</option>
                <option>LAB-2848 — CBC — Fatuma Wanjiru</option>
                <option>LAB-2857 — Troponin I — Hassan Ali</option>
                <option>LAB-2856 — β-hCG — Jane Mwangi</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* File Upload Zone with Drag & Drop for Lab Results */}
          <div 
            className={cn('mb-5 transition-all duration-200', isDragging && 'motion-safe:scale-[1.01]')}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <DragAndDropUploader
              onFilesSelected={handleFilesSelected}
              accept="image/*,.pdf,.csv,.txt,.xls,.xlsx"
              multiple={true}
              maxSizeMB={25}
              className="rounded-card"
            />
            
            {/* Uploaded Files Preview */}
            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
                  Attached Result Files ({uploadedFiles.length})
                </p>
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 bg-content-bg border border-content-border rounded-card px-3 py-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      {file.type.startsWith('image/') ? (
                        <FileText className="w-4 h-4 text-violet-600" />
                      ) : (
                        <File className="w-4 h-4 text-violet-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink font-medium truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-1 text-slate-400 hover:text-danger transition-colors"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CBC Results Form */}
          <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-content-border bg-content-surface/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">CBC Results — Hassan Ali (LAB-2841)</h2>
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle className="w-4 h-4" /> QC passed — within 2SD
              </div>
            </div>
            <div className="p-5 space-y-3">
              {cbcFields.map((field) => {
                const flag = getFieldFlag(cbcValues[field.param], field.param);
                const isCritical = flag === 'HH' || flag === 'LL';
                return (
                  <div key={field.param} className="grid grid-cols-4 gap-3 items-center">
                    <label className="text-sm text-slate-500 col-span-1">{field.label}</label>
                    <div className="relative col-span-1">
                      <input
                        type="number"
                        step="0.1"
                        value={cbcValues[field.param]}
                        onChange={(e) => handleCbcChange(field.param, e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg bg-content-bg border text-ink text-sm focus:outline-none',
                          isCritical ? 'border-danger/50 focus:border-danger' :
                          flag ? 'border-warning/50 focus:border-warning' :
                          'border-content-border focus:border-violet-500/50'
                        )}
                      />
                    </div>
                    <span className="text-xs text-slate-500 col-span-1">{field.unit} | Ref: {field.ref}</span>
                    <span className={cn('text-xs font-bold col-span-1', {
                      'text-danger': isCritical,
                      'text-warning': flag && !isCritical,
                      'text-success': !flag,
                    })}>
                      {flag || '✓'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Flag */}
            {aiFlag && (
              <div className="mx-5 mb-5 rounded-lg border border-violet-200 bg-violet-50 p-3 flex items-start gap-2">
                <BrainCircuit className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">
                  <span className="text-violet-600 font-medium">AI Auto-Flag:</span>{' '}
                  WBC <span className="text-ink font-medium">{cbcValues.wbc}</span> × 10³/µL flagged as HIGH — consider infection/inflammation. Correlate with clinical findings.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="px-5 pb-5 flex gap-3">
              <button className="px-4 py-2 rounded-lg border border-content-border text-slate-600 text-sm hover:bg-content-surface transition-colors">
                Save Draft
              </button>
              <button className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                Submit for Verification
              </button>
            </div>
          </div>

          {/* AI Lab Results Interpretation */}
          <LabResultsInterpretation
            labResults={cbcValues}
            testName="Complete Blood Count (CBC)"
            patientAge={35}
            patientGender="male"
            patientContext="Routine checkup, no significant symptoms"
          />
        </div>
      )}

      {/* Pending Verification */}
      {activeTab === 'Pending Verification' && (
        <div className="space-y-4">
          {mutationError && (
            <div
              className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex items-start justify-between gap-3"
              role="alert"
            >
              <span>{mutationError}</span>
              <button
                type="button"
                onClick={() => setMutationError(null)}
                className="text-xs font-medium text-danger underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {!queueLoading && queueError && (
            <div
              className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span>{queueError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadResultsQueue()}
                className="rounded-lg border border-content-border bg-content-bg px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-content-surface shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {queueLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-content-border bg-content-bg px-4 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
              <span>Loading verification queue…</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {queueLoading ? '—' : `${pendingRows.length} awaiting sign-off`}
            </p>
            <button
              type="button"
              onClick={() => void handleVerifyAll()}
              disabled={mutationBusy || queueLoading || pendingRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutationBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              )}
              Verify All
            </button>
          </div>
          <div className="rounded-card bg-content-bg border border-content-border overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-content-border bg-content-surface/80">
                    {['Lab ID', 'Patient', 'Test', 'Key Results', 'Flag', 'Tech', 'Time', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!queueLoading && pendingRows.length === 0 && !queueError && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                        No results awaiting verification for this hospital.
                      </td>
                    </tr>
                  )}
                  {pendingRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-content-border/50 transition-colors hover:bg-content-surface"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-violet-600">{r.labId}</td>
                      <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">{r.patient}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.test}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{r.keyResults}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', flagColors[r.flag])}>{r.flag}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.tech}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{r.time}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void handleVerifyOne(r)}
                          disabled={mutationBusy || !isPersistedLabRequest(r.id)}
                          className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {mutationBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                          )}
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delta Check Alerts */}
          <div className="rounded-card bg-content-bg border border-content-border p-5 shadow-card">
            <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Delta Check Alerts ({deltaChecks.length})
            </h3>
            <div className="space-y-3">
              {deltaChecks.map((d, i) => (
                <div key={i} className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-violet-600">{d.labId}</span>
                    <span className="text-sm font-medium text-ink">{d.patient}</span>
                    <span className="text-xs text-slate-500">— {d.param}</span>
                    <span className="ml-auto text-xs font-bold text-danger">{d.change}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                    <span>Previous: <span className="text-ink">{d.previous}</span></span>
                    <span>Current: <span className="text-warning font-bold">{d.current}</span></span>
                  </div>
                  <p className="text-xs text-warning">{d.alert}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Verified Today */}
      {activeTab === 'Verified Today' && (
        <div className="rounded-card bg-content-bg border border-content-border p-5 text-center shadow-card">
          {!queueLoading && queueError && (
            <div className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger flex flex-col gap-2" role="alert">
              <span>{queueError}</span>
              <button
                type="button"
                onClick={() => void loadResultsQueue()}
                className="rounded-lg border border-content-border bg-content-bg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-content-surface self-center"
              >
                Retry
              </button>
            </div>
          )}
          {queueLoading ? (
            <Loader2 className="w-8 h-8 text-violet-600 mx-auto mb-3 animate-spin" aria-label="Loading" />
          ) : (
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-3" aria-hidden />
          )}
          <p className="text-sm font-medium text-ink">
            {queueLoading ? 'Loading…' : `${verifiedTodayCount} results verified today`}
          </p>
          <p className="text-xs text-slate-500 mt-1">All results dispatched to clinicians</p>
        </div>
      )}
    </div>
  );
}
