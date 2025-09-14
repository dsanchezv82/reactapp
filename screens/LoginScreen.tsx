import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [biometricError, setBiometricError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(true);
  const [biometricSwitchError, setBiometricSwitchError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const { theme } = useTheme();
  const { login } = useAuth();

  // Check biometric settings on mount
  useEffect(() => {
    checkBiometricSettings();
  }, []);

  const checkBiometricSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('@gardi_biometric_enabled');
      setBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.log('Error checking biometric settings:', error);
    } finally {
      setCheckingBiometric(false);
    }
  };

  const performBackendLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setIsLoggingIn(true);

    console.log('📱 Attempting backend login...');
    
    // Use AuthContext login with backend authentication
    const result = await login(email, password);
    
    if (result.success) {
      console.log('✅ Backend login successful - navigating to app...');
      
      // Check biometric settings after successful login
      const enabled = await AsyncStorage.getItem('@gardi_biometric_enabled');
      
      if (enabled !== 'true') {
        // Show biometric setup option for first-time users
        setShowBiometricPrompt(true);
        setIsLoggingIn(false);
      } else {
        // Store credentials for biometric login
        await AsyncStorage.multiSet([
          ['@gardi_stored_email', email],
          ['@gardi_stored_password', password],
        ]);
        setIsLoggingIn(false);
      }
    } else {
      // Display backend error to user
      setError(result.error || 'Login failed');
      setIsLoggingIn(false);
    }
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
        // Get stored credentials for biometric login
        const storedEmail = await AsyncStorage.getItem('@gardi_stored_email');
        const storedPassword = await AsyncStorage.getItem('@gardi_stored_password');
        
        if (storedEmail && storedPassword) {
          console.log('🔐 Attempting biometric backend login...');
          const loginResult = await login(storedEmail, storedPassword);
          
          if (!loginResult.success) {
            setBiometricError(loginResult.error || 'Biometric login failed. Please use manual login.');
          } else {
            console.log('✅ Biometric backend login successful');
          }
        } else {
          setBiometricError('No stored credentials found. Please login manually first.');
        }
        setIsLoggingIn(false);
      } else {
        setBiometricError('Biometric authentication was cancelled or failed.');
        setIsLoggingIn(false);
      }
    } catch (e) {
      console.log('❌ Biometric authentication error:', e);
      setBiometricError('Biometric authentication error. Please try manual login.');
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    // Clear any previous errors
    setError('');
    setBiometricError('');
    
    await performBackendLogin();
  };

  const handleAcceptBiometric = async () => {
    try {
      await AsyncStorage.multiSet([
        ['@gardi_biometric_enabled', 'true'],
        ['@gardi_stored_email', email],
        ['@gardi_stored_password', password], // In production, use secure storage
      ]);
      
      setShowBiometricPrompt(false);
      setBiometricEnabled(true);
      
      console.log('✅ Biometric authentication enabled for backend login');
    } catch (error) {
      console.log('❌ Failed to enable biometric authentication:', error);
      Alert.alert('Error', 'Failed to enable biometric authentication.');
    }
  };

  const handleDeclineBiometric = async () => {
    try {
      await AsyncStorage.setItem('@gardi_biometric_enabled', 'false');
      setShowBiometricPrompt(false);
      setBiometricEnabled(false);
      
      console.log('✅ Biometric authentication declined');
    } catch (error) {
      console.log('❌ Failed to save biometric preference:', error);
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    input: {
      width: '100%',
      height: 48,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 16,
      paddingHorizontal: 12,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
    },
    biometricButton: {
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      width: '100%',
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    loginButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      marginBottom: 16,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginButtonDisabled: {
      backgroundColor: theme.colors.textSecondary,
      opacity: 0.6,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      padding: 24,
      borderRadius: 12,
      alignItems: 'center',
      width: 320,
      maxWidth: '90%',
    },
  });

  if (checkingBiometric) {
    return (
      <ThemedView style={[dynamicStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <ThemedText style={{ marginTop: 16 }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={dynamicStyles.container}>
      <View style={styles.logoWrapper}>
        <Image 
          source={require('../assets/images/brand-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      {biometricEnabled && !isLoggingIn && (
        <View style={styles.biometricSection}>
          <TouchableOpacity 
            style={dynamicStyles.biometricButton} 
            onPress={handleBiometricAuth}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.biometricButtonText, { color: theme.colors.primary }]}>
              Login with Face ID / Biometrics
            </ThemedText>
          </TouchableOpacity>
          {biometricError ? (
            <ThemedText style={styles.error}>{biometricError}</ThemedText>
          ) : null}
          <ThemedText type="secondary" style={styles.orText}>
            or login with credentials
          </ThemedText>
        </View>
      )}
      
      <TextInput
        style={dynamicStyles.input}
        placeholder="Email"
        placeholderTextColor={theme.colors.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        editable={!isLoggingIn}
      />
      
      <TextInput
        style={dynamicStyles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        editable={!isLoggingIn}
      />
      
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <TouchableOpacity 
        style={[
          dynamicStyles.loginButton, 
          isLoggingIn && dynamicStyles.loginButtonDisabled
        ]} 
        onPress={handleLogin}
        disabled={isLoggingIn}
        activeOpacity={0.7}
      >
        {isLoggingIn && (
          <ActivityIndicator 
            size="small" 
            color="#FFFFFF" 
            style={{ marginRight: 8 }} 
          />
        )}
        <ThemedText style={styles.loginButtonText}>
          {isLoggingIn ? 'Logging in...' : 'Login'}
        </ThemedText>
      </TouchableOpacity>

      <View style={styles.biometricToggle}>
        <ThemedText style={styles.toggleLabel}>Face ID / Biometrics</ThemedText>
        <Switch
          value={biometricEnabled}
          disabled={isLoggingIn}
          trackColor={{ 
            false: theme.colors.border, 
            true: theme.colors.primary 
          }}
          thumbColor={biometricEnabled ? '#FFFFFF' : theme.colors.textSecondary}
          onValueChange={async (value) => {
            if (value && (!email || !password)) {
              setBiometricSwitchError('Please log in first before enabling Face ID / Biometrics.');
              setTimeout(() => setBiometricSwitchError(''), 3000);
              return;
            }
            
            try {
              await AsyncStorage.setItem('@gardi_biometric_enabled', value ? 'true' : 'false');
              setBiometricEnabled(value);
              
              if (value && email && password) {
                // Store credentials for biometric login
                await AsyncStorage.multiSet([
                  ['@gardi_stored_email', email],
                  ['@gardi_stored_password', password],
                ]);
              }
            } catch (error) {
              console.log('❌ Failed to update biometric settings:', error);
            }
          }}
        />
      </View>
      
      {biometricSwitchError ? (
        <ThemedText style={styles.switchError}>{biometricSwitchError}</ThemedText>
      ) : null}

      {/* Biometric setup modal */}
      <Modal 
        visible={showBiometricPrompt} 
        transparent 
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <ThemedText type="title" style={styles.modalTitle}>
              Enable Face ID / Biometric Login?
            </ThemedText>
            <ThemedText type="secondary" style={styles.modalDescription}>
              Would you like to use Face ID or biometrics to log in faster next time?
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButtonAccept, { backgroundColor: theme.colors.primary }]} 
                onPress={handleAcceptBiometric}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.modalButtonTextAccept}>Accept</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonDecline, { borderColor: theme.colors.primary }]} 
                onPress={handleDeclineBiometric}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.modalButtonTextDecline, { color: theme.colors.primary }]}>
                  Decline
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// Static styles that don't need theming
const styles = StyleSheet.create({
  logoWrapper: {
    width: '100%',
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 100,
  },
  biometricSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  orText: {
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    color: '#FF3B30',
    marginBottom: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
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
  },
  switchError: {
    color: '#FF3B30',
    marginBottom: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButtonAccept: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    marginRight: 8,
  },
  modalButtonTextAccept: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
  modalButtonDecline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    marginLeft: 8,
  },
  modalButtonTextDecline: {
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
});
