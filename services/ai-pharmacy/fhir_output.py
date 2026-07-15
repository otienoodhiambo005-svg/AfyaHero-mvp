"""
FHIR-Compliant Output Module for AI Pharmacy Service
Converts AI pharmacy outputs to FHIR R4 Observation and MedicationRequest resources.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime


class FHIRPharmacyOutputConverter:
    """Converts AI pharmacy outputs to FHIR-compliant resources"""
    
    @staticmethod
    def drug_interaction_to_observation(
        patient_id: str,
        drug_1: str,
        drug_2: str,
        interaction_severity: str,
        interaction_description: str,
        confidence: float,
        drug_1_code: Optional[str] = None,
        drug_2_code: Optional[str] = None,
        clinical_recommendation: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert drug interaction AI output to FHIR Observation resource.
        
        Args:
            patient_id: Patient identifier
            drug_1: First drug name/code
            drug_2: Second drug name/code
            interaction_severity: Severity level (mild, moderate, severe, contraindicated)
            interaction_description: Description of interaction
            confidence: AI confidence score (0-1)
            drug_1_code: SNOMED CT or RxNorm code for drug 1
            drug_2_code: SNOMED CT or RxNorm code for drug 2
            clinical_recommendation: Clinical recommendation for managing interaction
            
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
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": drug_1_code or "UNKNOWN",
                                "display": drug_1
                            }
                        ] if drug_1_code else {"text": drug_1}
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
                        "coding": [
                            {
                                "system": "http://snomed.info/sct",
                                "code": drug_2_code or "UNKNOWN",
                                "display": drug_2
                            }
                        ] if drug_2_code else {"text": drug_2}
                    }
                }
            ],
            "_metadata": {
                "ai_provider": "ai-pharmacy-service",
                "confidence": confidence,
                "model_type": "drug-interaction",
                "clinical_recommendation": clinical_recommendation
            }
        }
        
        # Add clinical recommendation as note
        if clinical_recommendation:
            observation["note"].append({
                "text": f"Clinical Recommendation: {clinical_recommendation}"
            })
        
        return observation
    
    @staticmethod
    def formulary_lookup_to_medication_knowledge(
        drug_name: str,
        available: bool,
        alternatives: Optional[List[str]] = None,
        formulary_status: Optional[str] = None,
        confidence: float = 1.0
    ) -> Dict[str, Any]:
        """
        Convert formulary lookup to FHIR MedicationKnowledge resource.
        
        Args:
            drug_name: Name of the drug
            available: Whether drug is available in formulary
            alternatives: List of alternative drugs
            formulary_status: Formulary status (e.g., "preferred", "non-preferred", "restricted")
            confidence: AI confidence score (0-1)
            
        Returns:
            FHIR MedicationKnowledge resource
        """
        knowledge_id = f"med-knowledge-{datetime.now().timestamp()}"
        
        medication_knowledge = {
            "resourceType": "MedicationKnowledge",
            "id": knowledge_id,
            "meta": {
                "profile": ["https://afyahero.com/fhir/StructureDefinition/FormularyLookup"],
                "lastUpdated": datetime.now().isoformat()
            },
            "status": "active" if available else "inactive",
            "code": {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": "37386000",
                        "display": drug_name
                    }
                ],
                "text": drug_name
            },
            "contraindication": [],
            "monitoringProgram": [],
            "_metadata": {
                "ai_provider": "ai-pharmacy-service",
                "confidence": confidence,
                "model_type": "formulary-lookup",
                "formulary_status": formulary_status,
                "available": available
            }
        }
        
        # Add alternatives if available
        if alternatives:
            medication_knowledge["relatedMedicationKnowledge"] = [
                {
                    "type": "alternatives",
                    "reference": f"MedicationKnowledge/{alt}"
                }
                for alt in alternatives
            ]
        
        return medication_knowledge


def drug_interaction_to_fhir(
    patient_id: str,
    drug_1: str,
    drug_2: str,
    interaction_severity: str,
    interaction_description: str,
    confidence: float,
    **kwargs
) -> Dict[str, Any]:
    """Convenience function to convert drug interaction to FHIR."""
    return FHIRPharmacyOutputConverter.drug_interaction_to_observation(
        patient_id, drug_1, drug_2, interaction_severity, 
        interaction_description, confidence, **kwargs
    )


def formulary_to_fhir(
    drug_name: str,
    available: bool,
    **kwargs
) -> Dict[str, Any]:
    """Convenience function to convert formulary lookup to FHIR."""
    return FHIRPharmacyOutputConverter.formulary_lookup_to_medication_knowledge(
        drug_name, available, **kwargs
    )
