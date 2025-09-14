import { Platform, Text, type TextProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'subtitle' | 'secondary';
};

/**
 * Cross-platform themed text component optimized for both iOS and Android
 * Handles platform-specific typography, font weights, and accessibility
 */
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const { theme, isDark } = useTheme();

  // Cross-platform color handling
  const color = lightColor && darkColor 
    ? (isDark ? darkColor : lightColor)
    : type === 'secondary'
      ? theme.colors.textSecondary
      : theme.colors.text;

  // Platform-specific typography for optimal mobile UX
  const getTypeStyle = () => {
    const baseStyle = {
      // Android-specific font rendering improvements
      ...(Platform.OS === 'android' && {
        includeFontPadding: false,
        textAlignVertical: 'center' as const,
      }),
    };

    switch (type) {
      case 'title':
        return {
          ...baseStyle,
          fontSize: Platform.select({
            ios: 24,      // iOS Human Interface Guidelines
            android: 22,  // Material Design larger text scale
          }),
          fontWeight: Platform.select({
            ios: 'bold' as const,
            android: '700' as const,  // Android prefers numeric weights
          }),
          lineHeight: Platform.select({
            ios: 32,
            android: 28,  // Tighter line height for Android
          }),
          // Android Material Design letter spacing
          ...(Platform.OS === 'android' && {
            letterSpacing: 0.15,
          }),
        };

      case 'subtitle':
        return {
          ...baseStyle,
          fontSize: Platform.select({
            ios: 16,
            android: 16,
          }),
          fontWeight: Platform.select({
            ios: '600' as const,
            android: '500' as const,  // Medium weight for Android
          }),
          lineHeight: Platform.select({
            ios: 24,
            android: 22,
          }),
          ...(Platform.OS === 'android' && {
            letterSpacing: 0.1,
          }),
        };

      case 'secondary':
        return {
          ...baseStyle,
          fontSize: Platform.select({
            ios: 14,
            android: 14,
          }),
          fontWeight: Platform.select({
            ios: '400' as const,
            android: '400' as const,
          }),
          lineHeight: Platform.select({
            ios: 20,
            android: 18,
          }),
          // Platform-specific opacity for secondary text
          opacity: Platform.select({
            ios: 0.8,
            android: 0.75,  // Slightly less opacity for Android
          }),
          ...(Platform.OS === 'android' && {
            letterSpacing: 0.25,
          }),
        };

      default:
        return {
          ...baseStyle,
          fontSize: Platform.select({
            ios: 16,
            android: 16,
          }),
          fontWeight: Platform.select({
            ios: '400' as const,
            android: '400' as const,
          }),
          lineHeight: Platform.select({
            ios: 24,
            android: 22,
          }),
          ...(Platform.OS === 'android' && {
            letterSpacing: 0.5,
          }),
        };
    }
  };

  return (
    <Text
      style={[
        { color },
        getTypeStyle(),
        style,
      ]}
      // Android accessibility improvements
      {...(Platform.OS === 'android' && {
        accessible: true,
        accessibilityRole: 'text',
      })}
      {...rest}
    />
  );
}

export default ThemedText;
