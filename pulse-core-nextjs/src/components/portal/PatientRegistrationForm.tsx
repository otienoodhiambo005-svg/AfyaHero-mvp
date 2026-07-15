'use client';

import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    X, 
    User, 
    Calendar, 
    Phone, 
    Mail, 
    Contact, 
    ShieldCheck, 
    HeartPulse, 
    Loader2,
    Save,
    MapPin,
    AlertCircle,
    WifiOff,
    Wifi,
    Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import logger from '@/lib/logger';
import { GenderSchema } from '@/lib/schemas';
import { Modal, ModalContent, ModalOverlay, ModalPortal, ModalTitle, ModalDescription, ModalClose } from '@/components/ui/modal';
import AITriageAssistant from '@/components/reception/AITriageAssistant';

// Enhanced Patient Registration Schema
const registrationSchema = z.object({
    name: z.string().min(2, 'Full name is required').max(120),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    gender: GenderSchema,
    phone: z.string().min(10, 'Valid phone number is required').max(15),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    national_id: z.string().min(5, 'National ID or Passport is required').max(20),
    shif_number: z.string().min(5, 'SHIF/NHIF number is required').max(30),
    emergency_contact_name: z.string().min(2, 'Emergency contact name is required').max(120),
    emergency_contact_phone: z.string().min(10, 'Valid emergency contact phone is required').max(15),
    chief_complaint: z.string().min(5, 'Initial complaint is required').max(1000),
    county: z.string().min(2, 'Area of residence is required').max(200),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface PatientRegistrationFormProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: (patient: any) => void;
}

export default function PatientRegistrationForm({ open, onClose, onSuccess }: PatientRegistrationFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const idempotencyKeyRef = useRef<string | null>(null);
    const [formValues, setFormValues] = useState<Partial<RegistrationFormData>>({});
    const [isOnline, setIsOnline] = useState(true);
    const [queuedRegistrations, setQueuedRegistrations] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Network status detection
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Check initial status
        setIsOnline(navigator.onLine);
        
        // Load queued registrations count
        const loadQueueCount = () => {
            try {
                const queue = JSON.parse(localStorage.getItem('patient_registration_queue') || '[]');
                setQueuedRegistrations(queue.length);
            } catch {
                setQueuedRegistrations(0);
            }
        };
        loadQueueCount();
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Sync queued registrations when connection is restored
    useEffect(() => {
        if (isOnline && queuedRegistrations > 0 && !isSyncing) {
            syncQueuedRegistrations();
        }
    }, [isOnline, queuedRegistrations, isSyncing]);

    const syncQueuedRegistrations = async () => {
        setIsSyncing(true);
        try {
            const queue = JSON.parse(localStorage.getItem('patient_registration_queue') || '[]');
            const syncedQueue: any[] = [];
            
            for (const item of queue) {
                try {
                    const res = await fetch('/api/patients/register', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-idempotency-key': item.idempotencyKey,
                        },
                        body: JSON.stringify(item.data),
                    });
                    
                    if (res.ok) {
                        // Successfully synced, don't add back to queue
                        continue;
                    }
                    // Failed to sync, keep in queue
                    syncedQueue.push(item);
                } catch {
                    // Network error, keep in queue
                    syncedQueue.push(item);
                }
            }
            
            localStorage.setItem('patient_registration_queue', JSON.stringify(syncedQueue));
            setQueuedRegistrations(syncedQueue.length);
        } catch {
            // Error syncing, keep queue as is
        } finally {
            setIsSyncing(false);
        }
    };

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        watch
    } = useForm<RegistrationFormData>({
        resolver: zodResolver(registrationSchema),
        defaultValues: {
            gender: 'M',
        }
    });

    // Watch form values for AI triage
    const watchedValues = watch();
    
    // Calculate patient age from DOB
    const patientAge = watchedValues.dob ? 
        Math.floor((new Date().getTime() - new Date(watchedValues.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 
        undefined;

    const onSubmit = async (data: RegistrationFormData) => {
        setIsSubmitting(true);
        setError(null);
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = crypto.randomUUID();
        }

        // If offline, queue the registration
        if (!isOnline) {
            try {
                const queue = JSON.parse(localStorage.getItem('patient_registration_queue') || '[]');
                queue.push({
                    data,
                    idempotencyKey: idempotencyKeyRef.current,
                    timestamp: new Date().toISOString(),
                });
                localStorage.setItem('patient_registration_queue', JSON.stringify(queue));
                setQueuedRegistrations(queue.length);
                
                reset();
                setError(null);
                setIsSubmitting(false);
                onClose();
                
                // Show success message for offline queue
                alert('Patient registration queued for sync when connection is restored.');
                return;
            } catch (queueError) {
                setError('Failed to queue registration. Please try again.');
                setIsSubmitting(false);
                return;
            }
        }

        // Online: submit directly
        try {
            const res = await fetch('/api/patients/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-idempotency-key': idempotencyKeyRef.current,
                },
                body: JSON.stringify(data),
            });
            const payload = await res.json();
            if (!res.ok) {
                throw new Error(payload?.error ?? 'Failed to register patient. Please try again.');
            }
            const patient = payload.patient;

            reset();
            onSuccess?.(patient);
            onClose();
            idempotencyKeyRef.current = null;
        } catch (err: any) {
            // If network error during online submission, queue it
            if (err.message?.includes('fetch') || err.message?.includes('network')) {
                try {
                    const queue = JSON.parse(localStorage.getItem('patient_registration_queue') || '[]');
                    queue.push({
                        data,
                        idempotencyKey: idempotencyKeyRef.current,
                        timestamp: new Date().toISOString(),
                    });
                    localStorage.setItem('patient_registration_queue', JSON.stringify(queue));
                    setQueuedRegistrations(queue.length);
                    
                    setError('Network error. Registration queued for sync when connection is restored.');
                } catch {
                    setError('Failed to queue registration. Please try again.');
                }
            } else {
                setError(err.message || 'Failed to register patient. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <ModalPortal>
                <ModalOverlay
                    className="bg-[#080F0C]/80 backdrop-blur-md"
                    closeOnClick
                />

                <ModalContent
                    className="fixed inset-y-0 right-0 w-full max-w-2xl bg-slate-950 border-l border-white/10 z-[101] overflow-hidden flex flex-col shadow-2xl"
                    closeOnEscape
                    initialFocusSelector="input, select, textarea, button"
                >
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-content-bg/[0.02]">
                            <div className="flex-1">
                                <ModalTitle className="text-3xl font-serif italic text-white flex items-center gap-3">
                                    <HeartPulse className="w-8 h-8 text-emerald-500" />
                                    Patient Admission
                                </ModalTitle>
                                <ModalDescription className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    Secure Clinical Registry
                                </ModalDescription>
                            </div>
                            
                            {/* Network Status Indicator */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    {isOnline ? (
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                            <Wifi className="w-4 h-4 text-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-500 uppercase">Online</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                            <WifiOff className="w-4 h-4 text-amber-500" />
                                            <span className="text-xs font-bold text-amber-500 uppercase">Offline</span>
                                        </div>
                                    )}
                                    {queuedRegistrations > 0 && (
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full border",
                                            isSyncing ? "bg-[#3282B8]/10 border-[#3282B8]/20 animate-pulse" : "bg-amber-500/10 border-amber-500/20"
                                        )}>
                                            <Clock className={cn("w-4 h-4", isSyncing ? "text-[#3282B8]" : "text-amber-500")} />
                                            <span className={cn("text-xs font-bold uppercase", isSyncing ? "text-[#3282B8]" : "text-amber-500")}>
                                                {isSyncing ? 'Syncing...' : `${queuedRegistrations} Queued`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <ModalClose
                                    aria-label="Close patient registration form"
                                    className="p-3 hover:bg-content-bg/5 rounded-card transition-all border border-transparent hover:border-white/10 text-slate-400 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </ModalClose>
                            </div>
                        </div>

                        {/* Form Body */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <form id="registration-form" onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                                
                                {error && (
                                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-card flex items-center gap-3 text-rose-500 text-sm font-bold animate-shake">
                                        <AlertCircle className="w-5 h-5" />
                                        {error}
                                    </div>
                                ) }

                                {/* Section: Basic Information */}
                                <div className="space-y-6">
                                    <FormSectionTitle title="Personal Identity" index="01" />
                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField 
                                            label="Full Legal Name" 
                                            icon={User} 
                                            error={errors.name?.message}
                                        >
                                            <input 
                                                {...register('name')}
                                                placeholder="e.g. Alila Mwangi"
                                                className="form-input"
                                            />
                                        </FormField>

                                        <FormField 
                                            label="Date of Birth" 
                                            icon={Calendar} 
                                            error={errors.dob?.message}
                                        >
                                            <input 
                                                {...register('dob')}
                                                type="date"
                                                className="form-input"
                                            />
                                        </FormField>

                                        <FormField label="Gender" icon={User} error={errors.gender?.message}>
                                            <select {...register('gender')} className="form-input">
                                                <option value="M">Male</option>
                                                <option value="F">Female</option>
                                            </select>
                                        </FormField>

                                        <FormField label="National ID / Passport" icon={Contact} error={errors.national_id?.message}>
                                            <input 
                                                {...register('national_id')}
                                                placeholder="Document Number"
                                                className="form-input"
                                            />
                                        </FormField>
                                    </div>
                                </div>

                                {/* Section: Contact & Residence */}
                                <div className="space-y-6">
                                    <FormSectionTitle title="Connectivity & Origin" index="02" />
                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField label="Phone Number" icon={Phone} error={errors.phone?.message}>
                                            <input 
                                                {...register('phone')}
                                                placeholder="+254 --- --- ---"
                                                className="form-input"
                                            />
                                        </FormField>

                                        <FormField label="Email Address" icon={Mail} error={errors.email?.message}>
                                            <input 
                                                {...register('email')}
                                                type="email"
                                                placeholder="patient@provider.com"
                                                className="form-input"
                                            />
                                        </FormField>

                                        <div className="col-span-2">
                                            <FormField label="Residential County/Area" icon={MapPin} error={errors.county?.message}>
                                                <input 
                                                    {...register('county')}
                                                    placeholder="e.g. Nairobi, Kiambu"
                                                    className="form-input"
                                                />
                                            </FormField>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Healthcare Coverage */}
                                <div className="space-y-6">
                                    <FormSectionTitle title="Healthcare Coverage" index="03" />
                                    <FormField label="SHIF / NHIF Identification" icon={ShieldCheck} error={errors.shif_number?.message}>
                                        <input 
                                            {...register('shif_number')}
                                            placeholder="Enter SHIF/NHIF Number"
                                            className="form-input"
                                        />
                                    </FormField>
                                </div>

                                {/* Section: Emergency & Clinical */}
                                <div className="space-y-6">
                                    <FormSectionTitle title="Emergency & Intake" index="04" />
                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField label="Emergency Contact (Next of Kin)" icon={User} error={errors.emergency_contact_name?.message}>
                                            <input 
                                                {...register('emergency_contact_name')}
                                                placeholder="Contact Name"
                                                className="form-input"
                                            />
                                        </FormField>

                                        <FormField label="Kin Phone Number" icon={Phone} error={errors.emergency_contact_phone?.message}>
                                            <input 
                                                {...register('emergency_contact_phone')}
                                                placeholder="+254 --- --- ---"
                                                className="form-input"
                                            />
                                        </FormField>

                                        <div className="col-span-2">
                                            <FormField label="Chief Complaint" icon={AlertCircle} error={errors.chief_complaint?.message}>
                                                <textarea 
                                                    {...register('chief_complaint')}
                                                    placeholder="Initial reason for visit..."
                                                    rows={4}
                                                    className="form-input resize-none py-4"
                                                />
                                            </FormField>
                                            
                                            {/* AI Triage Assistant - Desktop/Tablet Optimized */}
                                            {watchedValues.chief_complaint && watchedValues.chief_complaint.length >= 10 && (
                                                <div className="mt-4">
                                                    <AITriageAssistant
                                                        chiefComplaint={watchedValues.chief_complaint}
                                                        patientAge={patientAge}
                                                        patientGender={watchedValues.gender}
                                                        onSuggestion={(suggestion) => {
                                                            // Could auto-fill priority or show suggestion
                                                            logger.info('Triage suggestion received', { suggestion });
                                                        }}
                                                        className="shadow-lg"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-8 border-t border-white/5 bg-content-bg/[0.02] flex items-center justify-between">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="px-8 py-4 text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
                            >
                                Discard Draft
                            </button>
                            <button 
                                type="submit"
                                form="registration-form"
                                disabled={isSubmitting}
                                className={cn(
                                    "px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-ink rounded-full flex items-center gap-3 shadow-xl shadow-emerald-500/20 transition-all font-black uppercase tracking-widest text-xs",
                                    isSubmitting && "opacity-50 cursor-not-allowed scale-95"
                                )}
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSubmitting ? 'Registering...' : 'Finalize Registration'}
                            </button>
                        </div>

                        {/* Custom Form Styles */}
                        <style jsx global>{`
                            .form-input {
                                width: 100%;
                                background: rgba(15, 38, 21, 0.25);
                                border: 1px solid rgba(255, 255, 255, 0.08);
                                border-radius: 1rem;
                                padding: 0.75rem 1rem;
                                color: white;
                                font-size: 0.875rem;
                                font-weight: 500;
                                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                                font-family: 'DM Sans', sans-serif;
                            }
                            .form-input:focus {
                                outline: none;
                                background: rgba(15, 38, 21, 0.35);
                                border-color: #10b981;
                                box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
                            }
                            .form-input::placeholder {
                                color: rgba(148, 163, 184, 0.3);
                            }
                            .custom-scrollbar::-webkit-scrollbar {
                                width: 4px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                                background: transparent;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                                background: rgba(255, 255, 255, 0.1);
                                border-radius: 10px;
                            }
                        `}</style>
                </ModalContent>
            </ModalPortal>
        </Modal>
    );
}

function FormSectionTitle({ title, index }: { title: string; index: string }) {
    return (
        <div className="flex items-center gap-4 mb-8">
            <span className="text-[10px] font-mono text-emerald-500 font-black border border-emerald-500/30 w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/5">
                {index}
            </span>
            <h3 className="text-xl font-serif italic text-white/90">{title}</h3>
            <div className="flex-1 h-[1px] bg-emerald-500/20" />
        </div>
    );
}

function FormField({ 
    label, 
    icon: Icon, 
    children, 
    error 
}: { 
    label: string; 
    icon: any; 
    children: React.ReactNode;
    error?: string;
}) {
    return (
        <div className="space-y-2 group">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 group-focus-within:text-emerald-500 transition-colors">
                    <Icon className="w-3 h-3" />
                    {label}
                </label>
            </div>
            {children}
            {error && (
                <motion.p 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-[10px] font-bold text-rose-500 uppercase tracking-tight ml-1"
                >
                    {error}
                </motion.p>
            )}
        </div>
    );
}
