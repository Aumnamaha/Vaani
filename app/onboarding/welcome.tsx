import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { saveUserProfile } from '../../db/database';

export default function WelcomeScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleGetStarted = async () => {
    if (!name.trim()) {
      setError('Please enter your name to personalize the experience.');
      return;
    }

    try {
      await saveUserProfile({
        name: name.trim(),
        models_downloaded: false,
      });
      router.replace('/onboarding/model-download');
    } catch (e) {
      console.error('Error saving profile:', e);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>Vaani</Text>
          <Text style={styles.tagline}>Speak it. Structure it. Store it — offline.</Text>
        </View>

        <View style={styles.introContainer}>
          <Text style={styles.introTitle}>Local AI Voice Extraction</Text>
          <Text style={styles.introText}>
            Vaani runs advanced speech-to-text (Whisper) and structured data extraction (Qwen) entirely on your device. Zero servers, zero APIs, 100% private.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Enter your name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError('');
            }}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 80,
  },
  logo: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#6366F1',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 15,
    color: '#8E919C',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  introContainer: {
    marginVertical: 40,
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  introTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  introText: {
    fontSize: 13,
    color: '#8E919C',
    lineHeight: 22,
  },
  form: {
    marginBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 16,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
