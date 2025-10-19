import { useFocusEffect } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useTheme } from '../contexts/ThemeContext';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isScreenFocused, setIsScreenFocused] = useState(false);
  const { theme, isDark } = useTheme();

  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView surface style={styles.header}>
        <ThemedText type="title" style={styles.title}>Search</ThemedText>
      </ThemedView>
      
      <View style={styles.searchContainer}>
        <View style={[
          styles.searchInputContainer,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          isScreenFocused && { borderColor: theme.colors.primary }
        ]}>
          <Search 
            size={20} 
            color={theme.colors.textSecondary} 
            strokeWidth={2}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <ThemedText type="secondary" style={styles.subtitle}>
          {isScreenFocused ? 'Screen is active' : 'Screen is inactive'}
        </ThemedText>
        {searchQuery ? (
          <ThemedText style={styles.searchResults}>
            Searching for: "{searchQuery}"
          </ThemedText>
        ) : (
          <ThemedText type="secondary" style={styles.placeholder}>
            Start typing to search...
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '600',
  },
  searchResults: {
    fontSize: 16,
    marginBottom: 8,
  },
  placeholder: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});