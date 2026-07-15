'use client';

import { DawaChat } from '@/components/ai/DawaChat';

export default function MedicalDawaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">DAWA Clinical Assistant</h1>
        <p className="text-sm text-slate mt-1">AI-powered clinical decision support for diagnosis, drug interactions, and care guidance.</p>
      </div>
      <DawaChat
        portal="medical"
        personaId="DAWA-Clinical"
        title="DAWA Clinical Assistant"
        placeholder="Ask about diagnoses, drug interactions, or clinical guidelines..."
        showPatientPin
        allowVoice
        allowFileUpload
      />
    </div>
  );
}
