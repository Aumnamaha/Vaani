import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Animated, Platform } from 'react-native';
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { transcribeAudio, initWhisperEngine, isWhisperLoaded } from '../services/transcriptionEngine';
import { insertRawCapture } from '../db/database';
import { generateId } from '../utils/idGen';
import { RawCapture } from '../types';

type RecordState = 'idle' | 'recording' | 'transcribing' | 'error';

export default function RecordScreen() {
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Tap mic to start recording');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animation for recording pulse
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (recordState === 'recording') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [recordState]);

  // Handle Recording Permissions and warm-up engines
  useEffect(() => {
    async function prepare() {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Microphone permission is required to record voice notes.');
          router.back();
          return;
        }

        // Configure audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        // Warm up Whisper model
        if (!isWhisperLoaded()) {
          await initWhisperEngine();
        }
      } catch (error) {
        console.error('Failed to prepare recording screen:', error);
      }
    }
    prepare();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      setRecordState('recording');
      setStatusMsg('Listening...');
      setDuration(0);

      // Configure recording settings for Whisper (16kHz, mono, PCM WAV)
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        recordingOptions
      );

      setRecording(newRecording);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording', err);
      setRecordState('error');
      setStatusMsg('Failed to initialize microphone');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setRecordState('transcribing');
      setStatusMsg('Transcribing locally...');

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        throw new Error('Could not retrieve recorded audio file path.');
      }

      const audioDurationMs = duration * 1000;

      // 1. Run local speech transcription
      const transcriptionResult = await transcribeAudio(uri);
      const transcriptText = transcriptionResult.transcript;

      if (!transcriptText || !transcriptText.trim()) {
        throw new Error('No speech detected. Please speak clearly and try again.');
      }

      // Save raw capture metadata
      const captureId = generateId('cap');
      const capture: RawCapture = {
        id: captureId,
        transcript: transcriptText,
        audio_duration_ms: audioDurationMs,
        language_detected: 'en',
        created_at: new Date().toISOString(),
      };
      await insertRawCapture(capture);

      // Navigate to review screen with transcript prefilled
      router.replace({
        pathname: '/review',
        params: {
          rawText: transcriptText,
        },
      });

    } catch (err: any) {
      console.error(err);
      setRecordState('error');
      setStatusMsg(err.message || 'Error occurred during processing.');
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    if (recording) {
      if (timerRef.current) clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleCancel}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Capture</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Timer and Waveform Visualizer */}
      <View style={styles.visualizerContainer}>
        {recordState === 'recording' && (
          <Text style={styles.timerText}>{formatTime(duration)}</Text>
        )}
        <Text style={styles.statusMsgText}>{statusMsg}</Text>

        {recordState === 'transcribing' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" style={{ marginBottom: 16 }} />
            <Text style={styles.subLoadingText}>Running on-device (CPU-only)</Text>
          </View>
        )}
      </View>

      {/* Recording Control Button */}
      <View style={styles.controlsContainer}>
        {recordState === 'idle' || recordState === 'error' ? (
          <TouchableOpacity 
            style={styles.micButton} 
            onPress={startRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.micText}>🎙️</Text>
          </TouchableOpacity>
        ) : recordState === 'recording' ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity 
              style={[styles.micButton, styles.recordingMicButton]} 
              onPress={stopRecording}
              activeOpacity={0.8}
            >
              <View style={styles.stopSquare} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={[styles.micButton, styles.disabledMicButton]}>
            <ActivityIndicator size="small" color="#555" />
          </View>
        )}

        {recordState === 'error' && (
          <TouchableOpacity style={styles.retryButton} onPress={startRecording}>
            <Text style={styles.retryText}>Retry Record</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
  },
  closeButton: {
    paddingVertical: 8,
  },
  closeText: {
    color: '#8E919C',
    fontSize: 16,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  visualizerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusMsgText: {
    color: '#8E919C',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 24,
  },
  loadingContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  subLoadingText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsContainer: {
    marginBottom: 60,
    alignItems: 'center',
  },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  recordingMicButton: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  disabledMicButton: {
    backgroundColor: '#1C1C1E',
    shadowOpacity: 0,
    elevation: 0,
  },
  micText: {
    fontSize: 32,
  },
  stopSquare: {
    width: 24,
    height: 24,
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  retryButton: {
    marginTop: 20,
    padding: 10,
  },
  retryText: {
    color: '#6366F1',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
