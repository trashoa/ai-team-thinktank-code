/**
 * 配置文件
 */

const config = {
  // 飞书配置
  feishu: {
    webhookUrl: process.env.FEISHU_WEBHOOK_URL || 'https://open.feishu.cn/open-apis/bot/v2/hook/b9f3a575-1a7b-48a2-8f17-f94e6317abf7',
    timeout: 10000,
    retryCount: 3,
    retryDelay: 1000
  },
  
  // GitHub配置
  github: {
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    apiToken: process.env.GITHUB_TOKEN || '',
    apiBaseUrl: 'https://api.github.com',
    userAgent: 'PR-Review-Notification-Bot/1.0.0'
  },
  
  // 集成配置
  integration: {
    enableFeishu: true,
    enableFailureAlert: true,
    enableDebugLog: process.env.NODE_ENV !== 'production',
    notificationLevel: 'all', // all, important, error
    ignoredRepos: [],
    ignoredUsers: [],
    
    // 通知模板
    templates: {
      approved: {
        title: '✅ PR审查通过',
        color: 'green',
        priority: 'info'
      },
      changes_requested: {
        title: '⚠️ PR需要修改',
        color: 'orange',
        priority: 'warning'
      },
      commented: {
        title: '💬 PR收到评论',
        color: 'blue',
        priority: 'info'
      },
      dismissed: {
        title: '❌ PR审查被驳回',
        color: 'red',
        priority: 'error'
      },
      failure: {
        title: '🚨 集成失败告警',
        color: 'red',
        priority: 'error'
      }
    }
  },
  
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    webhookPath: '/webhook/github',
    healthPath: '/health'
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    file: {
      enabled: false,
      path: './logs',
      maxSize: '10m',
      maxFiles: '7d'
    }
  }
};

/**
 * 验证配置
 */
function validateConfig() {
  const errors = [];
  
  // 验证飞书Webhook URL
  if (!config.feishu.webhookUrl) {
    errors.push('飞书Webhook URL未配置');
  } else if (!config.feishu.webhookUrl.startsWith('https://open.feishu.cn/open-apis/bot/v2/hook/')) {
    errors.push('飞书Webhook URL格式不正确');
  }
  
  // 验证GitHub配置
  if (config.github.webhookSecret && config.github.webhookSecret.length < 10) {
    errors.push('GitHub Webhook Secret太短，建议至少10个字符');
  }
  
  // 验证通知级别
  const validLevels = ['all', 'important', 'error'];
  if (!validLevels.includes(config.integration.notificationLevel)) {
    errors.push(`无效的通知级别，必须是: ${validLevels.join(', ')}`);
  }
  
  // 验证端口
  const port = parseInt(config.server.port);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`无效的端口号: ${config.server.port}`);
  }
  
  if (errors.length > 0) {
    console.error('配置验证失败:');
    errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }
  
  console.log('配置验证通过');
  return true;
}

/**
 * 获取环境相关的配置
 */
function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  
  const envConfigs = {
    development: {
      integration: {
        enableDebugLog: true,
        notificationLevel: 'all'
      },
      logging: {
        level: 'debug'
      }
    },
    test: {
      integration: {
        enableFeishu: false,
        enableDebugLog: true
      },
      logging: {
        level: 'debug'
      }
    },
    production: {
      integration: {
        enableDebugLog: false,
        notificationLevel: 'important'
      },
      logging: {
        level: 'info',
        file: {
          enabled: true
        }
      }
    }
  };
  
  return envConfigs[env] || {};
}

/**
 * 合并环境配置
 */
function mergeEnvironmentConfig() {
  const envConfig = getEnvironmentConfig();
  
  // 深度合并配置
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }
  
  return deepMerge({ ...config }, envConfig);
}

/**
 * 获取完整配置
 */
function getConfig() {
  const mergedConfig = mergeEnvironmentConfig();
  
  // 添加环境变量
  mergedConfig.environment = process.env.NODE_ENV || 'development';
  mergedConfig.version = '1.0.0';
  mergedConfig.startTime = new Date().toISOString();
  
  return mergedConfig;
}

module.exports = {
  config: getConfig(),
  validateConfig,
  getConfig,
  getEnvironmentConfig
};