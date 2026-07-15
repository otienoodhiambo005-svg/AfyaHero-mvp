/**
 * Profile Picture Upload Component
 * Drag and drop image uploader for profile avatars
 */
'use client';

import { useState, useRef, useCallback } from 'react';
import { User, Upload, X } from 'lucide-react';
import Image from 'next/image';
import logger from '@/lib/logger';

interface ProfilePictureUploaderProps {
  currentAvatar?: string | null;
  onUploadComplete?: (url: string) => void;
}

export default function ProfilePictureUploader({
  currentAvatar,
  onUploadComplete,
}: ProfilePictureUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatar || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      // Client side validation
      if (file.size > 2 * 1024 * 1024) {
        setError('File too large. Maximum 2MB allowed');
        return;
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Invalid file type. Only JPG, PNG and WebP allowed');
        return;
      }

      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Upload file
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/profile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setPreview(result.avatarUrl);
      onUploadComplete?.(result.avatarUrl);
      logger.info('Profile picture uploaded successfully');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview(currentAvatar || null);
    } finally {
      setUploading(false);
    }
  }, [currentAvatar, onUploadComplete]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const clearAvatar = useCallback(() => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {preview ? (
          <Image src={preview} alt="Profile" width={128} height={128} className="w-full h-full object-cover" />
        ) : (
          <User className="w-12 h-12 text-gray-400" />
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!uploading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <Upload className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      {preview && !uploading && (
        <button
          onClick={clearAvatar}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600"
        >
          <X className="w-4 h-4" />
          Remove
        </button>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      <p className="text-xs text-slate text-center">
        Click or drag image to upload<br/>
        Maximum 2MB • JPG, PNG, WebP
      </p>
    </div>
  );
}