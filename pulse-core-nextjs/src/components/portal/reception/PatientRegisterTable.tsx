'use client';

import React from 'react';
import { FrontDeskPatient } from './DashboardTypes';

interface PatientRegisterTableProps {
  patients: FrontDeskPatient[];
  statusStyles: Record<string, string>;
}

export function PatientRegisterTable({ patients, statusStyles }: PatientRegisterTableProps) {
  return (
    <div className="rounded-card border border-content-border bg-content-bg shadow-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-content-border bg-content-surface/50">
            <th className="py-3 px-4">PID</th>
            <th className="py-3 px-4">Name</th>
            <th className="py-3 px-4">Phone</th>
            <th className="py-3 px-4">Visit Type</th>
            <th className="py-3 px-4">Counter</th>
            <th className="py-3 px-4">Arrival</th>
            <th className="py-3 px-4">Insurance</th>
            <th className="py-3 px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {patients.length > 0 ? (
            patients.map((p) => (
              <tr key={p.pid} className="border-b border-content-border/50 hover:bg-content-surface transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{p.pid}</td>
                <td className="py-2.5 px-4 font-medium text-ink">{p.name}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.phone}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.visitType}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.counter}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.arrivalTime}</td>
                <td className="py-2.5 px-4 text-slate-600">{p.insurance}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[p.status] ?? 'bg-slate-100 text-slate-700'}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="text-center py-8 text-slate-400">
                No patients match your search.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
