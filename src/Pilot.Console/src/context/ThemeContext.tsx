import React, { createContext, useContext, useEffect, useState } from 'react';

type AccentColor = {
  name: string;
  primary: string;
  ring: string;
};

const accentColors: AccentColor[] = [
  { name: 'Indigo', primary: 'oklch(0.585 0.233 277.117)', ring: 'oklch(0.85 0.1 277)' },
  { name: 'Emerald', primary: 'oklch(0.627 0.194 149.214)', ring: 'oklch(0.85 0.1 149)' },
  { name: 'Rose', primary: 'oklch(0.607 0.21 15.228)', ring: 'oklch(0.85 0.1 15)' },
  { name: 'Amber', primary: 'oklch(0.769 0.188 70.08)', ring: 'oklch(0.9 0.1 70)' },
  { name: 'Violet', primary: 'oklch(0.606 0.25 293.528)', ring: 'oklch(0.85 0.1 293)' },
];

interface ThemeContextType {
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  availableColors: AccentColor[];
  glassEnabled: boolean;
  setGlassEnabled: (enabled: boolean) => void;
  transparencyEnabled: boolean;
  setTransparencyEnabled: (enabled: boolean) => void;
  flickerEnabled: boolean;
  setFlickerEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('accent-color');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return accentColors[0];
      }
    }
    return accentColors[0];
  });

  const [glassEnabled, setGlassEnabledState] = useState(() => {
    return localStorage.getItem('theme-glass') !== 'false';
  });

  const [transparencyEnabled, setTransparencyEnabledState] = useState(() => {
    return localStorage.getItem('theme-transparency') !== 'false';
  });

  const [flickerEnabled, setFlickerEnabledState] = useState(() => {
    return localStorage.getItem('theme-flicker') !== 'false';
  });

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
    localStorage.setItem('accent-color', JSON.stringify(color));
  };

  const setGlassEnabled = (enabled: boolean) => {
    setGlassEnabledState(enabled);
    localStorage.setItem('theme-glass', String(enabled));
  };

  const setTransparencyEnabled = (enabled: boolean) => {
    setTransparencyEnabledState(enabled);
    localStorage.setItem('theme-transparency', String(enabled));
  };

  const setFlickerEnabled = (enabled: boolean) => {
    setFlickerEnabledState(enabled);
    localStorage.setItem('theme-flicker', String(enabled));
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', accentColor.primary);
    root.style.setProperty('--ring', accentColor.ring);
    root.style.setProperty('--sidebar-primary', accentColor.primary);
  }, [accentColor]);

  useEffect(() => {
    const root = document.documentElement;
    if (glassEnabled) {
      root.classList.remove('no-glass');
    } else {
      root.classList.add('no-glass');
    }
  }, [glassEnabled]);

  useEffect(() => {
    const root = document.documentElement;
    if (transparencyEnabled) {
      root.classList.remove('no-transparency');
    } else {
      root.classList.add('no-transparency');
    }
  }, [transparencyEnabled]);

  return (
    <ThemeContext.Provider value={{
      accentColor,
      setAccentColor,
      availableColors: accentColors,
      glassEnabled,
      setGlassEnabled,
      transparencyEnabled,
      setTransparencyEnabled,
      flickerEnabled,
      setFlickerEnabled
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAccent() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAccent must be used within a ThemeProvider');
  }
  return context;
}
