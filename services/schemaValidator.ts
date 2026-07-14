import { RecordType, RECORD_TYPES, CATEGORIES } from '../constants/schema';
import { VaaniRecord } from '../types';
import { generateId } from '../utils/idGen';
import * as benchmarkLogger from './benchmarkLogger';

// ============================================================================
// Core Schema Validation
// ============================================================================
export function validateRecord(candidate: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['Candidate is not a valid JSON object'] };
  }

  // 1. Validate Type
  if (!candidate.type || !RECORD_TYPES.includes(candidate.type as RecordType)) {
    errors.push(`type must be one of: ${RECORD_TYPES.join(', ')}`);
  }

  // 2. Validate Title
  if (!candidate.title || typeof candidate.title !== 'string' || !candidate.title.trim()) {
    errors.push('title is a required non-empty string');
  }

  // 3. Validate Category (optional, but must be in enum if present)
  if (candidate.category && !CATEGORIES.includes(candidate.category as any)) {
    errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
  }

  // 4. Type-Specific Rules
  if (candidate.type === 'expense') {
    if (candidate.amount === undefined || candidate.amount === null || isNaN(Number(candidate.amount))) {
      errors.push('amount is required and must be a number for expenses');
    }
    if (!candidate.currency || typeof candidate.currency !== 'string' || candidate.currency.trim().length !== 3) {
      errors.push('currency is required and must be a 3-letter ISO code for expenses');
    }
  } else if (candidate.type === 'task' || candidate.type === 'reminder') {
    if (!candidate.due_date) {
      // Warn but don't hard fail
      console.warn('Warning: due_date is missing for task/reminder');
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (typeof candidate.due_date !== 'string' || !dateRegex.test(candidate.due_date.trim())) {
        errors.push('due_date must be in YYYY-MM-DD format');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Fallback Generator
// ============================================================================
/**
 * Constructs a fallback record when AI extraction and corrective retries fail.
 * Sets confidence to 'low', default type to 'task', and truncates title.
 */
export function buildFallbackRecord(rawTranscript: string): VaaniRecord {
  return {
    id: generateId('rec'),
    type: 'task',
    amount: null,
    currency: null,
    category: 'Other',
    due_date: null,
    title: rawTranscript.slice(0, 40),
    raw_text: rawTranscript,
    confidence: 'low',
    created_at: new Date().toISOString(),
  };
}

// ============================================================================
// Corrective Prompt & Inference Retry Wrapper
// ============================================================================
/**
 * Attempts a corrective extraction by feeding errors back into the SLM.
 * Max 2 attempts total before returning null.
 */
export async function retryWithCorrection(
  rawTranscript: string,
  failedOutput: string,
  attempt: number
): Promise<VaaniRecord | null> {
  if (attempt > 2) {
    return null;
  }

  // Log retry usage to benchmarks
  await benchmarkLogger.logStage(
    'extraction',
    0,
    rawTranscript.length,
    false,
    attempt
  );

  const { extractStructuredWithPrompt } = require('./extractionEngine');

  const correctivePrompt = `
You convert spoken notes into structured JSON.
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
}

Your previous output was invalid and failed schema validation:
"${failedOutput}"

Fix this to match the schema exactly. Respond with corrected JSON only.
`;

  try {
    // Dynamic import to prevent circular dependency at load time
    const record = await extractStructuredWithPrompt(rawTranscript, correctivePrompt, attempt);
    return record;
  } catch (error) {
    console.error(`Retry attempt ${attempt} failed:`, error);
    return null;
  }
}

// ============================================================================
// Compatibility Interface (Backwards-compatibility with validateExtraction)
// ============================================================================
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  record: Omit<VaaniRecord, 'id' | 'created_at'> | null;
}

export function validateExtraction(inputJson: any, rawText: string): ValidationResult {
  const check = validateRecord(inputJson);
  
  const record: Omit<VaaniRecord, 'id' | 'created_at'> = {
    type: inputJson?.type || 'task',
    amount: inputJson?.amount !== undefined ? Number(inputJson.amount) : null,
    currency: inputJson?.currency || null,
    category: inputJson?.category || 'Other',
    due_date: inputJson?.due_date || null,
    title: inputJson?.title || 'Untitled Record',
    raw_text: rawText,
    confidence: check.valid ? 'high' : 'low',
  };

  return {
    isValid: check.valid,
    errors: check.errors,
    record,
  };
}
