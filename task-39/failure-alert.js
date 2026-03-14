/**
 * 失败告警逻辑模块
 * 专门处理PR审查通知集成中的失败情况
 */

const feishuNotify = require('./feishu-notify');
const { config } = require('./config');

/**
 * 失败告警管理器
 */
class FailureAlertManager {
  constructor() {
    this.failureHistory = [];
    this.maxHistorySize = 100;
    this.alertCooldown = 5 * 60 * 1000; // 5分钟冷却时间
    this.lastAlertTime = {};
  }

  /**
   * 记录失败事件
   * @param {Object} failure - 失败事件对象
   * @param {string} failure.type - 失败类型
   * @param {string} failure.message - 失败消息
   * @param {Object} failure.context - 失败上下文
   * @param {Error} failure.error - 错误对象
   */
  recordFailure(failure) {
    const failureRecord = {
      id: this.generateFailureId(),
      type: failure.type || 'unknown',
      message: failure.message || '未知失败',
      context: failure.context || {},
      error: failure.error ? {
        message: failure.error.message,
        stack: failure.error.stack,
        code: failure.error.code
      } : null,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    // 添加到历史记录
    this.failureHistory.unshift(failureRecord);
    if (this.failureHistory.length > this.maxHistorySize) {
      this.failureHistory.pop();
    }

    console.log(`记录失败事件: ${failureRecord.type} - ${failureRecord.message}`);
    return failureRecord;
  }

  /**
   * 生成失败ID
   * @returns {string} 失败ID
   */
  generateFailureId() {
    return `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 检查是否需要发送告警
   * @param {string} failureType - 失败类型
   * @returns {boolean} 是否需要发送告警
   */
  shouldSendAlert(failureType) {
    const now = Date.now();
    const lastAlert = this.lastAlertTime[failureType];
    
    // 如果没有记录或者已经过了冷却时间
    if (!lastAlert || (now - lastAlert) > this.alertCooldown) {
      this.lastAlertTime[failureType] = now;
      return true;
    }
    
    return false;
  }

  /**
   * 发送失败告警
   * @param {Object} failureRecord - 失败记录
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 告警发送结果
   */
  async sendFailureAlert(failureRecord, options = {}) {
    console.log(`发送失败告警: ${failureRecord.type}`);
    
    const defaultOptions = {
      webhookUrl: config.feishu.webhookUrl,
      enableAlert: config.integration.enableFailureAlert,
      ...options
    };

    if (!defaultOptions.enableAlert) {
      console.log('失败告警已禁用，跳过发送');
      return {
        success: false,
        reason: '失败告警已禁用'
      };
    }

    // 检查是否需要发送告警（防刷）
    if (!this.shouldSendAlert(failureRecord.type)) {
      console.log(`失败类型 ${failureRecord.type} 还在冷却期内，跳过发送`);
      return {
        success: false,
        reason: '冷却期内'
      };
    }

    try {
      const alertMessage = this.buildAlertMessage(failureRecord);
      const result = await feishuNotify.sendNotification(alertMessage, defaultOptions.webhookUrl);
      
      // 标记告警已发送
      failureRecord.alertSent = true;
      failureRecord.alertSentAt = new Date().toISOString();
      
      return {
        success: true,
        alertId: failureRecord.id,
        alertResult: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('发送失败告警失败:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 构建告警消息
   * @param {Object} failureRecord - 失败记录
   * @returns {Object} 告警消息对象
   */
  buildAlertMessage(failureRecord) {
    const failureTypes = {
      'notification_failed': '通知发送失败',
      'integration_error': '集成错误',
      'webhook_error': 'Webhook处理错误',
      'config_error': '配置错误',
      'network_error': '网络错误',
      'rate_limit': 'API限流',
      'parse_error': '解析错误',
      'unknown': '未知错误'
    };
    
    const failureTypeText = failureTypes[failureRecord.type] || failureRecord.type;
    
    // 构建详细内容
    let content = `**失败类型**: ${failureTypeText}\n`;
    content += `**失败时间**: ${new Date(failureRecord.timestamp).toLocaleString('zh-CN')}\n`;
    content += `**失败消息**: ${failureRecord.message}\n`;
    
    if (failureRecord.context.prNumber) {
      content += `**PR编号**: #${failureRecord.context.prNumber}\n`;
    }
    
    if (failureRecord.context.repo) {
      content += `**仓库**: ${failureRecord.context.repo}\n`;
    }
    
    if (failureRecord.context.reviewState) {
      content += `**审查状态**: ${failureRecord.context.reviewState}\n`;
    }
    
    if (failureRecord.error && failureRecord.error.message) {
      content += `**错误信息**: ${failureRecord.error.message}\n`;
    }
    
    // 添加解决建议
    content += `\n**建议操作**:\n`;
    
    const suggestions = this.getFailureSuggestions(failureRecord.type);
    suggestions.forEach((suggestion, index) => {
      content += `${index + 1}. ${suggestion}\n`;
    });
    
    return {
      title: `🚨 PR审查通知失败告警`,
      content: content,
      priority: 'error'
    };
  }

  /**
   * 获取失败建议
   * @param {string} failureType - 失败类型
   * @returns {Array<string>} 建议列表
   */
  getFailureSuggestions(failureType) {
    const suggestions = {
      'notification_failed': [
        '检查飞书Webhook URL是否正确',
        '验证飞书机器人是否在线',
        '检查网络连接是否正常',
        '查看飞书机器人权限设置'
      ],
      'integration_error': [
        '检查GitHub事件格式是否正确',
        '验证审查结果解析逻辑',
        '查看集成配置参数',
        '检查依赖包版本是否兼容'
      ],
      'webhook_error': [
        '检查GitHub Webhook Secret配置',
        '验证Webhook签名',
        '查看服务器端口是否开放',
        '检查Webhook处理逻辑'
      ],
      'config_error': [
        '检查配置文件格式',
        '验证环境变量设置',
        '查看必需的配置项',
        '检查配置文件权限'
      ],
      'network_error': [
        '检查网络连接状态',
        '查看防火墙设置',
        '验证代理配置',
        '检查DNS解析'
      ],
      'rate_limit': [
        '降低通知发送频率',
        '实现请求队列和重试',
        '考虑使用多个Webhook',
        '检查API调用限制'
      ],
      'parse_error': [
        '检查事件数据格式',
        '验证JSON解析逻辑',
        '查看数据字段映射',
        '检查日期时间格式'
      ]
    };
    
    return suggestions[failureType] || [
      '检查系统日志获取详细信息',
      '验证所有配置项',
      '查看网络连接状态',
      '联系系统管理员'
    ];
  }

  /**
   * 处理通知发送失败
   * @param {Object} notificationResult - 通知结果
   * @param {Object} reviewContext - 审查上下文
   * @returns {Promise<Object>} 告警处理结果
   */
  async handleNotificationFailure(notificationResult, reviewContext) {
    console.log('处理通知发送失败...');
    
    const failureRecord = this.recordFailure({
      type: 'notification_failed',
      message: 'PR审查通知发送失败',
      context: {
        prNumber: reviewContext.prNumber,
        prTitle: reviewContext.prTitle,
        repo: reviewContext.repo,
        reviewState: reviewContext.state,
        reviewer: reviewContext.reviewer,
        notificationResult: notificationResult
      },
      error: notificationResult.error ? new Error(notificationResult.error) : null
    });
    
    return await this.sendFailureAlert(failureRecord);
  }

  /**
   * 处理集成错误
   * @param {Error} error - 错误对象
   * @param {Object} eventContext - 事件上下文
   * @returns {Promise<Object>} 告警处理结果
   */
  async handleIntegrationError(error, eventContext) {
    console.log('处理集成错误...');
    
    const failureRecord = this.recordFailure({
      type: 'integration_error',
      message: 'PR审查通知集成失败',
      context: {
        eventType: eventContext.eventType,
        action: eventContext.action,
        repo: eventContext.repo,
        errorDetails: error.message
      },
      error: error
    });
    
    return await this.sendFailureAlert(failureRecord);
  }

  /**
   * 处理Webhook错误
   * @param {Object} webhookError - Webhook错误
   * @param {Object} requestContext - 请求上下文
   * @returns {Promise<Object>} 告警处理结果
   */
  async handleWebhookError(webhookError, requestContext) {
    console.log('处理Webhook错误...');
    
    const failureRecord = this.recordFailure({
      type: 'webhook_error',
      message: 'GitHub Webhook处理失败',
      context: {
        requestMethod: requestContext.method,
        requestUrl: requestContext.url,
        headers: requestContext.headers,
        errorDetails: webhookError.message
      },
      error: webhookError
    });
    
    return await this.sendFailureAlert(failureRecord);
  }

  /**
   * 处理配置错误
   * @param {string} configIssue - 配置问题描述
   * @param {Object} configContext - 配置上下文
   * @returns {Promise<Object>} 告警处理结果
   */
  async handleConfigError(configIssue, configContext) {
    console.log('处理配置错误...');
    
    const failureRecord = this.recordFailure({
      type: 'config_error',
      message: `配置错误: ${configIssue}`,
      context: {
        missingConfig: configContext.missingConfig,
        invalidConfig: configContext.invalidConfig,
        configFile: configContext.configFile
      }
    });
    
    return await this.sendFailureAlert(failureRecord);
  }

  /**
   * 获取失败统计
   * @returns {Object} 失败统计信息
   */
  getFailureStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const allFailures = this.failureHistory;
    const recentHourFailures = allFailures.filter(f => 
      new Date(f.timestamp) > oneHourAgo
    );
    const recentDayFailures = allFailures.filter(f => 
      new Date(f.timestamp) > oneDayAgo
    );
    
    // 按类型统计
    const typeStats = {};
    allFailures.forEach(failure => {
      typeStats[failure.type] = (typeStats[failure.type] || 0) + 1;
    });
    
    return {
      total: allFailures.length,
      lastHour: recentHourFailures.length,
      lastDay: recentDayFailures.length,
      unresolved: allFailures.filter(f => !f.resolved).length,
      byType: typeStats,
      recentFailures: allFailures.slice(0, 10)
    };
  }

  /**
   * 标记失败为已解决
   * @param {string} failureId - 失败ID
   * @returns {boolean} 是否成功标记
   */
  markFailureResolved(failureId) {
    const failure = this.failureHistory.find(f => f.id === failureId);
    if (failure) {
      failure.resolved = true;
      failure.resolvedAt = new Date().toISOString();
      console.log(`标记失败 ${failureId} 为已解决`);
      return true;
    }
    return false;
  }

  /**
   * 清理旧的失败记录
   * @param {number} maxAgeDays - 最大保留天数（默认7天）
   * @returns {number} 清理的记录数
   */
  cleanupOldFailures(maxAgeDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    
    const initialCount = this.failureHistory.length;
    this.failureHistory = this.failureHistory.filter(failure => {
      return new Date(failure.timestamp) > cutoffDate;
    });
    
    const cleanedCount = initialCount - this.failureHistory.length;
    console.log(`清理了 ${cleanedCount} 条旧的失败记录`);
    return cleanedCount;
  }

  /**
   * 导出失败报告
   * @returns {Object} 失败报告
   */
  exportFailureReport() {
    return {
      generatedAt: new Date().toISOString(),
      stats: this.getFailureStats(),
      failures: this.failureHistory,
      config: {
        maxHistorySize: this.maxHistorySize,
        alertCooldown: this.alertCooldown
      }
    };
  }
}

// 创建单例实例
const failureAlertManager = new FailureAlertManager();

module.exports = {
  FailureAlertManager,
  failureAlertManager,
  
  // 快捷函数
  handleNotificationFailure: (notificationResult, reviewContext) => 
    failureAlertManager.handleNotificationFailure(notificationResult, reviewContext),
  
  handleIntegrationError: (error, eventContext) =>
    failureAlertManager.handleIntegrationError(error, eventContext),
  
  handleWebhookError: (webhookError, requestContext) =>
    failureAlertManager.handleWebhookError(webhookError, requestContext),
  
  handleConfigError: (configIssue, configContext) =>
    failureAlertManager.handleConfigError(configIssue, configContext),
  
  getFailureStats: () => failureAlertManager.getFailureStats(),
  
  markFailureResolved: (failureId) =>
    failureAlertManager.markFailureResolved(failureId),
  
  cleanupOldFailures: (maxAgeDays) =>
    failureAlertManager.cleanupOldFailures(maxAgeDays),
  
  exportFailureReport: () => failureAlertManager.exportFailureReport()
};