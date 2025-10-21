import { LogOut, Settings, Shield, User } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUserDevice } from '../utils/deviceApi';

export default function ProfileScreen() {
  const { logout, user, authToken } = useAuth();
  const { theme, isDark } = useTheme();
  const [deviceInfo, setDeviceInfo] = useState<string>('');

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              console.log('✅ User logged out successfully');
            } catch (error) {
              console.log('❌ Logout error:', error);
              Alert.alert('Logout Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCheckDevice = async () => {
    if (!authToken || !user?.userId) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    console.log('🔍 Checking for device...');
    setDeviceInfo('Loading...');
    
    const result = await getUserDevice(authToken, user.userId);
    
    if (result.hasDevice) {
      const info = `✅ Device found!\nHas GPS data: ${result.gpsData ? 'Yes' : 'No'}`;
      setDeviceInfo(info);
      Alert.alert('Device Status', info);
    } else {
      let info = `❌ No device registered or error occurred\n\n`;
      if (result.error?.includes('Something went wrong')) {
        info += `Backend Error: The server encountered an error.\n\nThis usually means:\n• No device is associated with your account\n• The backend needs to register a device for User ID: ${user.userId}\n\nPlease contact your backend team to:\n1. Register a device with an IMEI\n2. Associate it with your user account`;
      } else {
        info += result.error || 'Unknown error';
      }
      setDeviceInfo(info);
      Alert.alert('Device Status', info, [{ text: 'OK' }]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView surface style={styles.header}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.colors.secondary }]}>
          <User size={60} color={theme.colors.primary} strokeWidth={1.5} />
        </View>
        <ThemedText type="title" style={styles.username}>
          {user?.firstName || user?.username || 'User'}
        </ThemedText>
        <ThemedText type="secondary" style={styles.email}>
          {user?.email || 'No email'}
        </ThemedText>
        {user?.userId && (
          <ThemedText type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
            User ID: {user.userId} | Role: {user.role}
          </ThemedText>
        )}
      </ThemedView>

      <View style={styles.content}>
        <View style={styles.section}>
          <ThemedText type="secondary" style={styles.sectionTitle}>Device</ThemedText>
          
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
            onPress={handleCheckDevice}
          >
            <Shield size={20} color={theme.colors.textSecondary} strokeWidth={2} />
            <ThemedText style={styles.menuItemText}>Check Device Status</ThemedText>
            <ThemedText type="secondary" style={styles.menuItemArrow}>›</ThemedText>
          </TouchableOpacity>
          
          {deviceInfo ? (
            <View style={[styles.deviceInfo, { backgroundColor: theme.colors.surface }]}>
              <ThemedText type="secondary" style={{ fontSize: 12 }}>{deviceInfo}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="secondary" style={styles.sectionTitle}>Account</ThemedText>
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <Shield size={20} color={theme.colors.textSecondary} strokeWidth={2} />
            <ThemedText style={styles.menuItemText}>Security Settings</ThemedText>
            <ThemedText type="secondary" style={styles.menuItemArrow}>›</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <Settings size={20} color={theme.colors.textSecondary} strokeWidth={2} />
            <ThemedText style={styles.menuItemText}>App Settings</ThemedText>
            <ThemedText type="secondary" style={styles.menuItemArrow}>›</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText type="secondary" style={styles.sectionTitle}>Support</ThemedText>
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <ThemedText style={styles.menuItemText}>Help Center</ThemedText>
            <ThemedText type="secondary" style={styles.menuItemArrow}>›</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}>
            <ThemedText style={styles.menuItemText}>Contact Support</ThemedText>
            <ThemedText type="secondary" style={styles.menuItemArrow}>›</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.colors.error }]} onPress={handleLogout}>
          <LogOut size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
        
        <ThemedText type="secondary" style={styles.versionText}>Gardi v1.0.0</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingTop: 24,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  menuItemArrow: {
    fontSize: 20,
    fontWeight: '300',
  },
  deviceInfo: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionText: {
    fontSize: 14,
    textAlign: 'center',
  },
});