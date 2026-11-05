---
name: vaani-project-details
description: Vaani project implementation notes for internship report
metadata:
  type: reference
---

## Vaani (Project 1) — Complete Details

**GitHub:** https://code.swecha.org/aumnamaha/vaani

### Core Features Implemented:
1. **Onboarding Screen:** User name entry to customize profile
2. **AI Model Download:** Whisper Tiny GGML (~75MB) + Qwen 0.5B GGUF (~390MB) with WiFi check
3. **Home Dashboard:** Shows Expenses, Tasks, Reminders grouped with icons (💰/✅/⏰)
4. **Review/Edit Screen:** Raw transcript → structured fields via local Qwen extraction
5. **Saved Records/List View:** Filterable SQLite records with swipe-to-delete
6. **Benchmarking Dashboard:** Tracks latency (ms), CPU %, RAM MB for inference
7. **Network Guard:** Blocks all network requests after onboarding

### Key Code Sections:
- `app/(tabs)/onboarding/` — User profile setup
- `app/(tabs)/home/` — Dashboard with grouped records
- `app/(tabs)/review/` — Transcript to structured data extraction
- `services/whisperService.ts` — Speech-to-text transcription
- `services/llamaService.ts` — Schema extraction with retry logic
- `db/records.ts` — SQLite database operations

### Screenshots:
- `/home/aumnamaha/Pictures/Vaani Pictures/` (8 screenshots available)

### Known Limitations:
- Qwen2.5-0.5B can hallucinate occasionally (small model tradeoff)
- English-only transcription (Whisper Tiny EN)

### Privacy Guarantee:
- Zero cloud dependencies after onboarding
- No external HTTP calls allowed
- All data stays on device
- Offline mode self-test in Settings
