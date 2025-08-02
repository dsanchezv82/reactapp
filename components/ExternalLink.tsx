import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import React from 'react';
import {
  Alert,
  GestureResponderEvent,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity
} from 'react-native';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  style?: any;
  textStyle?: any;
}

export function ExternalLink({ href, children, style, textStyle }: ExternalLinkProps) {
  const handlePress = async (event: GestureResponderEvent) => {
    event.preventDefault();

    try {
      if (Platform.OS === 'web') {
        // On web, open in new tab
        window.open(href, '_blank');
      } else {
        // On mobile, use in-app browser for better UX
        await openBrowserAsync(href, {
          // Cross-platform browser options - using proper enum
          presentationStyle: WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: '#007AFF',
        });
      }
    } catch (error) {
      // Fallback to system browser if in-app browser fails
      console.log('In-app browser failed, falling back to system browser:', error);
      try {
        await Linking.openURL(href);
      } catch (linkingError) {
        Alert.alert(
          'Unable to Open Link',
          'Cannot open the requested link. Please check your internet connection.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.linkText, textStyle]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});
