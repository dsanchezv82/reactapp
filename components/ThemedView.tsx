import { View, type ViewProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  surface?: boolean;
};

/**
 * Mobile-optimized themed view component for cross-platform compatibility
 * Automatically switches between light and dark theme colors
 */
export function ThemedView({ 
  style, 
  lightColor, 
  darkColor, 
  surface = false,
  ...otherProps 
}: ThemedViewProps) {
  const { theme, isDark } = useTheme();

  // Determine background color based on theme and props
  const backgroundColor = lightColor && darkColor 
    ? (isDark ? darkColor : lightColor)
    : surface 
      ? theme.colors.surface 
      : theme.colors.background;

  return (
    <View 
      style={[{ backgroundColor }, style]} 
      {...otherProps} 
    />
  );
}

export default ThemedView;
