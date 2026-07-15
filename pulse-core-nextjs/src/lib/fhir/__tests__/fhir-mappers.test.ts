import { mapMedicationDispenseToFHIR, mapClaimToFHIR } from '../fhir-mappers';

describe('FHIR MedicationDispense & Claim Mappers', () => {
  describe('mapMedicationDispenseToFHIR', () => {
    it('should map a medication dispense record to a valid FHIR MedicationDispense resource', () => {
      const internalDispense = {
        id: 'disp-123',
        patientId: 'pat-456',
        prescriptionId: 'rx-789',
        rxNumber: 'RX998877',
        status: 'dispensed',
        dispensedAt: '2026-06-21T12:00:00.000Z',
        dispensedBy: 'staff-abc',
        notes: 'Take with food',
        items: [
          {
            drug: 'Amoxicillin 500mg',
            quantity: 30,
          },
          {
            drug: 'Paracetamol 500mg',
            quantity: 20,
          },
        ],
      };

      const result = mapMedicationDispenseToFHIR(internalDispense);

      expect(result.resourceType).toBe('MedicationDispense');
      expect(result.id).toBe('disp-123');
      expect(result.status).toBe('completed');
      expect(result.subject).toEqual({
        reference: 'Patient/pat-456',
        type: 'Patient',
      });
      expect(result.authorizingPrescription).toEqual([
        {
          reference: 'MedicationRequest/rx-789',
          type: 'MedicationRequest',
          display: 'RX998877',
        },
      ]);
      expect(result.performer).toEqual([
        {
          actor: {
            reference: 'Practitioner/staff-abc',
            type: 'Practitioner',
          },
        },
      ]);
      expect(result.whenHandedOver).toBe('2026-06-21T12:00:00.000Z');
      expect(result.quantity).toEqual({
        value: 50,
        unit: 'tablet',
      });
      expect(result.note).toEqual([
        {
          text: 'Take with food',
          time: '2026-06-21T12:00:00.000Z',
        },
      ]);
      expect(result.medicationCodeableConcept?.coding).toEqual([
        {
          system: 'https://afyahero.com/fhir/medication',
          code: 'amoxicillin-500mg',
          display: 'Amoxicillin 500mg',
        },
        {
          system: 'https://afyahero.com/fhir/medication',
          code: 'paracetamol-500mg',
          display: 'Paracetamol 500mg',
        },
      ]);
    });
  });

  describe('mapClaimToFHIR', () => {
    it('should map a SHIF insurance claim to a valid FHIR Claim resource', () => {
      const internalClaim = {
        id: 'claim-123',
        patientId: 'pat-456',
        hospitalId: 'hosp-789',
        status: 'pending',
        claimNumber: 'CLM-0001',
        memberNumber: 'MEM-9999',
        preauthNumber: 'PRE-8888',
        diagnosis: 'Acute Malaria',
        treatment: 'Artemether-Lumefantrine + Supportive Care',
        amountClaimed: 4500.5,
        amountApproved: null,
        rejectionReason: null,
        submittedAt: '2026-06-21T10:00:00.000Z',
        decidedAt: null,
        createdAt: '2026-06-21T09:30:00.000Z',
        updatedAt: '2026-06-21T10:00:00.000Z',
      };

      const result = mapClaimToFHIR(internalClaim);

      expect(result.resourceType).toBe('Claim');
      expect(result.id).toBe('claim-123');
      expect(result.status).toBe('active');
      expect(result.use).toBe('claim');
      expect(result.patient).toEqual({
        reference: 'Patient/pat-456',
        type: 'Patient',
      });
      expect(result.provider).toEqual({
        reference: 'Organization/hosp-789',
        type: 'Organization',
      });
      expect(result.insurer).toEqual({
        display: 'Social Health Authority (SHA)',
      });
      expect(result.created).toBe(new Date(internalClaim.createdAt).toISOString());
      expect(result.identifier).toEqual([
        {
          system: 'https://afyahero.com/fhir/claim-number',
          value: 'CLM-0001',
          use: 'official',
        },
        {
          system: 'https://afyahero.com/fhir/member-number',
          value: 'MEM-9999',
          use: 'secondary',
        },
      ]);
      expect(result.insurance).toEqual([
        {
          sequence: 1,
          focal: true,
          coverage: {
            display: 'SHA Coverage',
          },
          preAuthRef: ['PRE-8888'],
        },
      ]);
      expect(result.diagnosis).toEqual([
        {
          sequence: 1,
          diagnosisCodeableConcept: {
            text: 'Acute Malaria',
          },
        },
      ]);
      expect(result.item).toEqual([
        {
          sequence: 1,
          productOrService: {
            text: 'Artemether-Lumefantrine + Supportive Care',
          },
          net: {
            value: 4500.5,
            system: 'http://unitsofmeasure.org',
            code: 'KES',
          },
        },
      ]);
      expect(result.total).toEqual({
        value: 4500.5,
        system: 'http://unitsofmeasure.org',
        code: 'KES',
      });
    });

    it('should map rejected status to cancelled FHIR status', () => {
      const internalClaim = {
        id: 'claim-123',
        patientId: 'pat-456',
        hospitalId: 'hosp-789',
        status: 'rejected',
        claimNumber: 'CLM-0001',
        memberNumber: 'MEM-9999',
        amountClaimed: '3000',
        createdAt: '2026-06-21T09:30:00.000Z',
        updatedAt: '2026-06-21T10:00:00.000Z',
      };

      const result = mapClaimToFHIR(internalClaim);
      expect(result.status).toBe('cancelled');
      expect(result.total?.value).toBe(3000);
    });
  });
});
