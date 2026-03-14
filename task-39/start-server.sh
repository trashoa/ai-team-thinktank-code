#!/bin/bash
# start-server.sh
# WebSocket服务器启动脚本

set -e  # 遇到错误时退出

echo "=== WebSocket服务器启动脚本 ==="
echo "修复: 硬编码认证令牌安全问题"
echo ""

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装"
    echo "请安装Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js版本: $NODE_VERSION"

# 检查依赖
echo ""
echo "检查依赖..."
if [ ! -f "package.json" ]; then
    echo "📦 创建 package.json..."
    cat > package.json << EOF
{
  "name": "pr-review-websocket-server",
  "version": "1.0.0",
  "description": "PR Review Notification WebSocket Server",
  "main": "websocket-server-fixed.js",
  "scripts": {
    "start": "node websocket-server-fixed.js",
    "dev": "nodemon websocket-server-fixed.js",
    "test": "node test-auth.js"
  },
  "dependencies": {
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF
    echo "📦 安装依赖..."
    npm install ws
fi

# 检查环境变量
echo ""
echo "检查环境变量配置..."

if [ -f ".env" ]; then
    echo "✅ 找到 .env 文件"
    source .env
else
    echo "⚠️  未找到 .env 文件"
    echo "请复制 .env.example 为 .env 并配置:"
    echo "  cp .env.example .env"
    echo "  # 编辑 .env 文件，设置 WEBSOCKET_AUTH_TOKEN"
    echo ""
    echo "或者通过环境变量设置:"
    echo "  export WEBSOCKET_AUTH_TOKEN=\"your-token-here\""
    echo ""
    
    # 检查是否通过环境变量设置了令牌
    if [ -z "$WEBSOCKET_AUTH_TOKEN" ]; then
        echo "❌ WEBSOCKET_AUTH_TOKEN 未设置"
        echo ""
        echo "快速生成安全令牌:"
        echo "  node -e \"console.log('WEBSOCKET_AUTH_TOKEN=' + require('crypto').randomBytes(32).toString('hex'))\""
        exit 1
    else
        echo "✅ WEBSOCKET_AUTH_TOKEN 已通过环境变量设置"
    fi
fi

# 验证令牌安全性
if [ ! -z "$WEBSOCKET_AUTH_TOKEN" ]; then
    TOKEN_LENGTH=${#WEBSOCKET_AUTH_TOKEN}
    if [ $TOKEN_LENGTH -lt 32 ]; then
        echo "⚠️  安全警告: 令牌长度仅 $TOKEN_LENGTH 字符，建议至少32字符"
    else
        echo "✅ 令牌长度: $TOKEN_LENGTH 字符 (符合安全要求)"
    fi
fi

# 启动服务器
echo ""
echo "🚀 启动WebSocket服务器..."
echo "安全改进:"
echo "  ✅ 移除了硬编码默认令牌"
echo "  ✅ 强制环境变量验证"
echo "  ✅ 未配置时优雅退出"
echo "  ✅ 提供清晰错误提示"
echo ""

node websocket-server-fixed.js