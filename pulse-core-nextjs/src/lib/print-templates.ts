/**
 * Print Templates
 * 
 * Pre-built templates for common document types:
 * - Prescriptions
 * - Inventory Reports
 * - Receipts
 * - Conversation Logs
 * - Medical Records
 */

export interface PrescriptionData {
  prescriptionId: string;
  patientName: string;
  patientDOB?: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  quantity: number;
  refills?: number;
  prescriber: string;
  prescriberLicense?: string;
  pharmacy?: string;
  dateIssued: Date;
  expiryDate?: Date;
  instructions?: string;
  warnings?: string[];
}

export interface InventoryReportData {
  reportDate: Date;
  medicationName: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  totalValue: number;
  expiryDate?: Date;
  supplier?: string;
  lastRestock?: Date;
  dosageForm?: string;
  strength?: string;
}

export interface ConversationLogData {
  conversationId: string;
  startDate: Date;
  endDate: Date;
  messages: Array<{
    timestamp: Date;
    speaker: 'user' | 'assistant';
    message: string;
  }>;
  topic?: string;
  summary?: string;
}

export interface MedicalRecordData {
  patientName: string;
  patientId: string;
  recordDate: Date;
  recordType: 'visit' | 'lab' | 'imaging' | 'prescription' | 'allergy';
  provider?: string;
  findings?: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
}

/**
 * Format prescription template
 */
export const formatPrescriptionTemplate = (data: PrescriptionData): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; border: 2px solid #333; padding: 20px;">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">PRESCRIPTION</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          Rx #${data.prescriptionId}
        </p>
      </div>

      <!-- Prescriber Info -->
      <div style="margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; background: #f9f9f9;">
        <p style="margin: 0; font-weight: bold;">Prescriber Information</p>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          ${data.prescriber}
          ${data.prescriberLicense ? `<br/>License: ${data.prescriberLicense}` : ''}
        </p>
      </div>

      <!-- Patient Info -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <p style="margin: 0; font-weight: bold; font-size: 14px;">Patient Name</p>
          <p style="margin: 5px 0 0 0; font-size: 16px;">${data.patientName}</p>
        </div>
        <div>
          <p style="margin: 0; font-weight: bold; font-size: 14px;">Date of Birth</p>
          <p style="margin: 5px 0 0 0; font-size: 16px;">${data.patientDOB || 'N/A'}</p>
        </div>
      </div>

      <!-- Medication -->
      <div style="border-left: 4px solid #10b981; padding: 15px; background: #f0fdf4; margin: 20px 0;">
        <p style="margin: 0; font-weight: bold; color: #10b981;">MEDICATION</p>
        <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">${data.medicationName}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          Dosage: <strong>${data.dosage}</strong> | 
          Quantity: <strong>${data.quantity}</strong>
          ${data.refills ? ` | Refills: <strong>${data.refills}</strong>` : ''}
        </p>
      </div>

      <!-- Instructions -->
      <div style="margin: 20px 0;">
        <p style="margin: 0; font-weight: bold; font-size: 14px;">Instructions</p>
        <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.6;">
          ${data.frequency}
          ${data.instructions ? `<br/>${data.instructions}` : ''}
        </p>
      </div>

      <!-- Warnings -->
      ${data.warnings && data.warnings.length > 0 ? `
        <div style="border: 2px solid #ef4444; background: #fef2f2; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #ef4444; font-size: 14px;">⚠️ WARNINGS</p>
          <ul style="margin: 8px 0 0 20px; padding: 0;">
            ${data.warnings.map(warning => `<li style="margin: 5px 0; font-size: 13px;">${warning}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Dates -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ddd; font-size: 12px;">
        <div>
          <p style="margin: 0; color: #666;">Issued: ${data.dateIssued.toLocaleDateString()}</p>
        </div>
        <div>
          <p style="margin: 0; color: #666;">
            Expires: ${data.expiryDate ? data.expiryDate.toLocaleDateString() : 'Check local regulations'}
          </p>
        </div>
      </div>

      <!-- Pharmacy -->
      ${data.pharmacy ? `
        <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px dashed #ddd; font-size: 12px; color: #666;">
          <p style="margin: 0;">Pharmacy: ${data.pharmacy}</p>
        </div>
      ` : ''}
    </div>
  `;
};

/**
 * Format inventory report template
 */
export const formatInventoryReportTemplate = (items: InventoryReportData[]): string => {
  const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);

  return `
    <div style="font-family: Arial, sans-serif;">
      <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid #1e40af;">
        <h1 style="margin: 0; color: #1e40af; font-size: 24px;">Inventory Report</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 13px;">
          Generated: ${new Date().toLocaleString()}
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="border: 1px solid #d1d5db; padding: 12px; text-align: left;">Medication</th>
            <th style="border: 1px solid #d1d5db; padding: 12px; text-align: left;">SKU</th>
            <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right;">Quantity</th>
            <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right;">Reorder Level</th>
            <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right;">Unit Cost</th>
            <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right;">Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td style="border: 1px solid #d1d5db; padding: 10px;">
                ${item.medicationName}
                ${item.dosageForm ? `<br/><small style="color: #666;">${item.dosageForm}${item.strength ? ` ${item.strength}` : ''}</small>` : ''}
              </td>
              <td style="border: 1px solid #d1d5db; padding: 10px; font-family: monospace;">${item.sku}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">
                <span style="padding: 2px 6px; border-radius: 3px; ${item.quantity <= item.reorderLevel ? 'background: #fee2e2; color: #991b1b;' : 'background: #dcfce7; color: #15803d;'}">
                  ${item.quantity}
                </span>
              </td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">${item.reorderLevel}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right;">$${item.unitCost.toFixed(2)}</td>
              <td style="border: 1px solid #d1d5db; padding: 10px; text-align: right; font-weight: bold;">$${item.totalValue.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background: #f0f9ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px;">
          <strong>Total Inventory Value: $${totalValue.toFixed(2)}</strong>
        </p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
          Items Count: ${items.length} | 
          Low Stock Items: ${items.filter(i => i.quantity <= i.reorderLevel).length}
        </p>
      </div>
    </div>
  `;
};

/**
 * Format conversation log template
 */
export const formatConversationLogTemplate = (data: ConversationLogData): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 900px;">
      <div style="color: #1e40af; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1e40af;">
        <h1 style="margin: 0; font-size: 22px;">Conversation Log</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">
          ID: ${data.conversationId} | 
          ${data.startDate.toLocaleDateString()} to ${data.endDate.toLocaleDateString()}
        </p>
        ${data.topic ? `<p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Topic: ${data.topic}</p>` : ''}
      </div>

      <div style="background: #f9fafb; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
        ${data.summary ? `
          <p style="margin: 0; font-size: 13px;"><strong>Summary:</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 1.6; color: #374151;">${data.summary}</p>
        ` : ''}
      </div>

      <div style="margin-top: 20px;">
        ${data.messages.map(msg => `
          <div style="margin-bottom: 12px; ${msg.speaker === 'assistant' ? 'background: #ecfdf5;' : 'background: #eff6ff;'} padding: 12px; border-radius: 4px; border-left: 3px solid ${msg.speaker === 'assistant' ? '#10b981;' : '#3b82f6;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <strong style="font-size: 12px; color: ${msg.speaker === 'assistant' ? '#059669' : '#1d4ed8'};">
                ${msg.speaker === 'assistant' ? '🤖 Assistant' : '👤 User'}
              </strong>
              <span style="font-size: 11px; color: #666;">${msg.timestamp.toLocaleTimeString()}</span>
            </div>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #1f2937;">${msg.message}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};

/**
 * Format medical record template
 */
export const formatMedicalRecordTemplate = (data: MedicalRecordData): string => {
  return `
    <div style="font-family: 'Times New Roman', serif; max-width: 900px;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px solid #059669;">
        <h1 style="margin: 0; color: #059669; font-size: 24px;">Medical Record</h1>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
          Record Type: ${data.recordType.toUpperCase()}
        </p>
      </div>

      <!-- Patient Info -->
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; color: #059669; font-size: 14px; text-transform: uppercase;">Patient Information</h3>
        <div style="border: 1px solid #d1d5db; padding: 12px; background: #f9fafb;">
          <p style="margin: 5px 0; font-size: 13px;">
            <strong>Name:</strong> ${data.patientName}
          </p>
          <p style="margin: 5px 0; font-size: 13px;">
            <strong>ID:</strong> <span style="font-family: monospace;">${data.patientId}</span>
          </p>
        </div>
      </div>

      <!-- Record Details -->
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; color: #059669; font-size: 14px; text-transform: uppercase;">Record Details</h3>
        
        <p style="margin: 0 0 8px 0; font-size: 13px;">
          <strong>Date:</strong> ${data.recordDate.toLocaleDateString()}
          ${data.provider ? ` | <strong>Provider:</strong> ${data.provider}` : ''}
        </p>

        ${data.findings ? `
          <p style="margin: 12px 0 0 0; font-size: 13px;">
            <strong>Findings:</strong>
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; line-height: 1.7; color: #374151;">
            ${data.findings}
          </p>
        ` : ''}

        ${data.diagnosis ? `
          <p style="margin: 12px 0 0 0; font-size: 13px;">
            <strong>Diagnosis:</strong>
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; line-height: 1.7; color: #374151;">
            ${data.diagnosis}
          </p>
        ` : ''}

        ${data.treatment ? `
          <p style="margin: 12px 0 0 0; font-size: 13px;">
            <strong>Treatment:</strong>
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; line-height: 1.7; color: #374151;">
            ${data.treatment}
          </p>
        ` : ''}

        ${data.notes ? `
          <p style="margin: 12px 0 0 0; font-size: 13px;">
            <strong>Clinical Notes:</strong>
          </p>
          <p style="margin: 5px 0 0 0; font-size: 12px; line-height: 1.7; color: #374151;">
            ${data.notes}
          </p>
        ` : ''}
      </div>

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 15px; border-top: 1px dashed #d1d5db; text-align: center; font-size: 11px; color: #666;">
        <p style="margin: 0;">This document is confidential and intended for medical professionals only.</p>
        <p style="margin: 5px 0 0 0;">Printed: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;
};

/**
 * Parse and return correct template
 */
export const getTemplate = (
  type: 'prescription' | 'inventory' | 'conversation' | 'medical',
  data: any
): string => {
  switch (type) {
    case 'prescription':
      return formatPrescriptionTemplate(data as PrescriptionData);
    case 'inventory':
      return formatInventoryReportTemplate(data as InventoryReportData[]);
    case 'conversation':
      return formatConversationLogTemplate(data as ConversationLogData);
    case 'medical':
      return formatMedicalRecordTemplate(data as MedicalRecordData);
    default:
      return '<p>Unknown template type</p>';
  }
};

const printTemplates = {
  formatPrescriptionTemplate,
  formatInventoryReportTemplate,
  formatConversationLogTemplate,
  formatMedicalRecordTemplate,
  getTemplate
};

export default printTemplates;
