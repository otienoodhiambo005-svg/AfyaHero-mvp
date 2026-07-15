"""
FHIR-Compliant Output Module for AI Diagnosis Service
Converts AI diagnosis outputs to FHIR R4 Condition resources.
"""

from typing import Dict, Any, Optional
from datetime import datetime


class FHIRDiagnosisOutputConverter:
    """Converts AI diagnosis outputs to FHIR-compliant resources"""
    
    @staticmethod
    def diagnosis_to_condition(
        patient_id: str,
        diagnosis: str,
        confidence: float,
        icd10_code: Optional[str] = None,
        snomed_code: Optional[str] = None,
        reasoning: Optional[str] = None,
        differential_diagnoses: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Convert diagnosis AI output to FHIR Condition resource.
        
        Args:
            patient_id: Patient identifier
            diagnosis: Primary diagnosis text
            confidence: AI confidence score (0-1)
            icd10_code: ICD-10 code for diagnosis
            snomed_code: SNOMED CT code for diagnosis
            reasoning: AI reasoning text
            differential_diagnoses: List of alternative diagnoses with confidence
            
        Returns:
            FHIR Condition resource
        """
        condition_id = f"condition-{datetime.now().timestamp()}"
        
        condition = {
            "resourceType": "Condition",
            "id": condition_id,
            "meta": {
                "profile": ["https://afyahero.com/fhir/StructureDefinition/AIDiagnosis"],
                "lastUpdated": datetime.now().isoformat()
            },
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        "code": "active",
                        "display": "Active"
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        "code": "provisional",
                        "display": "Provisional"
                    }
                ]
            },
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/condition-category",
                            "code": "encounter-diagnosis",
                            "display": "Encounter Diagnosis"
                        }
                    ]
                }
            ],
            "severity": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "24484000" if confidence > 0.8 else "6736007" if confidence > 0.5 else "255604002",
                        "display": "Severe" if confidence > 0.8 else "Moderate" if confidence > 0.5 else "Mild"
                    }
                ]
            },
            "code": {
                "coding": []
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "onsetDateTime": datetime.now().isoformat(),
            "recordedDate": datetime.now().isoformat(),
            "asserter": {
                "reference": "Practitioner/ai-diagnosis-service",
                "display": "AI Diagnosis Service"
            },
            "note": []
        }
        
        # Add SNOMED CT code if available
        if snomed_code:
            condition["code"]["coding"].append({
                "system": "http://snomed.info/sct",
                "code": snomed_code,
                "display": diagnosis
            })
        
        # Add ICD-10 code if available
        if icd10_code:
            condition["code"]["coding"].append({
                "system": "http://hl7.org/fhir/sid/icd-10",
                "code": icd10_code,
                "display": diagnosis
            })
        
        # If no codes, use text only
        if not snomed_code and not icd10_code:
            condition["code"]["text"] = diagnosis
        
        # Add reasoning as note
        if reasoning:
            condition["note"].append({
                "text": f"AI Reasoning: {reasoning}\nConfidence: {confidence:.2%}"
            })
        
        # Add differential diagnoses as notes
        if differential_diagnoses:
            diff_text = "Differential Diagnoses:\n"
            for diff in differential_diagnoses:
                diff_text += f"- {diff.get('diagnosis', 'Unknown')}: {diff.get('confidence', 0):.2%}\n"
            condition["note"].append({"text": diff_text})
        
        # Add AI metadata
        condition["_metadata"] = {
            "ai_provider": "ai-diagnosis-service",
            "confidence": confidence,
            "model_type": "diagnosis",
            "differential_diagnoses": differential_diagnoses
        }
        
        return condition


def diagnosis_to_fhir(
    patient_id: str,
    diagnosis: str,
    confidence: float,
    **kwargs
) -> Dict[str, Any]:
    """Convenience function to convert diagnosis to FHIR."""
    return FHIRDiagnosisOutputConverter.diagnosis_to_condition(
        patient_id, diagnosis, confidence, **kwargs
    )
