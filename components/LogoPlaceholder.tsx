// Placeholder logo for development. Replace with your company logo.
import * as React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function LogoPlaceholder() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/brand-logo.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'flex-end', // 'center' to center vertically in wrapper
    alignItems: 'center',
  },
  image: {
    width: 800, // Increase for a bigger logo
    height: 300,
  },
});
