import AsyncStorage from '@react-native-async-storage/async-storage';
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
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
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
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@gardi_theme');
      if (savedTheme !== null) {
        const isDarkMode = savedTheme === 'dark';
        setIsDark(isDarkMode);
        console.log('🎨 LOADED THEME:', isDarkMode ? 'DARK MODE' : 'LIGHT MODE');
      } else {
        const systemTheme = Appearance.getColorScheme();
        const isDarkMode = systemTheme === 'dark';
        setIsDark(isDarkMode);
        console.log('🎨 SYSTEM THEME:', isDarkMode ? 'DARK MODE' : 'LIGHT MODE');
      }
    } catch (error) {
      console.log('❌ Theme load error:', error);
      setIsDark(false);
    }
  };

  const saveThemePreference = async (darkMode: boolean) => {
    try {
      await AsyncStorage.setItem('@gardi_theme', darkMode ? 'dark' : 'light');
      console.log('💾 THEME SAVED:', darkMode ? 'DARK MODE' : 'LIGHT MODE');
    } catch (error) {
      console.log('❌ Theme save error:', error);
    }
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    console.log('🔄 THEME TOGGLE:', isDark ? 'DARK' : 'LIGHT', '→', newIsDark ? 'DARK' : 'LIGHT');
    setIsDark(newIsDark);
    saveThemePreference(newIsDark);
  };

  const setTheme = (darkMode: boolean) => {
    console.log('🎯 SET THEME:', darkMode ? 'DARK MODE' : 'LIGHT MODE');
    setIsDark(darkMode);
    saveThemePreference(darkMode);
  };

  const theme = isDark ? darkTheme : lightTheme;

  // Debug current theme state
  console.log('🎨 CURRENT THEME STATE:', {
    isDark,
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.text
  });

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};