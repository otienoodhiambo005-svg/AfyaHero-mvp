'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Loader2, QrCode, UserPlus, X } from 'lucide-react';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteStaffModal({ isOpen, onClose }: InviteStaffModalProps) {
  const [role, setRole] = useState('medical');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<{ url: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, department }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setInviteData({ url: data.inviteUrl, token: data.token });
      } else {
        alert(data.error ?? 'Failed to generate invitation');
      }
    } catch (err) {
      alert('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (inviteData) {
      void navigator.clipboard.writeText(inviteData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-content-bg rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 border border-content-border">
        <div className="px-8 py-6 border-b border-content-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-card bg-blue-50 flex items-center justify-center text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Invite Staff</h2>
              <p className="text-xs text-slate-500">Generate a unique onboarding link</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!inviteData ? (
            <>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Staff Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['medical', 'nursing', 'reception', 'lab', 'pharmacy', 'admin'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r === 'nursing' ? 'medical' : r)} // Map nursing to medical for backend
                      className={`px-4 py-2 text-xs font-semibold rounded-card border transition-all ${
                        (r === 'nursing' ? 'medical' : r) === role 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' 
                          : 'bg-content-bg border-content-border text-slate-600 hover:border-blue-400'
                      }`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Department (Optional)
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Critical Care, Radiology"
                  className="w-full bg-content-surface border border-content-border rounded-card px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-content-bg transition-all ring-0"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-slate-900 text-white py-3.5 rounded-card text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Secure Invite'}
              </button>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-emerald-50 border border-emerald-100 rounded-card p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-900">Success!</p>
                  <p className="text-[11px] text-emerald-700">Invitation token generated correctly.</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-4 bg-content-surface rounded-3xl border border-content-border/50">
                <div className="p-4 bg-content-bg rounded-card shadow-card mb-4">
                  <QRCodeSVG value={inviteData.url} size={160} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Unique QR Code
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">
                  Onboarding Link
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteData.url}
                    className="flex-1 bg-content-bg border border-content-border rounded-card px-4 py-3 text-[11px] text-slate-600 font-mono outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="aspect-square bg-blue-600 text-white p-3 rounded-card hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setInviteData(null);
                  setDepartment('');
                }}
                className="w-full text-slate-400 hover:text-slate-600 text-xs font-semibold pt-2"
              >
                Create another invitation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
