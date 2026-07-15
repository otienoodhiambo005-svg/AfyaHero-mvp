export interface HospitalProfile {
    id: string;
    name: string;
    specialisation: string;
    location: string;
    license_number: string;
    email: string;
    created_at: string;
}

export interface Staff {
    id: string;
    hospital_id: string;
    name: string;
    role: 'Administrator' | 'Doctor' | 'Nurse' | 'Staff';
    department: string;
    status: 'On Duty' | 'Off Duty' | 'On Leave';
    created_at: string;
}

export interface PatientTrend {
    day: string;
    admissions: number;
}
