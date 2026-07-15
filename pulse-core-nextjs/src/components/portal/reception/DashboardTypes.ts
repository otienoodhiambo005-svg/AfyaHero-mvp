import React from 'react';

export type Priority = 'Normal' | 'Urgent' | 'Critical';
export type ArrivalStatus = 'Waiting' | 'In Progress' | 'Checked In' | 'Billed';

export interface ArrivalRow {
  token: string;
  patient: string;
  ageSex: string;
  priority: Priority;
  complaint: string;
  wait: string;
  status: ArrivalStatus;
}

export interface KpiCardData {
  title: string;
  value: string;
  sub: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
}

export interface FrontDeskPatient {
  pid: string;
  name: string;
  phone: string;
  visitType: string;
  counter: string;
  status: string;
  arrivalTime: string;
  insurance: string;
}

export interface QueuePatient {
  id: string;
  name: string;
  patientId: string;
  phone: string;
  mpesaStatus: 'Pending' | 'Paid' | 'Processing';
  mpesaAmount?: string;
  clinicalStatus: 'Awaiting Triage' | 'Payment Pending' | 'In Consultation' | 'Checked In';
}

export const CLINICAL_STATUS_STYLES: Record<QueuePatient['clinicalStatus'], string> = {
  'Awaiting Triage': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Payment Pending': 'bg-orange-50 text-orange-600 border-orange-100',
  'In Consultation': 'bg-content-surface text-slate-600 border-content-border/50',
  'Checked In': 'bg-blue-50 text-blue-600 border-blue-100',
};

export const PRIORITY_STYLES: Record<Priority, string> = {
  Normal: 'bg-emerald-100 text-emerald-600',
  Urgent: 'bg-yellow-100 text-yellow-600',
  Critical: 'bg-red-100 text-red-600',
};

export const STATUS_STYLES: Record<ArrivalStatus, string> = {
  Waiting: 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-600',
  'Checked In': 'bg-emerald-100 text-emerald-600',
  Billed: 'bg-purple-100 text-purple-600',
};
