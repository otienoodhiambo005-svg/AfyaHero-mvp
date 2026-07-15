'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-card border border-content-border bg-content-bg p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-severity-high-bg flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5 text-severity-high" />
          </div>
          <p className="text-sm font-semibold text-ink">
            {this.props.label ? `${this.props.label} failed to load` : 'Component failed to load'}
          </p>
          <p className="text-xs text-slate">An unexpected error occurred. Try refreshing the page.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-portal-primary text-white text-xs font-medium hover:bg-portal-primary-hover transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
