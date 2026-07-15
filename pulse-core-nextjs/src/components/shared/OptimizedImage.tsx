'use client';

import Image, { ImageProps } from 'next/image';
import { CSSProperties } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'alt'> {
  alt: string;
  /** Load with low priority by default for above-the-fold content */
  priority?: boolean;
  /** Add loading placeholder. Can be 'blur', 'empty', or none */
  placeholder?: 'blur' | 'empty';
  /** Optional blur data URL for placeholder effect */
  blurDataURL?: string;
  /** Responsive sizes hint for next/image optimization */
  responsiveSizes?: string;
  /** Enable lazy loading with IntersectionObserver */
  lazyLoad?: boolean;
}

/**
 * Optimized Image Component for Low Bandwidth
 * 
 * Features:
 * - Automatic AVIF/WebP conversion when available
 * - Intelligent lazy loading with fallback
 * - Proper sizing hints for responsive images
 * - Placeholder support for better UX
 * - Native Image CDN optimization
 * 
 * Usage:
 * ```tsx
 * <OptimizedImage
 *   src="/logo.png"
 *   alt="Logo"
 *   width={40}
 *   height={40}
 *   priority={false}
 *   responsiveSizes="(max-width: 768px) 100vw, 50vw"
 * />
 * ```
 */
export default function OptimizedImage({
  alt,
  priority = false,
  placeholder,
  blurDataURL,
  responsiveSizes,
  lazyLoad = true,
  loading,
  sizes,
  style,
  className,
  ...props
}: OptimizedImageProps) {
  // Use provided sizes or responsive default
  const sizeHint = sizes || responsiveSizes || '(max-width: 640px) 100vw, 50vw';

  // Default style for better image rendering
  const defaultStyle: CSSProperties = {
    width: '100%',
    height: 'auto',
  };

  // Combine custom styles with defaults
  const combinedStyle: CSSProperties = {
    ...defaultStyle,
    ...(style as CSSProperties),
  };

  return (
    <Image
      alt={alt}
      loading={loading || (lazyLoad && !priority ? 'lazy' : 'eager')}
      sizes={sizeHint}
      priority={priority}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      style={combinedStyle}
      className={className}
      {...props}
    />
  );
}
