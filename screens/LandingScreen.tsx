import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Image 
          source={require('../assets/images/brand-logo.png')} // Update with your logo path
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to Gardi</Text>
          <Text style={styles.welcomeSubtitle}>
            Protecting teens. Empowering families. Preventing crashes.
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>🔐 Gardi Secure</Text>
            <Text style={styles.featureDescription}>
              Keeping your loved ones safe
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>📱 Android/iOS</Text>
            <Text style={styles.featureDescription}>
              Seamless experience across iOS and Android devices
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureTitle}>⚡ Eyes in the sky</Text>
            <Text style={styles.featureDescription}>
              Track em down
            </Text>
          </View>
        </View>
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 32,
  },
  logo: {
    width: 220,
    height: 80,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100, // Extra padding to account for tab bar
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D1D1F',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6E6E73',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6E6E73',
    lineHeight: 20,
  },
});


