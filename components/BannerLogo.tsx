import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function BannerLogo() {
  return (
    <Image
      source={require('../assets/images/brand-logo.png')}
      style={styles.logo}
      accessibilityLabel="App Logo"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 260,   // Increased width
    height: 140,  // Increased height
    resizeMode: 'contain',
  },
});