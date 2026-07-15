import { DawaChat } from '@/components/ai/DawaChat';

export default function ReceptionDawaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">DAWA Operations Assistant</h1>
        <p className="text-sm text-slate-600">AI-powered support for front-desk, billing, and general operational flow</p>
      </div>
      <div className="rounded-card border border-content-border bg-content-bg p-6">
        <DawaChat
          portal="reception"
          personaId="DAWA-Reception"
          title="DAWA Operations Assistant"
          placeholder="Ask about patient registration, queue management, billing, or reception workflows..."
          allowVoice
          allowFileUpload
        />
      </div>
    </div>
  );
}
