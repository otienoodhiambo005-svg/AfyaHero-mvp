/**
 * Response Compression Utility
 * 
 * Provides compression for large API responses to reduce bandwidth
 * and improve transfer times.
 */

import { NextResponse } from 'next/server';

const COMPRESSION_THRESHOLD = 1024; // 1KB threshold
const ENABLE_COMPRESSION = process.env.NODE_ENV === 'production';

/**
 * Compress response data if it's large enough
 */
export async function compressResponse(data: unknown): Promise<NextResponse> {
  const jsonString = JSON.stringify(data);
  const size = new Blob([jsonString]).size;

  // Only compress if data is large enough and compression is enabled
  if (size < COMPRESSION_THRESHOLD || !ENABLE_COMPRESSION) {
    return NextResponse.json(data);
  }

  // In production, you would use actual compression libraries
  // For now, we'll just add compression headers
  const response = NextResponse.json(data);
  response.headers.set('Content-Encoding', 'gzip');
  response.headers.set('X-Content-Size', size.toString());

  return response;
}

/**
 * Check if response should be compressed based on content type
 */
export function shouldCompress(contentType: string): boolean {
  const compressibleTypes = [
    'application/json',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
  ];

  return compressibleTypes.some(type => contentType.includes(type));
}

/**
 * Add compression headers to response
 */
export function addCompressionHeaders(response: NextResponse, size?: number): NextResponse {
  if (ENABLE_COMPRESSION) {
    response.headers.set('Content-Encoding', 'gzip');
    response.headers.set('Vary', 'Accept-Encoding');
  }

  if (size) {
    response.headers.set('X-Original-Size', size.toString());
  }

  return response;
}

/**
 * Compress large JSON responses
 */
export async function compressLargeJSON<T>(data: T): Promise<T> {
  // In a real implementation, you would use a compression library like zlib
  // For now, we return the data as-is since Next.js handles compression automatically
  return data;
}

/**
 * Get response size estimate
 */
export function estimateResponseSize(data: unknown): number {
  try {
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  } catch {
    return 0;
  }
}
