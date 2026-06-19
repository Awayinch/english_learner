[简体中文](README_zh.md) | [English](README.md)

# LingoLeap - IELTS PKM Language Learning App

**Live Demo:** [https://english-learner.vercel.app](https://english-learner-wx.vercel.app)

LingoLeap is an AI language learning web app with IELTS-oriented **Personal Knowledge Management (PKM)** features. It helps learners collect vocabulary, preserve real contexts, enrich knowledge cards, track learning assets, and export reviewable notes instead of leaving study traces scattered across chats and files.

Built with **React 19**, **TypeScript**, and **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-PKM%20edition-green.svg)

## What It Helps You Do

- Chat with an AI tutor for English practice and roleplay.
- Capture vocabulary from conversations, selected text, and imported articles.
- Turn vocabulary into reusable knowledge cards with context and examples.
- Track vocabulary assets, active usage, enrichment depth, and reflection records.
- Export structured Markdown notes for Obsidian or any local knowledge base.
- Sync learning data across devices through a private GitHub repository.

## Key Features

### Knowledge Asset Dashboard

The vocabulary panel now includes a PKM dashboard that uses observable learning traces instead of arbitrary scores:

- **Vocabulary cards**: stored knowledge nodes in the personal language knowledge base.
- **Context exposures**: chat/article contexts where a word appears.
- **Active uses**: learner-produced usage records.
- **Deep-enriched cards**: cards with synonyms, roots, word family, IELTS examples, and source context.
- **Reflection records**: self-assessment traces used for metacognitive monitoring.

### Contextual Vocabulary Knowledge Cards

The Worldbook vocabulary manager supports both language learning and knowledge-card construction:

- Add words through selected text, chat messages, or article import.
- Preserve source context so a word is not separated from its usage situation.
- Enrich cards with synonyms, root/morpheme hints, word-family information, and IELTS-style example sentences.
- Export knowledge cards into Markdown for long-term storage and review.

### Reflection / Self-Assessment Module

A lightweight reflection module records:

- cognitive load
- learning anxiety
- review confidence
- next-step learning plan

These records are stored locally and included in the PKM dashboard and Markdown export.

### Obsidian-Compatible Markdown Export

The export module generates a Chinese Markdown knowledge-base file such as:

```text
LingoLeap-雅思个人知识库-2026-06-19.md
```

The file includes YAML frontmatter, topic tags, double-link style references, vocabulary assets, enrichment notes, dashboard metrics, and learning reflections. It can be directly placed into an Obsidian vault.

### AI Tutor Core

- Multi-session AI chat and roleplay.
- Custom personas through system prompts.
- Memory pad for stable learner background and learning goals.
- Browser-native TTS support.
- AI quiz generation and auto-grading from text, PDF, or image input.

### Cross-Device Cloud Sync

- Uses a personal GitHub repository as a private data store.
- Syncs chat history, vocabulary, memory, and settings across PC and mobile.
- No custom backend is required.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Google Gemini API key, or an OpenAI-compatible proxy endpoint
- A GitHub account if you want cross-device sync

### PC / Development

```bash
git clone https://github.com/Awayinch/english_learner.git
cd english_learner
npm install
npm run dev
```

If npm is slow in mainland China, use:

```bash
npm install --registry=https://registry.npmmirror.com
```

Production build:

```bash
npm run build
```

## Mobile Usage (Termux)

You can run this application on Android locally through Termux.

First-time setup:

```bash
pkg update -y && pkg upgrade -y && pkg install git nodejs -y && git clone https://github.com/Awayinch/english_learner.git && cd english_learner && chmod +x start.sh && ./start.sh
```

Subsequent launches:

```bash
cd english_learner && ./start.sh
```

The `start.sh` script checks dependencies, builds the app, starts a local server, and uses port 3000 to avoid common conflicts.

## Configuration

Open the settings panel in the app.

### AI Connection

- **API Key**: Google Gemini API key or compatible provider key.
- **Base URL**: Optional proxy URL. The app supports OpenAI-compatible proxy endpoints.

### GitHub Sync

1. Create a private GitHub repository, for example `english-learning-data`.
2. Create a classic Personal Access Token with the `repo` scope.
3. In LingoLeap settings, enter:
   - GitHub token
   - repository name, such as `yourname/english-learning-data`
   - optional storage path, such as `backup/`
4. Use **Backup Current Data** and **Fetch Backup & Preview** to move data between devices.

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build tool**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand and browser storage
- **AI SDK**: `@google/genai`
- **Icons**: Lucide React
- **Audio**: Web Audio API and SpeechSynthesis API

## License

This project is open source under the [MIT License](LICENSE).

Created by [awayinch](https://github.com/Awayinch).
