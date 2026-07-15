"""
ONNX Model Integration for AI Triage Service

Handles loading, quantization, and inference of offline AI models
for triage, diagnosis, and formulary lookup using ONNX Runtime.
"""

import os
import logging
from typing import Optional, Dict, Any
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import ONNX Runtime
try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
    logger.info("ONNX Runtime is available")
except ImportError:
    ONNX_AVAILABLE = False
    logger.warning("ONNX Runtime not available - offline AI will use fallbacks")

class ONNXModelManager:
    """Manages ONNX model loading and inference."""
    
    def __init__(self, models_dir: str = "/models"):
        self.models_dir = Path(models_dir)
        self.models: Dict[str, Any] = {}
        self.offline_mode = os.getenv("OFFLINE_MODE", "false").lower() == "true"
        
        if not ONNX_AVAILABLE:
            logger.warning("ONNX Runtime not installed - offline AI unavailable")
            return
        
        # Create models directory if it doesn't exist
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
    def load_model(self, model_name: str, model_path: Optional[str] = None) -> bool:
        """
        Load an ONNX model into memory.
        
        Args:
            model_name: Name/identifier for the model
            model_path: Path to ONNX model file (relative to models_dir)
        
        Returns:
            True if model loaded successfully, False otherwise
        """
        if not ONNX_AVAILABLE:
            return False
            
        try:
            if model_path is None:
                model_path = self.models_dir / model_name
            else:
                model_path = self.models_dir / model_path
            
            if not model_path.exists():
                logger.warning(f"Model file not found: {model_path}")
                return False
            
            # Create ONNX Runtime session with optimized settings
            session_options = ort.SessionOptions()
            session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            # Enable CPU optimizations
            providers = ['CPUExecutionProvider']
            
            session = ort.InferenceSession(
                str(model_path),
                sess_options=session_options,
                providers=providers
            )
            
            self.models[model_name] = {
                'session': session,
                'input_names': [input.name for input in session.get_inputs()],
                'output_names': [output.name for output in session.get_outputs()]
            }
            
            logger.info(f"Model loaded successfully: {model_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {str(e)}")
            return False
    
    def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory."""
        if model_name in self.models:
            del self.models[model_name]
            logger.info(f"Model unloaded: {model_name}")
            return True
        return False
    
    def is_model_loaded(self, model_name: str) -> bool:
        """Check if a model is loaded."""
        return model_name in self.models
    
    def get_loaded_models(self) -> list:
        """Get list of loaded model names."""
        return list(self.models.keys())
    
    def run_inference(
        self,
        model_name: str,
        inputs: Dict[str, np.ndarray]
    ) -> Optional[Dict[str, np.ndarray]]:
        """
        Run inference on a loaded model.
        
        Args:
            model_name: Name of the loaded model
            inputs: Dictionary of input names to numpy arrays
        
        Returns:
            Dictionary of output names to numpy arrays, or None if failed
        """
        if not ONNX_AVAILABLE:
            logger.error("ONNX Runtime not available")
            return None
        
        if model_name not in self.models:
            logger.error(f"Model not loaded: {model_name}")
            return None
        
        try:
            model = self.models[model_name]
            session = model['session']
            
            # Run inference
            outputs = session.run(
                model['output_names'],
                {name: inputs[name] for name in model['input_names']}
            )
            
            # Convert to dictionary
            output_dict = dict(zip(model['output_names'], outputs))
            
            return output_dict
            
        except Exception as e:
            logger.error(f"Inference failed for model {model_name}: {str(e)}")
            return None

class TriageModel(ONNXModelManager):
    """Triage-specific model manager."""
    
    MODEL_NAME = "phi-3-mini-4bit"
    MODEL_FILE = "triage/phi-3-mini-4bit.onnx"
    
    def __init__(self, models_dir: str = "/models"):
        super().__init__(models_dir)
        self._load_if_available()
    
    def _load_if_available(self):
        """Load triage model if available."""
        if self.offline_mode and ONNX_AVAILABLE:
            self.load_model(self.MODEL_NAME, self.MODEL_FILE)
    
    def predict_priority(
        self,
        patient_age: int,
        patient_gender: str,
        chief_complaint: str,
        vitals: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Predict triage priority using ONNX model.
        
        Args:
            patient_age: Patient age in years
            patient_gender: Patient gender
            chief_complaint: Chief complaint text
            vitals: Dictionary of vital signs
        
        Returns:
            Dictionary with priority score and reasoning, or None if model unavailable
        """
        if not self.is_model_loaded(self.MODEL_NAME):
            logger.warning("Triage model not loaded, using fallback")
            return None
        
        # TODO: Implement actual inference logic
        # This would:
        # 1. Tokenize input text
        # 2. Run ONNX inference
        # 3. Parse output to extract priority
        # 4. Return structured result
        
        # Placeholder for now
        return {
            "priority": 3,
            "priority_label": "Urgent (Yellow)",
            "confidence": 0.75,
            "reasoning": "ONNX model inference not yet implemented"
        }

class DiagnosisModel(ONNXModelManager):
    """Diagnosis-specific model manager."""
    
    MODEL_NAME = "mistral-7b-4bit"
    MODEL_FILE = "diagnosis/mistral-7b-4bit.onnx"
    
    def __init__(self, models_dir: str = "/models"):
        super().__init__(models_dir)
        self._load_if_available()
    
    def _load_if_available(self):
        """Load diagnosis model if available."""
        if self.offline_mode and ONNX_AVAILABLE:
            self.load_model(self.MODEL_NAME, self.MODEL_FILE)
    
    def predict_diagnosis(
        self,
        symptoms: list,
        history: str,
        lab_results: Optional[list] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Predict diagnosis using ONNX model.
        
        Args:
            symptoms: List of symptoms
            history: Patient history text
            lab_results: Optional lab results
        
        Returns:
            Dictionary with differential diagnosis and ICD-10 codes
        """
        if not self.is_model_loaded(self.MODEL_NAME):
            logger.warning("Diagnosis model not loaded, using fallback")
            return None
        
        # TODO: Implement actual inference logic
        return {
            "primary_diagnosis": "Pneumonia",
            "icd10_code": "J18.9",
            "confidence": 0.70,
            "differential": ["Bronchitis", "Asthma"],
            "reasoning": "ONNX model inference not yet implemented"
        }

class FormularyModel(ONNXModelManager):
    """Formulary lookup using embeddings."""
    
    MODEL_NAME = "clinical-bert-8bit"
    MODEL_FILE = "embeddings/clinical-bert-8bit.onnx"
    
    def __init__(self, models_dir: str = "/models"):
        super().__init__(models_dir)
        self._load_if_available()
    
    def _load_if_available(self):
        """Load embedding model if available."""
        if self.offline_mode and ONNX_AVAILABLE:
            self.load_model(self.MODEL_NAME, self.MODEL_FILE)
    
    def search_formulary(
        self,
        query: str,
        top_k: int = 5
    ) -> Optional[Dict[str, Any]]:
        """
        Search formulary using semantic similarity.
        
        Args:
            query: Drug name or description
            top_k: Number of results to return
        
        Returns:
            Dictionary with matching drugs and similarity scores
        """
        if not self.is_model_loaded(self.MODEL_NAME):
            logger.warning("Embedding model not loaded, using exact match")
            return None
        
        # TODO: Implement actual embedding generation and search
        # This would:
        # 1. Generate embedding for query
        # 2. Search local FAISS index
        # 3. Return top-k results
        
        return {
            "matches": [],
            "reasoning": "ONNX model inference not yet implemented"
        }

# Global model instances
triage_model: Optional[TriageModel] = None
diagnosis_model: Optional[DiagnosisModel] = None
formulary_model: Optional[FormularyModel] = None

def initialize_models(models_dir: str = "/models"):
    """Initialize all offline AI models."""
    global triage_model, diagnosis_model, formulary_model
    
    triage_model = TriageModel(models_dir)
    diagnosis_model = DiagnosisModel(models_dir)
    formulary_model = FormularyModel(models_dir)
    
    logger.info(f"Offline AI models initialized. Loaded: {len(triage_model.get_loaded_models())} triage, {len(diagnosis_model.get_loaded_models())} diagnosis, {len(formulary_model.get_loaded_models())} formulary")
    
    return {
        "triage": triage_model.is_model_loaded(TriageModel.MODEL_NAME),
        "diagnosis": diagnosis_model.is_model_loaded(DiagnosisModel.MODEL_NAME),
        "formulary": formulary_model.is_model_loaded(FormularyModel.MODEL_NAME)
    }

def get_model_status() -> Dict[str, bool]:
    """Get status of all models."""
    return {
        "onnx_available": ONNX_AVAILABLE,
        "triage_loaded": triage_model.is_model_loaded(TriageModel.MODEL_NAME) if triage_model else False,
        "diagnosis_loaded": diagnosis_model.is_model_loaded(DiagnosisModel.MODEL_NAME) if diagnosis_model else False,
        "formulary_loaded": formulary_model.is_model_loaded(FormularyModel.MODEL_NAME) if formulary_model else False,
        "offline_mode": os.getenv("OFFLINE_MODE", "false").lower() == "true"
    }
