# AI API Documentation

## Overview

This document describes the AI-powered API endpoints available in the AfyaHero Pulse application. These endpoints provide clinical decision support, population health analytics, and resource optimization features.

## Authentication

All AI API endpoints require authentication via session cookies. Only authorized users with appropriate roles can access these endpoints.

### Required Roles
- **Lab endpoints**: `lab`, `admin`, `super_admin`
- **Clinical endpoints**: `medical`, `admin`, `super_admin`
- **Admin endpoints**: `admin`, `super_admin`
- **Pharmacy endpoints**: `pharmacy`, `admin`, `super_admin`

## Rate Limiting

AI endpoints have specific rate limits to prevent abuse and ensure fair usage:

- **Lab interpretation**: 50 requests/minute
- **Clinical AI (diagnosis, deterioration risk, alerts)**: 40 requests/minute
- **Documentation AI**: 60 requests/minute
- **Population health AI**: 20 requests/minute
- **Heavy AI operations**: 30 requests/minute

Rate limits are enforced per user role and IP address.

## Endpoints

### 1. Lab Results Interpretation

**POST** `/api/lab/interpret`

Interprets lab results using AI analysis.

**Request Body:**
```json
{
  "labResults": {
    "hb": "12.0",
    "wbc": "8.0",
    "plt": "250"
  },
  "testName": "Complete Blood Count",
  "patientAge": 35,
  "patientGender": "male",
  "patientContext": "Routine checkup"
}
```

**Response:**
```json
{
  "success": true,
  "interpretation": "Normal CBC values. No abnormalities detected.",
  "confidenceScore": 0.95,
  "abnormalFlags": [],
  "recommendations": ["Continue routine monitoring"],
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "provider": "gemini",
    "latencyMs": 1200
  }
}
```

---

### 2. Deterioration Risk Assessment

**POST** `/api/clinical/deterioration-risk`

Assesses patient deterioration risk using AI-enhanced predictive models.

**Request Body:**
```json
{
  "patientId": "patient-uuid",
  "context": {
    "age": 45,
    "gender": "female",
    "consciousness": "alert",
    "isPregnant": false
  },
  "vitals": {
    "bloodPressure": { "systolic": 120, "diastolic": 80 },
    "heartRate": 72,
    "temperature": 37.0,
    "respiratoryRate": 16,
    "oxygenSaturation": 98
  }
}
```

**Response:**
```json
{
  "success": true,
  "overallRisk": "low",
  "overallScore": 2.3,
  "risks": {
    "sepsis": { "risk": "low", "score": 1.5 },
    "pediatric": { "risk": "n/a", "score": 0 },
    "maternal": { "risk": "n/a", "score": 0 }
  },
  "aiInsights": {
    "assessment": "Patient vitals are stable. Low deterioration risk.",
    "recommendations": ["Continue routine monitoring"]
  },
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "provider": "gemini"
  }
}
```

---

### 3. Clinical Alerts

**POST** `/api/clinical/alerts`

Generates AI-powered clinical decision alerts.

**Request Body:**
```json
{
  "patientId": "patient-uuid",
  "context": {},
  "vitals": {
    "bloodPressure": { "systolic": 85, "diastolic": 55 },
    "heartRate": 105,
    "temperature": 38.5,
    "respiratoryRate": 22,
    "oxygenSaturation": 93
  },
  "medications": ["Warfarin", "Aspirin"],
  "labResults": {
    "hemoglobin": 8.5,
    "whiteBloodCell": 14.0
  },
  "allergies": ["Penicillin"],
  "conditions": ["Hypertension", "Diabetes"]
}
```

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert-1",
      "category": "drug_interaction",
      "severity": "high",
      "message": "Warfarin and Aspirin interaction detected",
      "recommendation": "Monitor INR levels closely"
    },
    {
      "id": "alert-2",
      "category": "sepsis",
      "severity": "medium",
      "message": "Elevated white blood cell count",
      "recommendation": "Consider infection workup"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 1,
    "medium": 1,
    "low": 0
  }
}
```

---

### 4. Documentation Suggestions

**POST** `/api/clinical/documentation/suggestions`

Provides AI-powered clinical documentation suggestions.

**Request Body:**
```json
{
  "documentType": "soap_note",
  "patientContext": {
    "age": 45,
    "gender": "female",
    "chiefComplaint": "Chest pain",
    "history": "Patient presents with chest pain for 2 days"
  },
  "partialContent": "Subjective: Patient reports chest pain",
  "suggestionsFor": "completion"
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": {
    "completion": "Subjective: Patient reports chest pain for 2 days, described as pressure-like, 6/10 severity, aggravated by exertion, relieved by rest. No radiation to arm or jaw.",
    "structure": ["Chief Complaint", "History of Present Illness", "Review of Systems"],
    "icd10Codes": ["R07.4 - Chest pain, unspecified"]
  },
  "documentType": "soap_note"
}
```

---

### 5. Follow-up Recommendations

**POST** `/api/clinical/followup/recommendations`

Generates AI-driven patient follow-up recommendations.

**Request Body:**
```json
{
  "patientId": "patient-uuid",
  "diagnosis": "Community-acquired pneumonia",
  "treatment": {
    "medication": "Amoxicillin 500mg TID x 7 days",
    "instructions": "Complete full course"
  },
  "riskFactors": {
    "age": 65,
    "comorbidities": "Diabetes, Hypertension",
    "previousAdmissions": 2
  },
  "socialContext": {
    "support": "moderate",
    "distance": 15,
    "transportation": "limited"
  },
  "dischargeCondition": "stable"
}
```

**Response:**
```json
{
  "success": true,
  "readmissionRisk": {
    "risk": "medium",
    "score": 4.2,
    "factors": ["Age > 65", "Multiple comorbidities"]
  },
  "recommendations": {
    "followUpTimeline": "Schedule follow-up in 7 days",
    "monitoringParameters": ["Temperature", "Oxygen saturation", "Symptom review"],
    "communityHealthWorker": true,
    "urgency": "routine"
  },
  "summary": {
    "urgency": "routine",
    "requiresCHW": true,
    "priorityFollowup": "7 days"
  }
}
```

---

### 6. Medication Adherence

**POST** `/api/clinical/medication/adherence`

Monitors and predicts medication adherence using AI.

**Request Body:**
```json
{
  "patientId": "patient-uuid",
  "medications": [
    {
      "name": "Metformin 500mg",
      "frequency": "twice daily",
      "duration": "ongoing"
    }
  ],
  "adherenceHistory": {
    "previousMissedDoses": 1
  },
  "riskFactors": {
    "age": 65,
    "comorbidities": "Diabetes"
  },
  "socialContext": {
    "support": "good",
    "distance": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "adherenceScore": 0.85,
  "adherenceLevel": "high",
  "riskFactors": ["High pill burden", "Complex regimen"],
  "recommendations": {
    "interventions": ["Medication organizer", "Reminder system"],
    "education": ["Importance of adherence"],
    "followUp": "Weekly check-in"
  },
  "summary": {
    "requiresIntervention": false,
    "priorityFollowup": "monthly"
  }
}
```

---

### 7. Resource Allocation

**POST** `/api/admin/resource-allocation

Optimizes resource allocation using AI.

**Request Body:**
```json
{
  "resourceType": "staff",
  "facilityId": "facility-uuid",
  "currentAllocation": {
    "doctors": 10,
    "nurses": 30,
    "pharmacists": 5
  },
  "demandData": {
    "patientVolume": {
      "emergency": 50,
      "inpatient": 100
    },
    "peakHours": ["08:00-12:00", "14:00-18:00"]
  },
  "constraints": {
    "budget": 1000000,
    "minimumStaffing": {
      "doctors": 5,
      "nurses": 20
    }
  },
  "optimizationGoal": "efficiency"
}
```

**Response:**
```json
{
  "success": true,
  "resourceType": "staff",
  "optimization": {
    "recommendedAllocation": {
      "doctors": 12,
      "nurses": 35,
      "pharmacists": 6
    },
    "efficiencyGain": 0.15,
    "costImpact": -50000
  },
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "optimizationGoal": "efficiency"
  }
}
```

---

### 8. Population Health Analytics

**POST** `/api/population/analytics`

Generates AI-driven population health analytics.

**Request Body:**
```json
{
  "facilityId": "facility-uuid",
  "timeframe": "month",
  "reportType": "ahi"
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "healthIndicators": {
      "maternalHealth": {
        "mmr": 342,
        "trend": "decreasing"
      },
      "childHealth": {
        "under5Mortality": 45,
        "trend": "stable"
      }
    },
    "recommendations": [
      "Increase antenatal care coverage",
      "Strengthen immunization programs"
    ]
  },
  "metadata": {
    "facilityId": "facility-uuid",
    "timeframe": "month",
    "reportType": "ahi",
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Error Responses

All endpoints return standard error responses:

**400 Bad Request:**
```json
{
  "error": "Invalid request body"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again."
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Security Features

### Data Masking
All patient data sent to external AI providers is automatically masked to protect PHI:
- Names are partially masked
- Phone numbers are partially masked
- Email addresses are partially masked
- IDs are partially masked
- Addresses are replaced with placeholders

### Audit Logging
All AI operations are logged for audit purposes, including:
- User ID and hospital ID
- Operation type and task type
- Success/failure status
- Latency metrics
- Error messages

### Rate Limiting
Granular rate limiting is enforced per:
- User role
- IP address
- Endpoint type
- Time window

## Best Practices

1. **Always validate input** before sending to AI endpoints
2. **Handle errors gracefully** - AI providers may be unavailable
3. **Cache responses** when appropriate to reduce API calls
4. **Monitor usage** to stay within rate limits
5. **Review AI outputs** before presenting to patients
6. **Log all AI operations** for audit compliance
