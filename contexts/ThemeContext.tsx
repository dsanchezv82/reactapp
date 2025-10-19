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
    background: '#000000',
    surface: '#1C1C1E',
    primary: '#0A84FF',
    secondary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
  },
  isDark: true,
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
}

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
    console.log('🎨 ThemeProvider mounted');
    console.log('🎨 System color scheme:', systemTheme);
    console.log('🎨 Initial isDark state:', initialIsDark);

    // Listen for system appearance changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      console.log('🔔 Appearance change detected!');
      console.log('🎨 New color scheme:', colorScheme);
      const isDarkMode = colorScheme === 'dark';
      setIsDark(isDarkMode);
      console.log('🎨 Updated isDark state to:', isDarkMode);
    });

    // Cleanup listener on unmount
    return () => {
      console.log('🎨 ThemeProvider unmounting, removing listener');
      subscription.remove();
    };
  }, []);

  const theme = isDark ? darkTheme : lightTheme;

  // Debug current theme state
  console.log('🎨 CURRENT THEME STATE:', {
    isDark,
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.text
  });

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};