import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { getBenchmarkReport, exportReportJSON } from '../services/benchmarkLogger';
import { getDB } from '../db/database';
import { BenchmarkEntry } from '../types';

export default function BenchmarksScreen() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const rep = await getBenchmarkReport();
      setReport(rep);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleClearLogs = () => {
    Alert.alert(
      'Clear Benchmark Logs',
      'Are you sure you want to delete all historical benchmark logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const db = await getDB();
            await db.runAsync('DELETE FROM benchmarks');
            fetchReport();
          },
        },
      ]
    );
  };

  const handleExportReport = async () => {
    try {
      const jsonString = await exportReportJSON();
      const filePath = `${FileSystem.documentDirectory}vaani_benchmark_report.json`;
      
      await FileSystem.writeAsStringAsync(filePath, jsonString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file/content
      await Share.share({
        message: jsonString,
        title: 'Vaani Benchmark Report',
      });

      Alert.alert(
        'Export Successful',
        `Benchmark report saved locally & shared:\n\n${filePath}`
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Export Failed', error.message || 'Unknown error exporting report');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const { stats, rawLogs } = report || { stats: {}, rawLogs: [] };
  const txStats = stats.transcription || { count: 0, successRate: 0, avgDurationMs: 0, avgCpuPercent: 0, avgMemoryMb: 0 };
  const extStats = stats.extraction || { count: 0, successRate: 0, avgDurationMs: 0, avgCpuPercent: 0, avgMemoryMb: 0 };

  const totalRuns = txStats.count + extStats.count;
  const overallSuccessRate = totalRuns > 0 
    ? ((txStats.count * txStats.successRate + extStats.count * extStats.successRate) / totalRuns)
    : 0;

  // Chart math
  const lastNLogs = rawLogs.slice(0, 8);
  const maxDuration = Math.max(...lastNLogs.map((l: any) => l.duration_ms), 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vaani Benchmarks</Text>
        {rawLogs.length > 0 ? (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearLogs}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hackathon scoring highlight */}
        <View style={styles.scoringCard}>
          <Text style={styles.scoringEmoji}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoringTitle}>Offline Resource Efficiency</Text>
            <Text style={styles.scoringText}>
              Benchmarks track on-device latency, estimated CPU load, and peak memory footprint. Designed for optimal performance on low-power devices.
            </Text>
          </View>
        </View>

        {/* Global Summary Cards */}
        <Text style={styles.sectionTitle}>Summary Dashboard</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Avg Transcription</Text>
            <Text style={styles.summaryValue}>
              {txStats.count > 0 ? `${txStats.avgDurationMs}ms` : 'N/A'}
            </Text>
            <Text style={styles.summarySub}>Whisper speech model</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Avg Extraction</Text>
            <Text style={styles.summaryValue}>
              {extStats.count > 0 ? `${extStats.avgDurationMs}ms` : 'N/A'}
            </Text>
            <Text style={styles.summarySub}>Qwen 0.5B instruct</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Success Rate</Text>
            <Text style={[styles.summaryValue, { color: overallSuccessRate > 90 ? '#10B981' : '#F59E0B' }]}>
              {totalRuns > 0 ? `${overallSuccessRate.toFixed(1)}%` : '100%'}
            </Text>
            <Text style={styles.summarySub}>JSON schema validation</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Runs</Text>
            <Text style={styles.summaryValue}>{totalRuns}</Text>
            <Text style={styles.summarySub}>Total model invocations</Text>
          </View>
        </View>

        {/* Resource Breakdown Card */}
        <View style={styles.resourceCard}>
          <Text style={styles.resourceTitle}>Resource Consumption Estimates</Text>
          
          <View style={styles.resourceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resourceStage}>Transcription (Whisper)</Text>
              <Text style={styles.resourceStats}>
                Avg CPU: {txStats.count > 0 && txStats.avgCpuPercent ? `${txStats.avgCpuPercent}%` : 'N/A'} | Memory: {txStats.count > 0 && txStats.avgMemoryMb ? `${txStats.avgMemoryMb}MB` : 'N/A'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>GGML CPU</Text>
            </View>
          </View>

          <View style={[styles.resourceRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resourceStage}>Extraction (Llama/Qwen)</Text>
              <Text style={styles.resourceStats}>
                Avg CPU: {extStats.count > 0 && extStats.avgCpuPercent ? `${extStats.avgCpuPercent}%` : 'N/A'} | Memory: {extStats.count > 0 && extStats.avgMemoryMb ? `${extStats.avgMemoryMb}MB` : 'N/A'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Llama.cpp</Text>
            </View>
          </View>
        </View>

        {/* Latency Bar Chart */}
        {lastNLogs.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Latency per Stage (Last {lastNLogs.length} Inferences)</Text>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
                <Text style={styles.legendText}>Transcription</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Extraction</Text>
              </View>
            </View>
            
            <View style={styles.chartBars}>
              {lastNLogs.map((log: BenchmarkEntry, index: number) => {
                const percentage = Math.max((log.duration_ms / maxDuration) * 100, 5);
                const isTx = log.stage === 'transcription';
                const barColor = isTx ? '#6366F1' : '#10B981';
                
                return (
                  <View key={log.id} style={styles.chartRow}>
                    <View style={styles.chartRowHeader}>
                      <Text style={styles.chartRowIndex}>#{lastNLogs.length - index}</Text>
                      <Text style={styles.chartRowTime}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                      <Text style={styles.chartRowDuration}>{log.duration_ms} ms</Text>
                    </View>
                    <View style={styles.barBackground}>
                      <View 
                        style={[
                          styles.barFill, 
                          { 
                            width: `${percentage}%`, 
                            backgroundColor: barColor 
                          }
                        ]} 
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Export Button */}
        <TouchableOpacity style={styles.exportButton} onPress={handleExportReport}>
          <Text style={styles.exportButtonText}>Export Benchmark Report</Text>
        </TouchableOpacity>

        {/* Detailed Logs Section */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Recent Inference Logs</Text>
          {rawLogs.length === 0 ? (
            <Text style={styles.noLogsText}>No inference logs generated yet.</Text>
          ) : (
            rawLogs.slice(0, 15).map((log: BenchmarkEntry) => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logMain}>
                  <Text style={[styles.logStage, { color: log.stage === 'transcription' ? '#A5B4FC' : '#10B981' }]}>
                    {log.stage.toUpperCase()}
                  </Text>
                  <Text style={styles.logTime}>
                    {new Date(log.created_at).toLocaleDateString()} at {new Date(log.created_at).toLocaleTimeString()}
                  </Text>
                  {log.retry_count > 0 && (
                    <Text style={styles.retryBadge}>
                      Retries: {log.retry_count}
                    </Text>
                  )}
                </View>
                <View style={styles.logMeta}>
                  <Text style={styles.logDuration}>{log.duration_ms} ms</Text>
                  <Text style={styles.logStats}>
                    {log.cpu_percent_est !== null ? `${log.cpu_percent_est}% CPU` : 'N/A CPU'} | {log.memory_mb_est !== null ? `${log.memory_mb_est}MB` : 'N/A MB'}
                  </Text>
                  <Text style={styles.logMethod}>
                    Method: {log.measurement_type || 'estimated'}
                  </Text>
                </View>
                <View style={[styles.logIndicator, { backgroundColor: log.success ? '#10B981' : '#EF4444' }]} />
              </View>
            ))
          )}
        </View>

        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>🔒 All benchmarks measured on-device. No data leaves this phone.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
  clearButton: {
    paddingVertical: 8,
  },
  clearText: {
    color: '#EF4444',
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scoringCard: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  scoringEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  scoringTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scoringText: {
    color: '#8E919C',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#8E919C',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  summarySub: {
    color: '#444',
    fontSize: 9,
    marginTop: 4,
  },
  resourceCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  resourceTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#222',
    paddingBottom: 12,
    marginBottom: 12,
  },
  resourceStage: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  resourceStats: {
    color: '#8E919C',
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chartContainer: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  chartTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  chartLegend: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: '#8E919C',
    fontSize: 11,
  },
  chartBars: {
    gap: 12,
  },
  chartRow: {
    marginBottom: 4,
  },
  chartRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartRowIndex: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    width: 25,
  },
  chartRowTime: {
    color: '#666',
    fontSize: 10,
    flex: 1,
  },
  chartRowDuration: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: 'bold',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  exportButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  exportButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  logsSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  noLogsText: {
    color: '#555',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  logMain: {
    flex: 3,
  },
  logStage: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  logTime: {
    color: '#444',
    fontSize: 10,
    marginTop: 2,
  },
  retryBadge: {
    backgroundColor: '#2D1F10',
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  logMeta: {
    flex: 3,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  logDuration: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logStats: {
    color: '#8E919C',
    fontSize: 10,
    marginTop: 2,
  },
  logMethod: {
    color: '#555',
    fontSize: 9,
    marginTop: 2,
  },
  logIndicator: {
    width: 6,
    height: 32,
    borderRadius: 3,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  footerText: {
    color: '#444',
    fontSize: 11,
    textAlign: 'center',
  },
});
