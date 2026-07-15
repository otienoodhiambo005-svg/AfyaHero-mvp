'use client';

import { DawaChat } from '@/components/ai/DawaChat';

export default function PharmacyDawaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">DAWA Pharmacy Assistant</h1>
        <p className="text-sm text-slate mt-1">AI-powered support for drug interactions, dispensing guidance, and formulary decisions.</p>
      </div>
      <DawaChat
        portal="pharmacy"
        personaId="DAWA-Rx"
        title="DAWA Pharmacy Assistant"
        placeholder="Ask about drug interactions, dosing, or formulary alternatives..."
        allowVoice
        allowFileUpload
      />
    </div>
  );
}
