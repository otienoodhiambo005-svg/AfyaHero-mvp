# Integration Endpoints Contracts

This document defines the API contracts for the cross-portal integrations implemented in the medical workflow.

## Overview

| Purpose | Endpoint | Method | Used By |
| --- | --- | --- | --- |
| Pull patient assignment | `/api/medical/beds/assignments` | `GET` | Medical beds portal |
| Post vitals | `/api/medical/vitals` | `POST` | Medical vitals portal |
| Administer medication | `/api/medical/medications/administer` | `POST` | Medical MAR portal |
| Request lab draw | `/api/medical/orders` | `POST` | Medical orders portal |
| Notify doctor | `/api/medical/doctor-tasks` | `POST` / `GET` | MAR + Doctor dashboard |
| Update care plan (CHP) | `/api/apps/chp/care-plans` | `POST` / `GET` | Medical SOAP + CHP app |

All endpoints are hospital-scoped and protected by API guard middleware. Callers must be authenticated and have one of the expected roles (`medical`, `admin`, `super_admin`).

## Contract Updates (Apr 2026)

- Clinical write endpoints now require canonical patient identity (`patientId`) for safety.
- Bed allocation uses atomic claim semantics; concurrent claim loss returns `409`.
- CHP care plans are append-only audit versions (immutable history), not in-place updates.

---

## 1) Pull Patient Assignment (Bed Management)

### GET `/api/medical/beds/assignments`

Returns ward-level occupancy derived from `hospital_beds`.

**Response 200**

```json
{
  "wards": [
    {
      "id": "icu",
      "name": "ICU",
      "occupied": 8,
      "total": 10,
      "critical": 0,
      "pending": 1
    }
  ]
}
```

**Error responses**
- `400` missing hospital context
- `401/403` unauthorized/forbidden
- `500` backend read failure

---

## 2) Post Vitals (Medical Record)

### POST `/api/medical/vitals`

Stores vitals in `clinical_vitals`.

**Request body**

```json
{
  "patientId": "uuid-required",
  "bloodPressure": "120/80",
  "tempC": 37.1,
  "heartRate": 88,
  "respRate": 18,
  "spo2": 97,
  "weight": 72.3,
  "height": 176
}
```

Notes:
- Provide at least one measurement.
- `patientId` is mandatory for all writes.
- `patientName` is no longer accepted as write-time identity for this endpoint.

**Response 201**

```json
{
  "message": "Vitals recorded successfully.",
  "vital": {
    "id": "uuid",
    "patientId": "uuid",
    "recordedAt": "2026-04-14T12:30:00.000Z"
  }
}
```

**Error responses**
- `400` invalid payload/values
- `400` `patientId` required (migration guard)
- `404` patient not found
- `401/403` unauthorized/forbidden
- `500` write failure

---

## 3) Administer Medication (Inventory Deduction)

### POST `/api/medical/medications/administer`

Records medication administration and decrements pharmacy inventory atomically.

**Request body**

```json
{
  "patientId": "uuid-required",
  "medicationName": "Furosemide",
  "dose": "40 mg",
  "quantity": 1,
  "route": "IV",
  "notes": "Given after blood pressure review",
  "givenAt": "2026-04-14T09:15:00.000Z"
}
```

Notes:
- `patientId` is mandatory for all writes.
- `patientName` is no longer accepted as write-time identity for this endpoint.

**Response 200**

```json
{
  "ok": true,
  "patient": {
    "id": "uuid",
    "name": "Hassan Ali"
  },
  "administration": {
    "medicationName": "Furosemide",
    "quantity": 1,
    "dose": "40 mg",
    "route": "IV",
    "givenAt": "2026-04-14T09:15:00.000Z"
  },
  "inventory": {
    "id": "uuid",
    "medicationName": "Furosemide",
    "stockQuantity": 129,
    "status": "adequate"
  }
}
```

**Error responses**
- `400` invalid payload
- `400` `patientId` required (migration guard)
- `404` patient or medication not found
- `409` insufficient stock
- `401/403` unauthorized/forbidden
- `500` transactional failure

---

## 4) Request Lab Draw (Laboratory System)

### POST `/api/medical/orders`

Creates a `lab_requests` order for laboratory workflow.

**Request body**

```json
{
  "patientId": "uuid-optional",
  "patientQuery": "Hassan Ali",
  "testName": "CBC",
  "panel": "Full Blood Count",
  "sampleType": "Blood",
  "priority": "urgent",
  "notes": "Rule out acute infection"
}
```

**Response 201**

```json
{
  "order": {
    "id": "uuid",
    "labId": "LAB-20260414-1234",
    "patient": "Hassan Ali",
    "test": "CBC",
    "priority": "urgent",
    "status": "ordered"
  }
}
```

**Error responses**
- `400` invalid payload
- `404` patient not found
- `401/403` unauthorized/forbidden
- `500` order creation failure

---

## 5) Notify Doctor (Task/Chat Lane)

### POST `/api/medical/doctor-tasks`

Creates a doctor-facing task/notification using `service_escalations`.

**Request body**

```json
{
  "patientId": "uuid-optional",
  "patientName": "Hassan Ali",
  "title": "Medication review for Furosemide",
  "message": "Patient requires review after missed dose.",
  "channel": "task",
  "priority": "urgent"
}
```

**Response 201**

```json
{
  "task": {
    "id": "uuid",
    "title": "[URGENT] Medication review for Furosemide",
    "message": "Patient requires review after missed dose.",
    "channel": "task",
    "createdAt": "2026-04-14T10:00:00.000Z"
  }
}
```

### GET `/api/medical/doctor-tasks`

Returns open doctor tasks for dashboard consumption.

**Response 200**

```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "[ROUTINE] Review lab result",
      "message": "Please review latest chemistry panel.",
      "channel": "chat",
      "createdAt": "2026-04-14T10:15:00.000Z"
    }
  ]
}
```

---

## 6) Update Care Plan (CHP Follow-up)

### POST `/api/apps/chp/care-plans`

Appends an immutable care plan snapshot version (stored as auditable payload).

**Request body**

```json
{
  "patientRef": "PID-11234",
  "patientName": "Hassan Ali",
  "carePlan": "Community BP checks weekly for 4 weeks.",
  "communityFollowUpRequired": true,
  "followUpReason": "Uncontrolled BP after discharge",
  "followUpDueAt": "2026-04-21T08:00:00.000Z",
  "source": "medical-portal.soap"
}
```

**Response 201**

```json
{
  "ok": true,
  "action": "chp_app.care_plan.upsert",
  "mode": "created",
  "carePlanId": "uuid",
  "patientRef": "PID-11234",
  "communityFollowUpRequired": true,
  "auditable": {
    "actorId": "uuid",
    "actorRole": "medical",
    "hospitalId": "uuid",
    "recordedAt": "2026-04-14T10:30:00.000Z"
  }
}
```

Notes:
- Writes are append-only (no in-place mutation of prior care-plan records).
- New versions carry `supersedesId` metadata in the stored `payload` detail.

### GET `/api/apps/chp/care-plans?patientRef=PID-11234`

Retrieves the latest care plan version for a patient reference.

**Response 200**

```json
{
  "ok": true,
  "found": true,
  "patientRef": "PID-11234",
  "carePlanId": "uuid",
  "recordedAt": "2026-04-14T10:30:00.000Z",
  "actor": {
    "id": "uuid",
    "email": "doctor@example.com",
    "role": "medical"
  },
  "payload": {
    "carePlan": "Community BP checks weekly for 4 weeks.",
    "communityFollowUpRequired": true
  }
}
```

---

## Portal Integration Map

- `medical/beds` -> `GET /api/medical/beds/assignments`
- `medical/vitals` -> `POST /api/medical/vitals`
- `medical/medications` -> `POST /api/medical/medications/administer`, `POST /api/medical/doctor-tasks`
- `medical/orders` -> `POST /api/medical/orders`
- `medical/DoctorDashboard` -> `GET /api/medical/doctor-tasks`
- `medical/patients` SOAP flow -> `POST/GET /api/apps/chp/care-plans`

