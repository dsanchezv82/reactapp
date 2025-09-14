import { useTheme } from '../contexts/ThemeContext';

/**
 * Mobile-optimized theme color hook for cross-platform compatibility
 * Provides easy access to theme colors with proper TypeScript support
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof lightColors & keyof typeof darkColors
) {
  const { theme, isDark } = useTheme();
  const colorFromProps = props[isDark ? 'dark' : 'light'];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme.colors[colorName] || lightColors[colorName];
  }
}

// Default color mappings for mobile UI consistency
const lightColors = {
  text: '#1D1D1F',
  background: '#F5F5F7',
  surface: '#FFFFFF',
  primary: '#007AFF',
  secondary: '#F0F8FF',
  textSecondary: '#6E6E73',
  border: '#E5E5EA',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.3)',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
};

const darkColors = {
  text: '#FFFFFF',
  background: '#000000',
  surface: '#1C1C1E',
  primary: '#0A84FF',
  secondary: '#2C2C2E',
  textSecondary: '#8E8E93',
  border: '#38383A',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
};
