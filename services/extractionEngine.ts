import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { initLlama, LlamaContext } from 'llama.rn';
import * as benchmarkLogger from './benchmarkLogger';
import { auditNetworkCall } from './networkGuard';
import { validateRecord, retryWithCorrection, buildFallbackRecord, validateExtraction } from './schemaValidator';
import { generateId } from '../utils/idGen';
import { saveUserProfile } from '../db/database';
import { VaaniRecord } from '../types';

// ============================================================================
// Constants
// ============================================================================
export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-Q4_K_M-GGUF';
export const LLAMA_MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';
export const MODEL_LOCAL_PATH = FileSystem.documentDirectory + '.vaani/models/qwen/';
export const MODEL_FILE_PATH = `${MODEL_LOCAL_PATH}${MODEL_ID}.gguf`;

let llamaContext: LlamaContext | null = null;
const AI_TIMEOUT_MS = 10000; // 10-second timeout constraint

// ============================================================================
// Verification Checks
// ============================================================================
export async function isModelDownloaded(): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(MODEL_FILE_PATH);
    return fileInfo.exists && (fileInfo as any).size > 300000000;
  } catch {
    return false;
  }
}

export function isLlamaLoaded(): boolean {
  return llamaContext !== null;
}

// ============================================================================
// Model Download Flow (WiFi only, audited network gate)
// ============================================================================
export async function downloadModel(
  onProgress: (percent: number) => void
): Promise<void> {
  const netState = await NetInfo.fetch();
  if (netState.type !== 'wifi') {
    throw new Error('WiFi connection required. Downloading AI models over cellular networks is blocked.');
  }

  await auditNetworkCall(LLAMA_MODEL_URL);

  const dirInfo = await FileSystem.getInfoAsync(MODEL_LOCAL_PATH);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_LOCAL_PATH, { intermediates: true });
  }

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      LLAMA_MODEL_URL,
      MODEL_FILE_PATH,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        onProgress(progress * 100);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Download failed: No file URI returned.');
    }

    const fileInfo = await FileSystem.getInfoAsync(MODEL_FILE_PATH);
    if (!fileInfo.exists || (fileInfo as any).size < 300000000) {
      throw new Error('Downloaded model file is corrupted or incomplete.');
    }

    await saveUserProfile({
      llama_model_path: MODEL_FILE_PATH,
    });
  } catch (error) {
    console.error('Error downloading Llama model:', error);
    throw error;
  }
}

// ============================================================================
// Initialization (Loads Qwen once, singleton pattern to avoid cold-start cost)
// ============================================================================
export async function initEngine(): Promise<void> {
  if (llamaContext) return;

  const isDownloaded = await isModelDownloaded();
  if (!isDownloaded) {
    throw new Error('Qwen model not found. Please trigger the model setup flow.');
  }

  try {
    llamaContext = await initLlama({
      model: MODEL_FILE_PATH,
      use_mlock: true,
      n_ctx: 2048,
    });
  } catch (error) {
    console.error('Failed to initialize local Qwen model:', error);
    throw new Error('Failed to load local structured extraction engine.');
  }
}

// ============================================================================
// Extraction Execution
// ============================================================================
/**
 * Extracts structured JSON datasets from raw transcribed notes.
 * 
 * Note: Once the model is downloaded, this operates 100% locally
 * with ZERO network calls, fully air-gapped.
 */
export async function extractStructured(transcript: string): Promise<VaaniRecord> {
  if (!llamaContext) {
    await initEngine();
  }

  const systemPrompt = `You convert spoken notes into structured JSON.
Respond ONLY with a valid JSON object matching this schema.
No explanation. No markdown. No extra text.

Schema:
{
  "type": "expense" | "task" | "reminder",
  "amount": number or null,
  "currency": string or null,
  "category": "Food"|"Transport"|"Bills"|"Work"|"Personal"|"Other" or null,
  "due_date": ISO 8601 string or null,
  "title": short string summarizing the note
}`;

  let responseText = '';
  let inferenceTime = 0;
  const startTime = Date.now();

  const currentPrompt = `<|im_start|>system
${systemPrompt}

Today's date context is: ${new Date().toISOString().split('T')[0]} (resolve relative dates relative to this).
<|im_end|>
<|im_start|>user
Raw Note: "${transcript}"
<|im_end|>
<|im_start|>assistant
`;

  try {
    // 10-second timeout wrapper around model inference only
    const completionPromise = llamaContext!.completion({
      prompt: currentPrompt,
      n_predict: 256,
      temperature: 0.1,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Inference timeout')), AI_TIMEOUT_MS)
    );

    const result: any = await Promise.race([completionPromise, timeoutPromise]);
    inferenceTime = Date.now() - startTime;
    responseText = (result?.text || '').trim();

    // Extract JSON block using regex
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Response did not contain a valid JSON block.');
    }

    const parsedJson = JSON.parse(jsonMatch[0]);

    // Validate schema
    const checkResult = validateRecord(parsedJson);
    if (checkResult.valid) {
      await benchmarkLogger.logStage(
        'extraction',
        inferenceTime,
        transcript.length,
        true,
        0
      );

      return {
        id: generateId('rec'),
        type: parsedJson.type,
        amount: parsedJson.amount !== null && parsedJson.amount !== undefined ? Number(parsedJson.amount) : null,
        currency: parsedJson.currency || null,
        category: parsedJson.category || 'Other',
        due_date: parsedJson.due_date || null,
        title: parsedJson.title,
        raw_text: transcript,
        confidence: 'high',
        created_at: new Date().toISOString(),
      };
    } else {
      throw new Error(`Validation failed: ${checkResult.errors.join(', ')}`);
    }

  } catch (err: any) {
    inferenceTime = Date.now() - startTime;
    console.warn(`Initial extraction failed: ${err.message}. Retrying with correction...`);
    
    // Trigger corrective retry 1
    const retryRecord = await retryWithCorrection(transcript, responseText || err.message, 1);
    if (retryRecord) {
      return retryRecord;
    }
  }

  // Fallback defaults on terminal failure of all attempts
  return buildFallbackRecord(transcript);
}

/**
 * Helper called dynamically by retryWithCorrection to prevent circular imports.
 */
export async function extractStructuredWithPrompt(
  transcript: string,
  promptText: string,
  attempt: number
): Promise<VaaniRecord | null> {
  if (!llamaContext) {
    await initEngine();
  }

  let responseText = '';
  let inferenceTime = 0;
  const startTime = Date.now();

  try {
    const completionPromise = llamaContext!.completion({
      prompt: promptText,
      n_predict: 256,
      temperature: 0.1,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Inference timeout')), AI_TIMEOUT_MS)
    );

    const result: any = await Promise.race([completionPromise, timeoutPromise]);
    inferenceTime = Date.now() - startTime;
    responseText = (result?.text || '').trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Response did not contain a valid JSON block.');
    }

    const parsedJson = JSON.parse(jsonMatch[0]);

    // Validate schema
    const checkResult = validateRecord(parsedJson);
    if (checkResult.valid) {
      await benchmarkLogger.logStage(
        'extraction',
        inferenceTime,
        transcript.length,
        true,
        attempt
      );

      return {
        id: generateId('rec'),
        type: parsedJson.type,
        amount: parsedJson.amount !== null && parsedJson.amount !== undefined ? Number(parsedJson.amount) : null,
        currency: parsedJson.currency || null,
        category: parsedJson.category || 'Other',
        due_date: parsedJson.due_date || null,
        title: parsedJson.title,
        raw_text: transcript,
        confidence: 'high',
        created_at: new Date().toISOString(),
      };
    } else {
      throw new Error(`Validation failed: ${checkResult.errors.join(', ')}`);
    }

  } catch (err: any) {
    inferenceTime = Date.now() - startTime;
    console.warn(`Retry attempt ${attempt} failed: ${err.message}`);
    
    // Log failure log
    await benchmarkLogger.logStage(
      'extraction',
      inferenceTime,
      transcript.length,
      false,
      attempt
    );

    if (attempt < 2) {
      // Trigger corrective retry 2
      const retryRecord = await retryWithCorrection(transcript, responseText || err.message, attempt + 1);
      return retryRecord;
    }
    
    return null;
  }
}

// ============================================================================
// Compatibility Interfaces for Scaffold Screens
// ============================================================================
export async function initLlamaEngine(): Promise<void> {
  return initEngine();
}

export async function isLlamaModelDownloaded(): Promise<boolean> {
  return isModelDownloaded();
}

export async function extractStructuredData(rawText: string) {
  const record = await extractStructured(rawText);
  return {
    record,
    benchmark: {
      success: record.confidence === 'high',
    },
  };
}
