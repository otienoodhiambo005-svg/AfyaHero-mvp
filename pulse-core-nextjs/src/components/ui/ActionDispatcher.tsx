'use client';

import React, { useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export type ActionState = 'idle' | 'loading' | 'success' | 'error';

export interface ActionDispatcherProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The primary action text (e.g., "Send to Lab") */
  label: string;
  /** An optional async function to execute. If omitted, acts purely as UI wrapper using controlled state. */
  onAction?: () => Promise<void>;
  /** External state control. If provided, overrides internal state. */
  state?: ActionState;
  /** Icon to render when idle */
  icon?: React.ElementType;
  /** Tailwind color variations based on AfyaHero roles (emerald, blue, rose) */
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * Standardized CTA button for AfyaHero.
 * Handles identical state tracking mapping across all hospital sub-portals
 * (e.g. strict idempotent loops for M-Pesa tracking or Lab execution).
 */
export function ActionDispatcher({
  label,
  onAction,
  state: controlledState,
  icon: Icon,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}: ActionDispatcherProps) {
  const [internalState, setInternalState] = useState<ActionState>('idle');
  const currentState = controlledState || internalState;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (props.onClick) props.onClick(e);

    if (onAction) {
      setInternalState('loading');
      try {
        await onAction();
        setInternalState('success');
        // Reset after 3 seconds on success
        setTimeout(() => setInternalState('idle'), 3000);
      } catch (err) {
        setInternalState('error');
        // Reset immediately on error so they can retry
        setTimeout(() => setInternalState('idle'), 4000);
      }
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent';
      case 'secondary':
        return 'bg-ink hover:bg-charcoal text-content-bg border-content-border/40';
      case 'danger':
        return 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/30';
    }
  };

  const getStateContent = () => {
    switch (currentState) {
      case 'loading':
        return (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
            Complete
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4 mr-2 text-rose-400" />
            Failed. Retry?
          </>
        );
      default:
        return (
          <>
            {Icon && <Icon className="w-4 h-4 mr-2" />}
            {label}
          </>
        );
    }
  };

  return (
    <button
      disabled={disabled || currentState === 'loading'}
      onClick={handleClick}
      className={`
        inline-flex items-center justify-center rounded-card px-4 py-2.5 text-sm font-medium border
        transition-all duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-950
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getVariantStyles()}
        ${currentState === 'success' ? 'bg-emerald-900/50 border-emerald-500/30 text-emerald-300' : ''}
        ${currentState === 'error' ? 'bg-rose-900/50 border-rose-500/30 text-rose-300' : ''}
        ${className}
      `}
      {...props}
    >
      {getStateContent()}
    </button>
  );
}
