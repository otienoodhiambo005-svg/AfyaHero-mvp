/**
 * Image Analysis for Medical Documents
 *
 * Uses AI vision models (Gemini Vision) to analyze medical images
 * including X-rays, lab reports, prescriptions, and other medical documents.
 */

import { callGemini } from './ai-providers';
import logger from './logger';

/**
 * Analyze images using AI vision
 * @param files - Array of image files to analyze
 * @param query - User's query about the images
 * @returns Analysis text or null if failed
 */
export async function analyzeImagesWithAI(
  files: File[],
  query: string
): Promise<string | null> {
  if (!files || files.length === 0) {
    return null;
  }

  try {
    // Convert first image to base64 for analysis
    const firstImage = files[0];
    const base64Data = await fileToBase64(firstImage);

    const systemInstruction = `You are a medical AI assistant trained to analyze medical images and documents.
Your role is to:
1. Describe what you see in the image (type of document, key elements)
2. Identify any relevant medical information visible
3. Highlight important findings that may be clinically relevant
4. Note any potential issues or areas requiring attention

Provide a concise, professional analysis suitable for healthcare professionals.`;

    const prompt = `Analyze this medical image/document. User query: "${query}"

Image data (base64): ${base64Data}

Provide a structured analysis including:
- Document type
- Key observations
- Relevant medical information
- Any concerns or recommendations`;

    const response = await callGemini(prompt, systemInstruction, 'gemini-2.5-pro', 2000, 0.3);

    if (response.success && response.text) {
      return response.text;
    }

    logger.warn('[Image Analysis] AI analysis failed', { error: response.error });
    return null;
  } catch (error) {
    logger.error('[Image Analysis] Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Convert a file to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf';
}

/**
 * Get file size in a human-readable format
 */
export function getHumanReadableFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
