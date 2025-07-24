import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function BrandLogo() {
  return (
    <Image source={require('../assets/images/brand-logo.png')} style={styles.logo} />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 100,
    height: 60,
    resizeMode: 'contain',
  },
});
