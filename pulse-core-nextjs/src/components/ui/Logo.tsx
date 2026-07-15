'use client';

import React from 'react';

interface LogoProps {
  className?: string;
  color?: string;
  strokeWidth?: number;
}

export function LogoSVG({ className = 'w-12 h-12', color = '#1E3D2F', strokeWidth = 9 }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer capsule */}
      <rect
        x="15"
        y="10"
        width="70"
        height="100"
        rx="35"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Head */}
      <circle cx="50" cy="40" r="9" fill={color} />
      {/* Inner body loop */}
      <path
        d="M 50 96 C 36 96 36 66 50 66 C 64 66 64 96 50 96 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoText({ className = 'text-2xl font-bold', color = 'text-[#1E3D2F]' }: { className?: string; color?: string }) {
  return (
    <span className={`font-logo tracking-tight leading-none ${color} ${className}`}>
      AfyaHero
    </span>
  );
}
