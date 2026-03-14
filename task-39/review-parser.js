/**
 * 审查结果解析代码
 * 用于解析GitHub PR审查事件数据
 */

/**
 * 解析GitHub PR审查事件
 * @param {Object} event - GitHub PR审查事件
 * @returns {Object|null} 解析后的审查结果
 */
function parseReviewEvent(event) {
  console.log('解析GitHub PR审查事件...');
  
  if (!event || !event.review || !event.pull_request) {
    console.error('无效的GitHub事件数据');
    return null;
  }

  try {
    const review = event.review;
    const pullRequest = event.pull_request;
    const repository = event.repository;
    
    // 提取基本信息
    const reviewResult = {
      // 审查信息
      state: review.state,
      body: review.body || '',
      submittedAt: review.submitted_at,
      reviewer: review.user?.login || 'unknown',
      reviewerUrl: review.user?.html_url,
      
      // PR信息
      prNumber: pullRequest.number,
      prTitle: pullRequest.title,
      prUrl: pullRequest.html_url,
      prState: pullRequest.state,
      author: pullRequest.user?.login || 'unknown',
      authorUrl: pullRequest.user?.html_url,
      
      // 仓库信息
      repo: repository?.full_name || 'unknown',
      repoUrl: repository?.html_url,
      
      // 附加信息
      comments: extractComments(review),
      commitId: review.commit_id,
      eventAction: event.action,
      timestamp: new Date().toISOString()
    };

    // 处理审查状态
    reviewResult.state = normalizeReviewState(reviewResult.state);
    
    // 提取关键信息
    reviewResult.keyPoints = extractKeyPoints(reviewResult);
    
    // 计算审查质量评分
    reviewResult.qualityScore = calculateQualityScore(reviewResult);
    
    console.log(`解析完成: PR #${reviewResult.prNumber}, 状态: ${reviewResult.state}`);
    return reviewResult;

  } catch (error) {
    console.error('解析GitHub事件失败:', error);
    return null;
  }
}

/**
 * 标准化审查状态
 */
function normalizeReviewState(state) {
  const stateMap = {
    'approved': 'approved',
    'changes_requested': 'changes_requested',
    'commented': 'commented',
    'dismissed': 'dismissed',
    'pending': 'pending'
  };
  
  return stateMap[state] || 'unknown';
}

/**
 * 提取评论内容
 */
function extractComments(review) {
  const comments = [];
  
  // 从审查正文中提取评论
  if (review.body && review.body.trim()) {
    // 分割评论段落
    const paragraphs = review.body.split('\n\n').filter(p => p.trim());
    
    paragraphs.forEach(paragraph => {
      // 检查是否是具体的评论点（通常以-、*、•开头或包含"建议"、"问题"等关键词）
      if (isCommentPoint(paragraph)) {
        comments.push(cleanCommentText(paragraph));
      }
    });
  }
  
  return comments;
}

/**
 * 判断是否为评论点
 */
function isCommentPoint(text) {
  const trimmed = text.trim();
  
  // 检查常见模式
  const patterns = [
    /^[-*•]\s/, // 列表项
    /^(\d+\.\s|\(\d+\)\s)/, // 编号项
    /建议[:：]/, // 包含建议
    /问题[:：]/, // 包含问题
    /可以优化/, // 优化建议
    /需要修改/, // 修改要求
    /TODO/, // TODO标记
    /FIXME/, // FIXME标记
    /BUG/, // BUG标记
    /\?\s*$/, // 以问号结尾
    /\.{3}$/ // 以省略号结尾
  ];
  
  return patterns.some(pattern => pattern.test(trimmed));
}

/**
 * 清理评论文本
 */
function cleanCommentText(text) {
  return text
    .trim()
    .replace(/^[-*•]\s*/, '') // 移除列表标记
    .replace(/^(\d+\.\s|\(\d+\)\s)/, '') // 移除编号
    .replace(/\s+/g, ' ') // 合并多余空格
    .substring(0, 200); // 限制长度
}

/**
 * 提取关键信息点
 */
function extractKeyPoints(reviewResult) {
  const keyPoints = [];
  
  // 从审查正文中提取关键点
  if (reviewResult.body) {
    const body = reviewResult.body.toLowerCase();
    
    // 检查是否包含LGTM
    if (body.includes('lgtm') || body.includes('looks good to me')) {
      keyPoints.push('LGTM - 审查通过');
    }
    
    // 检查是否包含赞扬
    if (body.includes('great') || body.includes('good job') || body.includes('nice work')) {
      keyPoints.push('代码质量良好');
    }
    
    // 检查是否包含问题
    if (body.includes('bug') || body.includes('issue') || body.includes('problem')) {
      keyPoints.push('发现潜在问题');
    }
    
    // 检查是否包含安全问题
    if (body.includes('security') || body.includes('safe') || body.includes('vulnerability')) {
      keyPoints.push('涉及安全问题');
    }
    
    // 检查是否包含性能问题
    if (body.includes('performance') || body.includes('slow') || body.includes('optimize')) {
      keyPoints.push('涉及性能问题');
    }
    
    // 检查是否包含测试相关
    if (body.includes('test') || body.includes('coverage') || body.includes('unit')) {
      keyPoints.push('涉及测试相关');
    }
  }
  
  // 根据状态添加关键点
  if (reviewResult.state === 'approved') {
    keyPoints.push('审查已通过');
  } else if (reviewResult.state === 'changes_requested') {
    keyPoints.push('需要代码修改');
    keyPoints.push(`发现 ${reviewResult.comments.length} 个问题点`);
  } else if (reviewResult.state === 'commented') {
    keyPoints.push('提供审查意见');
  }
  
  return Array.from(new Set(keyPoints)); // 去重
}

/**
 * 计算审查质量评分
 */
function calculateQualityScore(reviewResult) {
  let score = 5; // 基础分
  
  // 加分项
  if (reviewResult.body && reviewResult.body.length > 50) {
    score += 1; // 详细评论
  }
  
  if (reviewResult.comments && reviewResult.comments.length > 0) {
    score += Math.min(reviewResult.comments.length, 3); // 具体评论点
  }
  
  if (reviewResult.keyPoints && reviewResult.keyPoints.length > 2) {
    score += 1; // 多关键点
  }
  
  // 减分项
  if (!reviewResult.body || reviewResult.body.trim().length === 0) {
    score -= 2; // 无评论正文
  }
  
  if (reviewResult.body && reviewResult.body.length < 10) {
    score -= 1; // 评论太简短
  }
  
  // 确保分数在1-10之间
  return Math.max(1, Math.min(10, score));
}

/**
 * 解析审查摘要
 */
function parseReviewSummary(reviewResult) {
  if (!reviewResult) return '无审查数据';
  
  const summary = {
    title: `PR #${reviewResult.prNumber} 审查结果`,
    state: reviewResult.state,
    reviewer: reviewResult.reviewer,
    timestamp: new Date(reviewResult.submittedAt).toLocaleString('zh-CN'),
    quality: reviewResult.qualityScore,
    keyPoints: reviewResult.keyPoints,
    hasComments: reviewResult.comments && reviewResult.comments.length > 0,
    commentCount: reviewResult.comments ? reviewResult.comments.length : 0
  };
  
  return summary;
}

/**
 * 生成人类可读的审查报告
 */
function generateReadableReport(reviewResult) {
  if (!reviewResult) return '无法生成报告：无审查数据';
  
  const stateTexts = {
    'approved': '✅ 已通过',
    'changes_requested': '⚠️ 需要修改',
    'commented': '💬 已评论',
    'dismissed': '❌ 已驳回',
    'pending': '⏳ 待处理',
    'unknown': '❓ 未知状态'
  };
  
  const stateText = stateTexts[reviewResult.state] || '❓ 未知状态';
  
  let report = `## PR审查报告\n\n`;
  report += `**PR**: #${reviewResult.prNumber} - ${reviewResult.prTitle}\n`;
  report += `**状态**: ${stateText}\n`;
  report += `**审查者**: ${reviewResult.reviewer}\n`;
  report += `**提交者**: ${reviewResult.author}\n`;
  report += `**仓库**: ${reviewResult.repo}\n`;
  report += `**审查时间**: ${new Date(reviewResult.submittedAt).toLocaleString('zh-CN')}\n`;
  report += `**质量评分**: ${reviewResult.qualityScore}/10\n\n`;
  
  if (reviewResult.keyPoints && reviewResult.keyPoints.length > 0) {
    report += `### 关键点\n`;
    reviewResult.keyPoints.forEach(point => {
      report += `- ${point}\n`;
    });
    report += `\n`;
  }
  
  if (reviewResult.comments && reviewResult.comments.length > 0) {
    report += `### 具体意见 (${reviewResult.comments.length} 条)\n`;
    reviewResult.comments.forEach((comment, index) => {
      report += `${index + 1}. ${comment}\n`;
    });
  } else if (reviewResult.body) {
    report += `### 审查意见\n`;
    report += `${reviewResult.body}\n`;
  }
  
  report += `\n**报告生成时间**: ${new Date().toLocaleString('zh-CN')}`;
  
  return report;
}

/**
 * 测试解析功能
 */
function testParser() {
  console.log('测试审查解析功能...');
  
  const testEvent = {
    action: 'submitted',
    review: {
      state: 'approved',
      body: 'LGTM! Great work on the refactoring.\n\nSome suggestions:\n- Consider adding more tests\n- Documentation could be improved',
      submitted_at: new Date().toISOString(),
      user: {
        login: 'test-reviewer',
        html_url: 'https://github.com/test-reviewer'
      },
      commit_id: 'abc123'
    },
    pull_request: {
      number: 123,
      title: 'Refactor user authentication module',
      html_url: 'https://github.com/test/repo/pull/123',
      state: 'open',
      user: {
        login: 'test-author',
        html_url: 'https://github.com/test-author'
      }
    },
    repository: {
      full_name: 'test/repo',
      html_url: 'https://github.com/test/repo',
      name: 'repo',
      owner: {
        login: 'test'
      }
    }
  };

  try {
    const result = parseReviewEvent(testEvent);
    console.log('解析测试结果:', {
      success: !!result,
      prNumber: result?.prNumber,
      state: result?.state,
      commentCount: result?.comments?.length,
      qualityScore: result?.qualityScore
    });
    
    if (result) {
      console.log('生成报告示例:');
      console.log(generateReadableReport(result).substring(0, 200) + '...');
    }
    
    return result;

  } catch (error) {
    console.error('解析测试失败:', error);
    return null;
  }
}

module.exports = {
  parseReviewEvent,
  parseReviewSummary,
  generateReadableReport,
  testParser,
  normalizeReviewState,
  extractComments,
  extractKeyPoints,
  calculateQualityScore
};