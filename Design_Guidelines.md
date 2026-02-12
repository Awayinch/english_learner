# Design & Style Guidelines

## 1. Visual Aesthetics (The "LingoLeap" Look)
*   **Vibe**: Clean, Academic yet Modern, "Notion-esque".
*   **Color Palette**:
    *   **Primary**: Indigo (`bg-indigo-600`, `text-indigo-600`).
    *   **Background**: Slate (`bg-slate-50` for app bg, `bg-white` for cards).
    *   **Text**: Slate (`text-slate-800` primary, `text-slate-500` secondary).
    *   **Accents**: Green (Success), Red (Error/Danger), Amber (Memory/Context).
*   **Shapes**:
    *   Cards/Modals: `rounded-2xl` or `rounded-xl`.
    *   Buttons: `rounded-lg` or `rounded-xl`.
*   **Shadows**: Soft, diffused shadows (`shadow-sm`, `shadow-lg` for modals). Avoid harsh outlines.

## 2. Component Guidelines
*   **Buttons**:
    *   Primary: Indigo background, White text, hover darken.
    *   Secondary: White background, Slate border, hover Slate-50.
    *   Icon-only: `p-2 rounded-lg hover:bg-slate-100`.
*   **Inputs**:
    *   `border-slate-200`, `focus:ring-2 focus:ring-indigo-200`, `rounded-lg`.
    *   Font size: `text-sm` (Desktop), `text-base` (Mobile - to prevent iOS zoom).
*   **Feedback**:
    *   Always show loading states (`Loader2` animate-spin).
    *   Use Optimistic UI updates where possible.
*   **Mobile-First Constraints**:
    *   **Touch Targets**: All interactive elements MUST be at least `44px` height/width.
    *   **Safe Areas**: Ensure padding-bottom accounts for mobile browser navigation bars and the virtual keyboard (avoid fixed positioning at absolute bottom without offsets).
    *   **No Hover Logic**: Do not rely on `:hover` states for critical functionality, as they don't exist on touch screens.
## 3. Coding Conventions
*   **React**: Functional Components only. Use `FC<Props>`.
*   **Imports**: Absolute/Module imports preferred. Group imports (React -> Libs -> Types -> Components -> Services).
*   **Naming**: 
    *   Components: PascalCase (`SettingsModal`).
    *   Functions/Vars: camelCase (`handleSave`).
    *   Types: PascalCase (`VocabularyItem`).
*   **Safety**:
    *   Always check `if (!apiKey)` before calls.
    *   Use `try/catch` block for **all** async operations (Network is unreliable).

## 4. Version Control
*   **Manifest**: Always update `metadata.json` version when pushing features.
*   **Changelog**: (Implicit) The XML `description` field serves as the commit message.
