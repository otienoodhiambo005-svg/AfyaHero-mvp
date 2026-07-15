"""
FHIR-Compliant Output Module for AI Services
Converts AI service outputs to FHIR R4 resources.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum


class FHIRResourceType(Enum):
    """FHIR resource types for AI outputs"""
    OBSERVATION = "Observation"
    CONDITION = "Condition"
    SERVICE_REQUEST = "ServiceRequest"
    DIAGNOSTIC_REPORT = "DiagnosticReport"
    ENCOUNTER = "Encounter"


class FHIROutputConverter:
    """Converts AI service outputs to FHIR-compliant resources"""
    
    @staticmethod
    def triage_to_observation(
        patient_id: str,
        priority: int,
        priority_label: str,
        confidence: float,
        reasoning: str,
        pews_score: Optional[int] = None,
        moews_score: Optional[int] = None,
        vital_signs: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Convert triage AI output to FHIR Observation resource.
        
        Args:
            patient_id: Patient identifier
            priority: Triage priority (1-5)
            priority_label: Priority label (e.g., "Immediate", "Urgent")
            confidence: AI confidence score (0-1)
            reasoning: AI reasoning text
            pews_score: Pediatric Early Warning Score
            moews_score: Modified Early Warning Score
            vital_signs: Dictionary of vital signs
            
        Returns:
            FHIR Observation resource
        """
        observation_id = f"triage-{datetime.now().timestamp()}"
        
        # Map priority to LOINC codes
        priority_loinc = {
            1: "LA28397-0",  # Immediate - Critical
            2: "LA28398-8",  # Urgent - Severe
            3: "LA28399-6",  # Moderate - Moderate
            4: "LA28400-2",  # Non-urgent - Mild
            5: "LA28401-0"   # Routine - Normal
        }
        
        # Create observation
        observation = {
            "resourceType": "Observation",
            "id": observation_id,
            "meta": {
                "profile": ["https://afyahero.com/fhir/StructureDefinition/TriageObservation"],
                "lastUpdated": datetime.now().isoformat()
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "vital-signs",
                            "display": "Vital Signs"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "LP7357-2",
                        "display": "Triage category"
                    }
                ],
                "text": "AI Triage Assessment"
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": datetime.now().isoformat(),
            "issued": datetime.now().isoformat(),
            "valueCodeableConcept": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": priority_loinc.get(priority, "LA28401-0"),
                        "display": priority_label
                    }
                ],
                "text": priority_label
            },
            "interpretation": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "code": "HH" if priority <= 2 else "N" if priority == 3 else "LL",
                            "display": "High" if priority <= 2 else "Normal" if priority == 3 else "Low"
                        }
                    ]
                }
            ],
            "note": [
                {
                    "text": reasoning
                }
            ],
            "_metadata": {
                "ai_provider": "ai-triage-service",
                "confidence": confidence,
                "model_type": "ensemble"
            }
        }
        
        # Add PEWS/MOEWS scores as component observations
        components = []
        if pews_score is not None:
            components.append({
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "57074-7",
                            "display": "Pediatric Early Warning Score"
                        }
                    ]
                },
                "valueInteger": pews_score
            })
        
        if moews_score is not None:
            components.append({
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "57074-7",
                            "display": "Modified Early Warning Score"
                        }
                    ]
                },
                "valueInteger": moews_score
            })
        
        # Add vital signs as components
        if vital_signs:
            vital_sign_loinc = {
                "heart_rate": "8867-4",
                "blood_pressure_systolic": "8480-6",
                "blood_pressure_diastolic": "8462-4",
                "respiratory_rate": "9279-1",
                "temperature": "8310-5",
                "oxygen_saturation": "2708-6"
            }
            
            for vital_name, vital_value in vital_signs.items():
                loinc_code = vital_sign_loinc.get(vital_name)
                if loinc_code:
                    components.append({
                        "code": {
                            "coding": [
                                {
                                    "system": "http://loinc.org",
                                    "code": loinc_code,
                                    "display": vital_name.replace("_", " ").title()
                                }
                            ]
                        },
                        "valueQuantity": {
                            "value": vital_value,
                            "unit": "mmHg" if "pressure" in vital_name else "bpm" if "rate" in vital_name else "°C" if "temperature" in vital_name else "%"
                        }
                    })
        
        if components:
            observation["component"] = components
        
        return observation
    
    @staticmethod
    def diagnosis_to_condition(
        patient_id: str,
        diagnosis: str,
        confidence: float,
        icd10_code: Optional[str] = None,
        snomed_code: Optional[str] = None,
        reasoning: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert diagnosis AI output to FHIR Condition resource.
        
        Args:
            patient_id: Patient identifier
            diagnosis: Diagnosis text
            confidence: AI confidence score (0-1)
            icd10_code: ICD-10 code for diagnosis
            snomed_code: SNOMED CT code for diagnosis
            reasoning: AI reasoning text
            
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
        
        # Add AI metadata
        condition["_metadata"] = {
            "ai_provider": "ai-diagnosis-service",
            "confidence": confidence,
            "model_type": "diagnosis"
        }
        
        return condition
    
    @staticmethod
    def imaging_to_diagnostic_report(
        patient_id: str,
        findings: str,
        impression: str,
        confidence: float,
        procedure_code: Optional[str] = None,
        procedure_display: Optional[str] = None
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
            
        Returns:
            FHIR DiagnosticReport resource
        """
        report_id = f"report-{datetime.now().timestamp()}"
        
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
                        "code": procedure_code or "LP29708-2",
                        "display": procedure_display or "Radiology Study"
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
                "model_type": "imaging"
            }
        }
        
        # Add SNOMED CT codes for conclusion if available
        # This would typically come from the AI model
        report["_metadata"]["findings"] = findings
        report["_metadata"]["impression"] = impression
        
        return report
    
    @staticmethod
    def drug_interaction_to_observation(
        patient_id: str,
        drug_1: str,
        drug_2: str,
        interaction_severity: str,
        interaction_description: str,
        confidence: float
    ) -> Dict[str, Any]:
        """
        Convert drug interaction AI output to FHIR Observation resource.
        
        Args:
            patient_id: Patient identifier
            drug_1: First drug name/code
            drug_2: Second drug name/code
            interaction_severity: Severity level (mild, moderate, severe)
            interaction_description: Description of interaction
            confidence: AI confidence score (0-1)
            
        Returns:
            FHIR Observation resource
        """
        observation_id = f"drug-int-{datetime.now().timestamp()}"
        
        # Map severity to SNOMED CT codes
        severity_codes = {
            "mild": "255604002",
            "moderate": "6736007",
            "severe": "24484000",
            "contraindicated": "260413007"
        }
        
        observation = {
            "resourceType": "Observation",
            "id": observation_id,
            "meta": {
                "profile": ["https://afyahero.com/fhir/StructureDefinition/DrugInteraction"],
                "lastUpdated": datetime.now().isoformat()
            },
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "laboratory",
                            "display": "Laboratory"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "394822004",
                        "display": "Drug interaction"
                    }
                ],
                "text": f"Drug Interaction: {drug_1} + {drug_2}"
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "effectiveDateTime": datetime.now().isoformat(),
            "issued": datetime.now().isoformat(),
            "valueCodeableConcept": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": severity_codes.get(interaction_severity, "255604002"),
                        "display": interaction_severity
                    }
                ],
                "text": interaction_severity
            },
            "note": [
                {
                    "text": interaction_description
                }
            ],
            "component": [
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "37386000",
                                "display": "Drug"
                            }
                        ]
                    },
                    "valueCodeableConcept": {
                        "text": drug_1
                    }
                },
                {
                    "code": {
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": "37386000",
                                "display": "Drug"
                            }
                        ]
                    },
                    "valueCodeableConcept": {
                        "text": drug_2
                    }
                }
            ],
            "_metadata": {
                "ai_provider": "ai-pharmacy-service",
                "confidence": confidence,
                "model_type": "drug-interaction"
            }
        }
        
        return observation
    
    @staticmethod
    def create_fhir_bundle(resources: List[Dict[str, Any]], bundle_type: str = "collection") -> Dict[str, Any]:
        """
        Create a FHIR Bundle containing multiple resources.
        
        Args:
            resources: List of FHIR resources
            bundle_type: Bundle type (collection, document, message, etc.)
            
        Returns:
            FHIR Bundle resource
        """
        bundle_id = f"bundle-{datetime.now().timestamp()}"
        
        bundle = {
            "resourceType": "Bundle",
            "id": bundle_id,
            "type": bundle_type,
            "timestamp": datetime.now().isoformat(),
            "total": len(resources),
            "entry": [
                {
                    "fullUrl": f"{resource['resourceType']}/{resource['id']}",
                    "resource": resource
                }
                for resource in resources
            ]
        }
        
        return bundle


# Convenience functions for common use cases

def triage_to_fhir(
    patient_id: str,
    priority: int,
    priority_label: str,
    confidence: float,
    reasoning: str,
    **kwargs
) -> Dict[str, Any]:
    """Convert triage output to FHIR Observation."""
    return FHIROutputConverter.triage_to_observation(
        patient_id, priority, priority_label, confidence, reasoning, **kwargs
    )


def diagnosis_to_fhir(
    patient_id: str,
    diagnosis: str,
    confidence: float,
    **kwargs
) -> Dict[str, Any]:
    """Convert diagnosis output to FHIR Condition."""
    return FHIROutputConverter.diagnosis_to_condition(
        patient_id, diagnosis, confidence, **kwargs
    )


def imaging_to_fhir(
    patient_id: str,
    findings: str,
    impression: str,
    confidence: float,
    **kwargs
) -> Dict[str, Any]:
    """Convert imaging output to FHIR DiagnosticReport."""
    return FHIROutputConverter.imaging_to_diagnostic_report(
        patient_id, findings, impression, confidence, **kwargs
    )
