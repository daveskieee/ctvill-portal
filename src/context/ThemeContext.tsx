import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeMode = 'light' | 'dark' | 'night' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'night';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = 'ldm_theme';
const LEGACY_THEME_KEY = 'ctvill_theme';

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'night' || stored === 'system') {
        return stored as ThemeMode;
      }
    }
    return 'dark'; // Default to Dark Executive Carbon Slate
  });

  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(getSystemTheme);

  // Listen to OS theme changes if user has selected 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setSystemResolved(mediaQuery.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemResolved;
    }
    return theme;
  }, [theme, systemResolved]);

  const isDark = resolvedTheme === 'dark' || resolvedTheme === 'night';

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_KEY, newTheme);
      localStorage.setItem(LEGACY_THEME_KEY, newTheme);
    }
  };

  const toggleTheme = () => {
    // Cycles between Light and Dark
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const root = document.documentElement;
    // Apply 150ms smooth transition to root
    root.style.transition = 'background-color 150ms ease, color 150ms ease';

    if (resolvedTheme === 'light') {
      root.classList.remove('dark', 'night');
      root.classList.add('light', 'light-mode');
      root.setAttribute('data-theme', 'light');
    } else if (resolvedTheme === 'night') {
      root.classList.remove('light', 'light-mode');
      root.classList.add('dark', 'night');
      root.setAttribute('data-theme', 'night');
    } else {
      root.classList.remove('light', 'light-mode', 'night');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
