import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { insertRecord } from '../db/database';
import { VaaniRecord } from '../types';
import { generateId } from '../utils/idGen';
import { RECORD_TYPES, CATEGORIES, RecordType, RecordCategory } from '../constants/schema';
import { extractStructured, isLlamaLoaded, initLlamaEngine } from '../services/extractionEngine';

export default function ReviewScreen() {
  const params = useLocalSearchParams();
  
  const [editableRawText, setEditableRawText] = useState(String(params.rawText || ''));
  const [isExtracting, setIsExtracting] = useState(false);

  // Parse initial record structure if passed from home/recording list
  const initialRecord = params.recordJson 
    ? JSON.parse(String(params.recordJson))
    : {
        id: null,
        type: 'task' as RecordType,
        amount: null,
        currency: 'USD',
        category: 'Other' as RecordCategory,
        due_date: null,
        title: '',
        raw_text: String(params.rawText || ''),
        confidence: 'low' as const
      };

  const [recordId, setRecordId] = useState<string | null>(initialRecord.id || null);
  const [type, setType] = useState<RecordType>(initialRecord.type || 'task');
  const [title, setTitle] = useState(initialRecord.title || '');
  const [category, setCategory] = useState<RecordCategory>(initialRecord.category || 'Other');
  const [amount, setAmount] = useState(initialRecord.amount !== null ? String(initialRecord.amount) : '');
  const [currency, setCurrency] = useState(initialRecord.currency || 'USD');
  const [dueDate, setDueDate] = useState(initialRecord.due_date || '');
  const [confidence, setConfidence] = useState<'high' | 'low'>(initialRecord.confidence || 'low');

  // If params changes or has new raw text, sync it
  useEffect(() => {
    if (params.rawText && !editableRawText) {
      setEditableRawText(String(params.rawText));
    }
  }, [params.rawText]);

  const handleExtractStructure = async () => {
    if (!editableRawText.trim()) {
      Alert.alert('Empty Input', 'Please enter some text before extracting structure.');
      return;
    }

    setIsExtracting(true);
    try {
      if (!isLlamaLoaded()) {
        await initLlamaEngine();
      }

      const result = await extractStructured(editableRawText.trim());
      
      // Update form state with SLM extraction outputs
      setType(result.type);
      setTitle(result.title || '');
      const validCategories = ['Food', 'Transport', 'Bills', 'Work', 'Personal', 'Other'];
      const mappedCategory = result.category && validCategories.includes(result.category)
        ? (result.category as any)
        : 'Other';
      setCategory(mappedCategory);
      setAmount(result.amount !== null && result.amount !== undefined ? String(result.amount) : '');
      setCurrency(result.currency || 'USD');
      setDueDate(result.due_date || '');
      setConfidence(result.confidence || 'low');

      Alert.alert('Extraction Complete', 'Fields have been populated from local Llama/Qwen analysis.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Extraction Failed', e.message || 'On-device small language model processing failed.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required.');
      return;
    }

    let parsedAmount: number | null = null;
    let formattedCurrency: string | null = null;
    let formattedDueDate: string | null = null;

    if (type === 'expense') {
      if (!amount.trim() || isNaN(Number(amount))) {
        Alert.alert('Validation Error', 'A valid amount number is required for expenses.');
        return;
      }
      parsedAmount = Number(amount);
      formattedCurrency = currency.toUpperCase().trim() || 'USD';
    } else {
      if (dueDate.trim()) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dueDate.trim())) {
          Alert.alert('Validation Error', 'Due date must be in YYYY-MM-DD format.');
          return;
        }
        formattedDueDate = dueDate.trim();
      }
    }

    const newRecord: VaaniRecord = {
      id: recordId || generateId('rec'),
      type,
      title: title.trim(),
      category,
      amount: parsedAmount,
      currency: formattedCurrency,
      due_date: formattedDueDate,
      raw_text: editableRawText.trim(),
      confidence: 'high', // Marked high once reviewed and saved by the user
      created_at: initialRecord.created_at || new Date().toISOString(),
    };

    try {
      await insertRecord(newRecord);
      Alert.alert('Success', 'Record saved successfully!', [
        { text: 'OK', onPress: () => router.replace('/list') }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save record to database.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.replace('/')}>
          <Text style={styles.cancelText}>Discard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Edit</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isExtracting}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Editable Raw Input Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Spoken or Typed Text</Text>
          <TextInput
            style={[styles.input, styles.rawTextInput]}
            value={editableRawText}
            onChangeText={setEditableRawText}
            multiline
            numberOfLines={4}
            placeholder="Type your note here..."
            placeholderTextColor="#555"
          />
          
          <TouchableOpacity 
            style={[styles.extractButton, isExtracting && styles.extractButtonDisabled]} 
            onPress={handleExtractStructure}
            disabled={isExtracting}
          >
            {isExtracting ? (
              <View style={styles.extractLoadingRow}>
                <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.extractButtonText}>Processing locally...</Text>
              </View>
            ) : (
              <Text style={styles.extractButtonText}>Extract Structure (Local SLM)</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Confidence Badge */}
        {confidence === 'low' && (
          <View style={styles.lowConfidenceBadge}>
            <Text style={styles.lowConfidenceText}>⚠️ Low confidence — please review fields</Text>
          </View>
        )}

        {/* Structured Editable Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Structured Fields</Text>

          {/* Record Type Selector */}
          <Text style={styles.label}>Record Type</Text>
          <View style={styles.selectorRow}>
            {RECORD_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.selectorButton,
                  type === t ? styles.selectorButtonActive : null,
                ]}
                onPress={() => setType(t as RecordType)}
              >
                <Text style={[styles.selectorButtonText, type === t ? styles.selectorTextActive : null]}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Summarized title"
            placeholderTextColor="#555"
          />

          {/* Category Selector */}
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryBadge,
                  category === cat ? styles.categoryBadgeActive : null,
                ]}
                onPress={() => setCategory(cat as RecordCategory)}
              >
                <Text style={[styles.categoryBadgeText, category === cat ? styles.categoryTextActive : null]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Type Conditional Form Fields */}
        {type === 'expense' ? (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Expense details</Text>
            <View style={styles.row}>
              <View style={{ flex: 2, marginRight: 12 }}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 45.50"
                  placeholderTextColor="#555"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Currency</Text>
                <TextInput
                  style={styles.input}
                  maxLength={3}
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="USD"
                  placeholderTextColor="#555"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Timeline Details</Text>
            <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="e.g. 2026-07-14"
              placeholderTextColor="#555"
            />
          </View>
        )}
      </ScrollView>
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
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 16,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 14,
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
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 16,
  },
  rawTextInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  extractButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  extractButtonDisabled: {
    backgroundColor: '#312E81',
  },
  extractLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  extractButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lowConfidenceBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  lowConfidenceText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectorButton: {
    flex: 1,
    backgroundColor: '#111',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#222',
  },
  selectorButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  selectorButtonText: {
    color: '#8E919C',
    fontSize: 11,
    fontWeight: 'bold',
  },
  selectorTextActive: {
    color: '#FFF',
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  categoryBadgeActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  categoryBadgeText: {
    color: '#8E919C',
    fontSize: 13,
  },
  categoryTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
});
