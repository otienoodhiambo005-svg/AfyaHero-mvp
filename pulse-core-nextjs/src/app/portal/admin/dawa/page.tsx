'use client';

import { DawaChat } from '@/components/ai/DawaChat';

export default function AdminDawaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">DAWA Admin Assistant</h1>
        <p className="text-sm text-slate mt-1">AI-powered analytics and operational guidance for hospital administrators.</p>
      </div>
      <DawaChat
        portal="admin"
        personaId="DAWA-Ops"
        title="DAWA Admin Assistant"
        placeholder="Ask about operations, staffing analytics, or quality metrics..."
        allowVoice
        allowFileUpload
      />
    </div>
  );
}
