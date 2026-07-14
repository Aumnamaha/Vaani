import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getAllRecords, getUserProfile } from '../db/database';
import { VaaniRecord, UserProfile } from '../types';
import { isLlamaLoaded, initLlamaEngine } from '../services/extractionEngine';
import { isWhisperLoaded, initWhisperEngine } from '../services/transcriptionEngine';

export default function HomeScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<VaaniRecord[]>([]);
  const [engineStatus, setEngineStatus] = useState({ whisper: false, llama: false });
  const [isInitializing, setIsInitializing] = useState(false);

  // Fetch data on screen focus
  useFocusEffect(
    React.useCallback(() => {
      async function fetchData() {
        try {
          const prof = await getUserProfile();
          setProfile(prof);
          const recs = await getAllRecords();
          setRecords(recs);
          
          setEngineStatus({
            whisper: isWhisperLoaded(),
            llama: isLlamaLoaded(),
          });
        } catch (e) {
          console.error('Error fetching data on focus:', e);
        }
      }
      fetchData();
    }, [])
  );

  // Initialize AI models to keep them resident in memory
  const initializeAI = async () => {
    setIsInitializing(true);
    try {
      await initWhisperEngine();
      await initLlamaEngine();
      setEngineStatus({ whisper: true, llama: true });
    } catch (error: any) {
      console.error(error);
      Alert.alert('Initialization Failed', error.message || 'Failed to initialize AI engines.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTypeNote = () => {
    router.push({
      pathname: '/review',
      params: {
        rawText: '',
      },
    });
  };

  // Metrics calculations
  const totalExpenses = records
    .filter(r => r.type === 'expense' && r.amount !== null)
    .reduce((sum, r) => sum + r.amount!, 0);

  const pendingTasks = records.filter(r => r.type === 'task').length;
  const remindersCount = records.filter(r => r.type === 'reminder').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Hello, {profile?.name || 'User'}</Text>
            <Text style={styles.appName}>Vaani</Text>
          </View>
          <TouchableOpacity 
            style={styles.statusIndicator} 
            onPress={initializeAI} 
            disabled={isInitializing || (engineStatus.whisper && engineStatus.llama)}
          >
            {isInitializing ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <>
                <View style={[styles.statusDot, { backgroundColor: engineStatus.whisper && engineStatus.llama ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.statusText}>
                  {engineStatus.whisper && engineStatus.llama ? 'AI Resident' : 'Warm-up AI'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Expenses</Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tasks</Text>
            <Text style={[styles.statValue, { color: '#6366F1' }]}>{pendingTasks}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Reminders</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{remindersCount}</Text>
          </View>
        </View>

        {/* Two Large Tap Options */}
        <Text style={styles.sectionTitle}>Add New Entry</Text>
        <View style={styles.largeOptionsRow}>
          <TouchableOpacity 
            style={[styles.largeOptionCard, { borderColor: '#6366F1' }]} 
            onPress={() => router.push('/record')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Text style={styles.largeOptionEmoji}>🎙️</Text>
            </View>
            <Text style={styles.largeOptionTitle}>Speak a note</Text>
            <Text style={styles.largeOptionDesc}>Record & transcribe locally using Whisper AI</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.largeOptionCard, { borderColor: '#10B981' }]} 
            onPress={handleTypeNote}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Text style={styles.largeOptionEmoji}>⌨️</Text>
            </View>
            <Text style={styles.largeOptionTitle}>Type a note</Text>
            <Text style={styles.largeOptionDesc}>Direct text extraction skipping voice recording</Text>
          </TouchableOpacity>
        </View>

        {/* Recent 5 Records Preview List */}
        <View style={styles.recentContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Records</Text>
            {records.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/list')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {records.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Text style={styles.emptyRecentText}>No records stored yet. Try speaking or typing a note.</Text>
            </View>
          ) : (
            records.slice(0, 5).map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.recordItem}
                onPress={() => router.push({
                  pathname: '/review',
                  params: {
                    recordJson: JSON.stringify(item),
                    rawText: item.raw_text,
                  }
                })}
              >
                <View style={styles.recordMain}>
                  <View style={styles.recordIndicatorWrapper}>
                    <View 
                      style={[
                        styles.typeDot, 
                        { 
                          backgroundColor: 
                            item.type === 'expense' ? '#EF4444' : 
                            item.type === 'task' ? '#6366F1' : '#10B981' 
                        }
                      ]} 
                    />
                    <Text style={styles.recordType}>{item.type.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.recordTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.recordRaw} numberOfLines={1}>"{item.raw_text}"</Text>
                </View>
                <View style={styles.recordMeta}>
                  {item.type === 'expense' && (
                    <Text style={styles.expenseAmount}>
                      {item.currency || '$'}{item.amount}
                    </Text>
                  )}
                  {item.due_date && (
                    <Text style={styles.dueDateText}>{item.due_date}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reusable Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/')}>
          <Text style={[styles.tabIcon, styles.tabIconActive]}>🏠</Text>
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Home</Text>
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
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={styles.tabLabel}>Settings</Text>
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
  scrollContent: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 90, // extra padding so content doesn't hide behind absolute tab bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    color: '#8E919C',
    fontSize: 14,
  },
  appName: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#111',
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  statLabel: {
    color: '#8E919C',
    fontSize: 12,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  largeOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  largeOptionCard: {
    backgroundColor: '#111',
    width: '48%',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  largeOptionEmoji: {
    fontSize: 22,
  },
  largeOptionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  largeOptionDesc: {
    color: '#555',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  recentContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#6366F1',
    fontSize: 14,
  },
  emptyRecent: {
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  emptyRecentText: {
    color: '#8E919C',
    fontSize: 12,
    textAlign: 'center',
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  recordMain: {
    flex: 1,
    marginRight: 12,
  },
  recordIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  recordType: {
    fontSize: 10,
    color: '#8E919C',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  recordTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  recordRaw: {
    color: '#555',
    fontSize: 12,
    fontStyle: 'italic',
  },
  recordMeta: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 15,
  },
  dueDateText: {
    color: '#8E919C',
    fontSize: 12,
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
