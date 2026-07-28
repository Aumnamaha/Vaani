# Vaani 🎙️

**Vaani** (meaning *voice* or *speech* in Sanskrit) is a privacy-first, fully offline, CPU-only mobile application for voice-to-structured-data extraction. Built for hackathons, it allows users to speak or type unstructured notes (expenses, tasks, reminders) and uses on-device Whisper and Llama/Qwen models to automatically parse them into structured SQLite databases with zero cloud dependencies.

---

## What It Is

Vaani is a secure, personal companion that structures your spoken notes without ever letting a single packet leave your phone.

The application uses an entirely local, air-gapped pipeline:
1. **On-device Voice Recording**: Captures high-fidelity WAV audio files.
2. **Local Speech Transcription**: Runs Whisper Tiny English (GGML/GGUF) via `whisper.rn` binding on device CPU.
3. **Local Schema Extraction**: Uses Qwen2.5-0.5B-Instruct GGUF via `llama.rn` (llama.cpp) running on device CPU to parse unstructured text into strict JSON schema formats.
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
- Keeps Qwen2.5-0.5B-Instruct resident in RAM to avoid cold start latency.
- Corrective Prompt Retry Engine: Automatically retries (up to 2 times) with feedback prompts on malformed JSON outputs.
- Schema Validator: Checks fields (title, amount, currency, category, due_date) and presents low confidence indicators (`⚠️ Low confidence`) if data alignment fails.
- Currency auto-defaulting: expenses without an explicit currency mention default to INR rather than failing validation, reducing unnecessary retries.

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
| Expo SDK 51 | Mobile development framework |
| React Native 0.74.5 | Cross-platform UI components |
| expo-router | File-based Stack routing |
| expo-file-system | Local file operations (model downloads, exporting reports) |
| expo-av | Microphone capture & recording configuration |

### Backend & Local AI
| Package | Purpose |
|---------|---------|
| expo-sqlite | Relational local storage |
| @react-native-community/netinfo | WiFi checks before heavy model downloads |
| whisper.rn | whisper.cpp binding for React Native |
| llama.rn | llama.cpp binding for React Native |

**Note on the environment:** Vaani uses native modules (`whisper.rn`, `llama.rn`) for on-device inference. This means the app **cannot run inside Expo Go** — it requires a custom development build (see Setup below). Expo Go only supports pure-JS/Expo-managed modules and has no way to load custom native C++ bindings.

---

## Architecture

┌─────────────────────────────────────────────────────────────┐
│                       Vaani App                             │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐    ┌──────────────┐     ┌─────────────────┐ │
│ │ Voice       │    │Transcription │     │Extraction       │ │
│ │ Recorder    │───>│ Engine       │────>│ Engine          │ │
│ │ (expo-av)   │    │ (whisper.rn) │     │ (llama.rn)      │ │
│ └─────────────┘    └──────┬───────┘     └────────-────────┘ │
│       │                   │                                 │
│       ▼                   ▼                                 │
│ ┌────────────────────────────────┐                          │
│ │ Benchmark Metrics Logger       │                          │
│ └────────────────┬───────────────┘                          │
│                  │                                          │
│                  ▼                                          │
│ ┌────────────────────────────────┐                          │
│ │ SQLite Database                │                          │
│ │ ┌────────┐ ┌───────────┐       │                          │
│ │ │records │ │benchmarks │       │                          │
│ │ └────────┘ └───────────┘       │                          │
│ └────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘


---

## Setup Instructions

### Prerequisites
- **Node.js 18.x** (Node 20+/22+/24+ are NOT currently compatible with this SDK 51 / RN 0.74 toolchain — use `nvm` to pin the version)
- **JDK 17 or 21** (Android Studio's bundled JBR works well; a system JDK 25+ will break Gradle/Kotlin compilation)
- Android Studio (SDK + emulator) or a physical Android device with USB debugging enabled
- ~465MB free storage for local model binaries (Whisper Tiny ~75MB + Qwen2.5 0.5B ~390MB)

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd Vaani

# Pin Node version (if using nvm)
nvm use 18   # or: nvm install 18 && nvm use 18

# Install packages
npm install

# Align Expo-managed package versions
npx expo install --fix

# Generate native android/ and ios/ projects
npx expo prebuild --clean

# Build and run on a connected device or emulator
npx expo run:android
```

**Important:** Do **not** run `npx expo start` and open the app in Expo Go — it will fail with `whisper.rn doesn't seem to be linked`. Always use `npx expo run:android` (or `run:ios`) to build the custom dev client with native modules properly linked.

### Onboarding & Model Download
1. **First Launch**: Enter your name to customize your profile.
2. **WiFi Verification**: The app will block starting downloads unless connected to WiFi.
3. **Sequenced Download**: Downloads the Whisper Tiny English model (~75MB) and Qwen 0.5B Instruct model (~390MB) sequentially via resumable downloads with size-based integrity checks.
4. **Locking Gate**: Upon completion, `isModelDownloadPhase` is locked permanently to block all subsequent network calls.

---

## Troubleshooting

Issues encountered and fixed during setup/testing, kept here for future reference:

- **`ERR_MODULE_NOT_FOUND` on expo-sqlite / metro errors** — usually caused by a Node version mismatch. Confirm `node --version` shows 18.x before installing.
- **`Plugin [id: 'expo-module-gradle-plugin'] was not found`** — one or more `expo-*` packages drifted to a mismatched SDK version. Run `npx expo install --fix`, then check each package under `node_modules/expo-*` reports a version consistent with SDK 51 (mostly `1x.x`/`1.x`, not `5x.x`).
- **Gradle `useDefaultAndroidSdkVersions()` not found** — caused by manually overriding `expo-modules-core` to the wrong version. Let `expo install --fix` manage this package; don't pin it manually.
- **Java version errors during Gradle build** — point `JAVA_HOME` at Android Studio's bundled JDK (`.../android-studio/jbr` or the flatpak equivalent), not a system-installed JDK.
- **"Failed to initialize context" (Whisper)** — check that the file path passed to `initWhisper()` doesn't retain a `file://` URI scheme; whisper.rn's native loader expects a bare filesystem path.
- **On-device transcription `ENOENT`** — Android's `expo-av` recording URI can come back as `file:/path` (single slash) rather than a standard `file:///path` URI. Strip any `file:` prefix (regardless of slash count) before passing the path to the transcription engine.
- **Model downloads silently truncating ("stream was reset")** — verify the downloaded file size against the actual current size on the model's host (hardcoded "official" byte counts found online can be stale); use a generous minimum-size threshold rather than an exact byte match.
- **Model context "busy" on retry** — add a short cooldown (e.g. 3s) before retrying inference after a timeout, so the native context fully releases before the next call.

---

## Known Limitations

- **Qwen2.5-0.5B is a very small model.** It runs fully offline on CPU, but as a tradeoff it can occasionally produce structured output unrelated to the input transcript (a form of hallucination more common in small quantized models). For the hackathon demo, testing a phrase 2-3 times and reviewing output before saving is recommended. This is a genuine and disclosed accuracy/efficiency tradeoff, not a bug.
- Currently English-only for transcription (Whisper Tiny EN); multilingual support is on the roadmap.

---

## Privacy Guarantee 🔒

- **No Remote Servers**: No API keys required, no external HTTP calls are allowed outside the one-time model download.
- **Network Guard**: Attempts to contact external networks after onboarding will trigger a security exception.
- **Offline Mode Self-Test**: Verification audit in Settings allows confirming network blockage locally.
- **All Data Stays On Device**: Your transcripts, categories, reminders, and performance logs never leave this phone.

---

## Roadmap

### v1.0 (Completed Hackathon Build)
- [x] Speech recording & local transcription.
- [x] On-device SLM classification & schema validation.
- [x] SQLite unified data layer.
- [x] Interactive benchmarking dashboard and JSON export.
- [x] WiFi-only model downloading and Network Guard.
- [x] Verified working end-to-end on physical Android hardware and emulator.

### v1.1
- [ ] Multilingual transcription support.
- [ ] Local vector search for semantic categorization.
- [ ] Direct calendar event integrations.
- [ ] Improved extraction reliability (larger quantized model or fine-tuned prompt strategy).

---

## License

MIT License. See [LICENSE](LICENSE) for details.