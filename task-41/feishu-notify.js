/**
 * 飞书通知模块 - PR 审查通知集成
 * 用于发送 PR 审查结果到飞书群
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 飞书 Webhook 配置
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || 
  'https://open.feishu.cn/open-apis/bot/v2/hook/b9f3a575-1a7b-48a2-8f17-f94e6317abf7';

/**
 * 发送飞书文本消息
 * @param {string} title - 消息标题
 * @param {string} content - 消息内容
 * @param {string} type - 消息类型: success/failure/progress
 */
async function sendFeishuNotification(title, content, type = 'info') {
  const emojiMap = {
    success: '✅',
    failure: '❌',
    progress: '📋',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const emoji = emojiMap[type] || emojiMap.info;
  
  const payload = {
    msg_type: 'text',
    content: {
      text: `${emoji} ${title}\n\n${content}`
    }
  };
  
  try {
    const response = await postJson(FEISHU_WEBHOOK, payload);
    console.log('[Feishu] 通知发送成功:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('[Feishu] 通知发送失败:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 发送 PR 审查完成通知
 * @param {Object} reviewData - 审查数据
 */
async function sendReviewCompleteNotification(reviewData) {
  const {
    prNumber,
    prTitle,
    repo,
    reviewer,
    score,
    issues = [],
    suggestions = [],
    commitUrl
  } = reviewData;
  
  const stars = '⭐'.repeat(Math.floor(score)) + '☆'.repeat(5 - Math.floor(score));
  const issueCount = issues.length;
  
  const content = `
📌 **PR**: #${prNumber} ${prTitle}
📁 **仓库**: ${repo}
👤 **审查者**: ${reviewer}
📊 **评分**: ${stars} (${score}/5)
🔍 **问题**: ${issueCount} 个
${commitUrl ? `🔗 [查看详情](${commitUrl})` : ''}
  `.trim();
  
  return sendFeishuNotification(
    'PR 审查完成',
    content,
    issueCount === 0 ? 'success' : 'warning'
  );
}

/**
 * 发送审查失败告警
 * @param {Object} errorData - 错误数据
 */
async function sendReviewFailureNotification(errorData) {
  const {
    prNumber,
    prTitle,
    error,
    stack
  } = errorData;
  
  const content = `
📌 **PR**: #${prNumber} ${prTitle || '未知'}
❌ **错误**: ${error}
${stack ? `\n\`\`\`\n${stack.slice(0, 500)}\n\`\`\`` : ''}
  `.trim();
  
  return sendFeishuNotification(
    'PR 审查失败告警',
    content,
    'failure'
  );
}

/**
 * 发送进度通知
 * @param {string} message - 进度消息
 */
async function sendProgressNotification(message) {
  return sendFeishuNotification(
    '任务进度更新',
    message,
    'progress'
  );
}

/**
 * HTTP POST 请求
 */
function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// 导出模块
module.exports = {
  sendFeishuNotification,
  sendReviewCompleteNotification,
  sendReviewFailureNotification,
  sendProgressNotification,
  FEISHU_WEBHOOK
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  console.log('🧪 测试飞书通知功能...');
  
  // 测试审查完成通知
  sendReviewCompleteNotification({
    prNumber: 42,
    prTitle: '测试 PR',
    repo: 'trashoa/ai-team-tasks',
    reviewer: '大黑手',
    score: 4,
    issues: [],
    commitUrl: 'https://github.com/trashoa/ai-team-tasks/commit/abc123'
  }).then(result => {
    console.log('测试结果:', result);
    process.exit(result.success ? 0 : 1);
  });
}
