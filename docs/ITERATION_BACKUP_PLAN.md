# 高效迭代与备份方案

## 当前分支策略

- 保留 `main` 对应 GitHub 原版。
- 使用 `codex/pkm-assignment` 作为大作业开发分支。
- 如果功能出问题，可随时切回：

```powershell
git switch main
```

## 每次迭代流程

```powershell
git status
npm run build
git add .
git commit -m "feat: add PKM assignment feature"
```

## 快速备份命令

```powershell
git stash push -u -m "backup before risky change"
```

恢复备份：

```powershell
git stash list
git stash apply stash@{0}
```

## 交作业前检查

```powershell
npm run build
npm run dev
```

打开：

```text
http://localhost:5173/
```

需要截图：

- 主页面。
- 生词本。
- IELTS PKM Dashboard。
- 导出的 Markdown 文件。
- Obsidian 中的双链效果。

