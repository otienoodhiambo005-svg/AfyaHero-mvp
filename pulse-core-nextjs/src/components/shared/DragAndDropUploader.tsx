/**
 * DragAndDropUploader
 *
 * A reusable drag and drop file uploader component with visual feedback.
 * Supports both drag-and-drop and traditional file browser selection.
 */

'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, File, X } from 'lucide-react';

interface DragAndDropUploaderProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
}

export function DragAndDropUploader({
  onFilesSelected,
  accept = '*',
  multiple = false,
  maxSizeMB = 10,
  className = '',
  disabled = false,
}: DragAndDropUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

   // Handle drag events
   const handleDragEnter = useCallback((e: React.DragEvent) => {
     e.preventDefault();
     e.stopPropagation();
     if (!disabled) {
       setIsDragging(true);
     }
   }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Process selected files - defined before use in callbacks
  const handleFiles = useCallback((files: File[]) => {
    setError(null);

    // Filter by accept types
    const acceptedTypes = accept.split(',').map(type => type.trim());
    const filteredFiles = files.filter(file => {
      if (accept === '*') return true;

      return acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          // Extension check
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        } else {
          // MIME type check
          return file.type.match(type.replace('*', '.*'));
        }
      });
    });

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const oversizedFiles = filteredFiles.filter(file => file.size > maxSizeBytes);
    if (oversizedFiles.length > 0) {
      setError(`File(s) too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    // Apply multiple limit
    const finalFiles = multiple ? filteredFiles : [filteredFiles[0]];

    if (finalFiles.length > 0) {
      setSelectedFiles(finalFiles);
      onFilesSelected(finalFiles);
    }
  }, [accept, maxSizeMB, multiple, onFilesSelected]);

  // Handle file selection via input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !disabled) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [disabled, handleFiles]);

  // Remove a file
  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  // Trigger file browser
  const triggerFileBrowser = () => {
    if (fileInputRef.current && !disabled) {
      fileInputRef.current.click();
    }
  };

  // Reset the component
  const reset = () => {
    setSelectedFiles([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      triggerFileBrowser();
    }
  };

  // Expose reset function to parent
  useEffect(() => {
    if (fileInputRef.current) {
      (fileInputRef.current as any).reset = reset;
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={dropZoneRef}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragging ? 'border-emerald-500 bg-emerald-50/50' : 'border-content-border'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileBrowser}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Upload files by dragging and dropping or clicking to browse"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload 
            className={`
              w-12 h-12 mx-auto
              ${isDragging ? 'text-emerald-600' : 'text-slate-400'}
            `} 
          />
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-700">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-slate-500">
              or click to browse files
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {accept === '*' ? 'All file types' : `Accepted: ${accept}`}
              {multiple ? '' : ', Single file'}
            </p>
          </div>
        </div>
      </div>

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Selected Files:</h3>
          <ul className="space-y-2">
            {selectedFiles.map((file, index) => (
              <li 
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between bg-content-surface rounded-lg p-3"
              >
                <div className="flex items-center space-x-3">
                  <File className="w-5 h-5 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}