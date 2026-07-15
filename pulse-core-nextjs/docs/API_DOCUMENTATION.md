# AfyaHero API Documentation

## Phase 3 API Endpoints

This document describes the API endpoints implemented for Phase 3 components.

### Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Rate Limiting

- **Auth endpoints:** 10 requests per minute
- **API endpoints:** 100 requests per minute
- Rate limit headers are included in responses

---

## Public Health Intelligence

### Get Outbreak Detection Data

**Endpoint:** `GET /api/admin/public-health/outbreak-detection`

**Description:** Returns disease clustering analysis and outbreak risk assessment

**Response:**
```json
{
  "diseaseClusters": [
    {
      "disease": "Malaria",
      "clusterId": "cluster-001",
      "riskLevel": "high",
      "affectedRegions": ["Nairobi", "Mombasa"],
      "trend": "increasing",
      "recommendedActions": ["Increase vector control", "Enhance surveillance"]
    }
  ],
  "overallRisk": "moderate",
  "lastUpdated": "2026-04-16T10:00:00Z"
}
```

**Use Cases:**
- Early outbreak detection
- Resource allocation planning
- Public health interventions

---

## Bed Management

### Get Predictive Bed Management

**Endpoint:** `GET /api/admin/beds/predictive-management`

**Description:** Returns bed allocation predictions and discharge timing forecasts

**Response:**
```json
{
  "bedPredictions": [
    {
      "ward": "ICU",
      "currentOccupancy": 18,
      "capacity": 20,
      "predictedOccupancy": 19,
      "dischargePredictions": [
        {
          "bedId": "bed-001",
          "predictedDischargeTime": "2026-04-17T14:00:00Z",
          "confidence": 0.85
        }
      ]
    }
  ],
  "wardCapacity": [
    {
      "ward": "General Ward",
      "totalBeds": 50,
      "availableBeds": 12,
      "utilizationRate": 0.76
    }
  ]
}
```

**Use Cases:**
- Bed capacity planning
- Admission optimization
- Resource allocation

---

## Executive Intelligence

### Get Executive KPIs

**Endpoint:** `GET /api/admin/executive/intelligence`

**Description:** Returns aggregated KPIs and quarterly forecasts

**Response:**
```json
{
  "kpiMetrics": {
    "patientVolume": {
      "current": 1250,
      "previous": 1180,
      "growth": 5.9
    },
    "revenue": {
      "current": 4500000,
      "previous": 4200000,
      "growth": 7.1
    },
    "patientSatisfaction": {
      "current": 4.2,
      "previous": 4.0,
      "growth": 5.0
    }
  },
  "forecasts": {
    "nextQuarter": {
      "predictedPatientVolume": 1350,
      "predictedRevenue": 4800000
    }
  }
}
```

**Use Cases:**
- Strategic planning
- Performance monitoring
- Financial forecasting

---

## Referral Matching

### Match Patient to Referral Hospital

**Endpoint:** `GET /api/medical/referrals/match`

**Query Parameters:**
- `specialization` (required): Medical specialty needed
- `insurance` (optional): Patient insurance provider
- `location` (optional): Patient location

**Response:**
```json
{
  "hospitalRecommendations": [
    {
      "hospitalId": "hospital-002",
      "hospitalName": "Kenya National Hospital",
      "specialization": "Cardiology",
      "availableBeds": 5,
      "distance": 12.5,
      "acceptsInsurance": true,
      "matchScore": 0.92
    }
  ]
}
```

**Use Cases:**
- Optimize patient referrals
- Reduce wait times
- Improve patient outcomes

---

## Patient Flow Prediction

### Get Patient Flow Forecast

**Endpoint:** `GET /api/analytics/patient-flow-prediction`

**Query Parameters:**
- `days` (optional): Number of days to forecast (default: 7)

**Response:**
```json
{
  "predictedArrivals": [
    {
      "date": "2026-04-17",
      "predictedPatients": 45,
      "confidence": 0.85,
      "resourceNeeds": {
        "doctors": 8,
        "nurses": 12,
        "beds": 15
      }
    }
  ],
  "overflowRisk": {
    "date": "2026-04-18",
    "riskLevel": "high",
    "recommendedActions": ["Increase staffing", "Prepare overflow areas"]
  }
}
```

**Use Cases:**
- Staff scheduling
- Resource planning
- Overflow prevention

---

## Discharge Planning

### Get Patient Discharge Prediction

**Endpoint:** `GET /api/medical/patients/{patientId}/discharge-prediction`

**Response:**
```json
{
  "losPrediction": {
    "predictedLOS": 5,
    "confidence": 0.88,
    "dischargeReadiness": 0.75
  },
  "riskFactors": [
    {
      "factor": "Age > 65",
      "impact": "positive",
      "weight": 0.3
    }
  ],
  "readmissionRisk": {
    "probability": 0.15,
    "factors": ["Comorbidities", "Previous admissions"]
  }
}
```

**Use Cases:**
- Discharge planning
- Resource optimization
- Readmission prevention

---

## Pharmacy Inventory

### Get Inventory Demand Forecast

**Endpoint:** `GET /api/pharmacy/inventory/predict-demand`

**Query Parameters:**
- `days` (optional): Forecast horizon in days (default: 30)

**Response:**
```json
{
  "demandForecasts": [
    {
      "medication": "Amoxicillin",
      "currentStock": 500,
      "predictedDemand": 450,
      "riskLevel": "low",
      "recommendedOrder": 200,
      "orderTimeline": "2 weeks"
    }
  ]
}
```

**Use Cases:**
- Inventory optimization
- Stockout prevention
- Cost reduction

---

## Insurance Optimization

### Optimize Insurance Claim

**Endpoint:** `POST /api/billing/insurance/optimize-claim`

**Request Body:**
```json
{
  "claimData": {
    "patientId": "patient-001",
    "services": [
      {
        "serviceCode": "CONS-001",
        "description": "General consultation",
        "cost": 1500
      }
    ]
  }
}
```

**Response:**
```json
{
  "validationResults": {
    "isValid": true,
    "errors": [],
    "warnings": ["Missing ICD-10 code for primary diagnosis"]
  },
  "codeSuggestions": [
    {
      "code": "Z00.00",
      "description": "General medical examination",
      "confidence": 0.92
    }
  ],
  "optimizationTips": [
    "Add supporting documentation for faster processing",
    "Include pre-authorization for high-cost procedures"
  ]
}
```

**Use Cases:**
- Claim validation
- Code optimization
- Reimbursement maximization

---

## Quality Intelligence

### Get Quality Metrics

**Endpoint:** `GET /api/admin/quality/intelligence`

**Response:**
```json
{
  "qualityMetrics": {
    "clinicalOutcomes": {
      "mortalityRate": 2.1,
      "readmissionRate": 8.5,
      "infectionRate": 3.2
    },
    "processMetrics": {
      "waitTime": 25,
      "documentationCompliance": 0.92
    }
  },
  "outlierAlerts": [
    {
      "metric": "readmissionRate",
      "value": 12.5,
      "benchmark": 8.5,
      "severity": "high"
    }
  ],
  "peerBenchmarks": {
    "topPerformers": ["Hospital A", "Hospital B"],
    "averagePerformance": {
      "mortalityRate": 2.5,
      "readmissionRate": 9.0
    }
  }
}
```

**Use Cases:**
- Quality improvement
- Performance benchmarking
- Compliance monitoring

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "error_type",
  "message": "Human-readable error message",
  "details": {}
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Offline Support

When the application is offline, API requests are queued in localStorage and automatically synced when connectivity is restored. Queue status is available via:

- **Header indicator:** Shows online/offline status
- **Queue count:** Displays number of queued requests
- **Sync status:** Indicates sync in progress

---

## AI Provider Cascade

API requests use a cascade of AI providers for reliability:

1. **OpenRouter** (primary)
2. **Groq** (secondary)
3. **HuggingFace** (tertiary)
4. **Gemini** (vision types)
5. **OpenAI** (diagnostic consensus)
6. **Claude** (clinical/radiology/pathology)

Fallback is automatic and transparent to the client.

---

## Security

- **Authentication:** JWT tokens with exp/iat/nbf validation
- **Authorization:** Role-based access control (RBAC)
- **Rate Limiting:** Redis-based with in-memory fallback
- **Encryption:** Fernet-based PII encryption
- **Audit Logging:** All data access logged with user/hospital details

---

## Versioning

Current API version: v1

Include version in requests if needed:
```
Accept: application/vnd.afyahero.v1+json
```

---

## Support

For API support or issues:
- Documentation: https://docs.afyahero.com
- Support: support@afyahero.com
- Status Page: https://status.afyahero.com
