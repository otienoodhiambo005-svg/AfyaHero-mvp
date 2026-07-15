"""
LangGraph Service for AfyaHero AI Orchestration
Implements the 7 core graphs from PRD v2.0:
1. TriageGraph - 3-model consensus triage
2. ClinicalNotesGraph - SOAP note autocomplete & suggestions
3. DrugInteractionGraph - OpenFDA + MedGemma validation
4. BillingClaimGraph - SHIF claim generation
5. OfflineSyncGraph - WatermelonDB sync resolution
6. KDPAErasureGraph - Right-to-erasure compliance
7. DischargeGraph - Discharge summary & PDF generation
"""
