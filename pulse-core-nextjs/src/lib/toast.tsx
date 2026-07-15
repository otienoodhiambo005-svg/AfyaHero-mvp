/**
 * Toast Notification System - User feedback mechanism
 * 
 * Provides comprehensive toast notifications for the AfyaHero Health system including:
 * - Success, error, warning, and info toasts
 * - Toast queue with prioritization
 * - Auto-dismiss with configurable duration
 * - Persistent toasts for important notifications
 * - Accessibility support
 */

'use client';

import { useEffect, useState, useCallback, createContext, useContext, useRef, type ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
  priority?: number; // Higher = more important
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  createdAt: number;
  position?: ToastPosition;
  isExiting?: boolean;
}

export interface ToastOptions extends Omit<Partial<Toast>, 'id' | 'createdAt'> {
  id?: string;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<ToastOptions, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastOptions>) => void;
  clearToasts: () => void;
  clearToastsByType: (type: ToastType) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ─── Toast Manager ──────────────────────────────────────────────────────────

class ToastManager {
  private toasts: Toast[] = [];

  private listeners: Set<() => void> = new Set();

  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    // Check if running in browser
    if (typeof window !== 'undefined') {
      // Load persistent toasts from localStorage
      this.loadPersistentToasts();
    }
  }
  
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
  
  generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  addToast(options: ToastOptions): string {
    const id = options.id ?? this.generateId();
    
    // Check for duplicate (same type and title within 5 seconds)
    const duplicate = this.toasts.find(
      t => t.type === options.type && 
           t.title === options.title && 
           Date.now() - t.createdAt < 5000
    );
    
    if (duplicate && options.type !== 'loading') {
      return duplicate.id;
    }
    
    const toast: Toast = {
      id,
      type: options.type ?? 'info',
      title: options.title ?? '',
      message: options.message,
      duration: options.duration ?? 5000,
      priority: options.priority ?? this.getDefaultPriority(options.type ?? 'info'),
      dismissible: options.dismissible ?? true,
      action: options.action,
      onDismiss: options.onDismiss,
      createdAt: Date.now(),
      position: options.position ?? 'top-right',
    };
    
    // Insert based on priority
    const toastPriority = toast.priority ?? 0;
    const insertIndex = this.toasts.findIndex((t) => (t.priority ?? 0) < toastPriority);
    if (insertIndex === -1) {
      this.toasts.push(toast);
    } else {
      this.toasts.splice(insertIndex, 0, toast);
    }
    
    // Set auto-dismiss timer
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);
      this.timers.set(id, timer);
    }
    
    // Save persistent toasts
    if (toast.duration === 0 || toast.type === 'error') {
      this.savePersistentToasts();
    }
    
    this.notify();
    return id;
  }
  
  removeToast(id: string): void {
    const index = this.toasts.findIndex(t => t.id === id);
    if (index !== -1) {
      const toast = this.toasts[index];
      if (toast.isExiting) return; // Prevent double firing
      
      toast.onDismiss?.();
      toast.isExiting = true;
      this.notify(); // Trigger animation
      
      // Clear timer
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
      
      // Actually remove after animation completes
      setTimeout(() => {
        const removeIndex = this.toasts.findIndex(t => t.id === id);
        if (removeIndex !== -1) {
          this.toasts.splice(removeIndex, 1);
          this.savePersistentToasts();
          this.notify();
        }
      }, 300);
    }
  }
  
  updateToast(id: string, updates: Partial<ToastOptions>): void {
    const toast = this.toasts.find(t => t.id === id);
    if (toast) {
      Object.assign(toast, updates);
      
      // Update timer if duration changed
      if (updates.duration !== undefined) {
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }
        
        if (updates.duration > 0) {
          const newTimer = setTimeout(() => {
            this.removeToast(id);
          }, updates.duration);
          this.timers.set(id, newTimer);
        }
      }
      
      this.notify();
    }
  }
  
  clearToasts(): void {
    // Call onDismiss and trigger exit animation for all toasts
    this.toasts.forEach(toast => {
      if (!toast.isExiting) {
        toast.onDismiss?.();
        toast.isExiting = true;
      }
    });
    
    this.notify();
    
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    setTimeout(() => {
      this.toasts = [];
      this.savePersistentToasts();
      this.notify();
    }, 300);
  }
  
  clearToastsByType(type: ToastType): void {
    const toRemove = this.toasts.filter(t => t.type === type && !t.isExiting);
    toRemove.forEach(toast => {
      toast.onDismiss?.();
      toast.isExiting = true;
      const timer = this.timers.get(toast.id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(toast.id);
      }
    });
    
    if (toRemove.length > 0) {
      this.notify();
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.type !== type || (t.type === type && !toRemove.includes(t)) || !t.isExiting);
        // Ensure clean removal of the specific type
        this.toasts = this.toasts.filter(t => t.type !== type);
        this.savePersistentToasts();
        this.notify();
      }, 300);
    }
  }
  
  getToasts(): Toast[] {
    return [...this.toasts];
  }
  
  getToastsByPosition(position: ToastPosition): Toast[] {
    return this.toasts.filter(t => t.position === position);
  }
  
  private getDefaultPriority(type: ToastType): number {
    switch (type) {
      case 'error': return 100;
      case 'warning': return 80;
      case 'loading': return 60;
      case 'success': return 40;
      case 'info': return 20;
      default: return 50;
    }
  }
  
  private savePersistentToasts(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const persistent = this.toasts.filter(t => t.duration === 0 || t.type === 'error');
      localStorage.setItem('afyahero-toasts', JSON.stringify(persistent));
    } catch {
      // Silently fail - localStorage might be full or unavailable
    }
  }
  
  private loadPersistentToasts(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('afyahero-toasts');
      if (saved) {
        const parsed: Toast[] = JSON.parse(saved);
        // Only load toasts from the last hour
        const oneHourAgo = Date.now() - 3600000;
        parsed.forEach(toast => {
          if (toast.createdAt > oneHourAgo) {
            this.toasts.push(toast);
          }
        });
        localStorage.removeItem('afyahero-toasts');
      }
    } catch {
      // Silently fail
    }
  }
}

const toastManager = new ToastManager();

// ─── Provider Component ─────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    return toastManager.subscribe(() => {
      setToasts(toastManager.getToasts());
    });
  }, []);
  
  const addToast = useCallback((toast: Omit<ToastOptions, 'id'>): string => {
    return toastManager.addToast(toast);
  }, []);
  
  const removeToast = useCallback((id: string) => {
    toastManager.removeToast(id);
  }, []);
  
  const updateToast = useCallback((id: string, updates: Partial<ToastOptions>) => {
    toastManager.updateToast(id, updates);
  }, []);
  
  const clearToasts = useCallback(() => {
    toastManager.clearToasts();
  }, []);
  
  const clearToastsByType = useCallback((type: ToastType) => {
    toastManager.clearToastsByType(type);
  }, []);
  
  // Group toasts by position
  const positions: ToastPosition[] = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
  const toastsByPosition = positions.reduce((acc, pos) => {
    acc[pos] = toasts.filter(t => t.position === pos);
    return acc;
  }, {} as Record<ToastPosition, Toast[]>);
  
  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast, clearToasts, clearToastsByType }}>
      {children as ReactNode}
      
      {/* Toast Containers */}
      <div ref={containerRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {positions.map(position => {
          if (toastsByPosition[position].length === 0) return null;
          
          const isTop = position.startsWith('top');
          const isCenter = position.includes('center');
          const isRight = position.includes('right');
          
          return (
            <div
              key={position}
              className={`absolute flex flex-col gap-2 p-4 ${
                isTop ? 'top-0' : 'bottom-0'
              } ${isCenter ? 'left-1/2 -translate-x-1/2' : isRight ? 'right-0' : 'left-0'}`}
            >
              {toastsByPosition[position].map(toast => (
                <ToastItem
                  key={toast.id}
                  toast={toast}
                  onDismiss={() => removeToast(toast.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Toast Item Component ───────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 200); // Wait for exit animation
  }, [onDismiss]);
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    loading: '⟳',
  };
  
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    loading: 'bg-gray-50 border-gray-200 text-gray-900',
  };
  
  return (
    <div
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`
        pointer-events-auto
w-full max-w-md
        rounded-lg border p-4
        shadow-lg
        transition-all duration-200
        ${colors[toast.type]}
        ${(isExiting || toast.isExiting) ? 'opacity-0 transform translate-x-full' : 'opacity-100'}
        ${toast.type === 'loading' ? 'animate-pulse' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className={`text-lg flex-shrink-0 ${toast.type === 'loading' ? 'animate-spin' : ''}`}>
          {icons[toast.type]}
        </span>
        
        {/* Content */}
        <div className="flex-grow min-w-0">
          <p className="font-semibold text-sm">{toast.title}</p>
          {toast.message && (
            <p className="text-xs mt-1 opacity-80 line-clamp-3">{toast.message}</p>
          )}
          
          {/* Action Button */}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-xs font-medium underline hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        
        {/* Dismiss Button */}
        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        )}
      </div>
      
      {/* Progress Bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <div className="mt-2 h-1 bg-current opacity-20 rounded-full overflow-hidden">
          <div
            className="h-full bg-current transition-all"
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
      
    </div>
  );
}

// ─── Convenience Functions ──────────────────────────────────────────────────

// These can be used outside of React components with the toast manager directly

export const toast = {
  success: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
    toastManager.addToast({ type: 'success', title, ...options }),
  
  error: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
    toastManager.addToast({ type: 'error', title, ...options }),
  
  warning: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
    toastManager.addToast({ type: 'warning', title, ...options }),
  
  info: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
    toastManager.addToast({ type: 'info', title, ...options }),
  
  loading: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
    toastManager.addToast({ type: 'loading', title, ...options }),
  
  dismiss: (id: string) => toastManager.removeToast(id),
  
  update: (id: string, updates: Partial<ToastOptions>) => toastManager.updateToast(id, updates),
  
  clear: () => toastManager.clearToasts(),
  
  clearByType: (type: ToastType) => toastManager.clearToastsByType(type),
};

// ─── Hook for Component Usage ───────────────────────────────────────────────

export function useToastNotification() {
  const context = useContext(ToastContext);
  
  // Return toast functions even outside provider (using manager directly)
  return {
    success: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
      context?.addToast({ type: 'success', title, ...options }) ?? toast.success(title, options),
    
    error: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
      context?.addToast({ type: 'error', title, ...options }) ?? toast.error(title, options),
    
    warning: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
      context?.addToast({ type: 'warning', title, ...options }) ?? toast.warning(title, options),
    
    info: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
      context?.addToast({ type: 'info', title, ...options }) ?? toast.info(title, options),
    
    loading: (title: string, options?: Omit<ToastOptions, 'type' | 'title'>) =>
      context?.addToast({ type: 'loading', title, ...options }) ?? toast.loading(title, options),
    
    dismiss: (id: string) =>
      context?.removeToast(id) ?? toast.dismiss(id),
    
    update: (id: string, updates: Partial<ToastOptions>) =>
      context?.updateToast(id, updates) ?? toast.update(id, updates),
    
    clear: () => context?.clearToasts() ?? toast.clear(),
  };
}

// ─── Predefined Toast Templates ─────────────────────────────────────────────

export const predefinedToasts = {
  // Network status
  networkOffline: () => toast.warning('Network Offline', {
    message: 'You are currently offline. Some features may be limited.',
    duration: 0, // Persistent
    id: 'network-offline',
  }),
  
  networkOnline: () => {
    toast.dismiss('network-offline');
    return toast.success('Network Restored', {
      message: 'You are back online. All features are now available.',
      duration: 3000,
      id: 'network-online',
    });
  },
  
  networkSlow: () => toast.warning('Slow Network', {
    message: 'Network connection is slow. Some operations may take longer.',
    duration: 10000,
    id: 'network-slow',
  }),
  
  // Data operations
  dataSaved: (resourceType?: string) => toast.success(
    `${resourceType || 'Data'} Saved`,
    { message: 'Your changes have been saved successfully.' }
  ),
  
  dataSaveFailed: (resourceType?: string, error?: string) => toast.error(
    `Failed to Save ${resourceType || 'Data'}`,
    { message: error || 'An error occurred while saving. Please try again.' }
  ),
  
  dataDeleted: (resourceType?: string) => toast.success(
    `${resourceType || 'Data'} Deleted`,
    { message: 'The item has been deleted.' }
  ),
  
  // Authentication
  loginSuccess: (userName?: string) => toast.success(
    `Welcome${userName ? `, ${userName}` : ''}!`,
    { message: 'You have successfully logged in.' }
  ),
  
  loginFailed: (reason?: string) => toast.error(
    'Login Failed',
    { message: reason || 'Invalid credentials. Please try again.' }
  ),
  
  logoutSuccess: () => toast.info('Logged Out', {
    message: 'You have been successfully logged out.',
    duration: 3000,
  }),
  
  // Medical operations
  prescriptionCreated: () => toast.success('Prescription Created', {
    message: 'The prescription has been created and sent to pharmacy.',
  }),
  
  labOrderPlaced: () => toast.success('Lab Order Placed', {
    message: 'Lab tests have been ordered. Results will be available soon.',
  }),
  
  vitalSignsRecorded: () => toast.success('Vital Signs Recorded', {
    message: 'Patient vitals have been saved.',
  }),
  
  // AI operations
  aiQueryProcessing: () => toast.loading('Processing AI Query', {
    message: 'Analyzing your request...',
    duration: 0, // Until completed
    id: 'ai-processing',
  }),
  
  aiQueryComplete: () => {
    toast.dismiss('ai-processing');
    return toast.success('AI Analysis Complete', {
      message: 'Your query has been processed.',
    });
  },
  
  aiQueryFailed: (error?: string) => {
    toast.dismiss('ai-processing');
    return toast.error('AI Analysis Failed', {
      message: error || 'An error occurred while processing your query.',
    });
  },
  
  // Inventory
  lowStockAlert: (itemName: string, currentStock: number) => toast.warning(
    'Low Stock Alert',
    {
      message: `${itemName}: Only ${currentStock} units remaining.`,
      priority: 90,
      action: {
        label: 'View Inventory',
        onClick: () => window.location.href = '/pharmacy/inventory',
      },
    }
  ),
  
  outOfStockAlert: (itemName: string) => toast.error(
    'Out of Stock',
    {
      message: `${itemName} is currently out of stock.`,
      priority: 95,
    }
  ),
};