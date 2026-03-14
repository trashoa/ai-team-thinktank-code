/**
 * PR审查通知集成代码
 * 将飞书通知功能集成到GitHub PR审查流程
 */

const feishuNotify = require('./feishu-notify');
const reviewParser = require('./review-parser');
const { failureAlertManager } = require('./failure-alert');

/**
 * 主集成函数 - 处理PR审查事件并发送通知
 * @param {Object} reviewEvent - GitHub PR审查事件
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 集成结果
 */
async function integratePRReviewNotification(reviewEvent, options = {}) {
  console.log('开始集成PR审查通知流程...');
  
  const defaultOptions = {
    enableFeishu: true,
    enableFailureAlert: true,
    feishuWebhook: process.env.FEISHU_WEBHOOK_URL,
    repoInfo: {},
    ...options
  };

  try {
    // 1. 解析审查结果
    console.log('解析PR审查结果...');
    const reviewResult = reviewParser.parseReviewEvent(reviewEvent);
    
    if (!reviewResult) {
      throw new Error('无法解析审查结果');
    }

    console.log(`审查状态: ${reviewResult.state}, PR: ${reviewResult.prNumber}`);
    
    // 2. 根据审查状态决定通知类型
    let notificationResult;
    
    switch (reviewResult.state) {
      case 'approved':
        notificationResult = await handleApprovedReview(reviewResult, defaultOptions);
        break;
      case 'changes_requested':
        notificationResult = await handleChangesRequested(reviewResult, defaultOptions);
        break;
      case 'commented':
        notificationResult = await handleCommentedReview(reviewResult, defaultOptions);
        break;
      case 'dismissed':
        notificationResult = await handleDismissedReview(reviewResult, defaultOptions);
        break;
      default:
        notificationResult = await handleOtherReview(reviewResult, defaultOptions);
        break;
    }

    // 3. 如果启用失败告警，检查是否有失败情况
    if (defaultOptions.enableFailureAlert) {
      await checkForFailures(notificationResult, reviewResult, defaultOptions);
    }

    console.log('PR审查通知集成完成');
    return {
      success: true,
      reviewResult,
      notificationResult,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('集成PR审查通知失败:', error);
    
    // 发送失败告警
    if (defaultOptions.enableFailureAlert && defaultOptions.enableFeishu) {
      await sendFailureAlert(error, reviewEvent, defaultOptions);
    }
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 处理通过的审查
 */
async function handleApprovedReview(reviewResult, options) {
  console.log('处理通过的PR审查...');
  
  const message = {
    title: `✅ PR #${reviewResult.prNumber} 审查通过`,
    content: `**PR标题**: ${reviewResult.prTitle}\n` +
             `**审查者**: ${reviewResult.reviewer}\n` +
             `**仓库**: ${reviewResult.repo}\n` +
             `**通过时间**: ${new Date(reviewResult.submittedAt).toLocaleString()}\n` +
             `**链接**: ${reviewResult.prUrl}`,
    priority: 'info'
  };

  if (options.enableFeishu) {
    return await feishuNotify.sendNotification(message, options.feishuWebhook);
  }
  
  return { sent: false, reason: '飞书通知未启用' };
}

/**
 * 处理需要修改的审查
 */
async function handleChangesRequested(reviewResult, options) {
  console.log('处理需要修改的PR审查...');
  
  const changesCount = reviewResult.comments ? reviewResult.comments.length : 0;
  const message = {
    title: `⚠️ PR #${reviewResult.prNumber} 需要修改`,
    content: `**PR标题**: ${reviewResult.prTitle}\n` +
             `**审查者**: ${reviewResult.reviewer}\n` +
             `**仓库**: ${reviewResult.repo}\n` +
             `**修改要求**: ${changesCount} 处需要修改\n` +
             `**提交者**: ${reviewResult.author}\n` +
             `**链接**: ${reviewResult.prUrl}`,
    priority: 'warning'
  };

  // 如果有详细评论，添加到消息中
  if (reviewResult.comments && reviewResult.comments.length > 0) {
    message.content += '\n\n**修改意见**:\n';
    reviewResult.comments.forEach((comment, index) => {
      message.content += `${index + 1}. ${comment}\n`;
    });
  }

  if (options.enableFeishu) {
    return await feishuNotify.sendNotification(message, options.feishuWebhook);
  }
  
  return { sent: false, reason: '飞书通知未启用' };
}

/**
 * 处理评论的审查
 */
async function handleCommentedReview(reviewResult, options) {
  console.log('处理评论的PR审查...');
  
  const message = {
    title: `💬 PR #${reviewResult.prNumber} 收到评论`,
    content: `**PR标题**: ${reviewResult.prTitle}\n` +
             `**评论者**: ${reviewResult.reviewer}\n` +
             `**仓库**: ${reviewResult.repo}\n` +
             `**评论时间**: ${new Date(reviewResult.submittedAt).toLocaleString()}\n` +
             `**提交者**: ${reviewResult.author}\n` +
             `**链接**: ${reviewResult.prUrl}`,
    priority: 'info'
  };

  if (options.enableFeishu) {
    return await feishuNotify.sendNotification(message, options.feishuWebhook);
  }
  
  return { sent: false, reason: '飞书通知未启用' };
}

/**
 * 处理被驳回的审查
 */
async function handleDismissedReview(reviewResult, options) {
  console.log('处理被驳回的PR审查...');
  
  const message = {
    title: `❌ PR #${reviewResult.prNumber} 审查被驳回`,
    content: `**PR标题**: ${reviewResult.prTitle}\n` +
             `**原审查者**: ${reviewResult.reviewer}\n` +
             `**仓库**: ${reviewResult.repo}\n` +
             `**驳回时间**: ${new Date(reviewResult.submittedAt).toLocaleString()}\n` +
             `**驳回原因**: 审查意见被驳回，需要重新审查\n` +
             `**链接**: ${reviewResult.prUrl}`,
    priority: 'error'
  };

  if (options.enableFeishu) {
    return await feishuNotify.sendNotification(message, options.feishuWebhook);
  }
  
  return { sent: false, reason: '飞书通知未启用' };
}

/**
 * 处理其他类型的审查
 */
async function handleOtherReview(reviewResult, options) {
  console.log(`处理其他类型的PR审查: ${reviewResult.state}`);
  
  const message = {
    title: `📝 PR #${reviewResult.prNumber} 审查状态更新`,
    content: `**PR标题**: ${reviewResult.prTitle}\n` +
             `**审查者**: ${reviewResult.reviewer}\n` +
             `**仓库**: ${reviewResult.repo}\n` +
             `**状态**: ${reviewResult.state}\n` +
             `**时间**: ${new Date(reviewResult.submittedAt).toLocaleString()}\n` +
             `**链接**: ${reviewResult.prUrl}`,
    priority: 'info'
  };

  if (options.enableFeishu) {
    return await feishuNotify.sendNotification(message, options.feishuWebhook);
  }
  
  return { sent: false, reason: '飞书通知未启用' };
}

/**
 * 检查失败情况并发送告警
 */
async function checkForFailures(notificationResult, reviewResult, options) {
  if (!notificationResult.success && options.enableFeishu && config.integration.enableFailureAlert) {
    console.log('检测到通知失败，使用失败告警管理器处理...');
    
    const reviewContext = {
      prNumber: reviewResult.prNumber,
      prTitle: reviewResult.prTitle,
      repo: reviewResult.repo,
      state: reviewResult.state,
      reviewer: reviewResult.reviewer,
      submittedAt: reviewResult.submittedAt
    };
    
    // 使用失败告警管理器处理通知失败
    await failureAlertManager.handleNotificationFailure(notificationResult, reviewContext);
  }
}

/**
 * 发送失败告警
 */
async function sendFailureAlert(error, reviewEvent, options) {
  console.log('发送集成失败告警...');
  
  const eventContext = {
    eventType: 'pull_request_review',
    action: reviewEvent.action || 'unknown',
    repo: reviewEvent.repository ? `${reviewEvent.repository.owner.login}/${reviewEvent.repository.name}` : 'unknown',
    prNumber: reviewEvent.pull_request ? reviewEvent.pull_request.number : 'unknown'
  };
  
  // 使用失败告警管理器处理集成错误
  return await failureAlertManager.handleIntegrationError(error, eventContext);
}

/**
 * GitHub Webhook处理函数
 * 用于处理GitHub的webhook请求
 */
function handleGitHubWebhook(payload, headers) {
  console.log('处理GitHub Webhook请求...');
  
  const eventType = headers['x-github-event'];
  console.log(`GitHub事件类型: ${eventType}`);
  
  if (eventType === 'pull_request_review') {
    // 处理PR审查事件
    return integratePRReviewNotification(payload, {
      repoInfo: {
        owner: payload.repository.owner.login,
        repo: payload.repository.name
      }
    });
  }
  
  return Promise.resolve({
    success: false,
    error: `不支持的事件类型: ${eventType}`,
    timestamp: new Date().toISOString()
  });
}

/**
 * 测试集成功能
 */
async function testIntegration() {
  console.log('测试集成功能...');
  
  const testEvent = {
    action: 'submitted',
    review: {
      state: 'approved',
      body: 'LGTM!',
      submitted_at: new Date().toISOString(),
      user: {
        login: 'test-reviewer'
      }
    },
    pull_request: {
      number: 123,
      title: '测试PR标题',
      html_url: 'https://github.com/test/repo/pull/123',
      user: {
        login: 'test-author'
      }
    },
    repository: {
      full_name: 'test/repo',
      name: 'repo',
      owner: {
        login: 'test'
      }
    }
  };

  const options = {
    enableFeishu: false, // 测试时不发送真实通知
    enableFailureAlert: true,
    feishuWebhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/test'
  };

  try {
    const result = await integratePRReviewNotification(testEvent, options);
    console.log('集成测试结果:', result);
    return result;
  } catch (error) {
    console.error('集成测试失败:', error);
    throw error;
  }
}

module.exports = {
  integratePRReviewNotification,
  handleGitHubWebhook,
  testIntegration,
  handleApprovedReview,
  handleChangesRequested,
  handleCommentedReview,
  handleDismissedReview,
  handleOtherReview
};