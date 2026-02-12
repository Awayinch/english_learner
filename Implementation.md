# Implementation Strategy

## 1. Technology Stack
*   **Framework**: React 19 + TypeScript + Vite (Fast, minimal overhead).
*   **State Management**: **Zustand** (with persistence middleware).
*   **Styling**: Tailwind CSS (Utility-first, responsive).
*   **Icons**: Lucide React.
*   **Data Persistence**: 
    *   Primary: `localStorage` (via Zustand Persist).
    *   Cloud: GitHub REST API (JSON/Markdown sync).
*   **AI**: `@google/genai` (Official SDK) + `fetch` (Proxy/OpenAI compat).
*   **Packaging**: Capacitor (Recommended for mobile), PWA (Web).

## 2. Architecture Principles (Refactored)
*   **Store-First**: All global state (Settings, Sessions, Vocabulary) lives in `src/store/useStore.ts`. Components read/write to this store.
*   **Service Layer**: Logic for API calls (`geminiService.ts`, `githubService.ts`) is separated from UI.
*   **Feature-Based Component Structure**:
    *   `components/ChatInterface.tsx`: Handles message list and input.
    *   `components/Header.tsx`: Navigation and mode switching.
    *   `components/VocabularyPanel.tsx`: Sidebar logic.
*   **Hooks**: Use Custom Hooks (`useChatLogic.ts`) to manage interaction logic (sending messages, handling loading states) to keep components clean.

## 3. Data Structure
*   `Settings`: Stores API keys, personas, preferences.
*   `VocabularyItem`: `{ id, word, definition, partOfSpeech, example }`.
*   `ChatMessage`: `{ id, role, text, usedVocabulary[] }`.
*   `ChatSession`: `{ id, title, messages[], createdAt }`.

## 4. Execution Workflow
1.  **Check `Task.md`**: Pick the top priority task.
2.  **Implementation**:
    *   Modify Store if data structure changes.
    *   Update Components.
3.  **Verification**:
    *   Check Mobile responsiveness.
    *   Check Offline behavior.
4.  **Documentation**: Update `Task.md`.

## 5. Strict Refactoring Rules
*   **The 200-Line Rule**: If a component file exceeds 200 lines, split it.
*   **No Logic in UI**: UI components (`.tsx`) should only contain rendering logic. Move complex logic to hooks or store actions.
*   **Zustand Usage**: Prefer atomic selectors or small slices when consuming state to avoid unnecessary re-renders.
