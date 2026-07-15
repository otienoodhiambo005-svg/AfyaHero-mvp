/**
 * AfyaHero Design System Tokens
 * Centralized source of truth for colors, spacing, typography, and shadows
 * Import from here instead of hardcoding values throughout the app
 */

export const tokens = {
  // Primary AfyaHero Blue Palette
  colors: {
    // Primary scale
    primary: {
      50: '#E8F4FB',
      100: '#D5EDF8',
      200: '#BBE1FA',
      300: '#89C4E8',
      400: '#5DA0D0',
      500: '#3282B8', // Primary brand color
      600: '#2A6E9E',
      700: '#0F4C75',
      800: '#1E3349',
      900: '#0F172A',
    },
    
    // Forest/Dark palette
    forest: {
      DEFAULT: '#0F4C75',
      mid: '#0A3A5E',
      light: '#1E3349',
      dark: '#1B262C',
    },
    
    // Portal accent colors (must match layout.tsx ACCENT constants)
    portals: {
      medical: '#2563EB',      // Royal Blue
      pharmacy: '#059669',     // Emerald Green
      lab: '#7C3AED',          // Violet
      reception: '#D97706',    // Amber
      admin: '#DC2626',        // Red
    },
    
    // Neutral scale
    neutral: {
      white: '#FFFFFF',
      offWhite: '#E8F4FB',
      paper: '#D5EDF8',
      fog: '#BBE1FA',
      mist: '#89C4E8',
      slate: '#4A6B7A',
      charcoal: '#253540',
      ink: '#1B262C',
    },
    
    // Semantic colors
    severity: {
      high: '#EF4444',
      highBg: '#FEE2E2',
      medium: '#F59E0B',
      mediumBg: '#FEF3C7',
      low: '#3282B8',
      lowBg: '#D5EDF8',
    },
    
    // AI-specific colors
    ai: {
      badgeBg: '#D5EDF8',
      badgeText: '#0F4C75',
      confirmedBg: '#E8F4FB',
      confirmedText: '#0F4C75',
    },
    
    // Content surface colors
    surface: {
      bg: '#FFFFFF',
      canvas: '#F4F8FC',
      content: '#E8F4FB',
      subtle: '#F8FBFD',
      border: '#BBE1FA',
      borderStrong: '#D6E3EE',
      vanilla: '#F7F1E6',
      glass: 'rgba(255, 255, 255, 0.03)',
    },
    
    // Status colors
    status: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3282B8',
    },
  },
  
  // Spacing scale (in pixels, matches Tailwind defaults)
  spacing: {
    0: '0',
    px: '1px',
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    2.5: '10px',
    3: '12px',
    3.5: '14px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    9: '36px',
    10: '40px',
    11: '44px',
    12: '48px',
    14: '56px',
    16: '64px',
    20: '80px',
    24: '96px',
    28: '112px',
    32: '128px',
    36: '144px',
    40: '160px',
    44: '176px',
    48: '192px',
    52: '208px',
    56: '224px',
    60: '240px',
    64: '256px',
    72: '288px',
    80: '320px',
    96: '384px',
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: ['DM Sans', 'system-ui', 'sans-serif'],
      serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      mono: ['DM Mono', 'ui-monospace', 'monospace'],
      logo: ['Quera', 'Cormorant Garamond', 'serif'],
    },
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '40px' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    letterSpacing: {
      tight: '-0.01em',
      normal: '0',
      wide: '0.02em',
      wider: '0.08em',
    },
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    DEFAULT: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
    md: '0 4px 10px -2px rgba(15, 23, 42, 0.08)',
    lg: '0 10px 18px -6px rgba(15, 23, 42, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
    // Portal-specific shadows with accent color
    portal: (accentColor: string) => `0 4px 16px ${accentColor}30`,
    card: '0 1px 2px rgba(15, 23, 42, 0.05), 0 10px 20px rgba(15, 23, 42, 0.04)',
    modal: '0 8px 32px rgba(0, 0, 0, 0.12)',
    dropdown: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '2px',
    DEFAULT: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    '2xl': '16px',
    '3xl': '24px',
    full: '9999px',
  },

  // Layout rhythm for dashboards and data-heavy pages
  layout: {
    sectionGap: '24px',
    cardPadding: '20px',
    cardPaddingCompact: '16px',
    tableCellY: '12px',
    tableCellX: '16px',
  },
  
  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    DEFAULT: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  // Z-index scale
  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
    aiChat: 10000,
  },
  
  // Breakpoints (in pixels)
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// Utility type for portal colors
export type PortalType = keyof typeof tokens.colors.portals;

// Helper to get portal color
export function getPortalColor(portal: PortalType): string {
  return tokens.colors.portals[portal];
}

// Helper to get color with opacity
export function withOpacity(color: string, opacity: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Handle rgb colors
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  return color;
}

// Export individual token categories for convenience
export const { colors, spacing, typography, shadows, borderRadius, transitions, zIndex, breakpoints, layout } = tokens;
