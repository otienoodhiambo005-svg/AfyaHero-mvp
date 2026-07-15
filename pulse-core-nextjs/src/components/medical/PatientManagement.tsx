'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Filter,
    User,
    ChevronRight,
    Plus,
    ArrowRight,
    Loader2,
    ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PatientDetailPanel, type PatientDetail } from '@/components/portal/PatientDetailPanel';

export default function PatientManagement() {
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);

    useEffect(() => {
        const loadPatients = async () => {
            const { data, count, error } = await supabase
                .from('patients')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .limit(10);

            if (!error && data) {
                setPatients(data);
                setTotalCount(count || 0);
            }
            setLoading(false);
        };

        loadPatients();
    }, []);

    const getPatientAge = (dob: string) => {
        const now = new Date();
        const birthDate = new Date(dob);
        return now.getUTCFullYear() - birthDate.getUTCFullYear();
    };

    const formatRegisteredDate = (createdAt: string) => {
        return new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi' }).format(new Date(createdAt));
    };

    const filteredPatients = useMemo(() => patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    ), [patients, searchTerm]);

    const handlePatientClick = (patient: any) => {
        // Map database patient to PatientDetail shape for the panel
        // In a real app, this would likely be a secondary fetch for full clinical details
        const detailedPatient: PatientDetail = {
            id: patient.id,
            name: patient.name,
            patient_id: `PID-${patient.id.slice(0, 5).toUpperCase()}`,
            gender: patient.gender || 'Unknown',
            age: getPatientAge(patient.dob),
            phone: patient.phone || '',
            national_id: '',
            blood_type: '',
            insurance: '',
            SHIF_no: '',
            emergency_contact: '',
            emergency_phone: '',
            allergies: [],
            medications: [],
            recent_records: [],
            conditions: [],
            vitals: { bp: '', pulse: 0, spo2: 0, temp: '', rr: 0, weight: '' },
        };
        setSelectedPatient(detailedPatient);
        setPanelOpen(true);
    };

    return (
        <div className="bg-[#0C1510] rounded-[32px] border border-emerald-500/10 shadow-2xl overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#080F0C]">
                <div>
                    <h3 className="text-lg font-bold text-white font-serif">Patient Directory</h3>
                    <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald" />
                        <p className="text-[10px] text-emerald font-bold uppercase tracking-tight">AES-256 Military Grade Encrypted</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist" />
                        <input
                            type="text"
                            placeholder="Search patients..."
                            aria-label="Search patients"
                            className="bg-[#080F0C] border border-white/10 rounded-card py-2 pl-9 pr-4 text-xs font-medium text-white placeholder:text-mist/50 outline-none focus:ring-2 focus:ring-emerald/20 transition-all w-48"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button aria-label="Open patient filters" className="p-2 border border-forest/30 rounded-card hover:bg-forest/30 text-mist transition-colors">
                        <Filter className="w-4 h-4" />
                    </button>
                    <button aria-label="Add new patient" className="bg-emerald text-white p-2 rounded-card hover:bg-emerald/90 transition-colors shadow-lg shadow-emerald/20">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 text-mist">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p className="text-sm font-medium">Synchronizing records...</p>
                    </div>
                ) : filteredPatients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                        <div className="w-16 h-16 bg-forest/30 rounded-card flex items-center justify-center mb-4">
                            <User className="w-8 h-8 text-mist" />
                        </div>
                        <h4 className="text-base font-bold text-white">No Patient Records</h4>
                        <p className="text-xs text-sage max-w-[200px] mt-1">Start by adding your first patient to the AfyaHero directory.</p>
                    </div>
                ) : (
                    <table className="w-full text-left font-sans border-collapse">
                        <thead>
                            <tr className="bg-[#080F0C]">
                                <th scope="col" className="px-6 py-4 text-[10px] font-bold text-sage uppercase tracking-widest border-b border-white/5">Patient</th>
                                <th scope="col" className="px-6 py-4 text-[10px] font-bold text-sage uppercase tracking-widest border-b border-white/5">Info</th>
                                <th scope="col" className="px-6 py-4 text-[10px] font-bold text-sage uppercase tracking-widest border-b border-white/5">Status</th>
                                <th scope="col" className="px-6 py-4 text-[10px] font-bold text-sage uppercase tracking-widest border-b border-white/5"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredPatients.map((patient) => (
                                <tr 
                                    key={patient.id} 
                                    className="hover:bg-emerald/5 transition-all group cursor-pointer"
                                    onClick={() => handlePatientClick(patient)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-card bg-forest/30 flex items-center justify-center text-mist group-hover:bg-emerald group-hover:text-white transition-all">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{patient.name}</div>
                                                <div className="text-[10px] font-bold text-mist tracking-tighter uppercase">{patient.id.slice(0, 8)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-sage font-medium">{patient.gender} • {getPatientAge(patient.dob)}y</div>
                                        <div className="text-[10px] text-mist font-bold uppercase">Registered: {formatRegisteredDate(patient.created_at)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            'px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                                            patient.status === 'Stable' ? 'bg-[#D5EDF8] text-[#3282B8] border border-[#BBF7D0]' :
                                                patient.status === 'Critical' ? 'bg-[#FEE2E2] text-[#EF4444] border border-[#FECACA] animate-pulse' :
                                                    'bg-[#FEF3C7] text-[#F59E0B] border border-[#FDE68A]'
                                        )}>
                                            {patient.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            aria-label={`View details for ${patient.name}`} 
                                            className="p-2 hover:bg-forest/30 rounded-lg transition-colors border border-transparent hover:border-forest/20 text-mist hover:text-emerald shadow-card"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="p-4 border-t border-white/5 bg-[#080F0C] flex justify-between items-center">
                <span className="text-xs text-sage font-medium">Showing {filteredPatients.length} of {totalCount} patients</span>
                <button className="text-xs font-bold text-emerald hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors">
                    View All <ArrowRight className="w-3 h-3" />
                </button>
            </div>
            <PatientDetailPanel 
                patient={selectedPatient}
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
            />
        </div>
    );
}
