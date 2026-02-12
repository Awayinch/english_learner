# LingoLeap Project Plan (Macro Goals)

## 1. Vision
Build a lightweight, privacy-first, and highly customizable AI language tutor that runs entirely in the browser (or hybrid mobile containers). It bridges the gap between casual chat bots and structured learning tools (like Anki/Duolingo).

## 2. Core Philosophy
*   **Serverless/Client-First**: No proprietary backend. Data lives in `LocalStorage` and syncs via **GitHub API** (acting as a personal cloud).
*   **Open & Extensible**: Users own their data (JSON/Markdown). The logic relies on standard APIs (Gemini/OpenAI-compat), allowing users to switch models easily.
*   **Immersive**: Voice-first experience where possible (High-quality TTS, and future STT).
*   **Aesthetic Utility**: The UI must be beautiful enough to encourage daily use, but functional enough not to waste time.

## 3. Key Pillars
1.  **AI Conversation (The Core)**:
    *   Context-aware chat (remembering user level, profession, and history).
    *   Support for "Personas" (Roleplay scenarios).
2.  **The "Worldbook" (Vocabulary System)**:
    *   Not just a list, but a contextual database.
    *   Integration with Obsidian (Markdown export) for knowledge management.
3.  **Gamification (Quiz Mode)**:
    *   AI-generated quizzes based on chat history or uploaded files.
    *   Instant feedback loop.
4.  **Cross-Platform Accessibility**:
    *   Responsive design (Desktop/Mobile).
    *   Specific optimization for **Termux** (Android) self-hosting.

## 4. Success Metrics
*   **Latency**: Chat response < 2s (streamed), TTS < 1s.
*   **Stability**: Zero crashes on mobile network switching.
*   **Data Integrity**: GitHub Sync never loses data.
# 🛑 Critical Constraints & Anti-Patterns

## 1. Environment Limitations (Termux/Mobile)
*   **NO Node.js Native Modules**: You are running in a Browser/Vite environment.
    *   ❌ FORBIDDEN: `fs` (file system), `path`, `crypto` (node version), `child_process`.
    *   ✅ USE: `localStorage`, `File API`, `Web Crypto API`.
*   **Performance**: Avoid heavy computations on the main thread. Mobile CPUs throttle easily.

## 2. Data Safety
*   **No Destructive Sync**: When syncing with GitHub, always `pull` and `merge` before `push`. Never force push (`git push -f`) or overwrite without checking version timestamps.
*   **API Keys**: Never commit API keys to code. They must remain in `localStorage` or environment variables.

## 3. Library Management
*   **No New npm Packages**: Do not add new npm packages without asking. We want to keep the bundle size small for mobile loading. Reuse existing libraries (Lucide, Tailwind, etc.) whenever possible.