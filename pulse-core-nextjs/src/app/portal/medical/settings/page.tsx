'use client';

import { useState } from 'react';
import { 
  User, 
  Bell, 
  Video, 
  FileText, 
  BrainCircuit, 
  Accessibility, 
  Languages, 
  Shield, 
  Lock,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentSettings } from '@/lib/settings';

type SettingsTab = 'profile' | 'notifications' | 'consultation' | 'prescription' | 'video' | 'ai' | 'accessibility' | 'language' | 'security' | 'privacy';

const TABS: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  { key: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { key: 'consultation', label: 'Consultation', icon: <Video className="w-4 h-4" /> },
  { key: 'prescription', label: 'E-Prescription', icon: <FileText className="w-4 h-4" /> },
  { key: 'video', label: 'Video', icon: <Video className="w-4 h-4" /> },
  { key: 'ai', label: 'AI Assistant', icon: <BrainCircuit className="w-4 h-4" /> },
  { key: 'accessibility', label: 'Accessibility', icon: <Accessibility className="w-4 h-4" /> },
  { key: 'language', label: 'Language', icon: <Languages className="w-4 h-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
  { key: 'privacy', label: 'Privacy', icon: <Lock className="w-4 h-4" /> },
];

export default function DoctorSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const { settings, updateSettings, isLoading, reset } = useCurrentSettings('doctor');

  const updateSection = <T,>(section: keyof typeof settings, data: T) => {
    updateSettings({ [section]: data });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleReset = () => {
    reset();
    setHasUnsavedChanges(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings settings={settings.profile} onChange={(data) => updateSection('profile', data)} />;
      case 'notifications':
        return <NotificationSettings settings={settings.notifications} onChange={(data) => updateSection('notifications', data)} />;
      case 'consultation':
        return <ConsultationSettings settings={settings.consultation} onChange={(data) => updateSection('consultation', data)} />;
      case 'prescription':
        return <PrescriptionSettings settings={settings.prescription} onChange={(data) => updateSection('prescription', data)} />;
      case 'video':
        return <VideoSettings settings={settings.video} onChange={(data) => updateSection('video', data)} />;
      case 'ai':
        return <AISettings settings={settings.aiAssistant} onChange={(data) => updateSection('aiAssistant', data)} />;
      case 'accessibility':
        return <AccessibilitySettings settings={settings.accessibility} onChange={(data) => updateSection('accessibility', data)} />;
      case 'language':
        return <LanguageSettings settings={settings.language} onChange={(data) => updateSection('language', data)} />;
      case 'security':
        return <SecuritySettings settings={settings.security} onChange={(data) => updateSection('security', data)} />;
      case 'privacy':
        return <PrivacySettings settings={settings.privacy} onChange={(data) => updateSection('privacy', data)} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[2rem] border border-portal-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_34%),linear-gradient(135deg,var(--content-bg),var(--content-surface))] p-5 shadow-card md:p-6">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-portal-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-portal-primary/25 bg-portal-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-portal-primary">
              <Shield className="h-3.5 w-3.5" />
              Clinical workspace controls
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate">
              Tune notifications, consultation defaults, AI assistance, accessibility, language, security, and privacy for fast clinical workflows.
            </p>
          </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2 rounded-full border border-warning/25 bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </div>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-full border border-content-border bg-content-bg/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-content-surface hover:text-ink"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || !hasUnsavedChanges}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors',
              saveStatus === 'saving' 
                ? 'bg-slate-400 cursor-not-allowed' 
                : saveStatus === 'saved'
                ? 'bg-success'
                : 'bg-portal-primary hover:bg-portal-primary-hover'
            )}
          >
            {saveStatus === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[1.5rem] border border-content-border bg-content-bg/90 p-2 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-portal-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-content-surface hover:text-ink'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-[1.75rem] border border-content-border bg-content-bg p-6 shadow-card">
        {renderTabContent()}
      </div>
    </div>
  );
}

// Profile Settings Component
 
function ProfileSettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Profile Information</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
          <input
            type="text"
            value={settings.displayName || ''}
            onChange={(e) => onChange({ ...settings, displayName: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
          <select
            value={settings.specialty || ''}
            onChange={(e) => onChange({ ...settings, specialty: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="">Select specialty</option>
            <option value="General Practice">General Practice</option>
            <option value="Internal Medicine">Internal Medicine</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
            <option value="Surgery">Surgery</option>
            <option value="Psychiatry">Psychiatry</option>
            <option value="Dermatology">Dermatology</option>
            <option value="Cardiology">Cardiology</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={settings.email || ''}
            onChange={(e) => onChange({ ...settings, email: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            type="tel"
            value={settings.phone || ''}
            onChange={(e) => onChange({ ...settings, phone: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">License Number</label>
          <input
            type="text"
            value={settings.licenseNumber || ''}
            onChange={(e) => onChange({ ...settings, licenseNumber: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">NPI Number</label>
          <input
            type="text"
            value={settings.npiNumber || ''}
            onChange={(e) => onChange({ ...settings, npiNumber: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
      </div>
    </div>
  );
}

// Notification Settings Component
 
function NotificationSettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  const options = [
    { key: 'email', label: 'Email Notifications', description: 'Receive notifications via email' },
    { key: 'push', label: 'Push Notifications', description: 'Receive push notifications in browser' },
    { key: 'sms', label: 'SMS Notifications', description: 'Receive text message notifications' },
    { key: 'consultationRequests', label: 'Consultation Requests', description: 'Get notified when patients request consultations' },
    { key: 'criticalResults', label: 'Critical Results', description: 'Get notified about critical lab results' },
    { key: 'appointmentReminders', label: 'Appointment Reminders', description: 'Receive reminders before appointments' },
    { key: 'systemAlerts', label: 'App Notifications', description: 'Get notified about updates and issues' },
    { key: 'marketingUpdates', label: 'Marketing Updates', description: 'Receive news about new features and promotions' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Notification Preferences</h2>
      
      <div className="space-y-4">
        {options.map((option) => (
          <div key={option.key} className="flex items-center justify-between py-3 border-b border-content-border/50">
            <div>
              <p className="font-medium text-ink">{option.label}</p>
              <p className="text-sm text-slate-500">{option.description}</p>
            </div>
            <button
              onClick={() => onChange({ ...settings, [option.key]: !settings[option.key] })}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                settings[option.key] ? 'bg-success' : 'bg-content-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-content-bg rounded-full shadow transition-transform',
                  settings[option.key] ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Consultation Settings Component
 
function ConsultationSettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Consultation Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Duration (minutes)</label>
          <input
            type="number"
            min={10}
            max={120}
            value={settings.defaultDuration}
            onChange={(e) => onChange({ ...settings, defaultDuration: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Buffer Time Between Appointments (minutes)</label>
          <input
            type="number"
            min={0}
            max={30}
            value={settings.bufferTime}
            onChange={(e) => onChange({ ...settings, bufferTime: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Consultation Mode</label>
          <select
            value={settings.defaultMode}
            onChange={(e) => onChange({ ...settings, defaultMode: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="video">Video Call</option>
            <option value="voice">Voice Call</option>
            <option value="text">Text Chat</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Max Daily Consultations</label>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxDailyConsultations}
            onChange={(e) => onChange({ ...settings, maxDailyConsultations: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="Enable Waiting Room"
          description="Patients wait in a virtual waiting room before being admitted"
          enabled={settings.enableWaitingRoom}
          onChange={() => onChange({ ...settings, enableWaitingRoom: !settings.enableWaitingRoom })}
        />
        
        <ToggleOption
          label="Auto-Admit from Waitroom"
          description="Automatically admit patients when their appointment time arrives"
          enabled={settings.autoAdmitWaitroom}
          onChange={() => onChange({ ...settings, autoAdmitWaitroom: !settings.autoAdmitWaitroom })}
        />
        
        <ToggleOption
          label="Auto-End Consultation"
          description="Automatically end consultation when time expires"
          enabled={settings.autoEndConsultation}
          onChange={() => onChange({ ...settings, autoEndConsultation: !settings.autoEndConsultation })}
        />
      </div>
    </div>
  );
}

// Prescription Settings Component
 
function PrescriptionSettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">E-Prescription Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Quantity (days)</label>
          <input
            type="number"
            min={1}
            max={90}
            value={settings.defaultQuantity}
            onChange={(e) => onChange({ ...settings, defaultQuantity: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Refills</label>
          <input
            type="number"
            min={0}
            max={12}
            value={settings.defaultRefills}
            onChange={(e) => onChange({ ...settings, defaultRefills: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="Require Digital Signature"
          description="All prescriptions must be digitally signed before submission"
          enabled={settings.requireDigitalSignature}
          onChange={() => onChange({ ...settings, requireDigitalSignature: !settings.requireDigitalSignature })}
        />
        
        <ToggleOption
          label="Allow Generic Substitution"
          description="Permit pharmacists to substitute brand-name drugs with generics"
          enabled={settings.allowGenericSubstitution}
          onChange={() => onChange({ ...settings, allowGenericSubstitution: !settings.allowGenericSubstitution })}
        />
        
        <ToggleOption
          label="Enable Drug Interaction Check"
          description="Automatically check for potential drug interactions"
          enabled={settings.enableDrugInteractionCheck}
          onChange={() => onChange({ ...settings, enableDrugInteractionCheck: !settings.enableDrugInteractionCheck })}
        />
      </div>
    </div>
  );
}

// Video Settings Component
 
function VideoSettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Video Call Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Default Video Quality</label>
          <select
            value={settings.defaultQuality}
            onChange={(e) => onChange({ ...settings, defaultQuality: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="auto">Auto (Adaptive)</option>
            <option value="720p">720p HD</option>
            <option value="480p">480p Standard</option>
            <option value="360p">360p Low</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="Enable Camera by Default"
          description="Turn on camera when starting video calls"
          enabled={settings.enableCamera}
          onChange={() => onChange({ ...settings, enableCamera: !settings.enableCamera })}
        />
        
        <ToggleOption
          label="Enable Microphone by Default"
          description="Turn on microphone when starting calls"
          enabled={settings.enableMicrophone}
          onChange={() => onChange({ ...settings, enableMicrophone: !settings.enableMicrophone })}
        />
        
        <ToggleOption
          label="Enable Screen Sharing"
          description="Allow screen sharing during consultations"
          enabled={settings.enableScreenShare}
          onChange={() => onChange({ ...settings, enableScreenShare: !settings.enableScreenShare })}
        />
        
        <ToggleOption
          label="Enable Recording"
          description="Allow recording of consultations (with patient consent)"
          enabled={settings.enableRecording}
          onChange={() => onChange({ ...settings, enableRecording: !settings.enableRecording })}
        />
        
        <ToggleOption
          label="Bandwidth Adaptive Quality"
          description="Automatically adjust video quality based on network conditions"
          enabled={settings.bandwidthAdaptive}
          onChange={() => onChange({ ...settings, bandwidthAdaptive: !settings.bandwidthAdaptive })}
        />
      </div>
    </div>
  );
}

// AI Settings Component
 
function AISettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">AI Assistant Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Transcription Language</label>
          <select
            value={settings.transcriptionLanguage}
            onChange={(e) => onChange({ ...settings, transcriptionLanguage: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="am">Amharic</option>
            <option value="fr">French</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
          <select
            value={settings.scribeProvider}
            onChange={(e) => onChange({ ...settings, scribeProvider: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI GPT-4</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="Enable AI Scribe"
          description="Use AI to automatically transcribe and summarize consultations"
          enabled={settings.enableScribe}
          onChange={() => onChange({ ...settings, enableScribe: !settings.enableScribe })}
        />
        
        <ToggleOption
          label="Auto-Generate Notes"
          description="Automatically generate clinical notes from consultation transcript"
          enabled={settings.autoGenerateNotes}
          onChange={() => onChange({ ...settings, autoGenerateNotes: !settings.autoGenerateNotes })}
        />
        
        <ToggleOption
          label="Include Timestamps"
          description="Add timestamps to transcribed text"
          enabled={settings.includeTimestamps}
          onChange={() => onChange({ ...settings, includeTimestamps: !settings.includeTimestamps })}
        />
        
        <ToggleOption
          label="Speaker Identification"
          description="Identify and label different speakers in transcription"
          enabled={settings.speakerIdentification}
          onChange={() => onChange({ ...settings, speakerIdentification: !settings.speakerIdentification })}
        />
      </div>
    </div>
  );
}

// Accessibility Settings Component
 
function AccessibilitySettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Accessibility Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Font Size</label>
          <select
            value={settings.fontSize}
            onChange={(e) => onChange({ ...settings, fontSize: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="small">Small</option>
            <option value="medium">Medium (Default)</option>
            <option value="large">Large</option>
            <option value="x-large">Extra Large</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Text Spacing</label>
          <select
            value={settings.textSpacing}
            onChange={(e) => onChange({ ...settings, textSpacing: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
            <option value="wider">Wider</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="High Contrast Mode"
          description="Increase contrast for better visibility"
          enabled={settings.highContrast}
          onChange={() => onChange({ ...settings, highContrast: !settings.highContrast })}
        />
        
        <ToggleOption
          label="Screen Reader Support"
          description="Optimize interface for screen readers"
          enabled={settings.screenReader}
          onChange={() => onChange({ ...settings, screenReader: !settings.screenReader })}
        />
        
        <ToggleOption
          label="Reduce Motion"
          description="Minimize animations and transitions"
          enabled={settings.reduceMotion}
          onChange={() => onChange({ ...settings, reduceMotion: !settings.reduceMotion })}
        />
        
        <ToggleOption
          label="Color Blind Mode"
          description="Use patterns in addition to colors for indicators"
          enabled={settings.colorBlindMode}
          onChange={() => onChange({ ...settings, colorBlindMode: !settings.colorBlindMode })}
        />
      </div>
    </div>
  );
}

// Language Settings Component
 
function LanguageSettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Language Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Interface Language</label>
          <select
            value={settings.interface}
            onChange={(e) => onChange({ ...settings, interface: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="am">Amharic</option>
            <option value="ha">Hausa</option>
            <option value="yo">Yoruba</option>
            <option value="zu">Zulu</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Patient Communication Language</label>
          <select
            value={settings.patientCommunication}
            onChange={(e) => onChange({ ...settings, patientCommunication: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="am">Amharic</option>
            <option value="ha">Hausa</option>
            <option value="yo">Yoruba</option>
            <option value="zu">Zulu</option>
            <option value="fr">French</option>
            <option value="pt">Portuguese</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fallback Language</label>
          <select
            value={settings.fallbackLanguage}
            onChange={(e) => onChange({ ...settings, fallbackLanguage: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>
      
      <div className="pt-4">
        <ToggleOption
          label="Enable Auto-Translate"
          description="Automatically translate patient messages to your preferred language"
          enabled={settings.enableAutoTranslate}
          onChange={() => onChange({ ...settings, enableAutoTranslate: !settings.enableAutoTranslate })}
        />
      </div>
    </div>
  );
}

// Security Settings Component
 
function SecuritySettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Security Settings</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Session Timeout (minutes)</label>
          <input
            type="number"
            min={5}
            max={480}
            value={settings.sessionTimeout}
            onChange={(e) => onChange({ ...settings, sessionTimeout: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password Expiry (days)</label>
          <input
            type="number"
            min={30}
            max={365}
            value={settings.passwordExpiry}
            onChange={(e) => onChange({ ...settings, passwordExpiry: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          />
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="Require Multi-Factor Authentication"
          description="Require 2FA for all login attempts"
          enabled={settings.requireMFA}
          onChange={() => onChange({ ...settings, requireMFA: !settings.requireMFA })}
        />
        
        <ToggleOption
          label="Login Notifications"
          description="Get notified of new login activity"
          enabled={settings.loginNotifications}
          onChange={() => onChange({ ...settings, loginNotifications: !settings.loginNotifications })}
        />
      </div>
      
      <div className="mt-6 p-4 bg-content-surface rounded-lg border border-content-border">
        <h3 className="text-sm font-semibold text-ink mb-3">Trusted Devices</h3>
        <p className="text-sm text-slate-500 mb-3">
          These devices are trusted and won&apos;t require 2FA for login.
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-content-bg rounded-lg border border-content-border">
            <div>
              <p className="text-sm font-medium text-ink">Current Device</p>
              <p className="text-xs text-slate-500">Last used: Just now</p>
            </div>
            <span className="text-xs text-success font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Privacy Settings Component
 
function PrivacySettings({ settings, onChange }: { settings: any; onChange: (data: any) => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Privacy Settings</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Profile Visibility</label>
          <select
            value={settings.profileVisibility}
            onChange={(e) => onChange({ ...settings, profileVisibility: e.target.value })}
            className="w-full px-3 py-2 border border-content-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary/20 focus:border-portal-primary"
          >
            <option value="private">Private (Only me)</option>
            <option value="colleagues">Colleagues (My organization)</option>
            <option value="public">Public (Anyone)</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-4 pt-4">
        <ToggleOption
          label="Show Online Status"
          description="Allow others to see when you're online"
          enabled={settings.showOnlineStatus}
          onChange={() => onChange({ ...settings, showOnlineStatus: !settings.showOnlineStatus })}
        />
        
        <ToggleOption
          label="Data Sharing for Research"
          description="Allow anonymized data to be used for medical research"
          enabled={settings.dataSharing}
          onChange={() => onChange({ ...settings, dataSharing: !settings.dataSharing })}
        />
        
        <ToggleOption
          label="Analytics Opt-Out"
          description="Opt out of usage analytics collection"
          enabled={settings.analyticsOptOut}
          onChange={() => onChange({ ...settings, analyticsOptOut: !settings.analyticsOptOut })}
        />
        
        <ToggleOption
          label="Marketing Opt-Out"
          description="Opt out of marketing communications"
          enabled={settings.marketingOptOut}
          onChange={() => onChange({ ...settings, marketingOptOut: !settings.marketingOptOut })}
        />
      </div>
    </div>
  );
}

// Toggle Option Component
function ToggleOption({ label, description, enabled, onChange }: { 
  label: string; 
  description: string; 
  enabled: boolean; 
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-content-border/50">
      <div>
        <p className="font-medium text-ink">{label}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors',
          enabled ? 'bg-success' : 'bg-content-border'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-content-bg rounded-full shadow transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}