'use client';

import { useState } from 'react';
import { Phone, Calendar, Clock, AlertTriangle, User, Mic } from 'lucide-react';
import { DawaChat } from '@/components/ai/DawaChat';
import { cn } from '@/lib/utils';

export default function ReceptionVoiceAssistant() {
  const [activeTab, setActiveTab] = useState<'assistant' | 'appointments' | 'waiting'>('assistant');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-content-surface text-ink p-4 rounded-t-2xl border-b border-content-border">
        <div className="flex items-center gap-3">
          <Phone className="w-6 h-6" />
          <div>
            <h2 className="font-bold text-lg">Reception Voice Assistant</h2>
            <p className="text-sm text-slate">AI customer care for appointment booking and queries</p>
          </div>
        </div>
      </div>

      {/* Quick Action Tabs */}
      <div className="flex border-b border-content-border" role="tablist" aria-label="Reception assistant sections">
        <button
          onClick={() => setActiveTab('assistant')}
          role="tab"
          aria-selected={activeTab === 'assistant'}
          className={cn(
            'flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'assistant'
              ? 'border-b-2 border-portal-primary text-portal-primary'
              : 'text-slate hover:text-charcoal'
          )}
        >
          <Mic className="w-4 h-4" />
          Voice Assistant
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          role="tab"
          aria-selected={activeTab === 'appointments'}
          className={cn(
            'flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'appointments'
              ? 'border-b-2 border-portal-primary text-portal-primary'
              : 'text-slate hover:text-charcoal'
          )}
        >
          <Calendar className="w-4 h-4" />
          Appointments
        </button>
        <button
          onClick={() => setActiveTab('waiting')}
          role="tab"
          aria-selected={activeTab === 'waiting'}
          className={cn(
            'flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2',
            activeTab === 'waiting'
              ? 'border-b-2 border-portal-primary text-portal-primary'
              : 'text-slate hover:text-charcoal'
          )}
        >
          <Clock className="w-4 h-4" />
          Waiting Times
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {activeTab === 'assistant' && (
          <div className="h-full">
            <DawaChat
              portal="reception"
              personaId="DAWA-Reception"
              title="Reception Assistant"
              placeholder="Ask about appointments, waiting times, hospital services, or speak directly..."
              allowVoice={true}
              allowFileUpload={false}
            />
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-content-border bg-white p-4">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-portal-primary" />
                <h3 className="font-semibold text-ink">Book Appointment</h3>
              </div>
              
              <div className="space-y-3">
                <button className="w-full p-3 rounded-lg border border-content-border bg-content-surface hover:bg-content-bg transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate" />
                    <span className="text-sm text-charcoal">New Patient Registration</span>
                  </div>
                </button>
                
                <button className="w-full p-3 rounded-lg border border-content-border bg-content-surface hover:bg-content-bg transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate" />
                    <span className="text-sm text-charcoal">View Available Slots</span>
                  </div>
                </button>
                
                <button className="w-full p-3 rounded-lg border border-content-border bg-content-surface hover:bg-content-bg transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate" />
                    <span className="text-sm text-charcoal">Reschedule Existing Appointment</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'waiting' && (
          <div className="p-4 space-y-3">
            <div className="rounded-xl border border-content-border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">Outpatient Department</span>
                <span className="text-sm font-bold text-amber-600">15 min</span>
              </div>
              <div className="w-full bg-content-border rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            
            <div className="rounded-xl border border-content-border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">Pharmacy</span>
                <span className="text-sm font-bold text-green-600">8 min</span>
              </div>
              <div className="w-full bg-content-border rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>
            
            <div className="rounded-xl border border-content-border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-ink">Laboratory</span>
                <span className="text-sm font-bold text-red-600">32 min</span>
              </div>
              <div className="w-full bg-content-border rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Wait times are estimates and may change. Patients with emergency conditions will be prioritized.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}