# LingoLeap - AI Language Tutor 🎓

LingoLeap is an immersive, personalized language learning web application powered by **Google Gemini**. It combines real-time AI conversation, contextual vocabulary tracking, and gamified quizzes into a single, cross-device experience.

Built with **React 19**, **TypeScript**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
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

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key (Get it [here](https://aistudio.google.com/app/apikey))
- A GitHub Account (for Sync functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/awayinch/LingoLeap.git
   cd LingoLeap
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

1. **Create a Private Repository** on GitHub (e.g., named `my-lingoleap-data`).
2. **Generate a Personal Access Token (Classic)**:
   - Go to [GitHub Settings > Developer Settings > Tokens (Classic)](https://github.com/settings/tokens).
   - Generate New Token.
   - **Scopes**: Check `repo` (Full control of private repositories).
   - Copy the token (starts with `ghp_...`).
3. **In LingoLeap Settings**:
   - **GitHub Token**: Paste your token.
   - **Repo**: Enter `awayinch/my-lingoleap-data` (Change to your actual username/repo).
   - **Path**: (Optional) Folder path, e.g., `backup/`.
4. **Usage**:
   - Click **"Backup Current Data"** to save your state.
   - On a new device, click **"Fetch Backup & Preview"** to restore.

---

## 📱 Mobile Usage (Termux)

You can run this strictly locally on Android using Termux:

1. Install Termux.
2. Run: `pkg install nodejs git`
3. Clone repo and install dependencies.
4. Run: `npm run build` then `npx serve -s dist` (or `build`).
5. Open `localhost:3000` in your mobile browser.
6. Use **Cloud Sync** to restore data from your PC.

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

<br/>

# LingoLeap - AI 语言导师 🎓

LingoLeap 是一款由 **Google Gemini** 驱动的沉浸式个性化语言学习 Web 应用程序。它将实时 AI 对话、上下文词汇跟踪和游戏化测验结合在一起，打造单一的跨设备体验。

使用 **React 19**、**TypeScript** 和 **Tailwind CSS** 构建。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Powered By](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## ✨ 核心功能

### 🤖 智能聊天与角色扮演
- **Gemini 驱动**：支持 `gemini-2.0-flash`, `gemini-3-flash-preview` 等模型。
- **自定义角色**：通过系统提示词设置任何角色（例如，“严厉的维多利亚时代教师”、“随和的朋友”）。
- **长期记忆**：“记忆板”功能可将用户详细信息（目标、背景）注入到每个对话上下文中。
- **TTS 支持**：浏览器原生文本转语音，朗读消息。

### 📚 “世界书”（词汇管理器）
- **语境学习**：添加到世界书的单词会在聊天中高亮显示，并附带 AI 生成的语境翻译。
- **智能导入**：粘贴任何文章，AI 将批量分析、提取并定义生词。
- **点击定义**：
  - **桌面端**：高亮任何文本即可添加。
  - **移动端**：点击聊天中的单词查看定义。

### ☁️ 跨设备云同步 (GitHub)
- **无需后端**：使用您自己的 **GitHub 仓库** 作为私有数据库。
- **全状态同步**：在 PC 和手机之间同步聊天记录、词汇表、记忆和设置。
- **Obsidian 集成**：将学习会话摘要（Markdown）直接导出到您的 Obsidian 库（托管在 GitHub 上）。

### 📝 AI 测验模式
- **生成测验**：根据任何文本输入或上传的文件（PDF/图片）创建英语理解测试。
- **自动评分**：提供即时反馈和答案解析。

---

## 🚀 快速开始

### 前置要求
- Node.js (v18 或更高版本)
- Google Gemini API Key (在此获取 [aistudio.google.com](https://aistudio.google.com/app/apikey))
- GitHub 账户（用于同步功能）

### 安装

1. **克隆仓库**
   ```bash
   git clone https://github.com/awayinch/LingoLeap.git
   cd LingoLeap
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **本地运行**
   ```bash
   npm start
   # 或
   npm run dev
   ```

---

## ⚙️ 配置指南

点击应用中的 **设置（齿轮图标）** 配置连接。

### 1. AI 连接
- **API Key**：输入您的 Google Gemini API Key。
- **Base URL (可选)**：如果您使用的是代理（例如 OneAPI）或无法直接访问 Google，请在此处输入您的代理 URL（例如 `https://your-proxy.com`）。该应用兼容 OpenAI 格式的代理。

### 2. 设置云同步（跨设备）
LingoLeap 使用 GitHub API 在您的手机和 PC 之间同步数据。

1. **在 GitHub 上创建一个私有仓库**（例如命名为 `my-lingoleap-data`）。
2. **生成个人访问令牌 (Classic)**：
   - 访问：[GitHub Settings > Developer Settings > Tokens (Classic)](https://github.com/settings/tokens)。
   - 生成新令牌 (Generate New Token)。
   - **权限范围 (Scopes)**：勾选 `repo`（完全控制私有仓库）。
   - 复制令牌（以 `ghp_...` 开头）。
3. **在 LingoLeap 设置中**：
   - **GitHub Token**：粘贴您的令牌。
   - **Repo**：输入 `awayinch/my-lingoleap-data`（更改为您实际的 用户名/仓库名）。
   - **Path**：（可选）文件夹路径，例如 `backup/`。
4. **使用方法**：
   - 点击 **"Backup Current Data"** 保存当前状态。
   - 在新设备上，点击 **"Fetch Backup & Preview"** 恢复数据。

---

## 📱 移动端使用 (Termux)

您可以使用 Termux 在 Android 上完全本地运行：

1. 安装 Termux。
2. 运行：`pkg install nodejs git`
3. 克隆仓库并安装依赖。
4. 运行：`npm run build` 然后 `npx serve -s dist`（或 `build`）。
5. 在手机浏览器中打开 `localhost:3000`。
6. 使用 **云同步** 从您的 PC 恢复数据。

---

## 🛠️ 技术栈

- **前端**：React 19, TypeScript
- **样式**：Tailwind CSS
- **AI SDK**：`@google/genai` (官方 SDK)
- **图标**：Lucide React
- **音频**：Web Audio API & SpeechSynthesis API

---

## 📄 许可证

本项目开源并遵循 [MIT 许可证](LICENSE)。

---

Created by [awayinch](https://github.com/awayinch)
