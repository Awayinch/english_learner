[🇬🇧 English](README.md) | [🇨🇳 简体中文](README_zh.md)

# LingoLeap - AI 语言导师 🎓

**在线预览：** [https://english-learner.vercel.app](https://english-learner-wx.vercel.app) 

LingoLeap 是一款沉浸式、个性化的语言学习 Web 应用，由 **Google Gemini(或自定义模型)** 强力驱动。它将实时 AI 对话、语境生词本和游戏化测试完美结合，为你提供跨设备的学习体验。

基于 **React 19**, **TypeScript** 和 **Tailwind CSS** 构建。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.13-green.svg)

## ✨ 核心功能

### 🤖 智能聊天与角色扮演
- **多会话管理**：支持创建、重命名、切换和批量删除对话会话。
- **Gemini 驱动**：支持最新的 `gemini-2.0-flash`, `gemini-3-flash-preview` 等模型。
- **自定义人设**：通过系统提示词扮演任何角色（例如：“严厉的维多利亚时代老师”、“随和的朋友”）。
- **长期记忆系统**：“记忆面板”能将你的个人信息（学习目标、背景）注入到每次对话中。
- **语音朗读 (TTS)**：支持浏览器原生的文本转语音功能。

### 📚 世界之书 (生词本)
- **语境学习**：添加到生词本的单词会在聊天中高亮显示，并附带 AI 生成的语境翻译。
- **智能导入**：粘贴任意英文文章，AI 将自动分析、提取并批量定义难词。
- **一键查词**：
  - **电脑端**：划词选中即可添加。
  - **手机端**：点击聊天中的单词即可查看释义。

### ☁️ 跨设备云同步 (基于 GitHub)
- **无需后端服务器**：直接使用你个人的 **GitHub 仓库** 作为私有数据库。
- **全状态同步**：在电脑和手机之间无缝同步聊天记录、生词本、记忆面板和设置。
- **Obsidian 集成**：将学习记录以 Markdown 格式直接导出到你的 Obsidian 笔记库（托管在 GitHub 上）。

### 📝 AI 测试模式
- **生成测试**：从任意文本或上传的文件（PDF/图片）生成英语阅读理解测试。
- **自动评分**：提供即时的分数反馈和答案解析。

---

## 📱 手机端使用指南 (Termux 懒人版)

你可以使用 Android 手机上的 Termux 本地运行此应用。

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

## 🚀 开发者快速开始 (电脑端)

### 环境要求
- Node.js (v18 或更高版本)
- Google Gemini API 密钥 (在 [这里](https://aistudio.google.com/app/apikey) 获取)
- GitHub 账号 (用于云同步功能)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/Awayinch/english_learner.git
   cd english_learner
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **本地运行**
   ```bash
   npm run dev
   ```

---

## ⚙️ 配置指南

点击应用中的 **设置（齿轮图标）** 来配置连接。

### 1. AI 连接配置
- **API Key**：填入你的 Google Gemini API 密钥。
- **Base URL (选填)**：如果你使用代理接口（例如 OneAPI）或国内无法直连 Google，请填入代理地址。本应用兼容 OpenAI 格式的代理。

### 2. 设置云同步 (跨设备)
为了在手机和电脑间同步数据，本应用利用了 GitHub API。

1. **创建一个私有仓库** (例如命名为 `english-learning-data`)。
2. **生成个人访问令牌 (Classic 模式)**:
   - 前往 [GitHub Settings > Developer Settings > Tokens (Classic)](https://github.com/settings/tokens)。
   - 点击 Generate New Token。
   - **Scopes (权限)**: 勾选 `repo` (完全控制私有仓库)。
   - 复制生成的令牌 (以 `ghp_` 开头)。
3. **在 LingoLeap 设置中**:
   - **GitHub Token**: 粘贴刚才的令牌。
   - **Repo**: 填写 `你的用户名/english-learning-data`。
   - **Path**: (可选) 存放路径，例如 `backup/`。
4. **如何使用**:
   - 点击 **"Backup Current Data"** 备份当前数据。
   - 在新设备上，点击 **"Fetch Backup & Preview"** 拉取并恢复数据。

---

## 🛠️ 技术栈

- **前端框架**: React 19, TypeScript
- **样式**: Tailwind CSS
- **AI SDK**: `@google/genai` (官方 SDK)
- **图标**: Lucide React
- **音频**: Web Audio API & SpeechSynthesis API

---

## 📄 开源协议

本项目开源，采用 [MIT 协议](LICENSE)。

---

由 [awayinch](https://github.com/Awayinch) 创建
