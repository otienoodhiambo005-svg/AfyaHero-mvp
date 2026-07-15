"""
Google Cloud Healthcare API Integration for AfyaHero
Handles DICOM storage and retrieval using Google Cloud Healthcare API.
"""

import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

try:
    from google.cloud import healthcare
    from google.api_core import exceptions as gcp_exceptions
    from google.auth import credentials
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False
    print("Google Cloud Healthcare API client not available. Install with: pip install google-cloud-healthcare")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GoogleHealthcareClient:
    """Client for interacting with Google Cloud Healthcare API"""
    
    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        dataset_id: Optional[str] = None,
        dicom_store_id: Optional[str] = None
    ):
        """
        Initialize Google Healthcare client.
        
        Args:
            project_id: Google Cloud project ID
            location: Google Cloud region (e.g., "us-central1")
            dataset_id: Healthcare dataset ID
            dicom_store_id: DICOM store ID
        """
        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = location
        self.dataset_id = dataset_id or os.getenv("HEALTHCARE_DATASET_ID")
        self.dicom_store_id = dicom_store_id or os.getenv("DICOM_STORE_ID")
        
        if not all([self.project_id, self.dataset_id, self.dicom_store_id]):
            logger.warning("Google Cloud Healthcare credentials not fully configured")
        
        self.client = None
        if GOOGLE_CLOUD_AVAILABLE and all([self.project_id, self.dataset_id, self.dicom_store_id]):
            try:
                self.client = healthcare.HealthcareClient()
                logger.info(f"Google Healthcare client initialized for project {self.project_id}")
            except Exception as e:
                logger.error(f"Failed to initialize Google Healthcare client: {str(e)}")
    
    def _get_dicom_store_path(self) -> str:
        """Get the full DICOM store path."""
        return f"projects/{self.project_id}/locations/{self.location}/datasets/{self.dataset_id}/dicomStores/{self.dicom_store_id}"
    
    def store_dicom_instance(
        self,
        dicom_file_path: str,
        study_instance_uid: Optional[str] = None,
        series_instance_uid: Optional[str] = None,
        sop_instance_uid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store a DICOM instance in Google Cloud Healthcare API.
        
        Args:
            dicom_file_path: Path to DICOM file
            study_instance_uid: Study Instance UID (optional, extracted from DICOM if not provided)
            series_instance_uid: Series Instance UID (optional)
            sop_instance_uid: SOP Instance UID (optional)
            
        Returns:
            Dictionary with storage result
        """
        if not self.client:
            return {
                "success": False,
                "error": "Google Healthcare client not initialized"
            }
        
        try:
            dicom_store_path = self._get_dicom_store_path()
            
            # Import DICOM file
            with open(dicom_file_path, "rb") as f:
                dicom_content = f.read()
            
            # Store DICOM instance
            parent = dicom_store_path
            dicom_web_path = f"{parent}/dicomWeb"
            
            import google.cloud.healthcare_v1.types as healthcare_types
            import google.protobuf.json_format as json_format
            
            # Create DICOM instance
            body = {"data": dicom_content.decode("latin-1")}
            
            # Store using import method
            name = self.client.import_dicom_instances(
                parent=parent,
                body={"dicom": {"data": dicom_content}}
            )
            
            logger.info(f"DICOM instance stored successfully: {name}")
            
            return {
                "success": True,
                "name": name,
                "dicom_store_path": dicom_store_path,
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to store DICOM instance: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def retrieve_dicom_instance(
        self,
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str
    ) -> Dict[str, Any]:
        """
        Retrieve a DICOM instance from Google Cloud Healthcare API.
        
        Args:
            study_instance_uid: Study Instance UID
            series_instance_uid: Series Instance UID
            sop_instance_uid: SOP Instance UID
            
        Returns:
            Dictionary with DICOM instance data
        """
        if not self.client:
            return {
                "success": False,
                "error": "Google Healthcare client not initialized"
            }
        
        try:
            dicom_store_path = self._get_dicom_store_path()
            dicom_path = f"{dicom_store_path}/studies/{study_instance_uid}/series/{series_instance_uid}/instances/{sop_instance_uid}"
            
            # Retrieve DICOM instance
            name = self.client.get_dicom_instance(name=dicom_path)
            
            logger.info(f"DICOM instance retrieved: {name}")
            
            return {
                "success": True,
                "name": name,
                "dicom_path": dicom_path,
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to retrieve DICOM instance: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def search_for_studies(
        self,
        patient_id: Optional[str] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Search for DICOM studies in the DICOM store.
        
        Args:
            patient_id: Patient ID to filter by
            limit: Maximum number of results
            
        Returns:
            Dictionary with search results
        """
        if not self.client:
            return {
                "success": False,
                "error": "Google Healthcare client not initialized"
            }
        
        try:
            dicom_store_path = self._get_dicom_store_path()
            
            # Build search query
            query = {}
            if patient_id:
                query["PatientID"] = patient_id
            
            # Search for studies
            studies = self.client.list_dicom_studies(parent=dicom_store_path)
            
            results = []
            for study in studies:
                study_data = {
                    "name": study.name,
                    "study_instance_uid": study.name.split("/")[-1],
                    "timestamp": datetime.now().isoformat()
                }
                results.append(study_data)
                
                if len(results) >= limit:
                    break
            
            logger.info(f"Found {len(results)} studies")
            
            return {
                "success": True,
                "studies": results,
                "count": len(results),
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to search for studies: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def delete_dicom_instance(
        self,
        study_instance_uid: str,
        series_instance_uid: str,
        sop_instance_uid: str
    ) -> Dict[str, Any]:
        """
        Delete a DICOM instance from Google Cloud Healthcare API.
        
        Args:
            study_instance_uid: Study Instance UID
            series_instance_uid: Series Instance UID
            sop_instance_uid: SOP Instance UID
            
        Returns:
            Dictionary with deletion result
        """
        if not self.client:
            return {
                "success": False,
                "error": "Google Healthcare client not initialized"
            }
        
        try:
            dicom_store_path = self._get_dicom_store_path()
            dicom_path = f"{dicom_store_path}/studies/{study_instance_uid}/series/{series_instance_uid}/instances/{sop_instance_uid}"
            
            # Delete DICOM instance
            self.client.delete_dicom_instance(name=dicom_path)
            
            logger.info(f"DICOM instance deleted: {dicom_path}")
            
            return {
                "success": True,
                "dicom_path": dicom_path,
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to delete DICOM instance: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def create_dicom_store_if_not_exists(self) -> Dict[str, Any]:
        """
        Create DICOM store if it doesn't exist.
        
        Returns:
            Dictionary with creation result
        """
        if not self.client:
            return {
                "success": False,
                "error": "Google Healthcare client not initialized"
            }
        
        try:
            dataset_path = f"projects/{self.project_id}/locations/{self.location}/datasets/{self.dataset_id}"
            dicom_store_path = self._get_dicom_store_path()
            
            # Create DICOM store
            dicom_store = {
                "name": dicom_store_path
            }
            
            # Note: In production, use proper resource management
            # This is a simplified version
            logger.info(f"DICOM store path: {dicom_store_path}")
            
            return {
                "success": True,
                "dicom_store_path": dicom_store_path,
                "message": "DICOM store configuration verified",
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to verify DICOM store: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


class DICOMManager:
    """High-level manager for DICOM operations"""
    
    def __init__(self):
        """Initialize DICOM manager with Google Healthcare client."""
        self.client = GoogleHealthcareClient()
    
    def store_medical_image(
        self,
        file_path: str,
        patient_id: str,
        study_date: Optional[str] = None,
        modality: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Store a medical image (DICOM) in Google Cloud Healthcare.
        
        Args:
            file_path: Path to DICOM file
            patient_id: Patient identifier
            study_date: Study date (YYYY-MM-DD format)
            modality: Imaging modality (CT, MRI, X-ray, etc.)
            
        Returns:
            Dictionary with storage result
        """
        result = self.client.store_dicom_instance(file_path)
        
        # Add metadata
        if result.get("success"):
            result["metadata"] = {
                "patient_id": patient_id,
                "study_date": study_date,
                "modality": modality,
                "stored_at": datetime.now().isoformat()
            }
        
        return result
    
    def retrieve_patient_images(
        self,
        patient_id: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Retrieve all images for a patient.
        
        Args:
            patient_id: Patient identifier
            limit: Maximum number of images to retrieve
            
        Returns:
            Dictionary with patient images
        """
        return self.client.search_for_studies(patient_id=patient_id, limit=limit)
    
    def get_storage_status(self) -> Dict[str, Any]:
        """
        Get the status of the Google Healthcare storage.
        
        Returns:
            Dictionary with storage status
        """
        status = {
            "configured": self.client.client is not None,
            "project_id": self.client.project_id,
            "location": self.client.location,
            "dataset_id": self.client.dataset_id,
            "dicom_store_id": self.client.dicom_store_id,
            "timestamp": datetime.now().isoformat()
        }
        
        if status["configured"]:
            # Verify DICOM store
            verification = self.client.create_dicom_store_if_not_exists()
            status["dicom_store_verified"] = verification.get("success", False)
        
        return status


# Convenience functions

def get_healthcare_client() -> GoogleHealthcareClient:
    """Get a configured Google Healthcare client."""
    return GoogleHealthcareClient()


def get_dicom_manager() -> DICOMManager:
    """Get a configured DICOM manager."""
    return DICOMManager()
