'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VideoBackgroundProps {
  /**
   * Path to the video file served from /public (e.g. '/media/onboarding-bg.mp4').
   * Rendered only when connectivity permits.
   */
  src: string;
  /**
   * Fallback static image path used as the <video> poster AND as the CSS
   * background when the video cannot play. Defaults to '/login-bg.png'.
   */
  poster?: string;
  /**
   * Additional Tailwind / CSS overlay applied on top of the video or fallback.
   * Defaults to the AfyaHero brand gradient.
   */
  overlayClassName?: string;
  /** Rendered as children — your page content, positioned above the backdrop. */
  children: React.ReactNode;
  /** Extra class applied to the outermost <main> wrapper. */
  className?: string;
}

// ─── Network type detection ─────────────────────────────────────────────────────

/** Returns true when the browser reports a slow / save-data context. */
function isLowConnectivity(): boolean {
  if (typeof navigator === 'undefined') return false;

  // navigator.connection is not in the standard TS lib — cast to any
   
  const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
  if (!conn) return false;

  const slow = ['slow-2g', '2g'];
  if (slow.includes(conn.effectiveType)) return true;
  if (conn.saveData === true) return true;
  return false;
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Full-screen backdrop that attempts to autoplay a looping, muted background
 * video. Falls back gracefully to a static image + gradient when:
 *   • The browser reports slow / save-data connectivity
 *   • The video element emits an error
 *   • prefers-reduced-motion is active (video hidden via CSS)
 *
 * Children are rendered in a relative z-10 layer above the backdrop.
 */
export function VideoBackground({
  src,
  poster = '/login-bg.png',
  overlayClassName,
  children,
  className = '',
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoActive, setVideoActive] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    // Skip video on low-connectivity networks
    if (isLowConnectivity()) {
      // Defer setState to avoid synchronous setState in effect
      setTimeout(() => setVideoFailed(true), 0);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const onCanPlay = () => setVideoActive(true);
    const onError = () => setVideoFailed(true);

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    // Attempt to play — some browsers need an explicit call after event listeners
    video.play().catch(() => {
      // autoplay blocked — treat the same as a failure and fall through to image
      setVideoFailed(true);
    });

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, []);

  const defaultOverlay =
    'absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.24),transparent_33%),linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.76))]';

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-slate-950 text-white ${className}`}
    >
      {/* ── Layer 1: Static fallback (always present, video sits on top) ────── */}
      <div
className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-150"
        style={{
          backgroundImage: `url('${poster}')`,
          // When video is active hide the static poster, otherwise show it
          opacity: videoActive ? 0 : 1,
        }}
        aria-hidden="true"
      />

      {/* ── Layer 2: Video (hidden until ready; skipped when connectivity poor) */}
      {!videoFailed && (
        <video
          ref={videoRef}
className={`absolute inset-0 h-full w-full object-cover motion-reduce:hidden transition-opacity duration-150 ${
            videoActive ? 'opacity-100' : 'opacity-0'
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          aria-hidden="true"
        >
          <source src={src} type="video/mp4" />
        </video>
      )}

      {/* ── Layer 3: Light veil (keeps text legible without darkening the media) ─── */}
      <div className="absolute inset-0 bg-slate-950/15" />

      {/* ── Layer 4: Subtle brand gradient overlay ───────────────────────────── */}
      <div
        className={cn(
          overlayClassName ?? 
          'absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(50,130,184,0.15),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_40%),linear-gradient(135deg,rgba(2,6,23,0.3),rgba(15,23,42,0.15))]'
        )}
        aria-hidden="true"
      />

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        {children}
      </div>
    </main>
  );
}
