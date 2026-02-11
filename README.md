# LingoLeap - AI 语言导师 🎓

LingoLeap 是一款沉浸式、个性化的语言学习网页应用，由 **Google Gemini** 提供技术支持。它将实时 AI 对话、语境词汇追踪和游戏化测验融为一体，打造跨设备、流畅的学习体验。

使用 **React 19**、**TypeScript** 和 **Tailwind CSS** 构建。

![许可证](https://img.shields.io/badge/license-MIT-blue.svg)

![版本](https://img.shields.io/badge/version-1.0.2-green.svg)

![技术支持](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## ✨ 主要功能

### 🤖 智能聊天与角色扮演

- **由 Gemini 提供技术支持**：支持 `gemini-2.0-flash`、`gemini-3-flash-preview` 等版本。

- **自定义角色**：通过系统提示设置任何角色（例如，“严厉的维多利亚时代教师”、“随和的朋友”）。

- **长期记忆**：一个“记忆板”，可将用户详细信息（目标、背景）融入到每次对话中。

- **文本转语音 (TTS) 支持**：浏览器原生文本转语音功能，可朗读消息。

### 📚 “世界词典”（词汇管理器）

- **上下文学习**：添加到世界词典的单词会在聊天中高亮显示，并附带 AI 生成的上下文翻译。

- **智能导入**：粘贴任何文章，AI 将批量分析、提取并定义难词。

- **点击定义**：

- **桌面端**：高亮显示任何文本即可添加。

- **移动端**：点击聊天中的单词即可查看定义。

### ☁️ 跨设备云同步 (GitHub)

- **无需后端**：使用您自己的 **GitHub 代码库** 作为私有数据库。

- **完整状态同步**：在电脑和移动设备之间同步聊天记录、词汇、内存和设置。

- **Obsidian 集成**：将学习课程总结（Markdown 格式）直接导出到您的 Obsidian 代码库（托管于 GitHub）。

### 📝 AI 测验模式

- **生成测验**：根据任何文本输入或上传的文件（PDF/图片）创建英语理解测试。

- **自动评分**：即时提供答案反馈和解释。

---

## 🚀 入门指南

### 前提条件

- Node.js（版本 18 或更高版本）

- Google Gemini API 密钥（[在此处](https://aistudio.google.com/app/apikey) 获取）

- GitHub 帐户（用于同步功能）

### 安装

1. **克隆仓库**

```bash

git clone https://github.com/Awayinch/english_learner.git

cd english_learner

```

2. **安装依赖项**

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

点击应用中的**设置（齿轮图标）**配置连接。

### 1. AI 连接

- **API 密钥**：输入您的 Google Gemini API 密钥。

- **基本 URL（可选）**：如果您使用代理（例如 OneAPI）或无法直接访问 Google，请在此处输入您的代理 URL（例如 `https://your-proxy.com`）。该应用兼容 OpenAI 格式的代理。

### 2. 设置云同步（跨设备）

LingoLeap 使用 GitHub API 在您的手机和电脑之间同步数据。

1. **在 GitHub 上创建一个私有仓库**（例如，命名为 `english-learning-data`）。

2. **生成个人访问令牌（经典）**：

- 前往 [GitHub 设置 > 开发者设置 > 令牌（经典）](https://github.com/settings/tokens)。

- 生成新令牌。

- **权限范围**：勾选 `repo`（完全控制私有仓库）。

- 复制令牌（以 `ghp_...` 开头）。

3. **在 LingoLeap 设置中**：

- **GitHub 令牌**：粘贴您的令牌。

- **仓库**：输入 `yourusername/english-learning-data`。

- **路径**：（可选）文件夹路径，例如 `backup/`。

4. **使用方法**：

- 点击**“备份当前数据”**保存您的状态。

- 在新设备上，点击**“获取备份和预览”**进行恢复。

---

## 📱 移动设备使用方法 (Termux)

您可以使用 Termux 在 Android 设备上本地运行此程序：

1. 安装 Termux。

2. 运行：`pkg install nodejs git`

3. 克隆仓库并安装依赖项。

4. 运行：`npm run build` 然后运行 ​​`npx serve -s dist`（或 `build`）。

5. 在移动浏览器中打开 `localhost:3000`。

6. 使用**云同步**从您的电脑恢复数据。

---

## 🛠️ 技术栈

- **前端**：React 19，TypeScript

- **样式**：Tailwind CSS

- **AI SDK**：`@google/genai`（官方 SDK）

- **图标**：Lucide React

- **音频**：Web Audio API 和 SpeechSynthesis API

---

## 📄 许可

本项目为开源项目，遵循 [MIT 许可证](LICENSE)。

---

由 [awayinch](https://github.com/Awayinch) 创建
