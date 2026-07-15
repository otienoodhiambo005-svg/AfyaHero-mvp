/**
 * Print Hook - usePrint
 * 
 * Simplified way to add print capabilities to any component
 */

import { useState, useCallback } from 'react';
import { printService, PrintOptions, PrintResult } from '@/lib/print-service';

export interface UsePrintOptions extends PrintOptions {
  autoClose?: boolean;
}

export interface UsePrintReturn {
  // State
  isPrinting: boolean;
  error: string | null;
  lastResult: PrintResult | null;

  // Methods
  print: (content: string | HTMLElement) => Promise<PrintResult>;
  printToPDF: (content: string | HTMLElement) => Promise<PrintResult>;
  preview: (content: string | HTMLElement) => void;
  silentPrint: (content: string | HTMLElement) => Promise<PrintResult>;

  // Utilities
  clearError: () => void;
  capabilitis: ReturnType<typeof printService.getPrintCapabilities>;
}

/**
 * Hook for easy print integration
 */
export function usePrint(defaultOptions: UsePrintOptions = {}): UsePrintReturn {
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PrintResult | null>(null);

  /**
   * Print to physical printer
   */
  const print = useCallback(
    async (content: string | HTMLElement) => {
      setIsPrinting(true);
      setError(null);

      try {
        const result = await printService.printToPrinter(content, defaultOptions);
        setLastResult(result);

        if (!result.success) {
          setError(result.error || result.message);
        }

        return result;
      } catch (err) {
        const errorMsg = String(err);
        setError(errorMsg);
        return {
          success: false,
          message: 'Print failed',
          error: errorMsg
        };
      } finally {
        setIsPrinting(false);
      }
    },
    [defaultOptions]
  );

  /**
   * Export to PDF
   */
  const printToPDF = useCallback(
    async (content: string | HTMLElement) => {
      setIsPrinting(true);
      setError(null);

      try {
        const result = await printService.exportToPDF(content, defaultOptions);
        setLastResult(result);

        if (!result.success) {
          setError(result.error || result.message);
        }

        return result;
      } catch (err) {
        const errorMsg = String(err);
        setError(errorMsg);
        return {
          success: false,
          message: 'PDF export failed',
          error: errorMsg
        };
      } finally {
        setIsPrinting(false);
      }
    },
    [defaultOptions]
  );

  /**
   * Show print preview
   */
  const preview = useCallback(
    (content: string | HTMLElement) => {
      try {
        printService.showPreview(content, defaultOptions);
      } catch (err) {
        setError(String(err));
      }
    },
    [defaultOptions]
  );

  /**
   * Silent print (browser-specific, limited)
   */
  const silentPrintFn = useCallback(
    async (content: string | HTMLElement) => {
      setIsPrinting(true);
      setError(null);

      try {
        const result = await printService.silentPrint(content, defaultOptions);
        setLastResult(result);

        if (!result.success) {
          setError(result.error || result.message);
        }

        return result;
      } catch (err) {
        const errorMsg = String(err);
        setError(errorMsg);
        return {
          success: false,
          message: 'Silent print failed',
          error: errorMsg
        };
      } finally {
        setIsPrinting(false);
      }
    },
    [defaultOptions]
  );

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isPrinting,
    error,
    lastResult,
    print,
    printToPDF,
    preview,
    silentPrint: silentPrintFn,
    clearError,
    capabilitis: printService.getPrintCapabilities()
  };
}

/**
 * Hook for printing table data
 */
export interface TableRow {
  [key: string]: string | number | boolean;
}

export interface UsePrintTableOptions extends UsePrintOptions {
  columns?: string[];
  filename?: string;
}

export function usePrintTable(defaultOptions: UsePrintTableOptions = {}) {
  const print = usePrint(defaultOptions);

  /**
   * Convert table data to HTML
   */
  const tableToHTML = (data: TableRow[], columns?: string[]): string => {
    if (!data || data.length === 0) {
      return '<p>No data to print</p>';
    }

    const cols = columns || Object.keys(data[0]);

    return `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            ${cols.map(col => `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${cols.map(col => `<td style="border: 1px solid #d1d5db; padding: 8px;">${row[col] || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  /**
   * Print table
   */
  const printTable = async (data: TableRow[], columns?: string[]) => {
    const html = tableToHTML(data, columns);
    return print.print(html);
  };

  /**
   * Export table to PDF
   */
  const exportTableToPDF = async (data: TableRow[], columns?: string[]) => {
    const html = tableToHTML(data, columns);
    return print.printToPDF(html);
  };

  return {
    ...print,
    printTable,
    exportTableToPDF,
    tableToHTML
  };
}

/**
 * Hook for printing receipts/invoices
 */
export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total?: number;
}

export interface UsePrintReceiptOptions extends UsePrintOptions {
  businessName?: string;
  businessAddress?: string;
  receiptNumber?: string;
  items: ReceiptItem[];
  subtotal?: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  notes?: string;
}

export function usePrintReceipt(options: UsePrintReceiptOptions) {
  const print = usePrint(options);

  /**
   * Generate receipt HTML
   */
  const generateReceiptHTML = (): string => {
    return `
      <div style="max-width: 400px; margin: 0 auto; font-family: monospace;">
        <div style="text-align: center; margin-bottom: 20px;">
          ${options.businessName ? `<h2 style="margin: 0; font-size: 18px;">${options.businessName}</h2>` : ''}
          ${options.businessAddress ? `<p style="margin: 5px 0; font-size: 11px;">${options.businessAddress}</p>` : ''}
          ${options.receiptNumber ? `<p style="margin: 5px 0; font-size: 11px;">Receipt #${options.receiptNumber}</p>` : ''}
          <p style="margin: 5px 0; font-size: 10px;">${new Date().toLocaleString()}</p>
        </div>

        <hr style="border: none; border-top: 1px dashed #000; margin: 15px 0;">

        <table style="width: 100%; font-size: 11px;">
          <thead>
            <tr>
              <th style="text-align: left; padding-bottom: 8px;">Item</th>
              <th style="text-align: right; padding-bottom: 8px;">Qty</th>
              <th style="text-align: right; padding-bottom: 8px;">Price</th>
              <th style="text-align: right; padding-bottom: 8px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${options.items.map(item => `
              <tr>
                <td style="padding: 4px 0; text-align: left;">${item.name}</td>
                <td style="padding: 4px 0; text-align: right;">${item.quantity}</td>
                <td style="padding: 4px 0; text-align: right;">$${item.price.toFixed(2)}</td>
                <td style="padding: 4px 0; text-align: right;">$${(item.total || item.quantity * item.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <hr style="border: none; border-top: 1px dashed #000; margin: 15px 0;">

        <div style="font-size: 11px;">
          ${options.subtotal ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Subtotal:</span>
              <span>$${options.subtotal.toFixed(2)}</span>
            </div>
          ` : ''}
          ${options.tax ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Tax:</span>
              <span>$${options.tax.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 1px solid #000;">
            <span>Total:</span>
            <span>$${options.total.toFixed(2)}</span>
          </div>
        </div>

        ${options.paymentMethod ? `
          <p style="margin-top: 15px; font-size: 11px;">Payment: ${options.paymentMethod}</p>
        ` : ''}

        ${options.notes ? `
          <p style="margin-top: 10px; font-size: 10px; font-style: italic;">${options.notes}</p>
        ` : ''}

        <div style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
          Thank you for your purchase!
        </div>
      </div>
    `;
  };

  /**
   * Print receipt
   */
  const printReceipt = async () => {
    return print.print(generateReceiptHTML());
  };

  /**
   * Export receipt to PDF
   */
  const exportReceiptToPDF = async () => {
    return print.printToPDF(generateReceiptHTML());
  };

  return {
    ...print,
    printReceipt,
    exportReceiptToPDF,
    receiptHTML: generateReceiptHTML()
  };
}

/**
 * Hook for printing reports/documents
 */
export interface ReportSection {
  title: string;
  content: string;
  pageBreak?: boolean;
}

export interface UsePrintReportOptions extends UsePrintOptions {
  sections: ReportSection[];
}

export function usePrintReport(options: UsePrintReportOptions) {
  const print = usePrint(options);

  /**
   * Generate report HTML
   */
  const generateReportHTML = (): string => {
    return `
      <div>
         ${options.sections.map((section, _idx) => `
          <section ${section.pageBreak ? 'style="page-break-before: always;"' : ''}>
            ${section.title ? `<h2 style="color: #1e40af; margin-bottom: 15px;">${section.title}</h2>` : ''}
            <div style="color: #333; line-height: 1.6;">
              ${section.content}
            </div>
          </section>
        `).join('')}
      </div>
    `;
  };

  /**
   * Print report
   */
  const printReport = async () => {
    return print.print(generateReportHTML());
  };

  /**
   * Preview report
   */
  const previewReport = () => {
    print.preview(generateReportHTML());
  };

  /**
   * Export report to PDF
   */
  const exportReportToPDF = async () => {
    return print.printToPDF(generateReportHTML());
  };

  return {
    ...print,
    printReport,
    previewReport,
    exportReportToPDF,
    reportHTML: generateReportHTML()
  };
}

export default usePrint;
