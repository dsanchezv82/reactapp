import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export interface Theme {
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
    overlay: string;
    success: string;
    warning: string;
    error: string;
  };
  isDark: boolean;
}

const lightTheme: Theme = {
  colors: {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    primary: '#007AFF',
    secondary: '#F0F8FF',
    text: '#1D1D1F',
    textSecondary: '#6E6E73',
    border: '#E5E5EA',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.3)',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
  },
  isDark: false,
};

const darkTheme: Theme = {
  colors: {
    background: '#0A0A0A',      // Custom dark background (almost black with slight warmth)
    surface: '#1A1A1A',         // Custom dark surface
    primary: '#00ACB4',         // Gardi teal brand color
    secondary: '#1E2A2D',       // Darker teal-tinted secondary
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',   // Slightly lighter secondary text
    border: '#2A2A2A',          // Subtle border
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
  isDark: true,
};

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    // Set initial theme based on system appearance
    const systemTheme = Appearance.getColorScheme();
    const initialIsDark = systemTheme === 'dark';
    setIsDark(initialIsDark);

    // Listen for system appearance changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const isDarkMode = colorScheme === 'dark';
      setIsDark(isDarkMode);
    });

    // Cleanup listener on unmount
    return () => {
      subscription.remove();
    };
  }, []);

  const theme = isDark ? darkTheme : lightTheme;
  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};