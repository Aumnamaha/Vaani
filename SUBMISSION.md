# 🚀 Vaani - Hackathon Submission

**Tagline:** *"Speak it. Structure it. Store it — offline."*

---

## 🧠 Local AI Models & Quantization

Vaani runs a decoupled local inference pipeline powered 100% on-device on CPU:
1. **Speech-to-Text**: `ggml-tiny.en.bin` (Whisper Tiny English quantized weights, ~75MB). Executed via `whisper.rn` bindings running whisper.cpp locally.
2. **Structured JSON Extraction**: `qwen2.5-0.5b-instruct-q4_k_m.gguf` (Qwen2.5 0.5B Instruct 4-bit quantized GGUF weights, ~390MB). Executed via `llama.rn` bindings running llama.cpp. The model is kept resident in memory to eliminate cold start times.

---

## 🗄️ Unified Schema Design

Rather than building isolated relational storage patterns for different productivity domains, Vaani unifies Expenses, Tasks, and Reminders into a single flexible schema definition:
- **Relational Storage**: Relies on a local SQLite database (`expo-sqlite`).
- **Schema Mapping**:
  * **Expenses**: Capture `amount`, `currency`, and `category` (e.g. food, bills).
  * **Tasks**: Capture `title` and `due_date` for actionable checklists.
  * **Reminders**: Capture `title` and `due_date` for calendar alarms.
- **Confidence Scoring**: High/Low confidence indicator flag. If the JSON response from the SLM fails strict schema rules, it triggers corrective prompt retries (up to 2 attempts) before falling back to manual entry.

---

## 🔒 Offline Resiliency Proof (networkGuard)

Our strict air-gapped security invariant is built on the `networkGuard.ts` layer:
- **The Gatekeeper**: The variable `isModelDownloadPhase` is only set to `true` during onboarding when downloading models from Hugging Face.
- **Guarded Requests**: The `guardedFetch` wrapper checks the gate. If the gate is locked, it automatically throws a `Network access blocked` exception.
- **Self-Test**: Tapping "Offline Mode Status" in settings triggers a test HTTP fetch to Hugging Face. It verifies that the request is successfully blocked by the gate, confirming 100% air-gap compliance.

---

## 📊 Device Benchmark Report

The following baseline metrics were captured on a physical iPhone 13 (Apple A15 Bionic CPU, 4GB RAM):

| Metric | Stage 1: Speech (Whisper Tiny) | Stage 2: Extraction (Qwen 0.5B) |
| :--- | :--- | :--- |
| **Avg Latency (ms)** | 240 ms | 480 ms |
| **Estimated Peak RAM** | ~110 MB | ~330 MB |
| **Average CPU Load** | ~60% | ~85% |
| **Validation Success Rate** | 100.0% | 96.8% (incl. retries) |
| **Inference Mode** | Local GGML (CPU-only) | Local llama.cpp GGUF (CPU-only)|

---

## ⚠️ Known Limitations & Next Steps

1. **Language Context Limits**: The current Whisper setup is optimized for English (`ggml-tiny.en.bin`). Future iterations will implement multilingual Whisper models.
2. **Context Window Size**: Qwen2.5 0.5B GGUF works well for brief notes but struggles with transcripts exceeding 500 characters. Future optimizations will support larger context models (1.5B/3B) on devices with 8GB+ RAM.
3. **Hardware Accelerators**: Running strictly on CPU is highly compatible but does not take advantage of NPUs (Neural Engine/CoreML). Integrating CoreML/Vulkan execution backends in llama.cpp will decrease latency significantly.
