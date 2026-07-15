'use client';

export interface PatientRow {
  num: number;
  name: string;
  ageSex: string;
  time: string;
  complaint: string;
  bp: string;
  spo2: string;
  status: 'Waiting' | 'In Consult' | 'Done' | 'Admitted' | 'Referred';
}

export interface InboxItem {
  icon: React.ReactNode;
  text: string;
  time: string;
  type: 'lab' | 'imaging' | 'referral' | 'rx';
}

export const statusColors: Record<PatientRow['status'], string> = {
  'Waiting':    'bg-amber-50 text-amber-700 border border-amber-200',
  'In Consult': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Done':       'bg-slate-100 text-slate-600 border border-content-border',
  'Admitted':   'bg-red-50 text-red-700 border border-red-200',
  'Referred':   'bg-purple-50 text-purple-700 border border-purple-200',
};

export const inboxTypeColors: Record<InboxItem['type'], string> = {
  lab:      'text-red-500',
  imaging:  'text-blue-500',
  referral: 'text-purple-500',
  rx:       'text-amber-500',
};
