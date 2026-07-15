"""
LangChain Workflow Orchestration for AfyaHero

Defines custom LangChain tools and workflows for AI service coordination.
"""

from langchain.tools import tool
from langchain.schema.runnable import RunnablePassthrough
from langchain.chains import SequentialChain
import httpx
import os
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Service URLs from environment
TRIAGE_SERVICE_URL = os.getenv("TRIAGE_SERVICE_URL", "http://localhost:8001")
DIAGNOSIS_SERVICE_URL = os.getenv("DIAGNOSIS_SERVICE_URL", "http://localhost:8002")
IMAGING_SERVICE_URL = os.getenv("IMAGING_SERVICE_URL", "http://localhost:8003")
BILLING_SERVICE_URL = os.getenv("BILLING_SERVICE_URL", "http://localhost:8004")
OPERATIONAL_SERVICE_URL = os.getenv("OPERATIONAL_SERVICE_URL", "http://localhost:8005")
PHARMACY_SERVICE_URL = os.getenv("PHARMACY_SERVICE_URL", "http://localhost:8006")

# ─── Custom Tools ─────────────────────────────────────────────────────────────

@tool
async def ai_triage_analyze(patient_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform AI triage analysis on patient data.
    
    Args:
        patient_data: Dictionary containing patient information (age, gender, chief complaint, vitals)
    
    Returns:
        Triage priority score and recommendations
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{TRIAGE_SERVICE_URL}/triage/analyze",
                json=patient_data
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Triage service error: {str(e)}")
        return {"error": str(e), "priority": 3, "priority_label": "Urgent (Yellow)"}

@tool
async def ai_diagnosis_analyze(patient_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform AI diagnosis analysis on patient data.
    
    Args:
        patient_data: Dictionary containing symptoms, history, lab results
    
    Returns:
        Differential diagnosis and ICD-10 codes
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{DIAGNOSIS_SERVICE_URL}/diagnosis/analyze",
                json=patient_data
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Diagnosis service error: {str(e)}")
        return {"error": str(e)}

@tool
async def ai_imaging_analyze(imaging_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze medical imaging (X-ray, CT, MRI).
    
    Args:
        imaging_data: Dictionary containing image URI and clinical context
    
    Returns:
        Imaging analysis and findings
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{IMAGING_SERVICE_URL}/imaging/analyze-xray",
                json=imaging_data
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Imaging service error: {str(e)}")
        return {"error": str(e)}

@tool
async def ai_pharmacy_check_interactions(medications: list, patient_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Check for drug interactions.
    
    Args:
        medications: List of medication names
        patient_data: Patient age, weight, conditions
    
    Returns:
        Drug interaction warnings and recommendations
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{PHARMACY_SERVICE_URL}/pharmacy/check-drug-interaction",
                json={"medications": medications, **patient_data}
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Pharmacy service error: {str(e)}")
        return {"error": str(e)}

@tool
async def ai_pharmacy_formulary_lookup(drug_name: str) -> Dict[str, Any]:
    """
    Look up drug in formulary (offline-capable).
    
    Args:
        drug_name: Name of the drug to look up
    
    Returns:
        Drug information, availability, and alternatives
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{PHARMACY_SERVICE_URL}/pharmacy/formulary-lookup",
                json={"drugName": drug_name}
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Formulary lookup error: {str(e)}")
        return {"error": str(e)}

# ─── Workflow Definitions ───────────────────────────────────────────────────────

class ClinicalWorkflow:
    """Base class for clinical workflows."""
    
    def __init__(self):
        self.tools = [
            ai_triage_analyze,
            ai_diagnosis_analyze,
            ai_pharmacy_check_interactions,
            ai_pharmacy_formulary_lookup,
        ]

class TriageToDiagnosisWorkflow(ClinicalWorkflow):
    """
    Workflow: Triage → Diagnosis → Drug Interaction Check
    
    Use case: Initial patient assessment
    """
    
    async def execute(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the triage-to-diagnosis workflow.
        
        Steps:
        1. Perform triage
        2. If priority ≤ 3, perform diagnosis
        3. Check drug interactions if medications prescribed
        """
        results = {}
        
        # Step 1: Triage
        triage_result = await ai_triage_analyze.func(patient_data)
        results["triage"] = triage_result
        
        # Step 2: Diagnosis (only if urgent or higher priority)
        if triage_result.get("priority", 5) <= 3:
            diagnosis_result = await ai_diagnosis_analyze.func(patient_data)
            results["diagnosis"] = diagnosis_result
        
        # Step 3: Drug interaction check (if medications present)
        if patient_data.get("currentMedications"):
            interaction_result = await ai_pharmacy_check_interactions.func(
                patient_data["currentMedications"],
                patient_data
            )
            results["drug_interactions"] = interaction_result
        
        return results

class ImagingWorkflow(ClinicalWorkflow):
    """
    Workflow: Imaging Analysis → Diagnosis Integration
    
    Use case: Radiology/pathology assessment
    """
    
    async def execute(self, imaging_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute imaging workflow.
        
        Steps:
        1. Analyze imaging
        2. Integrate findings with clinical context
        """
        results = {}
        
        # Step 1: Image analysis
        imaging_result = await ai_imaging_analyze.func(imaging_data)
        results["imaging"] = imaging_result
        
        # Step 2: Could integrate with diagnosis if patient data available
        # (implementation depends on specific use case)
        
        return results

class EmergencyWorkflow(ClinicalWorkflow):
    """
    Workflow: Rapid Triage → Priority Actions
    
    Use case: Emergency department rapid assessment
    """
    
    async def execute(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute emergency workflow.
        
        Steps:
        1. Quick triage (priority score only)
        2. Immediate action recommendations
        """
        results = {}
        
        # Use priority score endpoint for speed
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{TRIAGE_SERVICE_URL}/triage/priority-score",
                json=patient_data
            )
            response.raise_for_status()
            results["priority_score"] = response.json()
        
        # Generate immediate actions based on priority
        priority = results["priority_score"].get("priority", 3)
        if priority <= 2:
            results["immediate_actions"] = [
                "Alert emergency team",
                "Prepare resuscitation equipment",
                "Establish IV access",
                "Monitor vitals continuously"
            ]
        else:
            results["immediate_actions"] = [
                "Standard assessment protocol",
                "Monitor vitals every 15 minutes"
            ]
        
        return results

# ─── Workflow Registry ─────────────────────────────────────────────────────────

WORKFLOWS = {
    "triage-to-diagnosis": TriageToDiagnosisWorkflow,
    "imaging": ImagingWorkflow,
    "emergency": EmergencyWorkflow,
}

def get_workflow(workflow_name: str) -> Optional[ClinicalWorkflow]:
    """Get a workflow by name."""
    workflow_class = WORKFLOWS.get(workflow_name)
    if workflow_class:
        return workflow_class()
    return None
