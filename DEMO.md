# 🎙️ Vaani Demo Instructions

Follow these step-by-step instructions to verify the offline-first capability and resource efficiency of Vaani.

---

### Step 1: Go Air-Gapped (Airplane Mode)
1. Pull down your device's settings menu (or Control Center on iOS/Android).
2. Toggle on **Airplane Mode** to completely cut off WiFi and Cellular data connectivity.
3. Open the **Vaani** application. You will see the main Home Screen dashboard.
4. *(Optional)* Go to **Settings** and tap the **Offline Mode Status** check. You should see it display `Verified ✅ (Air-Gapped)`, verifying that the Network Guard has successfully locked down all traffic.

---

### Step 2: Speak a Note (Speech Capturing)
1. On the Home Screen, tap the large **🎙️ Speak a note** option.
2. Grant microphone access if prompted (needed for local recording).
3. Tap the big **Mic button** to begin recording.
4. Speak a sample unstructured note clearly. For example:
   * *"I just spent forty-five dollars on grocery shopping at Costco today"* (for an Expense)
   * *"Remember to write the project status email by tomorrow morning"* (for a Task/Reminder)
5. Tap the stop button. The capture UI will update to display `Transcribing locally...`.

---

### Step 3: Local Pipeline Processing
1. **Transcription**: The local Whisper GGML model runs CPU-only inference on your recorded wav file.
2. **Review Screen Transition**: Once transcribed, you will automatically navigate to the **Review & Edit** screen.
3. You will see your raw spoken transcript pre-filled in the editable text box. If the speech engine made minor typos, you can tap to edit them now.
4. Tap the **Extract Structure (Local SLM)** button.
5. The UI will show a `Processing locally...` spinner. The local Qwen2.5-0.5B-Instruct model will analyze the transcript on-device.
6. The resulting structured fields (Title, Type, Amount, Currency, Category, Due Date) will be automatically extracted and populated into the form.
7. If any details are ambiguous, a yellow banner reading `⚠️ Low confidence — please review fields` will appear at the top.
8. Make any manual corrections needed and tap **Save** in the top right.

---

### Step 4: Verification & Records View
1. You will be redirected to the **Saved Records** screen.
2. The new record will be listed here, automatically categorized with an icon:
   * 💰 for Expenses
   * ✅ for Tasks
   * ⏰ for Reminders
3. Swipe the row to the left to show the red **Delete** action, or tap the card to inspect original transcript and edit fields again.

---

### Step 5: Auditing the Performance & Privacy
1. Go back to Home and navigate to **Benchmarks** (or tap **Metrics** in the bottom tab bar).
2. Review the **Summary Dashboard**:
   * Average transcription latency
   * Average extraction latency
   * Model success rates (JSON validation pass rate)
3. Check the **Latency per Stage** bar chart illustrating the CPU performance profiles over the last 8 runs.
4. Rest assured that no data has left your phone: **All AI operations were performed 100% on-device on CPU.**
