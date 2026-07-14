export const RECORD_TYPES = ['expense', 'task', 'reminder'] as const;

export type RecordType = typeof RECORD_TYPES[number];

export const CATEGORIES = ['Food', 'Transport', 'Bills', 'Work', 'Personal', 'Other'] as const;

export type RecordCategory = typeof CATEGORIES[number];

export const EXTRACTION_SCHEMA_PROMPT = `
You are a precise data extraction system. You must analyze the text and output ONLY a valid JSON object matching the following structure:
{
  "type": "expense" | "task" | "reminder",
  "amount": number | null,
  "currency": string | null,
  "category": "Food" | "Transport" | "Bills" | "Work" | "Personal" | "Other" | null,
  "due_date": "YYYY-MM-DD" | null,
  "title": "A short descriptive summary",
  "raw_text": "The input text verbatim"
}

Constraints:
1. "amount" and "currency" should only be populated if the type is "expense".
2. "currency" should be an ISO 4217 code (e.g., USD, INR, EUR).
3. "due_date" should only be populated if the type is "task" or "reminder". Use YYYY-MM-DD format based on current relative date context if mentioned (e.g. tomorrow, next Monday).
4. "title" is always required and should be a concise summary (max 6 words).
5. "raw_text" is the exact input text provided to you.
6. Return ONLY the JSON object. Do not include markdown formatting, backticks, or any conversational text.
`;
