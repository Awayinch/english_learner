# Implementation Strategy

## 1. Technology Stack
*   **Framework**: React 19 + TypeScript + Vite (Fast, minimal overhead).
*   **Styling**: Tailwind CSS (Utility-first, responsive).
*   **Icons**: Lucide React.
*   **Data Persistence**: 
    *   Primary: `localStorage` (Instant load).
    *   Cloud: GitHub REST API (JSON/Markdown sync).
*   **AI**: `@google/genai` (Official SDK) + `fetch` (Proxy/OpenAI compat).

## 2. Architecture Principles
*   **Service Layer Pattern**: Logic for API calls (`geminiService.ts`, `githubService.ts`) must be separated from UI components.
*   **Hooks**: Use Custom Hooks (`useChat`, `useVocabulary`) to manage logic state.
*   **Error Boundaries**: Wrap major sections (Chat, Settings) to prevent full app crashes.

## 3. Data Structure (Current)
*   `Settings`: Stores API keys, personas, preferences. **Never sync API keys to cloud unless encrypted (currently strictly local).**
*   `VocabularyItem`: `{ id, word, definition, partOfSpeech, example }`.
*   `ChatMessage`: `{ id, role, text, usedVocabulary[] }`.

## 4. Execution Workflow (Coding Session)
1.  **Check `Task.md`**: Pick the top priority task.
2.  **Update Version**: Increment version in `metadata.json` and `SettingsModal.tsx` if logic changes.
3.  **Implementation**:
    *   Write/Modify Code.
    *   Ensure Tailwind classes follow `Design Guidelines.md`.
4.  **Verification**:
    *   Check Mobile responsiveness.
    *   Check Offline behavior (Graceful degradation).
5.  **Documentation**: Update `Task.md` (mark done) and `Plan.md` (if scope changed).
## 5. Strict Refactoring Rules (Anti-Spaghetti)
*   **The 200-Line Rule**: If a component file exceeds 200 lines, you MUST propose a split (extract sub-components or hooks) BEFORE implementing new features.
*   **No Logic in UI**: UI components (`.tsx`) should only contain rendering logic.
    *   ❌ BAD: Writing `fetch` or complex `filter/map` logic inside `useEffect` in the component.
    *   ✅ GOOD: Move logic to a custom hook (e.g., `useChatSession.ts`) and return only the data needed for rendering.
*   **One Component Per File**: Never define multiple components in a single file unless they are strictly private sub-components.
*   **Configuration over Hardcoding**: Never hardcode magic numbers or strings (e.g., API URLs, Timeout durations). Move them to `types.ts` or a config object.