"""
Offline AI Model Setup Script for AfyaHero

Downloads, quantizes, and prepares AI models for edge deployment.
Supports triage (Phi-3 Mini), diagnosis (Mistral 7B), and formulary (ClinicalBERT).
"""

import os
import sys
import logging
import argparse
from pathlib import Path
import subprocess
import json
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Model configurations
MODELS = {
    "triage": {
        "name": "Phi-3 Mini",
        "huggingface_id": "microsoft/Phi-3-mini-128k-instruct-onnx",
        "quantization": "4bit",
        "target_size_gb": 1.5,
        "output_dir": "models/triage",
        "filename": "phi-3-mini-4bit.onnx"
    },
    "diagnosis": {
        "name": "Mistral 7B",
        "huggingface_id": "mistralai/Mistral-7B-Instruct-v0.3",
        "quantization": "4bit",
        "target_size_gb": 3.5,
        "output_dir": "models/diagnosis",
        "filename": "mistral-7b-4bit.onnx"
    },
    "embeddings": {
        "name": "ClinicalBERT",
        "huggingface_id": "emilyalsentzer/Bio_ClinicalBERT",
        "quantization": "8bit",
        "target_size_gb": 0.4,
        "output_dir": "models/embeddings",
        "filename": "clinical-bert-8bit.onnx"
    }
}

def check_dependencies() -> bool:
    """Check if required dependencies are installed."""
    required_packages = ["torch", "transformers", "onnx", "onnxruntime"]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        logger.error(f"Missing required packages: {', '.join(missing)}")
        logger.error("Install with: pip install torch transformers onnx onnxruntime")
        return False
    
    return True

def download_model(model_id: str, output_dir: str) -> bool:
    """
    Download a model from HuggingFace.
    
    Args:
        model_id: HuggingFace model ID
        output_dir: Directory to save the model
    
    Returns:
        True if successful, False otherwise
    """
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        
        logger.info(f"Downloading model: {model_id}")
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Download tokenizer
        logger.info("Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        tokenizer.save_pretrained(output_path)
        
        # Download model (if not already ONNX)
        if "onnx" not in model_id.lower():
            logger.info("Downloading model weights...")
            model = AutoModelForCausalLM.from_pretrained(
                model_id,
                trust_remote_code=True,
                torch_dtype="auto"
            )
            model.save_pretrained(output_path)
        
        logger.info(f"Model downloaded successfully to {output_dir}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to download model {model_id}: {str(e)}")
        return False

def convert_to_onnx(model_dir: str, output_file: str, quantization: str = "4bit") -> bool:
    """
    Convert a PyTorch model to ONNX format with quantization.
    
    Args:
        model_dir: Directory containing the PyTorch model
        output_file: Output ONNX file path
        quantization: Quantization level ("4bit", "8bit")
    
    Returns:
        True if successful, False otherwise
    """
    try:
        import torch
        from transformers import AutoModelForCausalLM
        
        logger.info(f"Converting model to ONNX with {quantization} quantization...")
        
        # Load model
        model_path = Path(model_dir)
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype="auto",
            trust_remote_code=True
        )
        model.eval()
        
        # Create dummy input
        dummy_input = {
            "input_ids": torch.randint(0, 32000, (1, 128), dtype=torch.long),
            "attention_mask": torch.ones((1, 128), dtype=torch.long)
        }
        
        # Export to ONNX
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        torch.onnx.export(
            model,
            (dummy_input["input_ids"], dummy_input["attention_mask"]),
            str(output_path),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size", 1: "sequence_length"},
                "attention_mask": {0: "batch_size", 1: "sequence_length"},
                "logits": {0: "batch_size", 1: "sequence_length"}
            },
            opset_version=14
        )
        
        logger.info(f"Model exported to ONNX: {output_file}")
        
        # Apply quantization if requested
        if quantization == "4bit":
            logger.info("Applying 4-bit quantization...")
            quantize_onnx_4bit(str(output_file), str(output_file))
        elif quantization == "8bit":
            logger.info("Applying 8-bit quantization...")
            quantize_onnx_8bit(str(output_file), str(output_file))
        
        # Verify file size
        file_size_gb = output_path.stat().st_size / (1024**3)
        logger.info(f"Final model size: {file_size_gb:.2f} GB")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to convert model to ONNX: {str(e)}")
        return False

def quantize_onnx_4bit(onnx_path: str, output_path: str) -> bool:
    """Apply 4-bit quantization to ONNX model using ONNX Runtime."""
    try:
        import onnx
        from onnxruntime.quantization import quantize_dynamic, QuantType
        
        logger.info("Applying dynamic quantization (4-bit approximation)...")
        
        # Load ONNX model
        model = onnx.load(onnx_path)
        
        # Apply quantization
        quantized_model = quantize_dynamic(
            model,
            weight_type=QuantType.QUInt4,  # 4-bit weights
        )
        
        # Save quantized model
        onnx.save(quantized_model, output_path)
        
        logger.info(f"4-bit quantization complete: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"4-bit quantization failed: {str(e)}")
        return False

def quantize_onnx_8bit(onnx_path: str, output_path: str) -> bool:
    """Apply 8-bit quantization to ONNX model using ONNX Runtime."""
    try:
        import onnx
        from onnxruntime.quantization import quantize_dynamic, QuantType
        
        logger.info("Applying dynamic quantization (8-bit)...")
        
        # Load ONNX model
        model = onnx.load(onnx_path)
        
        # Apply quantization
        quantized_model = quantize_dynamic(
            model,
            weight_type=QuantType.QUInt8,  # 8-bit weights
        )
        
        # Save quantized model
        onnx.save(quantized_model, output_path)
        
        logger.info(f"8-bit quantization complete: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"8-bit quantization failed: {str(e)}")
        return False

def validate_model(model_path: str) -> bool:
    """Validate an ONNX model can be loaded by ONNX Runtime."""
    try:
        import onnxruntime as ort
        
        logger.info(f"Validating model: {model_path}")
        
        # Create inference session
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        
        # Check input/output shapes
        inputs = session.get_inputs()
        outputs = session.get_outputs()
        
        logger.info(f"Model validation successful. Inputs: {len(inputs)}, Outputs: {len(outputs)}")
        return True
        
    except Exception as e:
        logger.error(f"Model validation failed: {str(e)}")
        return False

def setup_model(model_type: str, models_dir: str = "models") -> bool:
    """
    Set up a specific model for offline deployment.
    
    Args:
        model_type: Type of model ("triage", "diagnosis", "embeddings")
        models_dir: Base directory for models
    
    Returns:
        True if successful, False otherwise
    """
    if model_type not in MODELS:
        logger.error(f"Unknown model type: {model_type}")
        return False
    
    config = MODELS[model_type]
    
    logger.info(f"Setting up {config['name']} model...")
    
    # For models that are already ONNX on HuggingFace, just download
    if "onnx" in config["huggingface_id"].lower():
        logger.info(f"Downloading pre-quantized ONNX model from HuggingFace...")
        output_dir = Path(models_dir) / config["output_dir"]
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Download using huggingface-cli
        cmd = [
            "huggingface-cli", "download",
            config["huggingface_id"],
            "--local-dir", str(output_dir),
            "--local-dir-use-symlinks", "False"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"Download failed: {result.stderr}")
            return False
        
        # Validate the downloaded model
        onnx_file = output_dir / "model.onnx"
        if onnx_file.exists():
            return validate_model(str(onnx_file))
        else:
            logger.warning("No model.onnx found, checking for other ONNX files...")
            for file in output_dir.glob("*.onnx"):
                if validate_model(str(file)):
                    logger.info(f"Validated: {file}")
                    return True
            logger.error("No valid ONNX model found")
            return False
    
    # For PyTorch models, need to convert to ONNX
    else:
        logger.info(f"Converting PyTorch model to ONNX...")
        
        # Download PyTorch model
        temp_dir = Path(models_dir) / "temp" / config["output_dir"]
        if not download_model(config["huggingface_id"], str(temp_dir)):
            return False
        
        # Convert to ONNX
        output_file = Path(models_dir) / config["output_dir"] / config["filename"]
        if not convert_to_onnx(str(temp_dir), str(output_file), config["quantization"]):
            return False
        
        # Validate
        if not validate_model(str(output_file)):
            return False
        
        # Cleanup temp directory
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        return True

def setup_all_models(models_dir: str = "models") -> Dict[str, bool]:
    """
    Set up all offline AI models.
    
    Args:
        models_dir: Base directory for models
    
    Returns:
        Dictionary of model types to success status
    """
    results = {}
    
    for model_type in MODELS:
        logger.info(f"\n{'='*60}")
        logger.info(f"Setting up {model_type} model")
        logger.info(f"{'='*60}\n")
        
        results[model_type] = setup_model(model_type, models_dir)
        
        if results[model_type]:
            logger.info(f"✓ {model_type} model setup successful")
        else:
            logger.error(f"✗ {model_type} model setup failed")
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Setup offline AI models for AfyaHero")
    parser.add_argument(
        "--model",
        type=str,
        choices=list(MODELS.keys()) + ["all"],
        default="all",
        help="Model type to setup (triage, diagnosis, embeddings, or all)"
    )
    parser.add_argument(
        "--models-dir",
        type=str,
        default="models",
        help="Directory to store models"
    )
    parser.add_argument(
        "--skip-dependencies",
        action="store_true",
        help="Skip dependency check"
    )
    
    args = parser.parse_args()
    
    # Check dependencies
    if not args.skip_dependencies:
        if not check_dependencies():
            sys.exit(1)
    
    # Setup models
    if args.model == "all":
        results = setup_all_models(args.models_dir)
    else:
        results = {args.model: setup_model(args.model, args.models_dir)}
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("Setup Summary")
    logger.info(f"{'='*60}\n")
    
    for model_type, success in results.items():
        status = "✓" if success else "✗"
        logger.info(f"{status} {model_type}: {'Success' if success else 'Failed'}")
    
    # Exit with error if any failed
    if not all(results.values()):
        sys.exit(1)

if __name__ == "__main__":
    main()
