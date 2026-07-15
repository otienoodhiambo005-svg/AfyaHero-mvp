'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type FacilityTheme = 'hospital' | 'clinic' | 'lab' | 'pharmacy';
type ContentMode = 'light' | 'dark';

interface ThemeContextType {
  facilityTheme: FacilityTheme;
  contentMode: ContentMode;
  setFacilityTheme: (theme: FacilityTheme) => void;
  setContentMode: (mode: ContentMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ 
  children,
  defaultFacility = 'hospital',
  defaultMode = 'light'
}: { 
  children: React.ReactNode;
  defaultFacility?: FacilityTheme;
  defaultMode?: ContentMode;
}) {
  const [facilityTheme, setFacilityTheme] = useState<FacilityTheme>(defaultFacility);
  const [contentMode, setContentMode] = useState<ContentMode>(defaultMode);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedFacility = localStorage.getItem('afya-facility-theme') as FacilityTheme;
    const savedMode = localStorage.getItem('afya-content-mode') as ContentMode;

    // Defer setState to avoid synchronous setState in effect
    if (savedFacility) setTimeout(() => setFacilityTheme(savedFacility), 0);
    if (savedMode) setTimeout(() => setContentMode(savedMode), 0);
  }, []);

  // Update data-attributes on <html> when state changes
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-facility-theme', facilityTheme);
    root.setAttribute('data-content-mode', contentMode);
    
    localStorage.setItem('afya-facility-theme', facilityTheme);
    localStorage.setItem('afya-content-mode', contentMode);
  }, [facilityTheme, contentMode]);

  return (
    <ThemeContext.Provider value={{ facilityTheme, contentMode, setFacilityTheme, setContentMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
