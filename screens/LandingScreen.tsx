import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BannerLogoSvg from '../components/BannerLogoSvg';

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <BannerLogoSvg width={220} height={80} color="#007AFF" />
      </View>
      <View style={styles.spacer} />
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Button 1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Button 2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Button 3</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Button 4</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  banner: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 32,
  },
  spacer: {
    flex: 1,
  },
  buttonsContainer: {
    width: '100%',
    padding: 16,
    paddingBottom: 32,
  },
  button: {
    width: '100%',
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
