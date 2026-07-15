'use client';

import { DawaChat } from '@/components/ai/DawaChat';

export default function LabDawaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">DAWA Lab Assistant</h1>
        <p className="text-sm text-slate mt-1">AI-powered support for lab workflows, result interpretation, and quality control.</p>
      </div>
      <DawaChat
        portal="lab"
        personaId="DAWA-Lab"
        title="DAWA Lab Assistant"
        placeholder="Ask about lab procedures, result validation, or quality metrics..."
        allowVoice
        allowFileUpload
      />
    </div>
  );
}
