# Patient Journey Analysis & Implementation Questions

## 1. Arrival & Registration

**Current State:**
- ✅ Patient model exists with demographics, contact info
- ✅ Profile model for staff authentication
- ✅ ReceptionCheckin model for check-in tracking
- ✅ HospitalQueue model for queue management
- ⚠️ No AI triage kiosk interface
- ⚠️ No mobile app/WhatsApp integration
- ⚠️ No mobile money pre-authorization flow

**Questions:**
1. **Triage Kiosk Hardware:** What hardware will be used for the AI triage kiosk? (tablet, terminal, mobile device)
2. **Vitals Integration:** Which vital sign measurement devices will be connected? (BP monitor, thermometer, pulse oximeter)
3. **Mobile App:** Do you have an existing mobile app or should we build a Progressive Web App (PWA)?
4. **WhatsApp Integration:** Should we use Twilio WhatsApp API for patient communication?
5. **Payment Pre-auth:** Which mobile money provider? (M-Pesa, Airtel Money, MTN Mobile Money)
6. **Self-service vs Staff-assisted:** Will patients self-register or will staff assist with registration?

**Implementation Requirements:**
- AI triage kiosk interface (tablet/web-based)
- Vital sign device integration (Bluetooth/USB)
- Mobile check-in (PWA or native app)
- WhatsApp bot for appointment reminders
- Mobile money payment integration

---

## 2. Triage & Initial Assessment

**Current State:**
- ✅ AI Triage Service (port 8001) with PEWS/MOEWS scoring
- ✅ ClinicalVital model for storing vital signs
- ✅ ServiceEscalation model for urgent cases
- ⚠️ No AI preliminary report generation
- ⚠️ No nurse/doctor confirmation workflow
- ⚠️ No fast-track to emergency care logic

**Questions:**
1. **Triage Algorithm:** Should we use the existing PEWS (Pediatric Early Warning Score) or create a custom triage algorithm?
2. **Report Format:** What format should the AI preliminary report use? (structured JSON, PDF, EMR note)
3. **Confirmation Workflow:** How should nurse/doctor confirm triage decisions? (approve/override with reason)
4. **Urgency Threshold:** What criteria define "urgent" for fast-tracking to emergency?
5. **Queue Management:** How should patients be sorted in queues? (by priority, by arrival time, by appointment)
6. **Triage History:** Should we track triage history over time for pattern analysis?

**Implementation Requirements:**
- AI triage report generation endpoint
- Triage confirmation workflow (nurse/doctor approval)
- Urgency threshold configuration
- Queue prioritization logic
- Triage history tracking

---

## 3. Consultation

**Current State:**
- ✅ Consultation model for doctor consultations
- ✅ Profile model with multi-facility access
- ✅ AI Diagnosis Service (port 8002)
- ✅ TeleconsultAppointment model
- ⚠️ No AI diagnosis suggestion integration
- ⚠️ No specialist connection workflow
- ⚠️ No unified patient record view

**Questions:**
1. **AI Integration:** When should AI suggest diagnoses? (before doctor sees patient, during consultation, after)
2. **Specialist Connection:** How should AI connect to remote specialists? (video call, chat, referral)
3. **Record View:** Should unified patient records show data from all facilities or only current facility?
4. **Multi-facility Access:** How should doctors access records from other facilities? (request access, automatic, role-based)
5. **Consultation Notes:** Should AI generate consultation notes or just suggestions?
6. **Telemedicine Platform:** Should we use Google Meet, Zoom, or a custom telehealth solution?

**Implementation Requirements:**
- AI diagnosis suggestion integration in consultation UI
- Specialist connection workflow
- Unified patient record aggregation
- Multi-facility access control
- Telemedicine integration
- AI-assisted consultation notes

---

## 4. Diagnostics & Tests

**Current State:**
- ✅ LabRequest model for lab orders
- ✅ LabInventory model for lab supplies
- ✅ LabQualityIncident model for quality tracking
- ⚠️ No AI lab system integration
- ⚠️ No automatic test ordering
- ⚠️ No anomaly flagging in results
- ⚠️ No offline-first design for lab data

**Questions:**
1. **Lab System Integration:** Which lab information systems need integration? (LIS, EMR, custom)
2. **AI Test Ordering:** Should AI suggest tests based on symptoms or should doctor always order?
3. **Priority Logic:** How should AI prioritize urgent cases in lab queue?
4. **Anomaly Detection:** What constitutes an anomaly in lab results? (out of range, trend analysis, AI-detected)
5. **Offline Design:** How long should data be stored locally if internet is down? (hours, days, weeks)
6. **Sync Strategy:** When offline data syncs, how to resolve conflicts?

**Implementation Requirements:**
- Lab system API integration
- AI test suggestion engine
- Lab queue prioritization
- Anomaly detection algorithms
- Offline-first lab data storage
- Conflict resolution for synced data

---

## 5. Treatment & Prescriptions

**Current State:**
- ✅ Prescription model for medication orders
- ✅ PharmacyInventory model for stock management
- ✅ AI Pharmacy Service (port 8006) with drug interaction checks
- ✅ PaymentTransaction model
- ⚠️ No AI treatment plan drafting
- ⚠️ No prescription digital delivery (SMS/WhatsApp)
- ⚠️ No insurance claim automation
- ⚠️ No alternative medication suggestion

**Questions:**
1. **Treatment Planning:** Should AI draft complete treatment plans or just medication lists?
2. **Prescription Delivery:** Should prescriptions be sent via SMS, WhatsApp, or patient portal?
3. **Insurance Integration:** Which insurance providers need integration? (NHIF/SHIF, private insurers)
4. **Stock Threshold:** At what stock level should AI suggest alternatives? (below 10, below 5, out of stock)
5. **Alternative Logic:** How should AI select alternatives? (same class, similar efficacy, cost-based)
6. **Payment Flow:** Should payment be processed before or after treatment? (pre-auth, post-service)

**Implementation Requirements:**
- AI treatment plan generation
- Digital prescription delivery (SMS/WhatsApp)
- Insurance claim automation
- Alternative medication suggestion engine
- Stock threshold configuration
- Payment flow integration

---

## 6. Follow-Up & Discharge

**Current State:**
- ✅ Appointment model for scheduling
- ⚠️ No AI follow-up scheduling
- ⚠️ No WhatsApp/SMS reminders
- ⚠️ No local language translation
- ⚠️ No cross-facility record sync
- ⚠️ No hospital dashboard analytics

**Questions:**
1. **Follow-up Logic:** When should AI schedule follow-ups? (based on condition, doctor preference, patient risk)
2. **Reminder Frequency:** How often should reminders be sent? (1 day before, 1 week before, custom)
3. **Local Languages:** Which local languages need support? (Swahili, Luganda, Amharic, etc.)
4. **Sync Strategy:** How should records sync across facilities? (real-time, batch, on-demand)
5. **Dashboard Metrics:** What analytics should be shown? (wait times, staff workload, medicine usage, patient outcomes)
6. **Discharge Criteria:** What determines when a patient can be discharged? (AI assessment, doctor decision, both)

**Implementation Requirements:**
- AI follow-up scheduling algorithm
- WhatsApp/SMS reminder system with translation
- Cross-facility record synchronization
- Hospital dashboard with analytics
- Discharge criteria automation
- Patient outcome tracking

---

## Critical Architecture Decisions Needed

### 1. Patient Identification
- **Question:** How will patients be uniquely identified across facilities?
- **Options:** National ID, phone number, biometric, QR code
- **Impact:** Affects record sync, insurance claims, privacy

### 2. Data Sovereignty
- **Question:** Should patient data be stored centrally or distributed across facilities?
- **Options:** Centralized database, distributed with sync, hybrid
- **Impact:** Affects offline design, sync strategy, compliance

### 3. AI Trust Level
- **Question:** How much autonomy should AI have in clinical decisions?
- **Options:** Advisory only, semi-autonomous with human override, fully autonomous with audit
- **Impact:** Affects UI design, liability, workflow

### 4. Offline Duration
- **Question:** How long should the system function without internet?
- **Options:** Hours, days, weeks
- **Impact:** Affects local storage size, sync complexity, conflict resolution

### 5. Multi-tenancy Model
- **Question:** How should multi-facility access be implemented?
- **Options:** Shared database with tenant isolation, separate databases per facility, hybrid
- **Impact:** Affects database design, scaling, backup strategy

---

## Recommended Implementation Priority

### Phase 1: Core Patient Flow (High Priority)
1. Patient registration with mobile check-in
2. AI triage kiosk with vital sign integration
3. Consultation with AI diagnosis suggestions
4. Treatment with AI prescription generation
5. Follow-up scheduling with reminders

### Phase 2: Integration (Medium Priority)
1. Lab system integration with AI anomaly detection
2. Insurance claim automation
3. Mobile money payment integration
4. Cross-facility record sync
5. Hospital dashboard analytics

### Phase 3: Advanced Features (Lower Priority)
1. Telemedicine with specialist connection
2. Offline-first design for all features
3. Advanced AI treatment planning
4. Biometric patient identification
5. Real-time analytics dashboard
