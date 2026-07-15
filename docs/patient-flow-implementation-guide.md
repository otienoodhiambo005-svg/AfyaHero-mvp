# Patient Flow Implementation Guide

## Overview

This guide explains the Phase 1 patient flow implementation for AfyaHero Hospital OS. We've built the foundational API endpoints that enable the patient journey from arrival through triage to queue management.

## What We've Built

### 1. Patient Registration with AI Triage

**Endpoint**: `POST /api/patients/register-with-triage`

This is the primary entry point for the patient flow. When a patient arrives at the hospital:

**What it does**:
1. Registers a new patient (or finds existing by phone/SHIF number)
2. Collects vital signs and chief complaint
3. Calls AI Triage Service to determine priority (1-5)
4. Creates a hospital queue entry with triage priority
5. Stores clinical vitals
6. Creates reception check-in record
7. Automatically escalates urgent cases (priority 1)

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-05-15",
  "gender": "MALE",
  "phoneNumber": "+254712345678",
  "email": "john.doe@example.com",
  "address": "123 Main St, Nairobi",
  "shifNumber": "SHIF123456",
  
  // Triage information
  "chiefComplaint": "Severe headache and fever for 3 days",
  "vitals": {
    "temperature": 38.5,
    "heartRate": 95,
    "respiratoryRate": 20,
    "systolicBP": 120,
    "diastolicBP": 80,
    "spO2": 98,
    "consciousness": "alert"
  },
  "isPregnant": false,
  "painScore": 7,
  "knownAllergies": ["Penicillin"],
  "currentMedications": ["Paracetamol"],
  "knownMedicalConditions": ["Hypertension"]
}
```

**Response**:
```json
{
  "success": true,
  "patient": {
    "id": "patient-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+254712345678",
    "shifNumber": "SHIF123456"
  },
  "triage": {
    "priority": 2,
    "priorityLabel": "Emergency (Orange)",
    "confidence": 0.85,
    "reasoning": "Patient presents with fever and headache, vital signs stable but elevated temperature suggests possible infection...",
    "recommendedActions": [
      "Immediate medical assessment",
      "Consider malaria testing",
      "Monitor vital signs"
    ],
    "pewsScore": null,
    "moewsScore": null
  },
  "queue": {
    "id": "queue-uuid",
    "position": 3,
    "estimatedWaitTime": 15,
    "status": "WAITING"
  },
  "requiresImmediateAttention": false
}
```

**Triage Priority Levels**:
- **1 (Immediate/Red)**: Life-threatening, requires immediate intervention
- **2 (Emergency/Orange)**: Potentially life-threatening, rapid assessment needed
- **3 (Urgent/Yellow)**: Serious condition, assessment within 30-60 minutes
- **4 (Semi-urgent/Green)**: Stable but needs care, assessment within 1-2 hours
- **5 (Non-urgent/Blue)**: Minor condition, can wait

**Estimated Wait Times**:
- Priority 1: 0 minutes (immediate)
- Priority 2: 15 minutes
- Priority 3: 45 minutes
- Priority 4: 90 minutes
- Priority 5: 180 minutes

---

### 2. Hospital Queue Management

**Endpoint**: `GET /api/hospital/queue`

Retrieves the current hospital queue sorted by priority and check-in time.

**Query Parameters**:
- `priority`: Filter by priority level (1-5)
- `status`: Filter by status (default: WAITING)

**Response**:
```json
{
  "queue": [
    {
      "id": "queue-uuid-1",
      "patientId": "patient-uuid-1",
      "hospitalId": "hospital-uuid",
      "priority": 1,
      "status": "WAITING",
      "checkInTime": "2026-04-17T10:00:00.000Z",
      "estimatedWaitTime": 0,
      "position": 1,
      "timeInQueue": 5,
      "patient": {
        "id": "patient-uuid-1",
        "firstName": "Jane",
        "lastName": "Smith",
        "phoneNumber": "+254712345679",
        "dateOfBirth": "1985-03-20",
        "gender": "FEMALE"
      }
    },
    {
      "id": "queue-uuid-2",
      "patientId": "patient-uuid-2",
      "hospitalId": "hospital-uuid",
      "priority": 2,
      "status": "WAITING",
      "checkInTime": "2026-04-17T10:05:00.000Z",
      "estimatedWaitTime": 15,
      "position": 2,
      "timeInQueue": 2,
      "patient": {
        "id": "patient-uuid-2",
        "firstName": "John",
        "lastName": "Doe",
        "phoneNumber": "+254712345678",
        "dateOfBirth": "1990-05-15",
        "gender": "MALE"
      }
    }
  ],
  "statistics": {
    "totalWaiting": 15,
    "byPriority": {
      "1": 2,
      "2": 5,
      "3": 6,
      "4": 2,
      "5": 0
    },
    "averageWaitTime": 35
  }
}
```

**Queue Statistics**:
- `totalWaiting`: Number of patients currently waiting
- `byPriority`: Count of patients at each priority level
- `averageWaitTime`: Average time patients have been waiting (in minutes)

---

### 3. Queue Status Update

**Endpoint**: `PATCH /api/hospital/queue/[id]`

Updates a queue entry status when a patient is called to consultation, completes consultation, etc.

**Request Body**:
```json
{
  "status": "IN_CONSULTATION",
  "notes": "Patient called to Room 3"
}
```

**Valid Statuses**:
- `WAITING`: Patient is in the queue
- `IN_CONSULTATION`: Patient is currently with a doctor
- `COMPLETED`: Patient consultation is complete
- `CANCELLED`: Patient cancelled/left
- `NO_SHOW`: Patient did not show up when called

**Response**:
```json
{
  "success": true,
  "queue": {
    "id": "queue-uuid",
    "patientId": "patient-uuid",
    "hospitalId": "hospital-uuid",
    "priority": 2,
    "status": "IN_CONSULTATION",
    "checkInTime": "2026-04-17T10:05:00.000Z",
    "callTime": "2026-04-17T10:20:00.000Z",
    "estimatedWaitTime": 15
  },
  "patient": {
    "id": "patient-uuid",
    "name": "John Doe",
    "phoneNumber": "+254712345678"
  }
}
```

**Side Effects**:
- When status changes to `IN_CONSULTATION`, a new Consultation record is automatically created
- `callTime` is set when status becomes `IN_CONSULTATION`
- `completeTime` is set when status becomes `COMPLETED`

---

## How the Patient Flow Works

### Step 1: Patient Arrival & Registration

1. Patient arrives at hospital reception
2. Reception staff calls `/api/patients/register-with-triage` with:
   - Patient demographics
   - Chief complaint
   - Vital signs (from manual entry or connected devices)
   - Medical history

3. System:
   - Registers patient (or finds existing by phone/SHIF number)
   - Calls AI Triage Service (or uses fallback if unavailable)
   - Determines priority (1-5) based on:
     - Vital signs
     - Chief complaint
     - PEWS/MOEWS scores (for pediatric/obstetric patients)
   - Creates queue entry with priority
   - Stores clinical vitals
   - Creates check-in record
   - Escalates priority 1 cases automatically

4. Returns:
   - Patient information
   - Triage results (priority, reasoning, recommended actions)
   - Queue position and estimated wait time

### Step 2: Queue Management

1. Reception staff monitors queue via `/api/hospital/queue`
2. Queue is automatically sorted by:
   - Priority (lower number = higher priority)
   - Check-in time (earlier = first within same priority)

3. Dashboard shows:
   - All waiting patients sorted by priority
   - Queue statistics (total, by priority, average wait)
   - Time each patient has been waiting

### Step 3: Calling Patients

1. When doctor is ready, reception calls next patient
2. Updates queue entry via `PATCH /api/hospital/queue/[id]` with status `IN_CONSULTATION`
3. System:
   - Updates queue status
   - Sets call time
   - Automatically creates Consultation record
   - Patient moves to consultation room

---

## Integration with AI Services

### AI Triage Service Integration

The registration endpoint integrates with the AI Triage Microservice:

**Service URL**: `http://localhost:8001` (configurable via `TRIAGE_SERVICE_URL`)

**Fallback Behavior**:
- If AI Triage Service is unavailable (timeout, connection refused), system:
  - Assigns default priority 3 (Urgent)
  - Logs the error
  - Returns triage results with confidence 0.5
  - Continues with patient registration (non-blocking)

**Triage Algorithm**:
- Uses PEWS (Pediatric Early Warning Score) for patients < 18 years
- Uses MOEWS (Modified Obstetric Early Warning Score) for pregnant patients
- Uses general triage algorithm for other patients
- Considers:
  - Vital signs (temperature, heart rate, blood pressure, respiratory rate, SpO2)
  - Consciousness level
  - Chief complaint
  - Pain score
  - Known allergies and medications

---

## Security & Access Control

All endpoints include:

**Authentication**:
- Role-based access control (RBAC)
- Session validation
- Hospital isolation (multi-tenancy)

**Rate Limiting**:
- Registration: 10 requests per minute
- Queue operations: 20 requests per minute

**Request Firewall**:
- IP filtering
- Origin validation
- Request size limits

**Audit Logging**:
- All triage interactions logged
- AI service calls tracked
- Queue status changes recorded

**Required Roles**:
- Registration: `reception`, `medical`, `admin`
- Queue view: `reception`, `medical`, `admin`
- Queue update: `reception`, `medical`, `admin`

---

## Database Models Used

The implementation uses these existing Prisma models:

- **Patient**: Patient demographics and contact info
- **HospitalQueue**: Queue management with priority and status
- **ReceptionCheckin**: Check-in tracking
- **ClinicalVital**: Vitals storage
- **Consultation**: Consultation records
- **ServiceEscalation**: Urgent case escalation

---

## Next Steps

### Immediate (UI Components)

1. **Patient Check-in Form**
   - Form for patient demographics
   - Vitals input (manual or device integration)
   - Chief complaint text area
   - Medical history fields
   - Submit to `/api/patients/register-with-triage`

2. **Queue Dashboard**
   - Display current queue sorted by priority
   - Show queue statistics
   - Call patient button (updates status)
   - Color-coded by priority (Red, Orange, Yellow, Green, Blue)

3. **Triage Results Display**
   - Show triage priority and reasoning
   - Display recommended actions
   - Highlight urgent cases
   - Show PEWS/MOEWS scores when applicable

### Short-term (Additional Features)

1. **Vitals Device Integration**
   - Bluetooth connection to BP monitors
   - Thermometer integration
   - Pulse oximeter integration
   - Auto-populate vitals in registration form

2. **Mobile Check-in**
   - PWA for patient self-registration
   - QR code scanning for returning patients
   - WhatsApp integration for notifications

3. **Queue Notifications**
   - SMS when patient is called
   - WhatsApp notifications
   - Digital display integration

### Long-term (Advanced Features)

1. **AI Consultation Assistance**
   - Diagnosis suggestions during consultation
   - Treatment plan recommendations
   - Drug interaction checks

2. **Follow-up System**
   - Automated appointment scheduling
   - WhatsApp reminders
   - Patient outcome tracking

3. **Offline Support**
   - Local queue management when internet is down
   - Sync when connection restored
   - Conflict resolution

---

## Testing the Implementation

### Test Registration with Triage

```bash
curl -X POST http://localhost:3003/api/patients/register-with-triage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "firstName": "Test",
    "lastName": "Patient",
    "dateOfBirth": "1990-01-01",
    "gender": "MALE",
    "phoneNumber": "+254700000000",
    "chiefComplaint": "Fever and headache",
    "vitals": {
      "temperature": 38.5,
      "heartRate": 90,
      "respiratoryRate": 18,
      "systolicBP": 120,
      "diastolicBP": 80,
      "spO2": 98,
      "consciousness": "alert"
    }
  }'
```

### Test Queue View

```bash
curl -X GET http://localhost:3003/api/hospital/queue \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Test Queue Update

```bash
curl -X PATCH http://localhost:3003/api/hospital/queue/QUEUE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "status": "IN_CONSULTATION"
  }'
```

---

## Troubleshooting

### AI Triage Service Unavailable

**Symptom**: Registration succeeds but triage confidence is 0.5 with default priority

**Solution**:
1. Check if AI Triage Service is running: `curl http://localhost:8001/health`
2. Verify `TRIAGE_SERVICE_URL` environment variable
3. Check Docker logs if using Docker Compose
4. Network timeout may require increasing timeout in microservices-client.ts

### Queue Not Sorting Correctly

**Symptom**: Patients not in correct priority order

**Solution**:
1. Verify database query includes `orderBy: [{ priority: 'asc' }, { checkInTime: 'asc' }]`
2. Check that priority values are 1-5 (not 0 or >5)
3. Ensure queue entries have correct status (WAITING)

### Patient Not Found by Phone Number

**Symptom**: New patient created instead of finding existing

**Solution**:
1. Verify phone number format matches (include country code)
2. Check hospitalId matches in query
3. Ensure patient was previously registered to same hospital

---

## Summary

We've successfully implemented the foundational patient flow features:

✅ Patient registration with AI triage
✅ Hospital queue management
✅ Queue status updates
✅ Automatic consultation creation
✅ Urgent case escalation
✅ Security and access control
✅ Fallback behavior for service failures

The system is now ready for:
- UI component development
- Vitals device integration
- Mobile check-in implementation
- Consultation with AI diagnosis
- Follow-up and reminder systems
