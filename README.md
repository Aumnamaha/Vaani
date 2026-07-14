# Vaani 🎙️

**Vaani** (meaning *voice* or *speech* in Sanskrit) is a privacy-first, fully offline, CPU-only mobile application for voice-to-structured-data extraction. Built for hackathons, it allows users to speak or type unstructured notes (expenses, tasks, reminders) and uses on-device Whisper and Llama/Qwen models to automatically parse them into structured SQLite databases with zero cloud dependencies.

---

## What It Is

Vaani is a secure, personal companion that structures your spoken notes without ever letting a single packet leave your phone. 

The application uses an entirely local, air-gapped pipeline:
1. **On-device Voice Recording**: Captures high-fidelity WAV audio files.
2. **Local Speech Transcription**: Runs Whisper Tiny English (GGML/GGUF) via `whisper.rn` binding on device CPU.
3. **Local Schema Extraction**: Fallback to Qwen2.5-0.5B-Instruct GGUF via `llama.rn` (llama.cpp) running on device CPU to parse unstructured text into strict JSON schema formats.
4. **Offline Relational Storage**: Stores structured items (expenses, tasks, reminders) in a local SQLite database (`expo-sqlite`).

### Key Capabilities
- 🎙️ **On-Device Whisper STT** - Real-time local speech-to-text with zero external APIs.
- 🤖 **On-Device Llama Schema Parser** - Translates spoken notes into strict structured JSON.
- 🔒 **Hardened Network Guard** - Automatically blocks all network requests outside initial onboarding download.
- ⚡ **Resource Efficiency Tracker** - Real-time benchmarking tracking latency, CPU load, and RAM.
- 🗄️ **Relational Storage** - Unified local storage for expenses, tasks, and reminders with full SQLite indexing.

---

## Key Features

### 🎙️ Speech Capture & Transcriber
- Converts spoken audio into text locally with 16kHz PCM WAV input formatted specifically for Whisper.
- Visual pulse animations during microphone recording.
- Real-time transcription spinner and fallback recovery options.

### 🧠 Local AI Schema Extraction
- Keep Qwen2.5-0.5B-Instruct resident in RAM to avoid cold start latency.
- Corrective Prompt Retry Engine: Automatically retries (up to 2 times) with feedback prompts on malformed JSON outputs.
- Schema Validator: Checks fields (title, amount, currency, category, due_date) and presents low confidence indicators (`⚠️ Low confidence`) if data alignment fails.

### 📋 Saved Records & Search
- Unifies Expense, Task, and Reminder types in a single queryable list.
- Grouped views with representative icons (💰 expense, ✅ task, ⏰ reminder).
- Swipe-to-delete gesture support powered by `react-native-gesture-handler`.
- Tap-to-edit capability to refine details or raw transcripts.

### 📊 Real-Time Benchmarking
- Tracks exact latency (ms), CPU usage (%), and memory footprint (MB) for every Whisper and Llama inference step.
- Displays summary statistics (avg transcription time, avg extraction time, JSON success rates).
- Beautiful horizontal bar charts illustrating latency scaling over the last 8 runs.
- **Export Report** button writes a JSON dump via `expo-file-system` and triggers native sharing for submission auditing.

---

## Tech Stack

### Frontend
| Package | Purpose |
|---------|---------|
| Expo SDK 52 | Mobile development framework |
| React Native | Cross-platform UI components |
| expo-router | File-based Stack routing |
| expo-file-system | Local file operations (exporting reports) |
| expo-av | Microphone capture & recording configuration |

### Backend & Local AI
| Package | Purpose |
|---------|---------|
| expo-sqlite | Relational local storage |
| @react-native-community/netinfo | WiFi checks before heavy model downloads |
| whisper.rn | whisper.cpp binding for React Native |
| llama.rn | llama.cpp binding for React Native |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Vaani App                          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐    ┌──────────────┐     ┌─────────────────┐ │
│ │   Voice     │    │Transcription │     │Extraction       │ │
│ │  Recorder   │───&gt;│    Engine    │────&gt;│     Engine      │ │
│ │  (expo-av)  │    │ (whisper.rn) │     │   (llama.rn)    │ │
│ └─────────────┘    └──────┬───────┘     └────────┬────────┘ │
│                           │                      │          │
│                           ▼                      ▼          │
│                      ┌────────────────────────────────┐     │
│                      │    Benchmark Metrics Logger    │     │
│                      └────────────────┬───────────────┘     │
│                                       │                     │
│                                       ▼                     │
│                      ┌────────────────────────────────┐     │
│                      │        SQLite Database         │     │
│                      │   ┌────────┐     ┌───────────┐ │     │
│                      │   │records │     │benchmarks │ │     │
│                      │   └────────┘     └───────────┘ │     │
│                      └────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Android Studio / Xcode (for native simulator/device run)
- ~465MB free storage for local model binaries

### Quick Start
```bash
# Clone the repository
git clone <repo-url>
cd Vaani

# Install packages
npm install

# Run the Expo project
npx expo start
```

### Onboarding & Model Download
1. **First Launch**: Enter your name to customize your profile.
2. **WiFi Verification**: The app will block starting downloads unless connected to WiFi.
3. **Sequenced Download**: Downloads the Whisper Tiny model (~75MB) and Qwen 0.5B Instruct model (~390MB) sequentially.
4. **Locking Gate**: Upon completion, `isModelDownloadPhase` is locked permanently to block all subsequent network calls.

---

## Privacy Guarantee 🔒

- **No Remote Servers**: No API keys required, no external HTTP calls are allowed.
- **Network Guard**: Attempts to contact external networks after onboarding will trigger a security exception.
- **Biometric Audits**: Verification self-test in Settings screens allows auditing blockages locally.
- **All Data Stays On Device**: Your transcripts, categories, reminders, and performance logs never leave this phone.

---

## Roadmap

### v1.0 (Completed Hackathon Build)
- [x] Speech recording & local transcription.
- [x] On-device SLM classification & schema validation.
- [x] SQLite unified data layer.
- [x] Interactive benchmarking dashboard and JSON export.
- [x] WiFi-only model downloading and Network Guard.

### v1.1
- [ ] Multilingual transcription support.
- [ ] Local vector search for semantic categorization.
- [ ] Direct calendar event integrations.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
