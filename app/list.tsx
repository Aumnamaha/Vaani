import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { getAllRecords, deleteRecord } from '../db/database';
import { VaaniRecord } from '../types';
import { RECORD_TYPES, RecordType } from '../constants/schema';

export default function RecordsListScreen() {
  const [allRecords, setAllRecords] = useState<VaaniRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<VaaniRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | RecordType>('all');

  const fetchRecords = async () => {
    try {
      const recs = await getAllRecords();
      setAllRecords(recs);
      applyFilterAndSearch(recs, activeFilter, searchQuery);
    } catch (e) {
      console.error('Failed to retrieve records:', e);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const applyFilterAndSearch = (recordsList: VaaniRecord[], filter: 'all' | RecordType, search: string) => {
    let result = [...recordsList];

    // Filter by type
    if (filter !== 'all') {
      result = result.filter(r => r.type === filter);
    }

    // Filter by query
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      result = result.filter(
        r => r.title.toLowerCase().includes(query) || r.raw_text.toLowerCase().includes(query)
      );
    }

    setFilteredRecords(result);
  };

  const handleFilterChange = (filter: 'all' | RecordType) => {
    setActiveFilter(filter);
    applyFilterAndSearch(allRecords, filter, searchQuery);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFilterAndSearch(allRecords, activeFilter, text);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to permanently delete this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecord(id);
            fetchRecords();
          },
        },
      ]
    );
  };

  const getGroupedRecords = () => {
    // Sort records by type: expense, then task, then reminder
    return [...filteredRecords].sort((a, b) => {
      const typeOrder = { expense: 1, task: 2, reminder: 3 };
      const orderA = typeOrder[a.type] || 99;
      const orderB = typeOrder[b.type] || 99;
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort: created_at descending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const renderRightActions = (id: string) => {
    return (
      <TouchableOpacity 
        style={styles.deleteSwipeButton} 
        onPress={() => handleDelete(id)}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }: { item: VaaniRecord; index: number }) => {
    const sortedList = getGroupedRecords();
    const showHeader = index === 0 || sortedList[index - 1].type !== item.type;
    
    const typeLabel = 
      item.type === 'expense' ? '💰 Expenses' : 
      item.type === 'task' ? '✅ Tasks' : '⏰ Reminders';

    return (
      <View>
        {showHeader && (
          <Text style={styles.groupHeader}>{typeLabel}</Text>
        )}
        <Swipeable
          renderRightActions={() => renderRightActions(item.id)}
          friction={1.5}
          rightThreshold={40}
        >
          <TouchableOpacity 
            style={styles.recordCard}
            onPress={() => router.push({
              pathname: '/review',
              params: {
                recordJson: JSON.stringify(item),
                rawText: item.raw_text,
              }
            })}
            activeOpacity={0.85}
          >
            <View style={styles.recordMain}>
              <Text style={styles.recordTitle}>{item.title}</Text>
              <Text style={styles.rawTextPreview} numberOfLines={1}>"{item.raw_text}"</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            </View>

            <View style={styles.recordRight}>
              {item.type === 'expense' && item.amount !== null && (
                <Text style={styles.amountText}>{item.currency || '$'}{item.amount}</Text>
              )}
              {item.due_date && (
                <Text style={styles.dateText}>{item.due_date}</Text>
              )}
            </View>
          </TouchableOpacity>
        </Swipeable>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
            <Text style={styles.backButtonText}>← Home</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Records</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search records or transcripts..."
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'all' ? styles.filterTabActive : null]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'all' ? styles.filterTextActive : null]}>ALL</Text>
          </TouchableOpacity>
          {RECORD_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.filterTab, activeFilter === t ? styles.filterTabActive : null]}
              onPress={() => handleFilterChange(t as RecordType)}
            >
              <Text style={[styles.filterTabText, activeFilter === t ? styles.filterTextActive : null]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Records List */}
        <FlatList
          data={getGroupedRecords()}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No records found matching criteria.</Text>
            </View>
          }
          renderItem={renderItem}
        />

        {/* Reusable Bottom Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/')}>
            <Text style={styles.tabIcon}>🏠</Text>
            <Text style={styles.tabLabel}>Home</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/list')}>
            <Text style={[styles.tabIcon, styles.tabIconActive]}>📋</Text>
            <Text style={[styles.tabLabel, styles.tabLabelActive]}>List</Text>
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
    </GestureHandlerRootView>
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
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterTab: {
    backgroundColor: '#111',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  filterTabActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterTabText: {
    color: '#8E919C',
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90, // extra padding so content doesn't hide behind absolute tab bar
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
  },
  groupHeader: {
    color: '#8E919C',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  recordMain: {
    flex: 1,
    marginRight: 12,
  },
  recordTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  rawTextPreview: {
    color: '#555',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  recordRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amountText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dateText: {
    color: '#8E919C',
    fontSize: 12,
  },
  deleteSwipeButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '88%',
    borderRadius: 16,
    marginLeft: 8,
  },
  deleteSwipeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
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
