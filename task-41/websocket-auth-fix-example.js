// websocket-auth-fix-example.js
// 示例：修复WebSocket认证令牌硬编码安全问题

// 修复前的问题代码（不安全）：
// const WEBSOCKET_AUTH_TOKEN = 'default-insecure-token-12345'; // 硬编码，不安全！

// 修复后的安全实现：

// 1. 从环境变量获取认证令牌
const WEBSOCKET_AUTH_TOKEN = process.env.WEBSOCKET_AUTH_TOKEN;

// 2. 启动时检查环境变量
function validateEnvironmentVariables() {
    if (!WEBSOCKET_AUTH_TOKEN) {
        console.error('❌ 严重错误: WEBSOCKET_AUTH_TOKEN 环境变量未设置!');
        console.error('   此令牌用于WebSocket连接认证，必须设置为安全值。');
        console.error('   设置方法:');
        console.error('   - Linux/Mac: export WEBSOCKET_AUTH_TOKEN="your-secure-token-here"');
        console.error('   - Windows: set WEBSOCKET_AUTH_TOKEN=your-secure-token-here');
        console.error('   - Docker: -e WEBSOCKET_AUTH_TOKEN="your-secure-token-here"');
        console.error('   - .env文件: WEBSOCKET_AUTH_TOKEN=your-secure-token-here');
        console.error('');
        console.error('⚠️  安全建议:');
        console.error('   - 使用强随机令牌（至少32字符）');
        console.error('   - 不同环境使用不同令牌');
        console.error('   - 定期轮换令牌');
        console.error('   - 不要将令牌提交到版本控制');
        
        process.exit(1); // 3. 如未设置则报错退出
    }
    
    console.log('✅ WEBSOCKET_AUTH_TOKEN 环境变量已设置');
    console.log(`🔐 令牌长度: ${WEBSOCKET_AUTH_TOKEN.length} 字符`);
    
    // 安全检查：令牌长度建议
    if (WEBSOCKET_AUTH_TOKEN.length < 16) {
        console.warn('⚠️  警告: 认证令牌长度小于16字符，建议使用更长的令牌增强安全性');
    }
    
    return true;
}

// WebSocket服务器初始化函数
function initializeWebSocketServer() {
    // 首先验证环境变量
    validateEnvironmentVariables();
    
    console.log('🚀 正在启动WebSocket服务器...');
    console.log(`🔐 使用认证令牌: ${WEBSOCKET_AUTH_TOKEN.substring(0, 8)}...`);
    
    // 模拟WebSocket服务器初始化
    // 实际实现中这里会创建WebSocket服务器并配置认证
    const serverInfo = {
        port: process.env.WS_PORT || 8080,
        authToken: WEBSOCKET_AUTH_TOKEN,
        requiresAuth: true,
        timestamp: new Date().toISOString()
    };
    
    console.log('✅ WebSocket服务器配置完成:', serverInfo);
    return serverInfo;
}

// 连接验证函数
function authenticateWebSocketConnection(token) {
    if (!token) {
        console.warn('🔒 连接尝试: 未提供认证令牌');
        return false;
    }
    
    if (token !== WEBSOCKET_AUTH_TOKEN) {
        console.warn(`🔒 连接尝试: 无效令牌 (${token.substring(0, 8)}...)`);
        return false;
    }
    
    console.log('🔓 连接认证成功');
    return true;
}

// 主函数
function main() {
    console.log('=== WebSocket认证安全修复示例 ===');
    console.log('修复问题: 硬编码认证令牌不安全问题');
    console.log('修复方案: 使用环境变量 + 启动时验证\n');
    
    try {
        const server = initializeWebSocketServer();
        
        // 测试认证
        console.log('\n=== 测试认证功能 ===');
        const testCases = [
            { token: WEBSOCKET_AUTH_TOKEN, expected: true, desc: '有效令牌' },
            { token: 'wrong-token', expected: false, desc: '无效令牌' },
            { token: null, expected: false, desc: '空令牌' }
        ];
        
        testCases.forEach(test => {
            const result = authenticateWebSocketConnection(test.token);
            console.log(`${test.desc}: ${result === test.expected ? '✅' : '❌'} (预期: ${test.expected}, 实际: ${result})`);
        });
        
        console.log('\n✅ 修复完成! 安全改进:');
        console.log('   1. ✅ 移除了硬编码默认令牌');
        console.log('   2. ✅ 添加了环境变量检查');
        console.log('   3. ✅ 未设置时优雅报错退出');
        console.log('   4. ✅ 提供了清晰的设置指导');
        
    } catch (error) {
        console.error('❌ 启动失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = {
    validateEnvironmentVariables,
    authenticateWebSocketConnection,
    initializeWebSocketServer
};