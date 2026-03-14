#!/usr/bin/env node

/**
 * PR审查通知集成 - 主入口文件
 * 将GitHub PR审查事件集成到飞书通知
 */

const { integratePRReviewNotification, handleGitHubWebhook } = require('./integration');
const { testFeishuNotification } = require('./feishu-notify');
const { generateReadableReport } = require('./review-parser');
const { config, validateConfig } = require('./config');

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
PR审查通知集成工具

用法:
  node index.js <command> [options]

命令:
  help                显示此帮助信息
  test                运行集成测试
  test-feishu         测试飞书通知连接
  validate            验证配置
  webhook             启动Webhook服务器
  notify <event.json> 处理指定的审查事件文件

环境变量:
  FEISHU_WEBHOOK_URL   飞书Webhook URL
  GITHUB_WEBHOOK_SECRET GitHub Webhook密钥
  PORT                 服务器端口 (默认: 3000)
  NODE_ENV             环境 (development/production)

示例:
  node index.js test
  node index.js test-feishu
  node index.js validate
  FEISHU_WEBHOOK_URL=your_webhook node index.js webhook
  `);
}

/**
 * 运行集成测试
 */
async function runTests() {
  console.log('🔧 运行集成测试...\n');
  
  try {
    // 运行测试脚本
    const testScript = require('./test-integration');
    console.log('测试脚本加载成功');
    
    // 注意：test-integration.js会自动运行
    return true;
  } catch (error) {
    console.error('运行测试失败:', error.message);
    return false;
  }
}

/**
 * 测试飞书通知
 */
async function testFeishu() {
  console.log('📨 测试飞书通知连接...\n');
  
  if (!config.feishu.webhookUrl) {
    console.error('❌ 未配置飞书Webhook URL');
    console.log('请设置环境变量: FEISHU_WEBHOOK_URL');
    return false;
  }
  
  console.log(`使用Webhook: ${config.feishu.webhookUrl}`);
  
  try {
    const result = await testFeishuNotification(config.feishu.webhookUrl);
    
    if (result.success) {
      console.log('\n✅ 飞书通知测试成功！');
      console.log(`消息ID: ${result.details?.messageId || '未知'}`);
      return true;
    } else {
      console.log('\n❌ 飞书通知测试失败:');
      console.log(`错误: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('\n⚠️  测试异常:', error.message);
    return false;
  }
}

/**
 * 验证配置
 */
function validate() {
  console.log('🔍 验证配置...\n');
  
  console.log('当前配置:');
  console.log(`- 环境: ${config.environment}`);
  console.log(`- 飞书Webhook: ${config.feishu.webhookUrl ? '已配置' : '未配置'}`);
  console.log(`- GitHub Secret: ${config.github.webhookSecret ? '已配置' : '未配置'}`);
  console.log(`- 服务器端口: ${config.server.port}`);
  console.log(`- 通知级别: ${config.integration.notificationLevel}`);
  console.log();
  
  const isValid = validateConfig();
  
  if (isValid) {
    console.log('✅ 配置验证通过');
    return true;
  } else {
    console.log('❌ 配置验证失败');
    return false;
  }
}

/**
 * 处理事件文件
 */
async function handleEventFile(filePath) {
  console.log(`📄 处理事件文件: ${filePath}\n`);
  
  const fs = require('fs').promises;
  
  try {
    // 读取事件文件
    const data = await fs.readFile(filePath, 'utf8');
    const event = JSON.parse(data);
    
    console.log(`事件类型: ${event.action || '未知'}`);
    console.log(`PR编号: ${event.pull_request?.number || '未知'}`);
    console.log();
    
    // 生成可读报告
    const report = generateReadableReport(require('./review-parser').parseReviewEvent(event));
    console.log(report);
    console.log();
    
    // 集成通知
    if (config.integration.enableFeishu) {
      console.log('📨 发送飞书通知...');
      const result = await integratePRReviewNotification(event, {
        enableFeishu: true,
        feishuWebhook: config.feishu.webhookUrl
      });
      
      console.log(`通知结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
      if (!result.success) {
        console.log(`错误: ${result.error}`);
      }
    } else {
      console.log('ℹ️  飞书通知未启用，跳过发送');
    }
    
    return true;
  } catch (error) {
    console.error('处理事件文件失败:', error.message);
    return false;
  }
}

/**
 * 启动Webhook服务器
 */
async function startWebhookServer() {
  console.log('🚀 启动Webhook服务器...\n');
  
  // 验证配置
  if (!validateConfig()) {
    console.error('❌ 配置验证失败，无法启动服务器');
    return false;
  }
  
  const express = require('express');
  const app = express();
  
  // 中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // 健康检查端点
  app.get(config.server.healthPath, (req, res) => {
    res.json({
      status: 'healthy',
      service: 'pr-review-notification',
      version: config.version,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
  
  // GitHub Webhook端点
  app.post(config.server.webhookPath, async (req, res) => {
    console.log(`📨 收到Webhook请求: ${req.headers['x-github-event']}`);
    
    try {
      // 验证签名（如果配置了secret）
      if (config.github.webhookSecret) {
        const crypto = require('crypto');
        const signature = req.headers['x-hub-signature-256'];
        const hmac = crypto.createHmac('sha256', config.github.webhookSecret);
        const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
        
        if (signature !== digest) {
          console.warn('⚠️  Webhook签名验证失败');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
      
      // 处理Webhook
      const result = await handleGitHubWebhook(req.body, req.headers);
      
      if (result.success) {
        console.log('✅ Webhook处理成功');
        res.json({ success: true, message: 'Webhook processed successfully' });
      } else {
        console.log('❌ Webhook处理失败:', result.error);
        res.status(500).json({ success: false, error: result.error });
      }
      
    } catch (error) {
      console.error('Webhook处理异常:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 根路径
  app.get('/', (req, res) => {
    res.json({
      service: 'GitHub PR Review Notification',
      version: config.version,
      endpoints: {
        health: config.server.healthPath,
        webhook: config.server.webhookPath
      },
      documentation: 'https://github.com/trashoa/ai-team-thinktank-code/tree/main/task-39'
    });
  });
  
  // 启动服务器
  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`✅ 服务器启动成功`);
    console.log(`📍 地址: http://${config.server.host}:${config.server.port}`);
    console.log(`📊 健康检查: http://${config.server.host}:${config.server.port}${config.server.healthPath}`);
    console.log(`📨 Webhook端点: http://${config.server.host}:${config.server.port}${config.server.webhookPath}`);
    console.log(`\n💡 在GitHub仓库中配置Webhook时使用以上URL`);
    console.log(`事件类型选择: pull_request_review`);
  });
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🔄 收到关闭信号，优雅关闭服务器...');
    server.close(() => {
      console.log('✅ 服务器已关闭');
      process.exit(0);
    });
  });
  
  return true;
}

/**
 * 主函数
 */
async function main() {
  console.log('🤖 PR审查通知集成工具');
  console.log('='.repeat(50));
  
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    case 'test':
      await runTests();
      break;
      
    case 'test-feishu':
      await testFeishu();
      break;
      
    case 'validate':
      validate();
      break;
      
    case 'webhook':
      await startWebhookServer();
      break;
      
    case 'notify':
      if (args.length < 2) {
        console.error('❌ 请提供事件文件路径');
        console.log('用法: node index.js notify <event.json>');
        process.exit(1);
      }
      await handleEventFile(args[1]);
      break;
      
    default:
      if (command) {
        console.error(`❌ 未知命令: ${command}`);
      }
      showHelp();
      break;
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('程序执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  integratePRReviewNotification,
  handleGitHubWebhook,
  startWebhookServer,
  runTests,
  testFeishu,
  validate
};