'use client';

import { useState } from 'react';
import { X, Bed as BedIcon, Calendar, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BedGrid, BedData } from '@/components/portal/BedGrid';
import { PatientDetail } from '@/components/portal/PatientDetailPanel';
import { toast } from '@/lib/toast';

interface BedAllocationModalProps {
    patient: PatientDetail;
    beds: BedData[];
    open: boolean;
    onClose: () => void;
    onSuccess?: (updatedBed: BedData) => void;
}

export function BedAllocationModal({ patient, beds, open, onClose, onSuccess }: BedAllocationModalProps) {
    const [selectedBed, setSelectedBed] = useState<BedData | null>(null);
    const [notes, setNotes] = useState('');
    const [expectedDischarge, setExpectedDischarge] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!open) return null;

    const handleAllocate = async () => {
        if (!selectedBed) return;
        
        setIsSubmitting(true);
        try {
            const resp = await fetch('/api/medical/beds/allocate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bedId: selectedBed.id,
                    patientId: patient.id,
                    patientName: patient.name,
                    notes,
                    expectedDischarge: expectedDischarge ? new Date(expectedDischarge).toISOString() : undefined
                })
            });

            const data = await resp.json();
            
            if (!resp.ok) {
                toast.error(data.error || 'Allocation failed');
                return;
            }

            toast.success(`${patient.name} has been allocated to ${selectedBed.wardName}, Bed ${selectedBed.bedNumber}`);
            onSuccess?.(data);
            onClose();
        } catch (error) {
            toast.error('Connection error. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-md" onClick={onClose} />
            
            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0A0F0D] border border-stone-800 rounded-card shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <BedIcon className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-stone-100 font-serif">Bed Allocation</h2>
                            <p className="text-xs text-stone-500">Assigning <span className="text-blue-400 font-medium">{patient.name}</span> to a ward bed</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-stone-500 hover:text-stone-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:grid md:grid-cols-[1fr,300px] gap-6">
                    {/* Left: Bed Grid */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Select Available Bed</h3>
                            <div className="flex gap-4 text-[10px] text-stone-500">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Available</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Occupied</span>
                            </div>
                        </div>
                        
                        <div className="bg-stone-900/20 p-4 rounded-card border border-stone-800/50">
                            <BedGrid 
                                beds={beds} 
                                onBedClick={(bed) => {
                                    if (bed.status === 'available') setSelectedBed(bed);
                                }}
                                className="max-h-[500px]"
                            />
                        </div>
                    </div>

                    {/* Right: Allocation Details */}
                    <div className="space-y-6 border-l border-stone-800 pl-6 h-full flex flex-col justify-between">
                        <div className="space-y-6">
                            {/* Selected Bed Summary */}
                            <div className="p-4 rounded-card bg-blue-500/5 border border-blue-500/20">
                                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Target Location</p>
                                {selectedBed ? (
                                    <div className="flex items-center justify-between">
                                        <div className="text-stone-100">
                                            <p className="font-bold text-lg">{selectedBed.wardName}</p>
                                            <p className="text-sm font-mono text-stone-400">Bed {selectedBed.bedNumber}</p>
                                        </div>
                                        <BedIcon className="w-8 h-8 text-blue-500/40" />
                                    </div>
                                ) : (
                                    <p className="text-sm text-stone-500 italic py-2 leading-tight">Please select an available bed from the grid</p>
                                )}
                            </div>

                            {/* Forms */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">Expected Discharge</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
                                        <input 
                                            type="date"
                                            value={expectedDischarge}
                                            onChange={(e) => setExpectedDischarge(e.target.value)}
                                            className="w-full h-10 bg-stone-900 border border-stone-800 rounded-lg pl-10 pr-4 text-sm text-stone-200 focus:outline-none focus:border-blue-500/50 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">Internal Notes</label>
                                    <textarea 
                                        placeholder="Add specific instructions for the ward staff..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full h-32 bg-stone-900 border border-stone-800 rounded-lg p-3 text-sm text-stone-200 focus:outline-none focus:border-blue-500/50 transition-colors resize-none mb-1"
                                    />
                                    <div className="flex items-start gap-1.5 text-[10px] text-stone-500">
                                        <Info className="w-3 h-3 mt-0.5" />
                                        <p>These notes will be pinned to the bed details in the Ward View.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action */}
                        <div className="pt-6">
                            <button
                                type="button"
                                className="w-full py-6 rounded-card font-bold text-sm"
                                disabled={!selectedBed || isSubmitting}
                                onClick={handleAllocate}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Allocating...
                                    </>
                                ) : 'Confirm Admission'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
