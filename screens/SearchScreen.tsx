import { useFocusEffect } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isScreenFocused, setIsScreenFocused] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={[
          styles.searchInputContainer,
          isScreenFocused && styles.searchInputFocused
        ]}>
          <Search 
            size={20} 
            color="#8E8E93" 
            strokeWidth={2}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
          />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.subtitle}>
          {isScreenFocused ? 'Screen is active' : 'Screen is inactive'}
        </Text>
        {searchQuery ? (
          <Text style={styles.searchResults}>
            Searching for: "{searchQuery}"
          </Text>
        ) : (
          <Text style={styles.placeholder}>
            Start typing to search...
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchInputFocused: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 16,
    fontWeight: '600',
  },
  searchResults: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
  },
  placeholder: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});