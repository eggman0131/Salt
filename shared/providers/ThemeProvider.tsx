import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Theme Provider - Manages light/dark mode app-wide
 * 
 * AI USAGE:
 * 1. Wrap your app in <ThemeProvider> (typically in App.tsx or index.tsx)
 * 2. Use useTheme() hook in any component to access theme state
 * 3. Call toggleTheme() to switch between light/dark
 * 4. Theme persists in localStorage
 * 
 * IMPLEMENTATION:
 * - Light mode is primary, dark mode is alternative color palette
 * - Theme stored in localStorage as 'theme' key
 * - Applies/removes .dark class on document.documentElement
 * - Respects system preference on first load if no stored preference
 * 
 * @example
 * // In App.tsx
 * <ThemeProvider>
 *   <YourApp />
 * </ThemeProvider>
 * 
 * // In any component
 * const { theme, toggleTheme } = useTheme();
 * <Button onClick={toggleTheme}>
 *   {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
 * </Button>
 */

type Theme = 'light' | 'dark';

interface ThemeContextType {
  /** Current theme: 'light' or 'dark' */
  theme: Theme;
  /** Toggle between light and dark mode */
  toggleTheme: () => void;
  /** Set specific theme */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme if no localStorage value - default: 'light' */
  defaultTheme?: Theme;
  /** Use system preference as fallback - default: true */
  useSystemPreference?: boolean;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  useSystemPreference = true,
}) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Check system preference if enabled
    if (useSystemPreference && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Fall back to default
    return defaultTheme;
  });

  useEffect(() => {
    // Apply theme class to document root
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Persist to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme Hook - Access theme state and controls
 * 
 * AI USAGE:
 * Import and use in any component that needs theme awareness
 * 
 * @example
 * const { theme, toggleTheme } = useTheme();
 * 
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
