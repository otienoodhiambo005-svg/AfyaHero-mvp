# AfyaHero API Documentation

## Overview

AfyaHero provides RESTful APIs for hospital management operations across multiple portals. All API routes are protected by authentication and authorization checks.

## Base URL

- **Development**: `http://localhost:3003`
- **Production**: `https://api.afyahero.com`

## Authentication

All API endpoints require authentication via Supabase Auth session tokens.

### Headers
```
Authorization: Bearer <session_token>
```

### Session Context
Authenticated requests include:
- `userId`: Current user's profile ID
- `hospitalId`: User's associated hospital (for multi-tenancy)
- `role`: User's portal role (medical, pharmacy, laboratory, reception, admin, superadmin)

## Rate Limiting

API requests are rate-limited using Upstash Redis:
- **Default**: 100 requests per minute
- **Authenticated**: Higher limits based on role
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Common Response Codes

- `200 OK`: Request successful
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## API Endpoints

### Settings API

#### GET /api/settings
Retrieve user settings for a specific portal role.

**Query Parameters:**
- `role` (required): Portal role (doctor, pharmacy, laboratory, admin, superadmin, reception)

**Response:**
```json
{
  "settings": {
    "profile": {
      "displayName": "Dr. John Doe",
      "email": "john@example.com"
    },
    "notifications": {
      "email": true,
      "inApp": true,
      "sms": false
    }
  },
  "lastSynced": "2024-01-15T10:30:00Z"
}
```

#### POST /api/settings
Save user settings for a specific portal role.

**Request Body:**
```json
{
  "role": "doctor",
  "settings": {
    "profile": {
      "displayName": "Dr. John Doe"
    },
    "notifications": {
      "email": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings saved successfully"
}
```

### Monitoring API

#### GET /api/monitoring/health
Health check endpoint for system status.

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "cache": true,
    "api": true
  },
  "timestamp": 1705320600000
}
```

#### GET /api/monitoring/metrics
Performance metrics and error statistics (requires authentication).

**Query Parameters:**
- `metric` (optional): Filter by specific metric name
- `since` (optional): Unix timestamp to filter metrics since

**Response:**
```json
{
  "summary": {
    "totalMetrics": 1250,
    "totalErrors": 5,
    "recentErrors": 2,
    "slowOperations": 3,
    "avgResponseTime": 245
  },
  "metrics": [...],
  "stats": {
    "count": 100,
    "avg": 245,
    "min": 50,
    "max": 1200,
    "p50": 200,
    "p95": 450,
    "p99": 800
  },
  "errors": [...],
  "timestamp": 1705320600000
}
```

### Admin API

#### GET /api/admin/users
List all users (admin only).

**Query Parameters:**
- `status` (optional): Filter by status (pending, active, suspended)
- `role` (optional): Filter by role
- `hospitalId` (optional): Filter by hospital

**Response:**
```json
{
  "users": [
    {
      "id": "profile-123",
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "medical",
      "status": "active",
      "hospitalId": "hospital-456"
    }
  ],
  "total": 1
}
```

#### POST /api/admin/users/approve
Approve a pending user registration (admin only).

**Request Body:**
```json
{
  "profileId": "profile-123",
  "role": "medical",
  "hospitalId": "hospital-456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User approved successfully"
}
```

#### POST /api/admin/users/reject
Reject a pending user registration (admin only).

**Request Body:**
```json
{
  "profileId": "profile-123",
  "reason": "Invalid credentials"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User rejected successfully"
}
```

### Medical API

#### GET /api/medical/patients
List patients (medical portal).

**Query Parameters:**
- `search` (optional): Search by name or ID
- `status` (optional): Filter by status
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "patients": [
    {
      "id": "patient-123",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1990-01-15",
      "gender": "male",
      "shifNumber": "1234567890",
      "status": "active"
    }
  ],
  "total": 1
}
```

#### POST /api/medical/patients
Create a new patient record (medical portal).

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "shifNumber": "1234567890",
  "phoneNumber": "+254712345678",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "id": "patient-123",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "shifNumber": "1234567890",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Pharmacy API

#### GET /api/pharmacy/prescriptions
List prescriptions (pharmacy portal).

**Query Parameters:**
- `status` (optional): Filter by status (pending, dispensed, cancelled)
- `patientId` (optional): Filter by patient
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "prescriptions": [
    {
      "id": "prescription-123",
      "patientId": "patient-456",
      "medication": "Amoxicillin 500mg",
      "dosage": "500mg",
      "frequency": "3 times daily",
      "duration": "7 days",
      "status": "pending",
      "prescribedBy": "doctor-789",
      "prescribedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/pharmacy/prescriptions/dispense
Mark a prescription as dispensed (pharmacy portal).

**Request Body:**
```json
{
  "prescriptionId": "prescription-123",
  "dispensedBy": "pharmacist-456",
  "batchNumber": "BATCH-001",
  "expiryDate": "2025-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Prescription dispensed successfully"
}
```

### Laboratory API

#### GET /api/laboratory/requests
List lab requests (laboratory portal).

**Query Parameters:**
- `status` (optional): Filter by status (pending, in_progress, completed, cancelled)
- `patientId` (optional): Filter by patient
- `testType` (optional): Filter by test type
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "requests": [
    {
      "id": "lab-request-123",
      "patientId": "patient-456",
      "testType": "CBC",
      "priority": "routine",
      "status": "pending",
      "requestedBy": "doctor-789",
      "requestedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/laboratory/requests/results
Submit lab test results (laboratory portal).

**Request Body:**
```json
{
  "requestId": "lab-request-123",
  "results": {
    "hemoglobin": "13.5 g/dL",
    "hematocrit": "40%",
    "wbc": "7.5 x10^9/L",
    "rbc": "4.5 x10^12/L"
  },
  "referenceRanges": {
    "hemoglobin": "12-16 g/dL",
    "hematocrit": "36-46%"
  },
  "performedBy": "lab-tech-456",
  "performedAt": "2024-01-15T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lab results submitted successfully"
}
```

### AI API

#### POST /api/ai/diagnostics
Generate AI-powered diagnostic suggestions (medical portal).

**Request Body:**
```json
{
  "patientId": "patient-123",
  "symptoms": ["fever", "cough", "fatigue"],
  "vitals": {
    "temperature": 38.5,
    "heartRate": 95,
    "bloodPressure": "120/80"
  },
  "medicalHistory": ["hypertension"]
}
```

**Response:**
```json
{
  "diagnosis": {
    "primary": "Upper Respiratory Infection",
    "confidence": 0.85,
    "differential": [
      {
        "condition": "Influenza",
        "probability": 0.70
      },
      {
        "condition": "COVID-19",
        "probability": 0.45
      }
    ]
  },
  "recommendations": [
    "Rest and hydration",
    "Monitor temperature",
    "Consider antiviral treatment if symptoms worsen"
  ],
  "provider": "gemini",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### POST /api/ai/drug-interaction
Check for drug interactions (pharmacy portal).

**Request Body:**
```json
{
  "medications": [
    {
      "name": "Amoxicillin",
      "dosage": "500mg"
    },
    {
      "name": "Ibuprofen",
      "dosage": "400mg"
    }
  ]
}
```

**Response:**
```json
{
  "interactions": [
    {
      "severity": "mild",
      "description": "No significant interaction expected",
      "recommendation": "Monitor for adverse effects"
    }
  ],
  "safe": true,
  "provider": "gemini",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Teleconsultation API

#### POST /api/teleconsultation/meetings
Create a Google Meet teleconsultation (medical portal).

**Request Body:**
```json
{
  "patientId": "patient-123",
  "doctorId": "doctor-456",
  "scheduledAt": "2024-01-20T14:00:00Z",
  "duration": 30,
  "title": "Follow-up Consultation"
}
```

**Response:**
```json
{
  "meetingId": "meeting-123",
  "meetingCode": "abc-defg-hij",
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "scheduledAt": "2024-01-20T14:00:00Z",
  "duration": 30
}
```

#### POST /api/teleconsultation/transcribe
Transcribe audio from a teleconsultation (medical portal).

**Request Body:**
```multipart/form-data**
- `audio`: Audio file (WebM, Opus, or PCM16)
- `meetingId`: Meeting identifier

**Response:**
```json
{
  "transcript": "Patient reports feeling better...",
  "language": "en",
  "duration": 125.5,
  "provider": "vertex-speech",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### FHIR API

#### GET /api/fhir/Patient
FHIR Patient resource endpoint.

**Query Parameters:**
- `_id`: Patient FHIR ID
- `identifier`: Patient identifier (e.g., SHIF number)
- `name`: Patient name search
- `birthdate`: Patient date of birth

**Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-123",
        "identifier": [
          {
            "system": "https://shif.go.ke/patient",
            "value": "1234567890"
          }
        ],
        "name": [
          {
            "family": "Doe",
            "given": ["John"]
          }
        ]
      }
    }
  ]
}
```

#### GET /api/fhir/Observation
FHIR Observation resource endpoint (clinical vitals, lab results).

**Query Parameters:**
- `patient`: Patient reference
- `code`: LOINC code
- `date`: Date filter
- `category`: Observation category

**Response:**
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 5,
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "id": "observation-123",
        "code": {
          "coding": [
            {
              "system": "http://loinc.org",
              "code": "8480-6",
              "display": "Systolic blood pressure"
            }
          ]
        },
        "valueQuantity": {
          "value": 120,
          "unit": "mmHg"
        }
      }
    }
  ]
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### Common Error Codes

- `AUTH_REQUIRED`: Authentication token missing or invalid
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `INVALID_REQUEST`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource does not exist
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INTERNAL_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

## Webhooks

### Patient Registration Webhook
Triggered when a new patient is registered.

**Payload:**
```json
{
  "event": "patient.created",
  "data": {
    "patientId": "patient-123",
    "hospitalId": "hospital-456",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Lab Result Webhook
Triggered when lab results are submitted.

**Payload:**
```json
{
  "event": "lab.result_submitted",
  "data": {
    "requestId": "lab-request-123",
    "patientId": "patient-456",
    "submittedAt": "2024-01-15T14:00:00Z"
  }
}
```

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

**Response Headers:**
- `X-Total-Count`: Total number of resources
- `X-Limit`: Current page size
- `X-Offset`: Current offset

## Filtering and Sorting

List endpoints support filtering and sorting:

**Filtering:** Use query parameters to filter results
**Sorting:** Use `sort` and `order` parameters
  - `sort`: Field to sort by
  - `order`: `asc` or `desc`

Example: `GET /api/medical/patients?sort=lastName&order=asc`

## SDK Integration

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get settings
const { data, error } = await supabase
  .from('user_settings')
  .select('*')
  .eq('profile_id', userId)
  .eq('role', 'doctor')
  .single();
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://api.afyahero.com/api/settings?role=doctor',
    headers=headers
)
```

## Testing

### Testing Endpoints Locally

```bash
# Start dev server
npm run dev

# Test health endpoint
curl http://localhost:3003/api/monitoring/health

# Test settings endpoint (with auth token)
curl -H "Authorization: Bearer <token>" \
  http://localhost:3003/api/settings?role=doctor
```

## Support

For API support:
- **Documentation**: See `docs/` directory
- **Issues**: Report via GitHub Issues
- **Contact**: support@afyahero.com
