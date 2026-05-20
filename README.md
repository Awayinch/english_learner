[🇨🇳 简体中文](README_zh.md) | [🇬🇧 English](README.md)

# LingoLeap - AI Language Tutor 🎓

**Live Demo:** [https://english-learner.vercel.app](https://english-learner.vercel.app) *(Replace with your actual Vercel link)*

LingoLeap is an immersive, personalized language learning web application powered by **Google Gemini**. It combines real-time AI conversation, contextual vocabulary tracking, and gamified quizzes into a single, cross-device experience.

Built with **React 19**, **TypeScript**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.13-green.svg)
![Powered By](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## ✨ Key Features

### 🤖 Intelligent Chat & Roleplay
- **Multi-Session Management**: Create, rename, switch, and batch delete conversation sessions.
- **Powered by Gemini**: Supports `gemini-2.0-flash`, `gemini-3-flash-preview` and more.
- **Custom Personas**: Set up any character (e.g., "Strict Victorian Teacher", "Casual Friend") via System Prompts.
- **Long-Term Memory**: A "Memory Pad" that injects user details (goals, background) into every conversation context.
- **TTS Support**: Browser-native Text-to-Speech to read messages aloud.

### 📚 The "Worldbook" (Vocabulary Manager)
- **Contextual Learning**: Words added to the Worldbook are highlighted in chat with AI-generated contextual translations.
- **Smart Import**: Paste any article, and the AI will analyze, extract, and define difficult words in batches.
- **Tap-to-Define**: 
  - **Desktop**: Highlight any text to add it.
  - **Mobile**: Tap words in chat to view definitions.

### ☁️ Cross-Device Cloud Sync (GitHub)
- **No Backend Required**: Uses your own **GitHub Repository** as a private database.
- **Full State Sync**: Syncs Chat History, Vocabulary, Memory, and Settings between PC and Mobile.
- **Obsidian Integration**: Export learning session summaries (Markdown) directly to your Obsidian vault (hosted on GitHub).

### 📝 AI Quiz Mode
- **Generate Quizzes**: Create English comprehension tests from any text input or uploaded files (PDF/Images).
- **Auto-Grading**: Instant feedback and explanations for answers.

---

## 📱 Mobile Usage (Termux) - Lazy Setup Guide

You can run this application on your Android phone locally using Termux.

### 1. First-time Installation (All-in-one command)
This script will automatically configure the environment, download the code, install dependencies, and run the app.

```bash
pkg update -y && pkg upgrade -y && pkg install git nodejs -y && git clone https://github.com/Awayinch/english_learner.git && cd english_learner && chmod +x start.sh && ./start.sh
```

*(If `git clone` fails, please ensure you have a proxy enabled or a GitHub mirror configured)*

### 2. Quick Start Command (For subsequent launches)
Next time you open Termux, just enter this single line:

```bash
cd english_learner && ./start.sh
```

**How it works:**
*   `chmod +x start.sh`: Grants execution permission to the script.
*   `./start.sh`: Automatically executes `npm install` (dependency check), `npm run build` (compilation), and `npx serve` (starts the server).
*   **Port Isolation**: Forces port 3000 to avoid conflicts with other services like SillyTavern (8000).

---

## 🚀 Getting Started (PC/Dev)

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key (Get it [here](https://aistudio.google.com/app/apikey))
- A GitHub Account (for Sync functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Awayinch/english_learner.git
   cd english_learner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```

---

## ⚙️ Configuration Guide

Click the **Settings (Gear Icon)** in the app to configure connections.

### 1. AI Connection
- **API Key**: Enter your Google Gemini API Key.
- **Base URL (Optional)**: If you are using a proxy (e.g., OneAPI) or cannot access Google directly, enter your proxy URL here. The app is compatible with OpenAI-format proxies.

### 2. Setting Up Cloud Sync (Cross-Device)
To sync data between your Phone and PC, LingoLeap uses GitHub's API.

1. **Create a Private Repository** on GitHub (e.g., named `english-learning-data`).
2. **Generate a Personal Access Token (Classic)**:
   - Go to [GitHub Settings > Developer Settings > Tokens (Classic)](https://github.com/settings/tokens).
   - Generate New Token.
   - **Scopes**: Check `repo` (Full control of private repositories).
   - Copy the token (starts with `ghp_...`).
3. **In LingoLeap Settings**:
   - **GitHub Token**: Paste your token.
   - **Repo**: Enter `yourusername/english-learning-data`.
   - **Path**: (Optional) Folder path, e.g., `backup/`.
4. **Usage**:
   - Click **"Backup Current Data"** to save your state.
   - On a new device, click **"Fetch Backup & Preview"** to restore.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **AI SDK**: `@google/genai` (Official SDK)
- **Icons**: Lucide React
- **Audio**: Web Audio API & SpeechSynthesis API

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Created by [awayinch](https://github.com/Awayinch)
