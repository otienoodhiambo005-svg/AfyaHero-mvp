"""
FHIR-Compliant Output Module for AI Imaging Service
Converts AI imaging outputs to FHIR R4 DiagnosticReport resources.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime


class FHIRImagingOutputConverter:
    """Converts AI imaging outputs to FHIR-compliant resources"""
    
    @staticmethod
    def imaging_to_diagnostic_report(
        patient_id: str,
        findings: str,
        impression: str,
        confidence: float,
        procedure_code: Optional[str] = None,
        procedure_display: Optional[str] = None,
        imaging_modality: Optional[str] = None,
        body_site: Optional[str] = None,
        abnormalities: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Convert imaging AI output to FHIR DiagnosticReport resource.
        
        Args:
            patient_id: Patient identifier
            findings: Imaging findings text
            impression: Radiologist impression
            confidence: AI confidence score (0-1)
            procedure_code: SNOMED CT code for imaging procedure
            procedure_display: Display name for procedure
            imaging_modality: Modality (CT, MRI, X-ray, etc.)
            body_site: Body part imaged
            abnormalities: List of detected abnormalities
            
        Returns:
            FHIR DiagnosticReport resource
        """
        report_id = f"report-{datetime.now().timestamp()}"
        
        # Map modality to LOINC codes
        modality_loinc = {
            "CT": "LP2050-0",
            "MRI": "LP21377-7",
            "X-ray": "LP29708-2",
            "Ultrasound": "LP19095-8",
            "PET": "LP19094-1"
        }
        
        report = {
            "resourceType": "DiagnosticReport",
            "id": report_id,
            "meta": {
                "profile": ["https://afyahero.com/fhir/StructureDefinition/AIImagingReport"],
                "lastUpdated": datetime.now().isoformat()
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                            "code": "RAD",
                            "display": "Radiology"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": modality_loinc.get(imaging_modality, "LP29708-2"),
                        "display": procedure_display or f"{imaging_modality or 'Radiology'} Study"
                    }
                ]
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": datetime.now().isoformat(),
            "issued": datetime.now().isoformat(),
            "performer": [
                {
                    "reference": "Practitioner/ai-imaging-service",
                    "display": "AI Imaging Service"
                }
            ],
            "conclusion": impression,
            "conclusionCode": [],
            "note": [
                {
                    "text": findings
                }
            ],
            "_metadata": {
                "ai_provider": "ai-imaging-service",
                "confidence": confidence,
                "model_type": "imaging",
                "imaging_modality": imaging_modality,
                "body_site": body_site,
                "findings": findings,
                "impression": impression
            }
        }
        
        # Add body site if specified
        if body_site:
            report["_metadata"]["bodySite"] = body_site
        
        # Add abnormalities as conclusion codes
        if abnormalities:
            for abn in abnormalities:
                if abn.get("snomed_code"):
                    report["conclusionCode"].append({
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": abn["snomed_code"],
                                "display": abn.get("description", "Abnormality")
                            }
                        ]
                    })
        
        return report
    
    @staticmethod
    def imaging_to_observation(
        patient_id: str,
        measurement_type: str,
        measurement_value: float,
        measurement_unit: str,
        confidence: float,
        reference_range: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Convert imaging measurements to FHIR Observation resource.
        
        Args:
            patient_id: Patient identifier
            measurement_type: Type of measurement (e.g., "lesion_size", "nodule_diameter")
            measurement_value: Measured value
            measurement_unit: Unit of measurement
            confidence: AI confidence score (0-1)
            reference_range: Reference range for the measurement
            
        Returns:
            FHIR Observation resource
        """
        observation_id = f"obs-{datetime.now().timestamp()}"
        
        observation = {
            "resourceType": "Observation",
            "id": observation_id,
            "meta": {
                "profile": ["https://afyahero.com/fhir/StructureDefinition/AIImagingMeasurement"],
                "lastUpdated": datetime.now().isoformat()
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "imaging",
                            "display": "Imaging"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "363679005",
                        "display": measurement_type.replace("_", " ").title()
                    }
                ],
                "text": measurement_type
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": datetime.now().isoformat(),
            "issued": datetime.now().isoformat(),
            "valueQuantity": {
                "value": measurement_value,
                "unit": measurement_unit,
                "system": "http://unitsofmeasure.org",
                "code": measurement_unit
            },
            "_metadata": {
                "ai_provider": "ai-imaging-service",
                "confidence": confidence,
                "model_type": "imaging-measurement"
            }
        }
        
        # Add reference range if provided
        if reference_range:
            observation["referenceRange"] = [
                {
                    "low": {
                        "value": reference_range.get("low"),
                        "unit": measurement_unit
                    },
                    "high": {
                        "value": reference_range.get("high"),
                        "unit": measurement_unit
                    }
                }
            ]
        
        return observation


def imaging_to_fhir(
    patient_id: str,
    findings: str,
    impression: str,
    confidence: float,
    **kwargs
) -> Dict[str, Any]:
    """Convenience function to convert imaging output to FHIR."""
    return FHIRImagingOutputConverter.imaging_to_diagnostic_report(
        patient_id, findings, impression, confidence, **kwargs
    )
