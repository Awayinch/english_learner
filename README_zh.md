[English](README.md) | [简体中文](README_zh.md)

# LingoLeap - 雅思备考个人知识管理系统

**在线预览：** [https://english-learner.vercel.app](https://english-learner-wx.vercel.app)

LingoLeap 是一款带有雅思备考 **个人知识管理（PKM）** 能力的 AI 语言学习 Web 应用。它帮助学习者收集生词、保留真实语境、补充知识卡片、追踪学习资产，并导出可复习的结构化笔记，避免学习痕迹散落在聊天和文件中。

项目基于 **React 19**、**TypeScript** 和 **Tailwind CSS** 构建。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-PKM%20edition-green.svg)

## 它能帮你做什么

- 和 AI 语言导师进行英语练习与角色扮演。
- 从对话、划词和导入文章中收集生词。
- 把生词加工成带语境和例句的可复用知识卡片。
- 追踪词汇资产、主动使用、深加工程度和反思记录。
- 导出结构化 Markdown 笔记，接入 Obsidian 或本地知识库。
- 通过个人 GitHub 私有仓库在多设备之间同步学习数据。

## 核心功能

### 知识资产看板

生词本面板新增了 PKM 知识资产看板，指标来自应用中可观测的学习行为，而不是随意填写的分数：

- **词汇卡片**：个人语言知识库中的知识节点数量。
- **语境暴露**：单词在聊天或文章中出现的上下文记录。
- **主动使用**：学习者主动产出的例句或使用痕迹。
- **深加工卡片**：包含同义词、词根词缀、词族、雅思例句和来源语境的完整知识卡。
- **反思记录**：学习者对认知负荷、焦虑、信心和下一步计划的自评记录。

### 语境化生词知识卡片

世界书 / 生词本不仅用于查词，也用于构建可复用的知识卡片：

- 支持通过划词、聊天内容和文章导入添加生词。
- 保留来源语境，避免单词脱离真实使用场景。
- 支持补充同义词、词根词缀、词族信息和雅思风格例句。
- 可导出为 Markdown，沉淀到个人笔记库中长期复习。

### 学习反思 / 自评记录

新增轻量级学习反思模块，用于记录：

- 认知负荷
- 学习焦虑
- 复习信心
- 下一步学习计划

这些记录会保存在本地，并参与知识资产看板与 Markdown 导出。

### Obsidian 兼容 Markdown 导出

导出模块会生成中文知识库文件，例如：

```text
LingoLeap-雅思个人知识库-2026-06-19.md
```

文件包含 YAML Frontmatter、主题标签、双链式引用、生词卡片、深加工信息、看板指标和学习反思，可直接放入 Obsidian 笔记库。

### AI 语言导师基础能力

- 多会话 AI 对话与角色扮演。
- 通过系统提示词自定义人设。
- 记忆面板记录学习目标、背景和长期偏好。
- 浏览器原生 TTS 朗读。
- 支持从文本、PDF 或图片生成 AI 测试并自动评分。

### GitHub 跨设备同步

- 使用个人 GitHub 私有仓库作为数据存储。
- 在电脑与手机之间同步聊天记录、生词本、记忆面板和设置。
- 不需要额外部署后端服务器。

## 快速开始

### 环境要求

- Node.js 18 或更高版本
- Google Gemini API Key，或 OpenAI 兼容代理接口
- GitHub 账号，用于跨设备同步

### 电脑端开发运行

```bash
git clone https://github.com/Awayinch/english_learner.git
cd english_learner
npm install
npm run dev
```

如果 npm 下载较慢，可以使用国内镜像：

```bash
npm install --registry=https://registry.npmmirror.com
```

生产构建：

```bash
npm run build
```

## 手机端使用指南（Termux）

可以在 Android 手机中通过 Termux 本地运行。

首次安装：

```bash
pkg update -y && pkg upgrade -y && pkg install git nodejs -y && git clone https://github.com/Awayinch/english_learner.git && cd english_learner && chmod +x start.sh && ./start.sh
```

以后启动：

```bash
cd english_learner && ./start.sh
```

`start.sh` 会自动检查依赖、构建项目、启动本地服务，并使用 3000 端口以减少端口冲突。

## 配置指南

打开应用中的设置面板进行配置。

### AI 连接

- **API Key**：填写 Google Gemini API Key 或兼容服务商的 Key。
- **Base URL**：可选代理地址。应用兼容 OpenAI 格式代理接口。

### GitHub 同步

1. 创建一个 GitHub 私有仓库，例如 `english-learning-data`。
2. 创建 Classic Personal Access Token，并勾选 `repo` 权限。
3. 在 LingoLeap 设置中填写：
   - GitHub Token
   - 仓库名，例如 `yourname/english-learning-data`
   - 可选存储路径，例如 `backup/`
4. 使用 **Backup Current Data** 和 **Fetch Backup & Preview** 在不同设备间迁移数据。

## 技术栈

- **前端框架**：React 19, TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **状态管理**：Zustand 与浏览器本地存储
- **AI SDK**：`@google/genai`
- **图标**：Lucide React
- **音频**：Web Audio API 与 SpeechSynthesis API

## 开源协议

本项目采用 [MIT 协议](LICENSE) 开源。

由 [awayinch](https://github.com/Awayinch) 创建。
