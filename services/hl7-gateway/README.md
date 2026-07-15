# HL7 Gateway Service

HL7 v2 message parser and FHIR converter microservice for AfyaHero Hospital OS.

## Features

- **HL7 v2 Message Parsing**: Full parser for HL7 v2 messages
- **FHIR Conversion**: Converts HL7 messages to FHIR R4 resources
- **Supported Message Types**:
  - ADT^A01: Admit patient
  - ADT^A02: Transfer patient
  - ADT^A03: Discharge patient
  - ADT^A04: Register patient
  - ADT^A08: Update patient information
  - ORM^O01: Order message
  - ORU^R01: Unsolicited observation/result message
- **Message Validation**: Validates HL7 message structure and compliance
- **Specialized Endpoints**: Dedicated endpoints for ADT and ORM conversions

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status.

### Parse HL7 Message
```
POST /parse
Content-Type: application/json

{
  "message": "MSH|^~\\&|AFYAHERO|FACILITY|...",
  "message_type": "ADT^A01"
}
```

Parses HL7 message and returns FHIR resources.

### Validate HL7 Message
```
POST /validate
Content-Type: application/json

{
  "message": "MSH|^~\\&|AFYAHERO|FACILITY|..."
}
```

Validates HL7 message structure without conversion.

### Get Supported Message Types
```
GET /message-types
```

Returns list of supported HL7 v2 message types.

### Convert ADT Message
```
POST /convert/adt
Content-Type: application/json

{
  "message": "MSH|^~\\&|AFYAHERO|FACILITY|...ADT^A01..."
}
```

Specialized endpoint for ADT (Admission/Discharge/Transfer) messages.

### Convert ORM Message
```
POST /convert/orm
Content-Type: application/json

{
  "message": "MSH|^~\\&|AFYAHERO|FACILITY|...ORM^O01..."
}
```

Specialized endpoint for ORM (Order Management) messages.

## FHIR Resource Mapping

| HL7 Segment | FHIR Resource |
|-------------|----------------|
| PID (Patient Identification) | Patient |
| PV1 (Patient Visit) | Encounter |
| NK1 (Next of Kin) | RelatedPerson |
| ORC (Common Order) + OBR (Observation Request) | ServiceRequest |
| OBR (Observation Request) + OBX (Observation) | DiagnosticReport + Observation |

## Running Locally

```bash
cd services/hl7-gateway
pip install -r requirements.txt
python main.py
```

Service runs on port 8008.

## Running with Docker

```bash
cd services/hl7-gateway
docker build -t afyahero/hl7-gateway:latest .
docker run -d -p 8008:8008 afyahero/hl7-gateway:latest
```

## Example Usage

### Parse ADT Message

```bash
curl -X POST http://localhost:8008/parse \
  -H "Content-Type: application/json" \
  -d '{
    "message": "MSH|^~\\&|AFYAHERO|FACILITY|AFYAHERO|20260417120000||ADT^A01|123456|P|2.5\nPID|1||12345^^^AFYAHERO^MR||DOE^JOHN^A||19750101|M"
  }'
```

Response:
```json
{
  "success": true,
  "message_type": "ADT^A01",
  "timestamp": "2026-04-17T11:30:00",
  "fhir_resources": {
    "Patient": {
      "resourceType": "Patient",
      "id": "12345",
      "name": [{"family": "DOE", "given": ["JOHN"]}],
      "gender": "male",
      "birthDate": "19750101"
    },
    "Encounter": {
      "resourceType": "Encounter",
      "id": "enc-123456",
      "status": "in-progress",
      "class": {"code": "inpatient"}
    }
  }
}
```

## Integration with AfyaHero

The HL7 Gateway Service is designed to integrate with hospital systems that use HL7 v2 messaging:

1. **Hospital Information Systems (HIS)**: Receives ADT messages for patient admissions, transfers, and discharges
2. **Laboratory Information Systems (LIS)**: Receives ORM messages for lab orders and ORU messages for results
3. **Radiology Information Systems (RIS)**: Receives ORM messages for imaging orders
4. **Pharmacy Systems**: Receives ORM messages for medication orders

The service converts these messages to FHIR resources that can be stored in the AfyaHero database and used by the AI services.

## Error Handling

The service returns appropriate HTTP status codes:
- `200`: Success
- `400`: Invalid HL7 message format
- `500`: Internal server error

Error responses include detailed error messages for debugging.

## Logging

The service uses Python's logging module with INFO level by default. Logs include:
- Message parsing events
- Conversion errors
- API request details
- Performance metrics
