// Global type declarations for browser APIs not in standard TypeScript lib

declare global {
  interface Navigator {
    connection?: {
      effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
      addEventListener: (type: string, handler: () => void) => void;
      removeEventListener: (type: string, handler: () => void) => void;
    };
  }
}

export {};
