import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { VaaniRecord, RawCapture, BenchmarkEntry, UserProfile } from '../types';

const DB_NAME = 'vaani.db';
let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function initDB(): Promise<void> {
  try {
    const dbDir = `${FileSystem.documentDirectory}SQLite`;
    const dirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }

    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await createTables();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance!;
}

async function createTables(): Promise<void> {
  const db = await getDB();
  
  // records table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL,
      currency TEXT,
      category TEXT,
      due_date TEXT,
      title TEXT NOT NULL,
      raw_text TEXT,
      confidence TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // raw_captures table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS raw_captures (
      id TEXT PRIMARY KEY,
      transcript TEXT NOT NULL,
      audio_duration_ms INTEGER,
      language_detected TEXT,
      created_at TEXT
    );
  `);

  // benchmarks table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS benchmarks (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      cpu_percent_est REAL,
      memory_mb_est REAL,
      input_char_count INTEGER,
      success INTEGER NOT NULL,
      retry_count INTEGER NOT NULL,
      created_at TEXT,
      measurement_type TEXT
    );
  `);

  // Safe migration: Add measurement_type column to benchmarks if it doesn't exist
  try {
    await db.execAsync('ALTER TABLE benchmarks ADD COLUMN measurement_type TEXT;');
  } catch (e) {
    // Ignore error if column already exists
  }

  // user_profile table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT,
      models_downloaded INTEGER DEFAULT 0,
      whisper_model_path TEXT,
      llama_model_path TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Indexes for optimization
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);
    CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
    CREATE INDEX IF NOT EXISTS idx_benchmarks_stage ON benchmarks(stage);
  `);
}

// Record Operations
export async function insertRecord(record: VaaniRecord): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO records (id, type, amount, currency, category, due_date, title, raw_text, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.type,
      record.amount,
      record.currency,
      record.category,
      record.due_date,
      record.title,
      record.raw_text,
      record.confidence,
      record.created_at,
    ]
  );
}

export async function getAllRecords(limit: number = 100, offset: number = 0): Promise<VaaniRecord[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM records ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    category: row.category,
    due_date: row.due_date,
    title: row.title,
    raw_text: row.raw_text || '',
    confidence: row.confidence,
    created_at: row.created_at,
  }));
}

export async function getRecordsByType(type: string): Promise<VaaniRecord[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM records WHERE type = ? ORDER BY created_at DESC',
    [type]
  );
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    category: row.category,
    due_date: row.due_date,
    title: row.title,
    raw_text: row.raw_text || '',
    confidence: row.confidence,
    created_at: row.created_at,
  }));
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM records WHERE id = ?', [id]);
}

// Raw Capture Operations
export async function insertRawCapture(capture: RawCapture): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO raw_captures (id, transcript, audio_duration_ms, language_detected, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      capture.id,
      capture.transcript,
      capture.audio_duration_ms,
      capture.language_detected,
      capture.created_at,
    ]
  );
}

// Benchmark Operations
export async function insertBenchmark(entry: BenchmarkEntry): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO benchmarks (id, stage, duration_ms, cpu_percent_est, memory_mb_est, input_char_count, success, retry_count, created_at, measurement_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.stage,
      entry.duration_ms,
      entry.cpu_percent_est,
      entry.memory_mb_est,
      entry.input_char_count,
      entry.success ? 1 : 0,
      entry.retry_count,
      entry.created_at,
      entry.measurement_type || null,
    ]
  );
}

export async function getAllBenchmarks(): Promise<BenchmarkEntry[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>('SELECT * FROM benchmarks ORDER BY created_at DESC');
  return rows.map(row => ({
    id: row.id,
    stage: row.stage,
    duration_ms: row.duration_ms,
    cpu_percent_est: row.cpu_percent_est,
    memory_mb_est: row.memory_mb_est,
    input_char_count: row.input_char_count,
    success: !!row.success,
    retry_count: row.retry_count,
    created_at: row.created_at,
    measurement_type: row.measurement_type || null,
  }));
}

export async function getBenchmarkSummary(): Promise<{
  avg_transcription_ms: number;
  avg_extraction_ms: number;
  success_rate: number;
  total_runs: number;
}> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(`
    SELECT 
      COALESCE(AVG(CASE WHEN stage = 'transcription' THEN duration_ms ELSE NULL END), 0) as avg_transcription,
      COALESCE(AVG(CASE WHEN stage = 'extraction' THEN duration_ms ELSE NULL END), 0) as avg_extraction,
      COALESCE((SUM(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) * 100.0) / NULLIF(COUNT(*), 0), 0) as rate,
      COUNT(*) as runs
    FROM benchmarks
  `);
  
  return {
    avg_transcription_ms: Math.round(row?.avg_transcription || 0),
    avg_extraction_ms: Math.round(row?.avg_extraction || 0),
    success_rate: parseFloat((row?.rate || 0).toFixed(1)),
    total_runs: row?.runs || 0,
  };
}

// User Profile Operations
export async function getUserProfile(): Promise<UserProfile | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM user_profile WHERE id = 1');
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    models_downloaded: !!row.models_downloaded,
    whisper_model_path: row.whisper_model_path,
    llama_model_path: row.llama_model_path,
    created_at: row.created_at,
  };
}

export async function saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
  const db = await getDB();
  const existing = await getUserProfile();
  
  if (!existing) {
    await db.runAsync(
      `INSERT INTO user_profile (id, name, models_downloaded, whisper_model_path, llama_model_path, created_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
      [
        profile.name || 'User',
        profile.models_downloaded ? 1 : 0,
        profile.whisper_model_path || null,
        profile.llama_model_path || null,
        new Date().toISOString(),
      ]
    );
  } else {
    await db.runAsync(
      `UPDATE user_profile SET
         name = COALESCE(?, name),
         models_downloaded = COALESCE(?, models_downloaded),
         whisper_model_path = COALESCE(?, whisper_model_path),
         llama_model_path = COALESCE(?, llama_model_path)
       WHERE id = 1`,
      [
        profile.name !== undefined ? profile.name : null,
        profile.models_downloaded !== undefined ? (profile.models_downloaded ? 1 : 0) : null,
        profile.whisper_model_path !== undefined ? profile.whisper_model_path : null,
        profile.llama_model_path !== undefined ? profile.llama_model_path : null,
      ]
    );
  }
}

export async function wipeAllData(): Promise<void> {
  const db = await getDB();
  await db.execAsync('DELETE FROM records');
  await db.execAsync('DELETE FROM raw_captures');
  await db.execAsync('DELETE FROM benchmarks');
  await db.execAsync('DELETE FROM user_profile');
  await db.execAsync('VACUUM');
}
