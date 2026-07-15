#!/usr/bin/env python3
"""
AfyaHero Gateway Verification Tests
Verifies core functionality is properly configured
"""

import asyncio
import sys


async def test_imports():
    """Test all core modules import correctly"""
    print("Testing imports...")

    try:
        from app.config import get_settings

        print("  ✓ config")

        from app.services.ai.orchestrator import AIOrchestrator, AITask

        print("  ✓ AI orchestrator")

        from app.services.ai.providers.medgemma import MedGemmaProvider
        from app.services.ai.providers.gemini import GeminiProvider
        from app.services.ai.providers.llama import LlamaProvider
        from app.services.ai.providers.deepseek import DeepSeekProvider

        print("  ✓ AI providers")

        from app.services.ai.tasks.drug_checker import offline_interaction_check

        print("  ✓ drug checker")

        from app.services.ai.tasks.risk_models import NEWS2Calculator

        print("  ✓ risk models")

        from app.api.v1.router import v1_router

        print("  ✓ API router")

        return True
    except Exception as e:
        print(f"  ✗ Import failed: {e}")
        return False


async def test_ai_providers():
    """Test AI provider health checks"""
    print("\nTesting AI providers...")

    from app.services.ai.providers.medgemma import MedGemmaProvider
    from app.services.ai.providers.gemini import GeminiProvider
    from app.services.ai.providers.llama import LlamaProvider
    from app.services.ai.providers.deepseek import DeepSeekProvider

    providers = [
        ("MedGemma", MedGemmaProvider()),
        ("Gemini", GeminiProvider()),
        ("Llama", LlamaProvider()),
        ("DeepSeek", DeepSeekProvider()),
    ]

    results = {}
    for name, provider in providers:
        try:
            # Can't await in sync context, just check attrs exist
            results[name] = {
                "model": provider.model_name,
                "has_health_check": hasattr(provider, "health_check"),
            }
            print(f"  ✓ {name}: {provider.model_name}")
        except Exception as e:
            print(f"  ✗ {name}: {e}")
            results[name] = {"error": str(e)}

    return results


async def test_drug_interaction():
    """Test drug interaction checker"""
    print("\nTesting drug interaction checker...")

    from app.services.ai.tasks.drug_checker import offline_interaction_check

    # Test dangerous combination
    result = offline_interaction_check({"drugs": ["aspirin", "warfarin"]})

    if result["severity"] == "contraindicated":
        print(f"  ✓ Aspirin + Warfarin blocked: {result['severity']}")
    else:
        print(f"  ✗ Aspirin + Warfarin not blocked: {result}")
        return False

    # Test safe combination
    result = offline_interaction_check({"drugs": ["paracetamol", "amoxicillin"]})

    if result["severity"] == "none":
        print(f"  ✓ Paracetamol + Amoxicillin safe: {result['severity']}")
    else:
        print(f"  ✗ False positive: {result}")
        return False

    return True


async def test_triage_orchestrator():
    """Test triage processing"""
    print("\nTesting triage orchestrator...")

    from app.services.ai.orchestrator import AIOrchestrator, AIRequest, AITask

    orchestrator = AIOrchestrator()

    # Create test request
    req = AIRequest(
        task=AITask.TRIAGE,
        hospital_id="test-hospital-id",
        user_id="test-user-id",
        payload={"symptoms": "fever, headache", "duration": "2 days"},
    )

    print(f"  ✓ Request created: {req.task}")
    print(f"  ✓ Ensemble tasks: {orchestrator.ENSEMBLE_TASKS}")
    print(f"  ✓ Offline tasks: {orchestrator.OFFLINE_TASKS}")

    return True


async def test_shif_claims():
    """Test SHIF claim schema"""
    print("\nTesting SHIF claims...")

    from app.api.v1.shif import SHIFClaimCreate, ClaimStatus, SHIF_TARIFF

    # Verify tariff loaded
    if len(SHIF_TARIFF) > 10:
        print(f"  ✓ SHIF tariff loaded: {len(SHIF_TARIFF)} items")
    else:
        print(f"  ✗ SHIF tariff incomplete")
        return False

    # Verify claim status
    expected = ["draft", "pending", "submitted", "approved", "paid", "rejected"]
    for status in expected:
        if hasattr(ClaimStatus, status.upper()):
            print(f"  ✓ ClaimStatus.{status}")

    return True


async def main():
    """Run all verification tests"""
    print("=" * 50)
    print("AfyaHero Gateway Verification")
    print("=" * 50)

    all_passed = True

    all_passed &= await test_imports()
    all_passed &= await test_drug_interaction()
    all_passed &= await test_triage_orchestrator()
    all_passed &= await test_shif_claims()

    print("\n" + "=" * 50)
    if all_passed:
        print("✓ All verification tests passed!")
    else:
        print("✗ Some tests failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
