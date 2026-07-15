"""
HL7 Gateway Service - AfyaHero
FastAPI microservice for HL7 v2 message parsing and FHIR conversion.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
from datetime import datetime
import os

from hl7_parser import HL7Parser, HL7ToFHIRConverter, parse_hl7_message, convert_hl7_to_fhir

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HL7 Gateway Service",
    description="HL7 v2 message parser and FHIR converter for AfyaHero Hospital OS",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request/Response Models ───────────────────────────────────────────────

class HL7MessageRequest(BaseModel):
    """Request model for HL7 message parsing"""
    message: str = Field(..., description="Raw HL7 v2 message string")
    message_type: Optional[str] = Field(None, description="Optional message type hint")
    
    class Config:
        schema_extra = {
            "example": {
                "message": "MSH|^~\\&|AFYAHERO|FACILITY|AFYAHERO|20260417120000||ADT^A01|123456|P|2.5\nPID|1||12345^^^AFYAHERO^MR||DOE^JOHN^A||19750101|M"
            }
        }


class FHIRResourceResponse(BaseModel):
    """Response model for FHIR resources"""
    resourceType: str
    id: str
    data: Dict[str, Any]


class HL7ParseResponse(BaseModel):
    """Response model for HL7 parsing"""
    success: bool
    message_type: str
    timestamp: str
    fhir_resources: Dict[str, Any]
    error: Optional[str] = None
    raw_message: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    timestamp: str

# ─── API Endpoints ─────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="hl7-gateway-service",
        version="1.0.0",
        timestamp=datetime.now().isoformat()
    )


@app.post("/parse", response_model=HL7ParseResponse)
async def parse_hl7(request: HL7MessageRequest):
    """
    Parse an HL7 v2 message and convert to FHIR resources.
    
    This endpoint:
    1. Parses the raw HL7 message
    2. Converts it to FHIR resources (Patient, Encounter, ServiceRequest, etc.)
    3. Returns the FHIR resources in a structured format
    
    Supported message types:
    - ADT^A01: Admit patient
    - ADT^A02: Transfer patient
    - ADT^A03: Discharge patient
    - ADT^A04: Register patient
    - ADT^A08: Update patient information
    - ORM^O01: Order message
    - ORU^R01: Unsolicited observation/result message
    """
    try:
        logger.info(f"Parsing HL7 message, type hint: {request.message_type}")
        
        # Convert HL7 to FHIR
        fhir_resources = convert_hl7_to_fhir(request.message)
        
        # Get message type from conversion
        parser = HL7Parser()
        parsed_message = parser.parse(request.message)
        
        return HL7ParseResponse(
            success=True,
            message_type=str(parsed_message.message_type.value),
            timestamp=datetime.now().isoformat(),
            fhir_resources=fhir_resources,
            raw_message=request.message[:500] + "..." if len(request.message) > 500 else request.message
        )
    
    except ValueError as e:
        logger.error(f"Invalid HL7 message: {str(e)}")
        return HL7ParseResponse(
            success=False,
            message_type="unknown",
            timestamp=datetime.now().isoformat(),
            fhir_resources={},
            error=f"Invalid HL7 message: {str(e)}",
            raw_message=request.message[:500] + "..." if len(request.message) > 500 else request.message
        )
    
    except Exception as e:
        logger.error(f"Error parsing HL7 message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/validate")
async def validate_hl7(request: HL7MessageRequest):
    """
    Validate an HL7 v2 message without converting to FHIR.
    
    This endpoint checks:
    1. Message structure validity
    2. Required segments presence
    3. Field format compliance
    """
    try:
        parser = HL7Parser()
        message = parser.parse(request.message)
        
        validation_result = {
            "valid": True,
            "message_type": str(message.message_type.value),
            "segments": len(message.segments),
            "segment_ids": [s.segment_id for s in message.segments],
            "timestamp": datetime.now().isoformat()
        }
        
        # Check for required segments based on message type
        required_segments = {
            "ADT": ["PID"],
            "ORM": ["ORC", "PID"],
            "ORU": ["PID", "OBR"]
        }
        
        msg_type_str = str(message.message_type.value).split('^')[0]
        if msg_type_str in required_segments:
            for req_seg in required_segments[msg_type_str]:
                if not message.get_segment(req_seg):
                    validation_result["valid"] = False
                    validation_result["error"] = f"Missing required segment: {req_seg}"
        
        return validation_result
    
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@app.get("/message-types")
async def get_supported_message_types():
    """Return list of supported HL7 v2 message types."""
    return {
        "supported_types": [
            {
                "code": "ADT^A01",
                "name": "Admit Patient",
                "description": "Patient admission notification"
            },
            {
                "code": "ADT^A02",
                "name": "Transfer Patient",
                "description": "Patient transfer notification"
            },
            {
                "code": "ADT^A03",
                "name": "Discharge Patient",
                "description": "Patient discharge notification"
            },
            {
                "code": "ADT^A04",
                "name": "Register Patient",
                "description": "Patient registration"
            },
            {
                "code": "ADT^A08",
                "name": "Update Patient",
                "description": "Patient information update"
            },
            {
                "code": "ORM^O01",
                "name": "Order Message",
                "description": "General order message"
            },
            {
                "code": "ORU^R01",
                "name": "Observation Result",
                "description": "Unsolicited observation/result message"
            }
        ],
        "timestamp": datetime.now().isoformat()
    }


@app.post("/convert/adt")
async def convert_adt(request: HL7MessageRequest):
    """
    Convert ADT (Admission/Discharge/Transfer) message specifically.
    
    This is a specialized endpoint for ADT messages that provides
    additional context specific to patient encounters.
    """
    try:
        parser = HL7Parser()
        message = parser.parse(request.message)
        
        # Verify it's an ADT message
        if not str(message.message_type.value).startswith('ADT'):
            raise HTTPException(status_code=400, detail="Message is not an ADT type")
        
        converter = HL7ToFHIRConverter()
        fhir_resources = converter.convert_to_fhir(request.message)
        
        # Add encounter-specific metadata
        if 'Encounter' in fhir_resources:
            fhir_resources['Encounter']['_metadata'] = {
                'source': 'HL7_ADT',
                'original_message_type': str(message.message_type.value),
                'parsed_at': datetime.now().isoformat()
            }
        
        return {
            "success": True,
            "message_type": str(message.message_type.value),
            "fhir_resources": fhir_resources,
            "timestamp": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting ADT message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")


@app.post("/convert/orm")
async def convert_orm(request: HL7MessageRequest):
    """
    Convert ORM (Order Management) message specifically.
    
    This is a specialized endpoint for ORM messages that provides
    additional context specific to medical orders.
    """
    try:
        parser = HL7Parser()
        message = parser.parse(request.message)
        
        # Verify it's an ORM message
        if not str(message.message_type.value).startswith('ORM'):
            raise HTTPException(status_code=400, detail="Message is not an ORM type")
        
        converter = HL7ToFHIRConverter()
        fhir_resources = converter.convert_to_fhir(request.message)
        
        # Add order-specific metadata
        if 'ServiceRequest' in fhir_resources:
            fhir_resources['ServiceRequest']['_metadata'] = {
                'source': 'HL7_ORM',
                'original_message_type': str(message.message_type.value),
                'parsed_at': datetime.now().isoformat()
            }
        
        return {
            "success": True,
            "message_type": str(message.message_type.value),
            "fhir_resources": fhir_resources,
            "timestamp": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting ORM message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion error: {str(e)}")


# ─── Main Entry Point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8008))
    uvicorn.run(app, host="0.0.0.0", port=port)
