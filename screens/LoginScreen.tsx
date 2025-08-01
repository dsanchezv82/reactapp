import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const [biometricError, setBiometricError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [biometricSwitchError, setBiometricSwitchError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // On mount, check if biometric is enabled
  useEffect(() => {
    (async () => {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      setBiometricEnabled(enabled === 'true');
      setCheckingBiometric(false);
    })();
  }, []);

  const performLogin = async () => {
    // Set authentication token - this triggers navigation to main app
    await AsyncStorage.setItem('userToken', 'logged_in');
    console.log('Login completed, userToken set');
  };

  const handleBiometricAuth = async () => {
    setBiometricError('');
    setIsLoggingIn(true);
    
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        setBiometricError('Biometric authentication not available.');
        setIsLoggingIn(false);
        return;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with Face ID / Biometrics',
        fallbackLabel: 'Enter Passcode',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        setError('');
        await performLogin();
      } else {
        setBiometricError('Authentication failed.');
        setIsLoggingIn(false);
      }
    } catch (e) {
      setBiometricError('Biometric authentication error.');
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setIsLoggingIn(true);

    // Simulate login validation (replace with real backend call)
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Check if biometric prompt should be shown BEFORE setting token
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      
      if (enabled !== 'true') {
        // Show biometric setup prompt but DON'T login yet
        setShowBiometricPrompt(true);
        setIsLoggingIn(false);
      } else {
        // User already has biometric setup, proceed with login
        await performLogin();
      }
    } catch (error) {
      setError('Login failed. Please try again.');
      setIsLoggingIn(false);
    }
  };

  const handleAcceptBiometric = async () => {
    try {
      await AsyncStorage.setItem('biometricEnabled', 'true');
      setShowBiometricPrompt(false);
      setBiometricEnabled(true);
      
      // Now perform the actual login after biometric setup
      await performLogin();
    } catch (error) {
      setError('Failed to enable biometric authentication.');
      setShowBiometricPrompt(false);
    }
  };

  const handleDeclineBiometric = async () => {
    try {
      await AsyncStorage.setItem('biometricEnabled', 'false');
      setShowBiometricPrompt(false);
      setBiometricEnabled(false);
      
      // Perform login without biometric setup
      await performLogin();
    } catch (error) {
      setError('Login failed. Please try again.');
      setShowBiometricPrompt(false);
    }
  };

  if (checkingBiometric) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image 
          source={require('../assets/images/brand-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      {biometricEnabled && !isLoggingIn ? (
        <View style={styles.biometricSection}>
          <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
            <Text style={styles.biometricButtonText}>Login with Face ID / Biometrics</Text>
          </TouchableOpacity>
          {biometricError ? <Text style={styles.error}>{biometricError}</Text> : null}
          <Text style={styles.orText}>or login with credentials</Text>
        </View>
      ) : null}
      
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!isLoggingIn}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoggingIn}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity 
        style={[styles.loginButton, isLoggingIn && styles.loginButtonDisabled]} 
        onPress={handleLogin}
        disabled={isLoggingIn}
      >
        <Text style={styles.loginButtonText}>
          {isLoggingIn ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>

      <View style={styles.biometricToggle}>
        <Text style={styles.toggleLabel}>Face ID / Biometrics</Text>
        <Switch
          value={biometricEnabled}
          disabled={isLoggingIn}
          onValueChange={async (value) => {
            if (value && (!username || !password)) {
              setBiometricSwitchError('Please log in first before enabling Face ID / Biometrics.');
              setTimeout(() => setBiometricSwitchError(''), 3000);
              return;
            }
            await AsyncStorage.setItem('biometricEnabled', value ? 'true' : 'false');
            setBiometricEnabled(value);
          }}
        />
      </View>
      {biometricSwitchError ? (
        <Text style={styles.switchError}>{biometricSwitchError}</Text>
      ) : null}

      {/* Biometric setup modal - prevent auto-dismissal */}
      <Modal 
        visible={showBiometricPrompt} 
        transparent 
        animationType="fade"
        onRequestClose={() => {}} // Prevent Android back button dismissal
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enable Face ID / Biometric Login?</Text>
            <Text style={styles.modalDescription}>
              Would you like to use Face ID or biometrics to log in faster next time?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonAccept} 
                onPress={handleAcceptBiometric}
              >
                <Text style={styles.modalButtonTextAccept}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButtonDecline} 
                onPress={handleDeclineBiometric}
              >
                <Text style={styles.modalButtonTextDecline}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  logoWrapper: {
    width: '100%',
    marginTop: 32,
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#6E6E73',
  },
  biometricSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  biometricButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 8,
  },
  biometricButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  orText: {
    fontSize: 14,
    color: '#6E6E73',
    marginTop: 8,
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  error: {
    color: 'red',
    marginBottom: 12,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
    width: '100%',
  },
  loginButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  biometricToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 16,
    marginRight: 12,
    color: '#1D1D1F',
  },
  switchError: {
    color: 'red',
    marginBottom: 8,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    width: 320,
    maxWidth: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1D1D1F',
  },
  modalDescription: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#6E6E73',
    lineHeight: 22,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButtonAccept: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    marginRight: 8,
  },
  modalButtonTextAccept: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  modalButtonDecline: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    marginLeft: 8,
  },
  modalButtonTextDecline: {
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
});
