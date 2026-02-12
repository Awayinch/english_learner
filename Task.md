# Current Task List
# Agent Execution Protocol
Before marking a task as [x] Completed, you MUST:
1.  **Analyze**: Briefly explain the root cause or implementation strategy.
2.  **Plan**: If the change involves modifying >3 files, list the files you intend to touch.
3.  **Self-Correction**: Ask yourself: "Does this change break the GitHub Sync or Mobile layout?"
4.  **Confirm**: Wait for user confirmation if the change involves deleting legacy code.
## ✅ Completed (Recent)
- [x] Fix mobile update white-screen crash (v1.0.10).
- [x] Add "Up to date" visual feedback.
- [x] Implement Edge TTS (Microsoft) integration.
- [x] Basic GitHub Sync (Backup/Restore).
- [x] Quiz Mode (Text/File input).

## 🚧 In Progress / High Priority
- [ ] **Refactor `App.tsx`**: The main component is too large. Split `Header`, `Sidebar`, and `ChatArea` into sub-components.
- [ ] **State Management**: Move `useState` logic for Settings/Vocabulary into a lightweight Context or `zustand` store to reduce prop drilling.
- [ ] **Mobile UI Polish**: Improve the "Tap-to-Define" modal animation and touch targets on small screens.
- [ ] **DeepSeek/OpenAI Support**: Explicitly add configuration UI for non-Gemini models (BaseURL is there, but needs better UX).

## 📋 Backlog (Future Features)
- [ ] **Spaced Repetition (SRS)**: Add a "Review" tab using an SM-2 like algorithm for vocabulary.
- [ ] **Voice Input (STT)**: Add microphone support for speaking to the AI (Web Speech API).
- [ ] **PDF Export**: Generate a PDF report of the study session.
- [ ] **Plugin System**: Allow custom "Tools" for the AI (e.g., Google Search grounding).

## 🐛 Known Issues
- Large chat history might slow down rendering (Need virtualization).
- Edge TTS sometimes times out on unstable mobile networks (Fallback logic exists but can be smoother).
