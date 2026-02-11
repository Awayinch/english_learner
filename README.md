
# LingoLeap - AI Language Tutor 🎓

LingoLeap is an immersive, personalized language learning web application powered by **Google Gemini**. It combines real-time AI conversation, contextual vocabulary tracking, and gamified quizzes into a single, cross-device experience.

Built with **React 19**, **TypeScript**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.9-green.svg)
![Powered By](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## ✨ Key Features

### 🤖 Intelligent Chat & Roleplay
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

## 📱 Mobile Usage (Termux) - 懒人版指南

你可以使用 Android 手机上的 Termux 运行此应用。

### 1. 首次安装指令（一条龙复制）
这段代码会自动配置环境、下载代码、安装依赖并运行。

```bash
pkg update -y && pkg upgrade -y && pkg install git nodejs -y && git clone https://github.com/Awayinch/english_learner.git && cd english_learner && chmod +x start.sh && ./start.sh
```

*(如果 git clone 失败，请确保开启了加速器，或配置了 GitHub 镜像)*

### 2. 以后每次启动的最短指令
以后打开 Termux，只需要输入下面这一行：

```bash
cd english_learner && ./start.sh
```

**原理说明：**
*   `chmod +x start.sh`: 赋予脚本执行权限。
*   `./start.sh`: 自动执行 `npm install` (依赖检查), `npm run build` (编译) 和 `npx serve` (启动服务器)。
*   **端口隔离**: 强制指定 3000 端口，与 SillyTavern (8000) 等其他服务互不冲突。

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
   npm start
   # or
   npm run dev
   ```

---

## ⚙️ Configuration Guide

Click the **Settings (Gear Icon)** in the app to configure connections.

### 1. AI Connection
- **API Key**: Enter your Google Gemini API Key.
- **Base URL (Optional)**: If you are using a proxy (e.g., OneAPI) or cannot access Google directly, enter your proxy URL here (e.g., `https://your-proxy.com`). The app is compatible with OpenAI-format proxies.

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
