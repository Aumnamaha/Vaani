# Specification: Voice Recording & Audio Capture

This document outlines the voice recording and audio capture requirements for the Vaani application.

## 1. Overview
The Voice Recording module is responsible for capturing high-quality user speech, storing it locally in an optimized audio format, and passing the local audio path to the transcription engine.

## 2. Requirements
* **Sample Rate:** 16kHz (required for optimal Whisper model accuracy).
* **Format:** Mono WAV format.
* **Permissions:** Explicit request for Android and iOS microphone permissions.
* **Storage:** Locally saved in the app's document cache, cleaned up periodically.
