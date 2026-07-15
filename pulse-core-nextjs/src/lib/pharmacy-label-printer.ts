/**
 * Pharmacy Label Printer Worker
 * 
 * Handles printing of pharmacy labels including:
 * - Patient medication labels
 * - Bilingual labels (English/Swahili)
 * - QR codes for verification
 * - Drug interaction warnings
 * 
 * Supports:
 * - Direct thermal printer (Zebra, Dymo)
 * - Network printers via CUPS/IPP
 * - Browser print dialog fallback
 * 
 * Environment:
 * - PHARMACY_PRINTER_URL: Network printer endpoint
 * - PHARMACY_PRINTER_TYPE: 'thermal' | 'laser' | 'generic'
 */

import { printService, type PrintOptions } from './print-service';
import logger from '@/lib/logger';

export interface PharmacyLabelData {
  prescriptionId: string;
  patientName: string;
  patientId: string;
  facilityName: string;
  medication: {
    name: string;
    genericName?: string;
    dosage: string;
    form: string; // tablet, syrup, injection, etc.
    strength: string;
    quantity: number;
  };
  instructions: {
    frequency: string; // e.g., "1 tablet twice daily"
    duration: string; // e.g., "7 days"
    route: string; // oral, topical, etc.
    timing?: string; // before/after food
  };
  prescriber: {
    name: string;
    license?: string;
    signature?: string;
  };
  pharmacy: {
    name: string;
    contact?: string;
    address?: string;
  };
  dates: {
    issued: Date;
    expiry: Date;
    filled?: Date;
  };
  warnings?: string[];
  language: 'en' | 'sw' | 'bilingual';
}

export interface LabelPrintResult {
  success: boolean;
  labelId?: string;
  printJobId?: string;
  error?: string;
}

export interface LabelBatchResult {
  total: number;
  successful: number;
  failed: number;
  results: LabelPrintResult[];
}

/**
 * Print a single pharmacy label
 */
export async function printPharmacyLabel(
  data: PharmacyLabelData,
  options: {
    printerUrl?: string;
    copies?: number;
    printImmediately?: boolean;
  } = {}
): Promise<LabelPrintResult> {
  try {
    const labelHtml = generateLabelHTML(data);
    const labelId = `lbl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const printOptions: PrintOptions = {
      title: `Pharmacy Label - ${data.patientName}`,
      documentType: 'prescription',
      paperSize: 'Custom',
      orientation: 'portrait',
      margins: { top: 2, right: 2, bottom: 2, left: 2 },
      showHeader: false,
      showFooter: false,
      theme: 'minimal',
      quality: 'high',
    };

    // Try direct thermal printer first
    if (options.printerUrl) {
      try {
        const printJobId = await sendToNetworkPrinter(options.printerUrl, labelHtml, {
          copies: options.copies || 1,
          labelId,
        });
        
        logger.info('Label sent to network printer', { labelId, printJobId });
        
        return {
          success: true,
          labelId,
          printJobId,
        };
      } catch (networkError) {
        logger.warn('Network printer failed, falling back to browser print', { 
          error: networkError 
        });
      }
    }

    // Fallback to browser print dialog
    const result = await printService.printToPrinter(labelHtml, printOptions);
    
    if (result.success) {
      logger.info('Pharmacy label printed', { labelId, patient: data.patientName });
    }

    return {
      success: result.success,
      labelId,
      error: result.error,
    };
  } catch (error) {
    logger.error('Failed to print pharmacy label', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Print multiple labels in batch
 */
export async function printLabelBatch(
  labels: PharmacyLabelData[],
  options: {
    printerUrl?: string;
    collate?: boolean;
  } = {}
): Promise<LabelBatchResult> {
  const results: LabelPrintResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const label of labels) {
    const result = await printPharmacyLabel(label, {
      printerUrl: options.printerUrl,
      copies: 1,
    });
    
    results.push(result);
    
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  logger.info('Label batch completed', { total: labels.length, successful, failed });

  return {
    total: labels.length,
    successful,
    failed,
    results,
  };
}

/**
 * Generate HTML for pharmacy label
 */
function generateLabelHTML(data: PharmacyLabelData): string {
  const isSwahili = data.language === 'sw' || data.language === 'bilingual';
  const qrCode = generateQRCodeUrl(data.prescriptionId);
  
  // Translations
  const labels = {
    patient: isSwahili ? 'Mgonjwa' : 'Patient',
    medication: isSwahili ? 'Dawa' : 'Medication',
    dosage: isSwahili ? 'Kiwango' : 'Dosage',
    quantity: isSwahili ? 'Idadi' : 'Qty',
    instructions: isSwahili ? 'Maagizo' : 'Instructions',
    frequency: isSwahili ? 'Mara' : 'Frequency',
    duration: isSwahili ? 'Mud' : 'Duration',
    warning: isSwahili ? 'Onyo' : 'Warning',
    pharmacy: isSwahili ? 'Pharmacy' : 'Pharmacy',
    prescriber: isSwahili ? 'Daktari' : 'Prescriber',
    issued: isSwahili ? 'Tarehe' : 'Issued',
    expiry: isSwahili ? 'Inakabili' : 'Expires',
    take: isSwahili ? 'Chukua' : 'Take',
    before: isSwahili ? 'Kabla ya' : 'before',
    after: isSwahili ? 'Baada ya' : 'after',
    food: isSwahili ? 'ula' : 'food',
  };

  const warningHtml = data.warnings?.length 
    ? `<div class="warning">${labels.warning}: ${data.warnings.join(', ')}</div>` 
    : '';

  // Generate timing instruction
  let timingLabel = '';
  if (data.instructions.timing) {
    const timing = data.instructions.timing === 'before' ? labels.before : labels.after;
    timingLabel = ` (${timing} ${labels.food})`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.2;
      width: 50mm;
      padding: 2mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      border-bottom: 1px solid #333;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .facility {
      font-weight: bold;
      font-size: 8pt;
    }
    .qr {
      width: 15mm;
      height: 15mm;
    }
    .patient {
      margin-bottom: 2mm;
    }
    .patient-label {
      font-size: 7pt;
      color: #666;
    }
    .patient-name {
      font-weight: bold;
      font-size: 10pt;
    }
    .medication {
      margin-bottom: 2mm;
    }
    .med-name {
      font-weight: bold;
      font-size: 10pt;
    }
    .med-details {
      font-size: 8pt;
      color: #333;
    }
    .instructions {
      background: #f5f5f5;
      padding: 2mm;
      margin-bottom: 2mm;
      font-size: 8pt;
    }
    .instructions-label {
      font-size: 7pt;
      color: #666;
    }
    .instructions-text {
      font-weight: bold;
    }
    .timing {
      font-size: 7pt;
      color: #666;
      margin-top: 1mm;
    }
    .warning {
      color: #d00;
      font-size: 7pt;
      font-weight: bold;
      border: 1px solid #d00;
      padding: 1mm;
      margin-bottom: 2mm;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      font-size: 6pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 1mm;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="facility">${data.facilityName}</div>
    <img class="qr" src="${qrCode}" alt="QR Code" />
  </div>
  
  <div class="patient">
    <div class="patient-label">${labels.patient}:</div>
    <div class="patient-name">${data.patientName}</div>
  </div>
  
  <div class="medication">
    <div class="med-name">${data.medication.name}</div>
    <div class="med-details">
      ${data.medication.strength} ${data.medication.form} | ${labels.quantity}: ${data.medication.quantity}
    </div>
  </div>
  
  <div class="instructions">
    <div class="instructions-label">${labels.instructions}:</div>
    <div class="instructions-text">${data.instructions.frequency}</div>
    <div class="timing">${labels.take}${timingLabel} | ${data.instructions.duration}</div>
  </div>
  
  ${warningHtml}
  
  <div class="footer">
    <div>${data.pharmacy.name}</div>
    <div>${labels.expiry}: ${formatDate(data.dates.expiry)}</div>
  </div>
</body>
</html>
`;
}

/**
 * Send label to network thermal printer
 */
async function sendToNetworkPrinter(
  printerUrl: string,
  html: string,
  options: {
    copies: number;
    labelId: string;
  }
): Promise<string> {
  const response = await fetch(printerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobType: 'print',
      content: html,
      copies: options.copies,
      jobId: options.labelId,
      mediaType: 'label-4x6',
    }),
  });

  if (!response.ok) {
    throw new Error(`Printer error: ${response.status}`);
  }

  const result = await response.json();
  return result.jobId || options.labelId;
}

/**
 * Generate QR code URL for label
 */
function generateQRCodeUrl(prescriptionId: string): string {
  // Use a QR code API or generate locally
  const data = encodeURIComponent(JSON.stringify({
    id: prescriptionId,
    type: 'prescription',
    verify: true,
  }));
  
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}`;
}

/**
 * Format date for label
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Get available pharmacy printers
 */
export async function getPharmacyPrinters(): Promise<Array<{
  id: string;
  name: string;
  type: string;
  status: string;
  location?: string;
}>> {
  // In production, this would query printer management API
  const configuredPrinter = process.env.PHARMACY_PRINTER_URL;
  
  if (configuredPrinter) {
    return [{
      id: 'primary',
      name: 'Pharmacy Label Printer',
      type: process.env.PHARMACY_PRINTER_TYPE || 'thermal',
      status: 'ready',
      location: 'Pharmacy Counter',
    }];
  }
  
  // Return default browser print option
  return [{
    id: 'browser',
    name: 'Browser Print Dialog',
    type: 'generic',
    status: 'ready',
    location: 'Local',
  }];
}

/**
 * Check printer connectivity
 */
export async function checkPrinterStatus(printerId: string): Promise<{
  online: boolean;
  status: string;
  inkLevel?: number;
  paperStatus?: string;
}> {
  const printerUrl = process.env.PHARMACY_PRINTER_URL;
  
  if (!printerUrl) {
    return {
      online: false,
      status: 'Not configured',
    };
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${printerUrl}/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const status = await response.json();
      return {
        online: true,
        status: status.state || 'ready',
        inkLevel: status.inkLevel,
        paperStatus: status.paperStatus,
      };
    }
  } catch {
    // Printer unreachable
  }
  
  return {
    online: false,
    status: 'Offline',
  };
}