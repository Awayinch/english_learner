#!/bin/bash

# Stop script on error
set -e

echo "🚀 LingoLeap Termux Launcher"

# 1. Check and Install Dependencies
# We run this every time to ensure consistency, but it's fast if already installed.
if [ ! -d "node_modules" ]; then
    echo "📦 检测到首次运行，正在安装依赖 (npm install)..."
    echo "☕ 这可能需要几分钟，请耐心等待..."
    npm install
else
    echo "📦 正在检查依赖..."
    npm install
fi

# 2. Build the project
echo "🔨 正在编译应用 (npm run build)..."
npm run build

# 3. Start the lightweight server
echo "✅ 部署完成！"
echo "🌐 服务已启动于端口 3000"
echo "👉 请在浏览器打开: http://localhost:3000"
echo "❌ 按 CTRL + C 停止服务"
echo "----------------------------------------"

# Use npx to run 'serve' without installing it globally
# -s dist: Single-page app support (rewrites to index.html), serving 'dist' folder
# -l 3000: Listen on port 3000
npx serve -s dist -l 3000
