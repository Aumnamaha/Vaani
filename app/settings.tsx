import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { getUserProfile, saveUserProfile, wipeAllData } from '../db/database';
import { isModelDownloaded as isWhisperModelDownloaded, MODEL_FILE_PATH as WHISPER_MODEL_LOCAL_PATH } from '../services/transcriptionEngine';
import { isLlamaModelDownloaded, MODEL_FILE_PATH as LLAMA_MODEL_LOCAL_PATH } from '../services/extractionEngine';
import { UserProfile } from '../types';
import { guardedFetch } from '../services/networkGuard';

export default function SettingsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [newName, setNewName] = useState('');
  const [modelSizes, setModelSizes] = useState({ whisper: 'Checking...', llama: 'Checking...' });
  const [strictMode, setStrictMode] = useState(true);
  const [offlineVerified, setOfflineVerified] = useState<boolean | null>(null);


  const fetchProfileAndModelInfo = async () => {
    try {
      const prof = await getUserProfile();
      setProfile(prof);
      if (prof) {
        setNewName(prof.name || '');
      }

      // Check model file sizes on disk
      let whisperSize = 'Not Found';
      let llamaSize = 'Not Found';

      const whisperDownloaded = await isWhisperModelDownloaded();
      if (whisperDownloaded) {
        const info = await FileSystem.getInfoAsync(WHISPER_MODEL_LOCAL_PATH);
        if (info.exists) {
          whisperSize = `${((info as any).size / (1024 * 1024)).toFixed(1)} MB`;
        }
      }

      const llamaDownloaded = await isLlamaModelDownloaded();
      if (llamaDownloaded) {
        const info = await FileSystem.getInfoAsync(LLAMA_MODEL_LOCAL_PATH);
        if (info.exists) {
          llamaSize = `${((info as any).size / (1024 * 1024)).toFixed(1)} MB`;
        }
      }

      setModelSizes({ whisper: whisperSize, llama: llamaSize });

    } catch (e) {
      console.error(e);
    }
  };

  const runNetworkSelfTest = async () => {
    try {
      // attempt guardedFetch outside download phase (should throw)
      await guardedFetch('https://huggingface.co');
      setOfflineVerified(false); // If it succeeded, verification failed!
    } catch (e: any) {
      if (e.message && e.message.includes('Network access blocked')) {
        setOfflineVerified(true);
      } else {
        setOfflineVerified(false);
      }
    }
  };

  useEffect(() => {
    fetchProfileAndModelInfo();
    runNetworkSelfTest();
  }, []);


  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }

    try {
      await saveUserProfile({ name: newName.trim() });
      Alert.alert('Success', 'Profile name updated.');
      fetchProfileAndModelInfo();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const handleWipeData = () => {
    Alert.alert(
      '🚨 Wipe All Data',
      'This will delete all saved records, raw audio captures, benchmark stats, and your profile configuration. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed Wipe',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation Required',
              'Confirm that you want to wipe all records. The app will reset to onboarding.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Wipe Everything',
                  style: 'destructive',
                  onPress: async () => {
                    // Delete model files as well to do a complete wipe
                    try {
                      const whisperDownloaded = await isWhisperModelDownloaded();
                      if (whisperDownloaded) {
                        await FileSystem.deleteAsync(WHISPER_MODEL_LOCAL_PATH, { idempotent: true });
                      }
                      const llamaDownloaded = await isLlamaModelDownloaded();
                      if (llamaDownloaded) {
                        await FileSystem.deleteAsync(LLAMA_MODEL_LOCAL_PATH, { idempotent: true });
                      }
                    } catch (fileErr) {
                      console.log('Error deleting model files:', fileErr);
                    }
                    
                    await wipeAllData();
                    router.replace('/onboarding/welcome');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Settings */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          <Text style={styles.label}>Your Name</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Name"
              placeholderTextColor="#555"
            />
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateName}>
              <Text style={styles.updateButtonText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security / Network Guard Info */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Privacy & Security Audit</Text>
          
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={styles.switchLabel}>Strict Air-Gapped Mode</Text>
              <Text style={styles.switchDesc}>
                Blocks all network connection calls in the application context. Gated only during onboarding.
              </Text>
            </View>
            <Switch
              value={strictMode}
              onValueChange={setStrictMode}
              trackColor={{ false: '#222', true: '#6366F1' }}
              thumbColor={strictMode ? '#FFF' : '#8E919C'}
            />
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🔒 Vaani utilizes an on-device Network Guard that blocks external API requests. Whisper and Llama inference runs 100% locally on your CPU.
            </Text>
          </View>

          <View style={styles.selfTestRow}>
            <Text style={styles.selfTestLabel}>Offline Mode Status:</Text>
            <Text style={[styles.selfTestValue, { color: offlineVerified ? '#10B981' : '#EF4444' }]}>
              {offlineVerified === null ? 'Testing...' : offlineVerified ? 'Verified ✅ (Air-Gapped)' : 'Verification Failed ❌'}
            </Text>
          </View>
        </View>


        {/* Local Storage / Model Sizes */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Local Model Management</Text>
          <View style={styles.modelStatusRow}>
            <Text style={styles.modelNameText}>Whisper GGML Model</Text>
            <Text style={styles.modelSizeText}>{modelSizes.whisper}</Text>
          </View>
          <View style={styles.modelStatusRow}>
            <Text style={styles.modelNameText}>Qwen 0.5B GGUF Model</Text>
            <Text style={styles.modelSizeText}>{modelSizes.llama}</Text>
          </View>
        </View>

        {/* System resets */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionTitle}>Dangerous Actions</Text>
          <TouchableOpacity style={styles.wipeButton} onPress={handleWipeData}>
            <Text style={styles.wipeButtonText}>Reset Application & Wipe Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reusable Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/')}>
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/list')}>
          <Text style={styles.tabIcon}>📋</Text>
          <Text style={styles.tabLabel}>List</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/benchmarks')}>
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={styles.tabLabel}>Metrics</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/settings')}>
          <Text style={[styles.tabIcon, styles.tabIconActive]}>⚙️</Text>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#111',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 90, // extra padding so content doesn't hide behind absolute tab bar
  },
  settingSection: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    paddingLeft: 8,
  },
  label: {
    color: '#8E919C',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    marginRight: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchDesc: {
    color: '#555',
    fontSize: 12,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 12,
  },
  infoText: {
    color: '#A5B4FC',
    fontSize: 12,
    lineHeight: 18,
  },
  modelStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modelNameText: {
    color: '#FFF',
    fontSize: 13,
  },
  modelSizeText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  wipeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  wipeButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selfTestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#080808',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  selfTestLabel: {
    color: '#8E919C',
    fontSize: 12,
    fontWeight: '600',
  },
  selfTestValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
  },
  tabIcon: {
    fontSize: 20,
    color: '#8E919C',
    marginBottom: 2,
  },
  tabIconActive: {
    color: '#6366F1',
  },
  tabLabel: {
    fontSize: 10,
    color: '#8E919C',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#6366F1',
  },
});

