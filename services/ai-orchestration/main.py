"""
AI Orchestration Service - AfyaHero
FastAPI microservice for workflow coordination using LangChain.

Port: 8007
Technology: FastAPI (Python) + LangChain
Purpose: Coordinate multi-step clinical workflows
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging
import os
from workflows import get_workflow, WORKFLOWS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Orchestration Service", version="1.0.0")

# ─── Models ────────────────────────────────────────────────────────────────────

class WorkflowRequest(BaseModel):
    workflow_type: str = Field(..., description="Type of workflow to execute")
    patient_data: Optional[Dict[str, Any]] = Field(None, description="Patient data for clinical workflows")
    imaging_data: Optional[Dict[str, Any]] = Field(None, description="Imaging data for radiology workflows")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Additional workflow parameters")

class WorkflowResponse(BaseModel):
    workflow_type: str
    status: str
    results: Dict[str, Any]
    execution_time_ms: int
    timestamp: str

class WorkflowListResponse(BaseModel):
    available_workflows: Dict[str, str]
    count: int

# ─── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-orchestration-service", "version": "1.0.0"}

@app.get("/workflows", response_model=WorkflowListResponse)
async def list_workflows():
    """List available workflows."""
    workflow_descriptions = {
        "triage-to-diagnosis": "Triage → Diagnosis → Drug Interaction Check (Initial patient assessment)",
        "imaging": "Imaging Analysis → Diagnosis Integration (Radiology/pathology)",
        "emergency": "Rapid Triage → Priority Actions (Emergency department)"
    }
    return WorkflowListResponse(
        available_workflows=workflow_descriptions,
        count=len(workflow_descriptions)
    )

@app.post("/orchestrate/workflow", response_model=WorkflowResponse)
async def orchestrate_workflow(request: WorkflowRequest):
    """
    Execute a multi-step workflow across AI services.
    
    Available workflows:
    - triage-to-diagnosis: Triage → Diagnosis → Drug Interaction Check
    - imaging: Imaging Analysis → Diagnosis Integration
    - emergency: Rapid Triage → Priority Actions
    """
    import time
    start_time = time.time()
    
    try:
        logger.info(f"Executing workflow: {request.workflow_type}")
        
        workflow = get_workflow(request.workflow_type)
        if not workflow:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown workflow type: {request.workflow_type}. Available: {list(WORKFLOWS.keys())}"
            )
        
        # Execute workflow with appropriate data
        if request.workflow_type == "triage-to-diagnosis":
            if not request.patient_data:
                raise HTTPException(status_code=400, detail="patient_data required for triage-to-diagnosis workflow")
            results = await workflow.execute(request.patient_data)
        elif request.workflow_type == "imaging":
            if not request.imaging_data:
                raise HTTPException(status_code=400, detail="imaging_data required for imaging workflow")
            results = await workflow.execute(request.imaging_data)
        elif request.workflow_type == "emergency":
            if not request.patient_data:
                raise HTTPException(status_code=400, detail="patient_data required for emergency workflow")
            results = await workflow.execute(request.patient_data)
        else:
            results = await workflow.execute(request.patient_data or request.imaging_data or {})
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        logger.info(f"Workflow {request.workflow_type} completed in {execution_time_ms}ms")
        
        return WorkflowResponse(
            workflow_type=request.workflow_type,
            status="completed",
            results=results,
            execution_time_ms=execution_time_ms,
            timestamp=time.time()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Workflow execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/orchestrate/chain")
async def orchestrate_chain(request: dict):
    """
    Execute a custom chain of AI service calls.
    
    Allows building custom workflows on the fly.
    
    Example:
    {
      "steps": [
        {"service": "triage", "endpoint": "/triage/analyze", "data": {...}},
        {"service": "diagnosis", "endpoint": "/diagnosis/analyze", "data": {...}}
      ]
    }
    """
    return {"status": "not implemented - use predefined workflows for now"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8007))
    uvicorn.run(app, host="0.0.0.0", port=port)
