/**
 * 飞书通知函数
 * 用于发送PR审查通知到飞书群
 */

const axios = require('axios');

/**
 * 发送飞书通知
 * @param {Object} message - 消息对象
 * @param {string} message.title - 消息标题
 * @param {string} message.content - 消息内容
 * @param {string} message.priority - 优先级 (info/warning/error)
 * @param {string} webhookUrl - 飞书Webhook URL
 * @returns {Promise<Object>} 发送结果
 */
async function sendNotification(message, webhookUrl) {
  console.log(`发送飞书通知: ${message.title}`);
  
  if (!webhookUrl) {
    throw new Error('飞书Webhook URL未配置');
  }

  if (!message || !message.title || !message.content) {
    throw new Error('消息对象必须包含title和content属性');
  }

  try {
    // 根据优先级选择消息颜色
    const colorMap = {
      info: 'green',
      warning: 'orange',
      error: 'red'
    };
    
    const color = colorMap[message.priority] || 'blue';
    
    // 构建飞书消息卡片
    const feishuMessage = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: message.title
          },
          template: color
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: message.content
            }
          },
          {
            tag: 'hr'
          },
          {
            tag: 'note',
            elements: [
              {
                tag: 'plain_text',
                content: `发送时间: ${new Date().toLocaleString('zh-CN')}`
              }
            ]
          }
        ]
      }
    };

    // 发送请求
    const response = await axios.post(webhookUrl, feishuMessage, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });

    console.log('飞书通知发送成功:', response.data);
    
    return {
      success: true,
      messageId: response.data.data?.message_id,
      code: response.data.code,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('发送飞书通知失败:', error.message);
    
    // 检查是否是网络错误
    if (error.response) {
      console.error('飞书API响应错误:', {
        status: error.response.status,
        data: error.response.data
      });
      
      return {
        success: false,
        error: `飞书API错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
        timestamp: new Date().toISOString()
      };
    } else if (error.request) {
      console.error('网络请求失败:', error.request);
      
      return {
        success: false,
        error: '网络请求失败，请检查网络连接',
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * 发送简单的文本消息
 * @param {string} text - 文本内容
 * @param {string} webhookUrl - 飞书Webhook URL
 * @returns {Promise<Object>} 发送结果
 */
async function sendTextMessage(text, webhookUrl) {
  console.log('发送飞书文本消息:', text.substring(0, 50) + '...');
  
  const message = {
    msg_type: 'text',
    content: {
      text: text
    }
  };

  try {
    const response = await axios.post(webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    return {
      success: true,
      messageId: response.data.data?.message_id,
      code: response.data.code,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('发送飞书文本消息失败:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 发送带按钮的交互消息
 * @param {Object} options - 消息选项
 * @param {string} options.title - 标题
 * @param {string} options.content - 内容
 * @param {Array} options.buttons - 按钮数组 [{text: '按钮文本', url: '跳转链接'}]
 * @param {string} webhookUrl - 飞书Webhook URL
 * @returns {Promise<Object>} 发送结果
 */
async function sendInteractiveMessage(options, webhookUrl) {
  console.log(`发送交互消息: ${options.title}`);
  
  const elements = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: options.content
      }
    }
  ];

  // 添加按钮
  if (options.buttons && options.buttons.length > 0) {
    const buttonElements = options.buttons.map(button => ({
      tag: 'button',
      text: {
        tag: 'plain_text',
        content: button.text
      },
      type: 'primary',
      multi_url: {
        url: button.url,
        android_url: button.url,
        ios_url: button.url,
        pc_url: button.url
      }
    }));
    
    elements.push({
      tag: 'action',
      actions: buttonElements
    });
  }

  const feishuMessage = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: options.title
        },
        template: 'blue'
      },
      elements: elements
    }
  };

  try {
    const response = await axios.post(webhookUrl, feishuMessage, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    return {
      success: true,
      messageId: response.data.data?.message_id,
      code: response.data.code,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('发送交互消息失败:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 测试飞书通知功能
 * @param {string} webhookUrl - 飞书Webhook URL
 * @returns {Promise<Object>} 测试结果
 */
async function testFeishuNotification(webhookUrl) {
  console.log('测试飞书通知功能...');
  
  if (!webhookUrl) {
    return {
      success: false,
      error: '未提供飞书Webhook URL',
      timestamp: new Date().toISOString()
    };
  }

  const testMessage = {
    title: '🔧 飞书通知功能测试',
    content: '**测试消息**\n' +
             '这是一条测试消息，用于验证飞书通知功能是否正常工作。\n' +
             '**发送时间**: ' + new Date().toLocaleString('zh-CN') + '\n' +
             '**状态**: 测试中',
    priority: 'info'
  };

  try {
    const result = await sendNotification(testMessage, webhookUrl);
    
    if (result.success) {
      console.log('✅ 飞书通知测试成功');
      return {
        success: true,
        message: '飞书通知测试成功',
        details: result,
        timestamp: new Date().toISOString()
      };
    } else {
      console.log('❌ 飞书通知测试失败:', result.error);
      return {
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    console.error('飞书通知测试异常:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 验证Webhook URL格式
 * @param {string} url - Webhook URL
 * @returns {boolean} 是否有效
 */
function validateWebhookUrl(url) {
  if (!url) return false;
  
  // 检查是否是有效的飞书Webhook URL格式
  const feishuPattern = /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[a-f0-9-]+$/;
  return feishuPattern.test(url);
}

module.exports = {
  sendNotification,
  sendTextMessage,
  sendInteractiveMessage,
  testFeishuNotification,
  validateWebhookUrl
};