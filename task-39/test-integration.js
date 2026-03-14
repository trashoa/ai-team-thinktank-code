/**
 * 集成代码测试
 */

const integration = require('./integration');
const feishuNotify = require('./feishu-notify');
const reviewParser = require('./review-parser');
const config = require('./config').config;

async function runAllTests() {
  console.log('🚀 开始运行集成代码测试...\n');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // 测试1: 审查解析功能
  console.log('📋 测试1: 审查解析功能');
  try {
    const parserResult = reviewParser.testParser();
    if (parserResult) {
      console.log('✅ 审查解析测试通过');
      results.tests.push({ name: '审查解析', status: 'passed' });
      results.passed++;
    } else {
      console.log('❌ 审查解析测试失败');
      results.tests.push({ name: '审查解析', status: 'failed' });
      results.failed++;
    }
  } catch (error) {
    console.log('❌ 审查解析测试异常:', error.message);
    results.tests.push({ name: '审查解析', status: 'error', error: error.message });
    results.failed++;
  }
  results.total++;
  console.log();

  // 测试2: 飞书通知配置验证
  console.log('📋 测试2: 飞书通知配置验证');
  try {
    const isValid = feishuNotify.validateWebhookUrl(config.feishu.webhookUrl);
    if (isValid) {
      console.log('✅ 飞书Webhook URL格式正确');
      results.tests.push({ name: '飞书配置验证', status: 'passed' });
      results.passed++;
    } else {
      console.log('❌ 飞书Webhook URL格式不正确');
      results.tests.push({ name: '飞书配置验证', status: 'failed' });
      results.failed++;
    }
  } catch (error) {
    console.log('❌ 飞书配置验证异常:', error.message);
    results.tests.push({ name: '飞书配置验证', status: 'error', error: error.message });
    results.failed++;
  }
  results.total++;
  console.log();

  // 测试3: 集成功能测试（不发送真实通知）
  console.log('📋 测试3: 集成功能测试');
  try {
    const testResult = await integration.testIntegration();
    if (testResult && testResult.success) {
      console.log('✅ 集成功能测试通过');
      results.tests.push({ name: '集成功能', status: 'passed' });
      results.passed++;
    } else {
      console.log('❌ 集成功能测试失败:', testResult?.error);
      results.tests.push({ name: '集成功能', status: 'failed', error: testResult?.error });
      results.failed++;
    }
  } catch (error) {
    console.log('❌ 集成功能测试异常:', error.message);
    results.tests.push({ name: '集成功能', status: 'error', error: error.message });
    results.failed++;
  }
  results.total++;
  console.log();

  // 测试4: 配置验证
  console.log('📋 测试4: 配置验证');
  try {
    const { validateConfig } = require('./config');
    const isValid = validateConfig();
    if (isValid) {
      console.log('✅ 配置验证通过');
      results.tests.push({ name: '配置验证', status: 'passed' });
      results.passed++;
    } else {
      console.log('❌ 配置验证失败');
      results.tests.push({ name: '配置验证', status: 'failed' });
      results.failed++;
    }
  } catch (error) {
    console.log('❌ 配置验证异常:', error.message);
    results.tests.push({ name: '配置验证', status: 'error', error: error.message });
    results.failed++;
  }
  results.total++;
  console.log();

  // 测试5: 模块导入测试
  console.log('📋 测试5: 模块导入测试');
  try {
    // 测试所有模块都能正确导入
    const modules = {
      integration,
      feishuNotify,
      reviewParser,
      config: require('./config')
    };
    
    const moduleNames = Object.keys(modules);
    let allImported = true;
    
    for (const moduleName of moduleNames) {
      if (!modules[moduleName]) {
        console.log(`❌ 模块 ${moduleName} 导入失败`);
        allImported = false;
        break;
      }
    }
    
    if (allImported) {
      console.log('✅ 所有模块导入成功');
      results.tests.push({ name: '模块导入', status: 'passed' });
      results.passed++;
    } else {
      console.log('❌ 模块导入测试失败');
      results.tests.push({ name: '模块导入', status: 'failed' });
      results.failed++;
    }
  } catch (error) {
    console.log('❌ 模块导入测试异常:', error.message);
    results.tests.push({ name: '模块导入', status: 'error', error: error.message });
    results.failed++;
  }
  results.total++;
  console.log();

  // 输出测试结果
  console.log('📊 测试结果汇总:');
  console.log('='.repeat(50));
  console.log(`总测试数: ${results.total}`);
  console.log(`通过: ${results.passed}`);
  console.log(`失败: ${results.failed}`);
  console.log(`通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log();
  
  console.log('📋 详细测试结果:');
  results.tests.forEach((test, index) => {
    const statusIcon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${statusIcon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   错误: ${test.error}`);
    }
  });
  
  console.log();
  console.log('='.repeat(50));
  
  if (results.failed === 0) {
    console.log('🎉 所有测试通过！集成代码功能正常。');
    return true;
  } else {
    console.log('⚠️  部分测试失败，请检查相关问题。');
    return false;
  }
}

// 运行测试
runAllTests().then(success => {
  if (success) {
    console.log('\n💡 下一步建议:');
    console.log('1. 运行 npm install 安装依赖');
    console.log('2. 设置环境变量 FEISHU_WEBHOOK_URL');
    console.log('3. 运行 npm test 进行完整测试');
    console.log('4. 部署到服务器并配置GitHub Webhook');
    process.exit(0);
  } else {
    console.log('\n🔧 需要修复的问题:');
    console.log('1. 检查飞书Webhook URL格式');
    console.log('2. 验证配置文件');
    console.log('3. 检查模块依赖');
    process.exit(1);
  }
}).catch(error => {
  console.error('测试运行异常:', error);
  process.exit(1);
});