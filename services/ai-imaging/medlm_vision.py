"""
Google MedLM Vision Integration for AfyaHero
Handles medical image analysis using Google's MedLM Vision model for radiology and pathology.
"""

import os
import logging
import base64
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    print("httpx not available. Install with: pip install httpx")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MedLMVisionClient:
    """Client for Google MedLM Vision API"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "medlm-vision-1.0"
    ):
        """
        Initialize MedLM Vision client.
        
        Args:
            api_key: Google Cloud API key for MedLM Vision
            model: Model name (default: medlm-vision-1.0)
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model = model
        self.api_endpoint = "https://generativelanguage.googleapis.com/v1beta/models/medlm-vision:generateContent"
        
        if not self.api_key:
            logger.warning("Google MedLM Vision API key not configured")
        
        self.client = None
        if HTTPX_AVAILABLE and self.api_key:
            self.client = httpx.AsyncClient(timeout=60.0)
            logger.info(f"MedLM Vision client initialized with model: {model}")
    
    async def analyze_medical_image(
        self,
        image_data: bytes,
        image_format: str = "png",
        prompt: Optional[str] = None,
        modality: Optional[str] = None,
        body_part: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a medical image using MedLM Vision.
        
        Args:
            image_data: Binary image data
            image_format: Image format (png, jpeg, etc.)
            prompt: Optional analysis prompt
            modality: Imaging modality (CT, MRI, X-ray, etc.)
            body_part: Body part imaged (chest, brain, abdomen, etc.)
            
        Returns:
            Dictionary with analysis results
        """
        if not self.client:
            return {
                "success": False,
                "error": "MedLM Vision client not initialized"
            }
        
        try:
            # Encode image to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # Build prompt
            if not prompt:
                prompt = self._build_default_prompt(modality, body_part)
            
            # Prepare request
            request_data = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": prompt
                            },
                            {
                                "inline_data": {
                                    "mime_type": f"image/{image_format}",
                                    "data": base64_image
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "topK": 32,
                    "topP": 0.95,
                    "maxOutputTokens": 2048
                }
            }
            
            # Make API request
            url = f"{self.api_endpoint}?key={self.api_key}"
            response = await self.client.post(url, json=request_data)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract analysis
            analysis = self._parse_analysis_result(result)
            
            logger.info(f"Medical image analysis completed")
            
            return {
                "success": True,
                "analysis": analysis,
                "model": self.model,
                "modality": modality,
                "body_part": body_part,
                "timestamp": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to analyze medical image: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _build_default_prompt(self, modality: Optional[str], body_part: Optional[str]) -> str:
        """Build default analysis prompt based on modality and body part."""
        prompt_parts = [
            "Analyze this medical image as a radiologist would.",
            "Provide a detailed clinical assessment including:",
            "- Findings",
            "- Abnormalities",
            "- Potential diagnosis",
            "- Clinical significance",
            "- Recommendations for follow-up"
        ]
        
        if modality:
            prompt_parts.append(f"\nImaging modality: {modality}")
        
        if body_part:
            prompt_parts.append(f"Body part: {body_part}")
        
        prompt_parts.append("\nFormat your response in a structured manner suitable for clinical documentation.")
        
        return "\n".join(prompt_parts)
    
    def _parse_analysis_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse the API response into structured analysis."""
        analysis = {
            "raw_text": "",
            "findings": [],
            "abnormalities": [],
            "impression": "",
            "recommendations": []
        }
        
        try:
            if "candidates" in result and result["candidates"]:
                candidate = result["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    text_parts = []
                    for part in candidate["content"]["parts"]:
                        if "text" in part:
                            text_parts.append(part["text"])
                    
                    analysis["raw_text"] = " ".join(text_parts)
                    
                    # Parse structured sections
                    lines = analysis["raw_text"].split("\n")
                    current_section = None
                    
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        
                        # Detect section headers
                        if "findings" in line.lower():
                            current_section = "findings"
                        elif "abnormalit" in line.lower():
                            current_section = "abnormalities"
                        elif "impression" in line.lower():
                            current_section = "impression"
                        elif "recommend" in line.lower():
                            current_section = "recommendations"
                        elif current_section and line.startswith("-"):
                            # List item
                            content = line[1:].strip()
                            analysis[current_section].append(content)
                        elif current_section:
                            # Continuation of section
                            analysis[current_section][-1] += " " + line
                        else:
                            # General text
                            if not analysis["findings"]:
                                analysis["findings"].append(line)
        
        except Exception as e:
            logger.error(f"Failed to parse analysis result: {str(e)}")
            analysis["parse_error"] = str(e)
        
        return analysis
    
    async def detect_abnormalities(
        self,
        image_data: bytes,
        image_format: str = "png",
        abnormality_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Detect specific abnormalities in medical image.
        
        Args:
            image_data: Binary image data
            image_format: Image format
            abnormality_types: List of abnormality types to detect (e.g., ["nodule", "mass", "fracture"])
            
        Returns:
            Dictionary with detected abnormalities
        """
        if not abnormality_types:
            abnormality_types = ["nodule", "mass", "fracture", "effusion", "consolidation"]
        
        prompt = f"""
        Analyze this medical image for the following abnormalities:
        {', '.join(abnormality_types)}
        
        For each abnormality detected, provide:
        - Type
        - Location
        - Size (if measurable)
        - Severity
        - Clinical significance
        
        Format as a structured list.
        """
        
        result = await self.analyze_medical_image(
            image_data=image_data,
            image_format=image_format,
            prompt=prompt
        )
        
        if result.get("success"):
            result["abnormality_types"] = abnormality_types
        
        return result
    
    async def generate_report(
        self,
        image_data: bytes,
        image_format: str = "png",
        patient_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a complete radiology report.
        
        Args:
            image_data: Binary image data
            image_format: Image format
            patient_context: Patient context (age, gender, clinical history)
            
        Returns:
            Dictionary with generated report
        """
        prompt_parts = [
            "Generate a complete radiology report for this medical image.",
            "Include the following sections:",
            "- Clinical Information",
            "- Technique",
            "- Findings",
            "- Impression",
            "- Recommendations"
        ]
        
        if patient_context:
            prompt_parts.append("\nPatient Context:")
            for key, value in patient_context.items():
                prompt_parts.append(f"- {key}: {value}")
        
        prompt_parts.append("\nUse standard radiology terminology and format.")
        
        prompt = "\n".join(prompt_parts)
        
        result = await self.analyze_medical_image(
            image_data=image_data,
            image_format=image_format,
            prompt=prompt
        )
        
        if result.get("success"):
            result["patient_context"] = patient_context
        
        return result
    
    async def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the MedLM Vision model.
        
        Returns:
            Dictionary with model information
        """
        return {
            "model": self.model,
            "provider": "Google Cloud",
            "type": "Vision Language Model",
            "capabilities": [
                "Medical image analysis",
                "Radiology report generation",
                "Abnormality detection",
                "Clinical finding extraction"
            ],
            "supported_modalities": [
                "X-ray",
                "CT",
                "MRI",
                "Ultrasound",
                "Mammography"
            ],
            "timestamp": datetime.now().isoformat()
        }


class MedLMVisionAnalyzer:
    """High-level analyzer for medical images using MedLM Vision"""
    
    def __init__(self):
        """Initialize MedLM Vision analyzer."""
        self.client = MedLMVisionClient()
    
    async def analyze_chest_xray(
        self,
        image_data: bytes,
        patient_age: Optional[int] = None,
        patient_gender: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a chest X-ray specifically.
        
        Args:
            image_data: Binary image data
            patient_age: Patient age in years
            patient_gender: Patient gender (M/F)
            
        Returns:
            Dictionary with chest X-ray analysis
        """
        patient_context = {}
        if patient_age:
            patient_context["age"] = patient_age
        if patient_gender:
            patient_context["gender"] = patient_gender
        
        result = await self.client.generate_report(
            image_data=image_data,
            image_format="jpeg",
            patient_context=patient_context
        )
        
        if result.get("success"):
            result["modality"] = "X-ray"
            result["body_part"] = "chest"
        
        return result
    
    async def analyze_brain_mri(
        self,
        image_data: bytes,
        sequence_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a brain MRI specifically.
        
        Args:
            image_data: Binary image data
            sequence_type: MRI sequence type (T1, T2, FLAIR, DWI, etc.)
            
        Returns:
            Dictionary with brain MRI analysis
        """
        prompt = f"""
        Analyze this brain MRI image.
        Sequence type: {sequence_type or 'Not specified'}
        
        Provide detailed assessment of:
        - Brain parenchyma
        - Ventricles
        - Sulci and gyri
        - Any lesions, masses, or abnormalities
        - Vascular structures
        
        Include measurements where relevant.
        """
        
        result = await self.client.analyze_medical_image(
            image_data=image_data,
            image_format="jpeg",
            prompt=prompt,
            modality="MRI",
            body_part="brain"
        )
        
        if result.get("success"):
            result["sequence_type"] = sequence_type
        
        return result
    
    async def batch_analyze(
        self,
        images: List[tuple[bytes, str]],
        modality: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyze multiple images in batch.
        
        Args:
            images: List of (image_data, image_format) tuples
            modality: Common modality for all images
            
        Returns:
            List of analysis results
        """
        results = []
        
        for image_data, image_format in images:
            result = await self.client.analyze_medical_image(
                image_data=image_data,
                image_format=image_format,
                modality=modality
            )
            results.append(result)
        
        return results


# Convenience functions

async def analyze_medical_image(
    image_data: bytes,
    image_format: str = "png",
    **kwargs
) -> Dict[str, Any]:
    """Convenience function to analyze a medical image."""
    client = MedLMVisionClient()
    return await client.analyze_medical_image(image_data, image_format, **kwargs)


async def get_medlm_info() -> Dict[str, Any]:
    """Get MedLM Vision model information."""
    client = MedLMVisionClient()
    return await client.get_model_info()
