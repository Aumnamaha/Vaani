import { RecordType } from '../constants/schema';

export interface VaaniRecord {
  id: string;
  type: RecordType;
  amount: number | null;
  currency: string | null;
  category: string | null;
  due_date: string | null;
  title: string;
  raw_text: string;
  confidence: 'high' | 'low';
  created_at: string;
}

export interface RawCapture {
  id: string;
  transcript: string;
  audio_duration_ms: number;
  language_detected: string;
  created_at: string;
}

export interface BenchmarkEntry {
  id: string;
  stage: 'transcription' | 'extraction';
  duration_ms: number;
  cpu_percent_est: number | null;
  memory_mb_est: number | null;
  input_char_count: number;
  success: boolean;
  retry_count: number;
  created_at: string;
  measurement_type?: 'estimated' | 'measured' | null;
}

export interface UserProfile {
  id: number;
  name?: string;
  models_downloaded: boolean;
  whisper_model_path?: string;
  llama_model_path?: string;
  created_at?: string;
}
