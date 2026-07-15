export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface ClinicalTask {
  id: string;
  patientName: string;
  patientId: string;
  ward: string;
  bed: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueTime: string;
  category: 'medication' | 'lab' | 'dressing' | 'observation';
}

export interface VitalTrend {
  time: string;
  value: number;
}

export interface PatientVitals {
  id: string;
  patientName: string;
  bed: string;
  lastUpdated: string;
  status: 'stable' | 'warning' | 'critical';
  metrics: {
    bp: { sys: number; dia: number; trend: VitalTrend[] };
    hr: { value: number; trend: VitalTrend[] };
    temp: { value: number; trend: VitalTrend[] };
    spo2: { value: number; trend: VitalTrend[] };
  };
}
