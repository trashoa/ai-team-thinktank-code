// websocket-server-fixed.js
// 修复后的WebSocket服务器 - 移除了硬编码认证令牌

const WebSocket = require('ws');
const http = require('http');

// === 修复的核心部分 ===
// 旧代码（不安全）:
// const AUTH_TOKEN = 'default-insecure-websocket-token-2024';
//
// 新代码（安全）:
const AUTH_TOKEN = process.env.WEBSOCKET_AUTH_TOKEN;

// 环境变量验证函数
function validateAuthToken() {
    if (!AUTH_TOKEN) {
        console.error('❌ 致命错误: WEBSOCKET_AUTH_TOKEN 环境变量未设置');
        console.error('');
        console.error('解决方案:');
        console.error('1. 创建 .env 文件:');
        console.error('   WEBSOCKET_AUTH_TOKEN=your-secure-random-token-here');
        console.error('');
        console.error('2. 或在启动时设置:');
        console.error('   export WEBSOCKET_AUTH_TOKEN="your-token"');
        console.error('   node websocket-server-fixed.js');
        console.error('');
        console.error('3. Docker环境:');
        console.error('   docker run -e WEBSOCKET_AUTH_TOKEN="your-token" ...');
        console.error('');
        console.error('安全要求:');
        console.error('- 令牌长度至少32字符');
        console.error('- 使用 cryptographically secure random 生成');
        console.error('- 生产环境与开发环境使用不同令牌');
        console.error('- 不要提交到版本控制系统');
        
        process.exit(1);
    }
    
    // 安全检查
    if (AUTH_TOKEN.length < 32) {
        console.warn('⚠️  安全警告: 认证令牌长度小于32字符，建议使用更长的令牌');
    }
    
    console.log(`✅ 认证令牌已加载 (${AUTH_TOKEN.length} 字符)`);
    return true;
}

// WebSocket认证中间件
function authenticateConnection(req) {
    const token = req.headers['x-websocket-token'] || 
                  new URL(req.url, 'http://localhost').searchParams.get('token');
    
    if (!token) {
        console.warn(`[${new Date().toISOString()}] 🔒 连接拒绝: 未提供认证令牌`);
        return false;
    }
    
    if (token !== AUTH_TOKEN) {
        console.warn(`[${new Date().toISOString()}] 🔒 连接拒绝: 无效令牌`);
        return false;
    }
    
    console.log(`[${new Date().toISOString()}] 🔓 连接认证成功`);
    return true;
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        service: 'PR Review Notification WebSocket Server',
        status: 'running',
        version: '1.0.0',
        security: {
            auth_required: true,
            auth_method: 'token',
            env_check: AUTH_TOKEN ? 'configured' : 'missing'
        },
        timestamp: new Date().toISOString()
    }));
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
    server,
    verifyClient: (info, callback) => {
        // 验证客户端连接
        const isAuthenticated = authenticateConnection(info.req);
        callback(isAuthenticated);
    }
});

// WebSocket连接处理
wss.on('connection', (ws, req) => {
    console.log(`[${new Date().toISOString()}] 📡 新WebSocket连接建立`);
    
    // 发送欢迎消息
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to PR Review Notification System',
        timestamp: new Date().toISOString(),
        features: ['pr_updates', 'review_notifications', 'status_changes']
    }));
    
    // 处理消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[${new Date().toISOString()}] 📨 收到消息: ${data.type || 'unknown'}`);
            
            // 处理不同类型的消息
            switch (data.type) {
                case 'subscribe_pr':
                    ws.send(JSON.stringify({
                        type: 'subscription_confirmed',
                        pr_id: data.pr_id,
                        timestamp: new Date().toISOString()
                    }));
                    break;
                    
                case 'ping':
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type',
                        timestamp: new Date().toISOString()
                    }));
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ 消息处理错误:`, error.message);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
                timestamp: new Date().toISOString()
            }));
        }
    });
    
    // 处理连接关闭
    ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] 🔌 WebSocket连接关闭`);
    });
    
    // 处理错误
    ws.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] ❌ WebSocket错误:`, error.message);
    });
});

// 服务器启动函数
function startServer() {
    // 1. 验证环境变量
    validateAuthToken();
    
    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
        console.log(`\n🚀 WebSocket服务器已启动`);
        console.log(`   📍 地址: http://localhost:${PORT}`);
        console.log(`   🔐 认证: Token-based (环境变量配置)`);
        console.log(`   ⏰ 时间: ${new Date().toISOString()}`);
        console.log(`\n📋 连接示例:`);
        console.log(`   ws://localhost:${PORT}/?token=${AUTH_TOKEN.substring(0, 8)}...`);
        console.log(`   或使用 Header: x-websocket-token: ${AUTH_TOKEN.substring(0, 8)}...`);
        console.log(`\n🔒 安全状态: ✅ 硬编码令牌已移除`);
        console.log(`              ✅ 环境变量验证已启用`);
        console.log(`              ✅ 未配置时优雅退出`);
    });
}

// 优雅关闭处理
process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，正在关闭服务器...');
    wss.close(() => {
        console.log('✅ WebSocket服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号，正在关闭服务器...');
    wss.close(() => {
        console.log('✅ WebSocket服务器已关闭');
        process.exit(0);
    });
});

// 启动服务器
if (require.main === module) {
    startServer();
}

module.exports = {
    server,
    wss,
    validateAuthToken,
    authenticateConnection
};