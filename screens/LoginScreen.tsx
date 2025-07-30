import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Button, Modal, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import BannerLogoSvg from '../components/BannerLogoSvg';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const [biometricError, setBiometricError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [biometricSwitchError, setBiometricSwitchError] = useState('');

  // On mount, check if biometric is enabled
  useEffect(() => {
    (async () => {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      setBiometricEnabled(enabled === 'true');
      setCheckingBiometric(false);
    })();
  }, []);

  const handleBiometricAuth = async () => {
    setBiometricError('');
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setBiometricError('Biometric authentication not available.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with Face ID / Biometrics',
        fallbackLabel: 'Enter Passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setError('');
        router.replace('/landing');
      } else {
        setBiometricError('Authentication failed.');
      }
    } catch (e) {
      setBiometricError('Biometric authentication error.');
    }
  };

  const handleLogin = async () => {
    // TODO: Replace with real backend authentication
    if (username && password) {
      setError('');
      // After successful login, prompt for biometric setup if not already enabled
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      if (enabled !== 'true') {
        setShowBiometricPrompt(true);
      } else {
        router.replace('/landing');
      }
    } else {
      setError('Please enter both username and password.');
    }
  };

  const handleAcceptBiometric = async () => {
    await AsyncStorage.setItem('biometricEnabled', 'true');
    setShowBiometricPrompt(false);
    setBiometricEnabled(true);
    // Optionally, enroll user biometrics here
    router.replace('/landing');
  };

  const handleDeclineBiometric = async () => {
    await AsyncStorage.setItem('biometricEnabled', 'false');
    setShowBiometricPrompt(false);
    setBiometricEnabled(false);
    router.replace('/landing');
  };

  if (checkingBiometric) return null;

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <BannerLogoSvg width={200} height={100} color="#007AFF" />
      </View>
      {biometricEnabled ? (
        <>
          <Button title="Login with Face ID / Biometrics" onPress={handleBiometricAuth} />
          {biometricError ? <Text style={styles.error}>{biometricError}</Text> : null}
          <View style={{ height: 16 }} />
          <Text style={{ marginBottom: 16 }}>or login with credentials</Text>
        </>
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Login" onPress={handleLogin} />

      {/* Face ID / Biometric toggle switch */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
        <Text style={{ fontSize: 16, marginRight: 12 }}>Face ID / Biometrics</Text>
        <Switch
          value={biometricEnabled}
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
        <Text style={{ color: 'red', marginBottom: 8 }}>{biometricSwitchError}</Text>
      ) : null}

      {/* Biometric setup modal */}
      <Modal visible={showBiometricPrompt} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center', width: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Enable Face ID / Biometric Login?</Text>
            <Text style={{ marginBottom: 24, textAlign: 'center' }}>
              Would you like to use Face ID or biometrics to log in faster next time?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <Button title="Accept" onPress={handleAcceptBiometric} />
              <View style={{ width: 16 }} />
              <Button title="Decline" onPress={handleDeclineBiometric} />
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
    marginTop: 32, // Increase to move logo lower, decrease to move higher
    marginBottom: 32,
    alignItems: 'center',
    // Removed fixed height and justifyContent to let logo size and marginTop take effect
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
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
  },
});
