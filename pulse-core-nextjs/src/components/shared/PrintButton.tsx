/**
 * Print Button Component
 * 
 * Reusable print button with dropdown menu for various print options
 */

import React, { useRef, useState } from 'react';
import { usePrint } from '@/hooks/usePrint';
import { PrintOptions } from '@/lib/print-service';

export interface PrintButtonProps {
  content: string | HTMLElement;
  contentRef?: React.RefObject<HTMLElement>;
  title?: string;
  options?: PrintOptions;
  variant?: 'icon' | 'text' | 'full';
  size?: 'sm' | 'md' | 'lg';
  showMenu?: boolean;
  onPrintStart?: () => void;
  onPrintComplete?: (success: boolean) => void;
  customLabel?: string;
  className?: string;
}

/**
 * Print button with dropdown menu
 */
export const PrintButton: React.FC<PrintButtonProps> = ({
  content,
  contentRef,
  options = {},
  variant = 'text',
  size = 'md',
  showMenu = true,
  onPrintStart,
  onPrintComplete,
  customLabel,
  className = ''
}) => {
  const { isPrinting, print, printToPDF, preview, silentPrint, error } = usePrint(options);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    onPrintStart?.();
    setShowDropdown(false);

    // Get content from ref if provided
    const displayContent = contentRef?.current || content;
    const result = await print(displayContent);
    onPrintComplete?.(result.success);
  };

  const handlePDF = async () => {
    onPrintStart?.();
    setShowDropdown(false);

    // Get content from ref if provided
    const displayContent = contentRef?.current || content;
    const result = await printToPDF(displayContent);
    onPrintComplete?.(result.success);
  };

  const handlePreview = () => {
    onPrintStart?.();

    // Get content from ref if provided
    const displayContent = contentRef?.current || content;
    setShowDropdown(false);

    preview(displayContent);
    onPrintComplete?.(true);
  };

  const handleSilent = async () => {
    onPrintStart?.();
    setShowDropdown(false);

    // Get content from ref if provided
    const displayContent = contentRef?.current || content;
    const result = await silentPrint(displayContent);
    onPrintComplete?.(result.success);
  };

  // Size styles
  const sizeStyles: Record<string, string> = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  // Variant styles
  let buttonStyles = 'inline-flex items-center gap-2 font-medium transition-all duration-200 ';
  if (variant === 'icon') {
    buttonStyles += 'bg-transparent text-gray-600 hover:text-ink';
  } else if (variant === 'text') {
    buttonStyles += 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700';
  } else {
    buttonStyles += 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 rounded-lg';
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Main button */}
      <button
        onClick={handlePrint}
        disabled={isPrinting}
        className={`${buttonStyles} ${sizeStyles[size]} rounded-lg disabled:opacity-50 disabled:cursor-not-allowed`}
        title={customLabel || 'Print document'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 00-2 2v2a2 2 0 002 2h10a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"
          />
        </svg>
        {(variant === 'text' || variant === 'full') && (customLabel || 'Print')}

        {/* Dropdown toggle */}
        {showMenu && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="ml-1 hover:bg-content-bg/20 p-1 rounded"
            title="More options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {isPrinting && <span className="ml-1 inline-block animate-spin">⟳</span>}
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-content-bg border border-content-border rounded-lg shadow-lg z-50">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 disabled:opacity-50 first:rounded-t-lg flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4H9a2 2 0 00-2 2v2a2 2 0 002 2h10a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
            </svg>
            <span>Print to Printer</span>
          </button>

          <button
            onClick={handlePreview}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-t"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Preview</span>
          </button>

          <button
            onClick={handlePDF}
            disabled={isPrinting}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 border-t"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span>Save as PDF</span>
          </button>

          <button
            onClick={handleSilent}
            disabled={isPrinting}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2 border-t last:rounded-b-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Quick Print</span>
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm z-50">
          {error}
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

/**
 * Simple icon-only print button
 */
export const PrintIconButton: React.FC<Omit<PrintButtonProps, 'variant'>> = (props) => (
  <PrintButton {...props} variant="icon" />
);

/**
 * Large print button with full label
 */
export const PrintActionButton: React.FC<Omit<PrintButtonProps, 'variant' | 'size'>> = (props) => (
  <PrintButton {...props} variant="full" size="md" />
);

export default PrintButton;
