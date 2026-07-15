import logger from '@/lib/logger';

/**
 * Universal Print Service
 * 
 * Comprehensive printing solution supporting:
 * - Print to physical printers
 * - Export to PDF
 * - Print preview
 * - Custom formatting and branding
 * - Multiple document types
 */

export interface PrintOptions {
  title?: string;
  documentType?: 'prescription' | 'inventory' | 'report' | 'conversation' | 'receipt' | 'custom';
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter' | 'A5' | 'Custom';
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  showHeader?: boolean;
  showFooter?: boolean;
  headerText?: string;
  footerText?: string;
  companyName?: string;
  companyLogo?: string;
  includeTimestamp?: boolean;
  includePageNumbers?: boolean;
  theme?: 'default' | 'professional' | 'medical' | 'minimal';
  quality?: 'draft' | 'normal' | 'high';
  color?: boolean;
  duplex?: boolean; // Print on both sides
}

export interface PrintResult {
  success: boolean;
  message: string;
  documentId?: string;
  timestamp?: Date;
  pages?: number;
  fileSize?: number;
  error?: string;
}

export interface PrintAuditLog {
  id: string;
  timestamp: Date;
  documentType: string;
  documentTitle: string;
  printMethod: 'printer' | 'pdf' | 'preview';
  userAgent?: string;
  pageCount?: number;
  status: 'success' | 'failed' | 'cancelled';
}

/**
 * Print Service Singleton
 * Manages all printing operations across the application
 */
class PrintService {
  private static instance: PrintService;

  private printWindow: Window | null = null;

  private auditLogs: PrintAuditLog[] = [];

  private defaultOptions: PrintOptions = {
    orientation: 'portrait',
    paperSize: 'A4',
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    showHeader: true,
    showFooter: true,
    includeTimestamp: true,
    includePageNumbers: true,
    theme: 'professional',
    quality: 'normal',
    color: true,
    duplex: false
  };

  private constructor() {
    this.loadAuditLogs();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }

  /**
   * Print HTML content to physical printer
   */
  async printToPrinter(
    content: string | HTMLElement,
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      const htmlContent = this.prepareContent(content, mergedOptions);

      // Create print window
      this.printWindow = window.open('', '_blank', 'height=600,width=800');
      if (!this.printWindow) {
        return {
          success: false,
          message: 'Failed to open print window. Please check popup blocker.',
          error: 'Popup blocked'
        };
      }

      // Write content to window
      this.printWindow.document.write(htmlContent);
      this.printWindow.document.close();

      // Wait for content to load
      await this.waitForPageLoad(this.printWindow);

      // Trigger print dialog
      this.printWindow.focus();
      this.printWindow.print();

      const result: PrintResult = {
        success: true,
        message: 'Print dialog opened successfully',
        timestamp: new Date()
      };

      // Log audit trail
      this.logAudit({
        documentType: options.documentType || 'custom',
        documentTitle: options.title || 'Untitled',
        printMethod: 'printer',
        status: 'success'
      });

      return result;
    } catch (error) {
      const errorMsg = String(error);

      this.logAudit({
        documentType: options.documentType || 'custom',
        documentTitle: options.title || 'Untitled',
        printMethod: 'printer',
        status: 'failed'
      });

      return {
        success: false,
        message: 'Failed to print to printer',
        error: errorMsg
      };
    }
  }

  /**
   * Export content to PDF
   * Requires html2pdf library (npm install html2pdf.js)
   */
  async exportToPDF(
    content: string | HTMLElement,
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      // Check if html2pdf is available
      const html2pdf = (window as any).html2pdf;
      if (!html2pdf) {
        return {
          success: false,
          message: 'PDF export requires html2pdf library. Install with: npm install html2pdf.js',
          error: 'Library not found'
        };
      }

      const element = typeof content === 'string'
        ? this.createElementFromHTML(content)
        : content;

      const pdfOptions = {
        margin: mergedOptions.margins,
        filename: `${options.title || 'document'}-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: {
          orientation: mergedOptions.orientation,
          unit: 'mm',
          format: mergedOptions.paperSize?.toLowerCase() === 'a4' ? 'a4' : 'letter',
          compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(pdfOptions).from(element).save();

      const result: PrintResult = {
        success: true,
        message: 'PDF exported successfully',
        timestamp: new Date()
      };

      this.logAudit({
        documentType: options.documentType || 'custom',
        documentTitle: options.title || 'Untitled',
        printMethod: 'pdf',
        status: 'success'
      });

      return result;
    } catch (error) {
      const errorMsg = String(error);

      this.logAudit({
        documentType: options.documentType || 'custom',
        documentTitle: options.title || 'Untitled',
        printMethod: 'pdf',
        status: 'failed'
      });

      return {
        success: false,
        message: 'Failed to export to PDF',
        error: errorMsg
      };
    }
  }

  /**
   * Display print preview modal
   */
  showPreview(
    content: string | HTMLElement,
    options: PrintOptions = {}
  ): { closePreview: () => void; printNow: () => Promise<PrintResult> } {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const htmlContent = this.prepareContent(content, mergedOptions);

    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.id = 'print-preview-modal';
    previewContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    const previewContent = document.createElement('div');
    previewContent.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 100%;
      max-width: 900px;
      height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h2');
    title.textContent = options.title || 'Print Preview';
    title.style.cssText = 'margin: 0; font-size: 18px; color: #333;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 10px;';

    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.style.cssText = `
      padding: 8px 16px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    `;

    const pdfBtn = document.createElement('button');
    pdfBtn.textContent = 'PDF';
    pdfBtn.style.cssText = `
      padding: 8px 16px;
      background: #f59e0b;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      padding: 8px 12px;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    `;

    header.appendChild(title);
    buttons.appendChild(printBtn);
    buttons.appendChild(pdfBtn);
    buttons.appendChild(closeBtn);
    header.appendChild(buttons);

    // Preview frame
    const frame = document.createElement('iframe');
    frame.style.cssText = `
      flex: 1;
      border: none;
      margin: 0;
      padding: 0;
    `;

    previewContent.appendChild(header);
    previewContent.appendChild(frame);

    // Write content to iframe
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
    }

    previewContainer.appendChild(previewContent);
    document.body.appendChild(previewContainer);

    // Event handlers
    const closePreview = () => {
      previewContainer.remove();
    };

    const printNow = async () => {
      closePreview();
      return this.printToPrinter(content, mergedOptions);
    };

    const exportPDF = async () => {
      closePreview();
      return this.exportToPDF(content, mergedOptions);
    };

    closeBtn.onclick = closePreview;
    printBtn.onclick = printNow;
    pdfBtn.onclick = exportPDF;

    // Close on background click
    previewContainer.addEventListener('click', (e) => {
      if (e.target === previewContainer) {
        closePreview();
      }
    });

    return { closePreview, printNow };
  }

  /**
   * Print directly without dialog (silent print)
   * Note: browsers restrict silent printing for security
   */
  async silentPrint(
    content: string | HTMLElement,
    options: PrintOptions = {}
  ): Promise<PrintResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      const htmlContent = this.prepareContent(content, mergedOptions);

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Could not access iframe document');
      }

      doc.open();
      doc.write(htmlContent);
      doc.close();

      // Wait for content to load
      await new Promise(resolve => {
        iframe.onload = resolve;
      });

      // Trigger print
      iframe.contentWindow?.print();

      // Clean up
      setTimeout(() => iframe.remove(), 1000);

      return {
        success: true,
        message: 'Print job sent',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Silent print failed',
        error: String(error)
      };
    }
  }

  /**
   * Prepare HTML content with styling and formatting
   */
  private prepareContent(content: string | HTMLElement, options: PrintOptions): string {
    const htmlContent = typeof content === 'string' ? content : content.outerHTML;

    const styles = this.generatePrintStyles(options);
    const header = options.showHeader ? this.generateHeader(options) : '';
    const footer = options.showFooter ? this.generateFooter(options) : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.title || 'Print Document'}</title>
        <style>
          ${styles}
        </style>
      </head>
      <body>
        ${header}
        <main class="print-content">
          ${htmlContent}
        </main>
        ${footer}
      </body>
      </html>
    `;
  }

  /**
   * Generate print-friendly CSS
   */
  private generatePrintStyles(options: PrintOptions): string {
    const margins = options.margins || {};
    const theme = options.theme || 'professional';

    let themeStyles = '';
    if (theme === 'professional') {
      themeStyles = `
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
        h2 { color: #1e40af; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 12px; text-align: left; }
        td { border: 1px solid #d1d5db; padding: 8px; }
      `;
    } else if (theme === 'medical') {
      themeStyles = `
        body { font-family: 'Times New Roman', Times, serif; }
        h1 { border-top: 3px solid #059669; border-bottom: 1px solid #d1d5db; }
        .patient-info { border: 1px solid #d1d5db; padding: 10px; margin-bottom: 15px; }
        table { border: 1px solid #d1d5db; }
      `;
    } else if (theme === 'minimal') {
      themeStyles = `
        body { font-family: Georgia, serif; color: #1f2937; }
        h1, h2, h3 { color: #1f2937; }
        table { width: 100%; }
        th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
      `;
    }

    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      @page {
        size: ${options.paperSize === 'A5' ? 'A5' : options.paperSize === 'A4' ? 'A4' : 'letter'};
        margin: ${margins.top || 20}mm ${margins.right || 20}mm ${margins.bottom || 20}mm ${margins.left || 20}mm;
        ${options.includePageNumbers ? '@bottom-center { content: "Page " counter(page) " of " counter(pages); }' : ''}
      }

      body {
        line-height: 1.6;
        color: #333;
        background: white;
        font-size: 11pt;
        ${options.color ? '' : 'filter: grayscale(100%);'}
      }

      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e5e7eb;
      }

      .print-header-left { flex: 1; }
      .print-header-right { text-align: right; font-size: 9pt; color: #666; }

      .print-content {
        page-break-inside: avoid;
      }

      .print-footer {
        position: fixed;
        bottom: 0;
        width: 100%;
        text-align: center;
        font-size: 9pt;
        color: #999;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
      }

      @media print {
        body { margin: 0; padding: 0; }
        .no-print { display: none; }
        a { text-decoration: none; color: #000; }
        table { page-break-inside: avoid; }
        tr { page-break-inside: avoid; }
      }

      ${themeStyles}
    `;
  }

  /**
   * Generate document header
   */
  private generateHeader(options: PrintOptions): string {
    const timestamp = options.includeTimestamp
      ? new Date().toLocaleString()
      : '';

    return `
      <header class="print-header">
        <div class="print-header-left">
          ${options.companyLogo ? `<img src="${options.companyLogo}" alt="Logo" style="height: 40px;">` : ''}
          ${options.companyName ? `<h3 style="margin: 5px 0 0 0;">${options.companyName}</h3>` : ''}
        </div>
        <div class="print-header-right">
          ${options.title ? `<strong>${options.title}</strong><br>` : ''}
          ${timestamp ? `<span>${timestamp}</span>` : ''}
        </div>
      </header>
    `;
  }

  /**
   * Generate document footer
   */
  private generateFooter(options: PrintOptions): string {
    return `
      <footer class="print-footer">
        ${options.footerText || ''}
        ${options.includePageNumbers ? '<span> | Page <span class="page"></span></span>' : ''}
      </footer>
    `;
  }

  /**
   * Create DOM element from HTML string
   */
  private createElementFromHTML(htmlString: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = htmlString;
    return div.firstElementChild as HTMLElement;
  }

  /**
   * Wait for page to load in print window
   */
  private async waitForPageLoad(window: Window): Promise<void> {
    return new Promise(resolve => {
      if (window.document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve());
      }
    });
  }

  /**
   * Log audit trail
   */
  private logAudit(data: Partial<PrintAuditLog>): void {
    const log: PrintAuditLog = {
      id: `print-${Date.now()}`,
      timestamp: new Date(),
      documentType: data.documentType || 'unknown',
      documentTitle: data.documentTitle || 'Untitled',
      printMethod: data.printMethod || 'printer',
      status: data.status || 'success'
    };

    this.auditLogs.push(log);

    // Persist to localStorage
    try {
      localStorage.setItem('print-audit-logs', JSON.stringify(this.auditLogs.slice(-100)));
    } catch (e) {
      logger.error('Failed to save audit logs', { error: e });
    }
  }

  /**
   * Load audit logs from storage
   */
  private loadAuditLogs(): void {
    try {
      const stored = localStorage.getItem('print-audit-logs');
      if (stored) {
        this.auditLogs = JSON.parse(stored);
      }
    } catch (e) {
      logger.error('Failed to load audit logs', { error: e });
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(): PrintAuditLog[] {
    return [...this.auditLogs];
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
    localStorage.removeItem('print-audit-logs');
  }

  /**
   * Get browser print capabilities
   */
  getPrintCapabilities() {
    return {
      canPrint: !!window.print,
      supportsPageBreak: !!window.CSS?.supports?.('page-break-after', 'avoid'),
      supportsPDF: !!(window as any).html2pdf || !!navigator.userAgent.match(/firefox|fxios/i),
      colorSupport: !(window.matchMedia('(color)').matches === false),
      defaultPrinter: this.getDefaultPrinter()
    };
  }

  /**
   * Get default printer info
   */
  private getDefaultPrinter(): string {
    // This is limited by browser security, returns basic info
    if (!navigator.userAgent) return 'Unknown';

    if (navigator.userAgent.includes('Win')) {
      return 'Windows Default Printer';
    } else if (navigator.userAgent.includes('Mac')) {
      return 'macOS Default Printer';
    } else if (navigator.userAgent.includes('Linux')) {
      return 'CUPS (Linux)';
    }

    return 'System Default';
  }

  /**
   * Set print quality
   */
  setQuality(quality: 'draft' | 'normal' | 'high'): void {
    this.defaultOptions.quality = quality;
  }

  /**
   * Check if printing is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.print;
  }
}

// Export singleton instance
export const printService = PrintService.getInstance();

export default printService;
