# PR审查通知集成

将GitHub Pull Request审查事件自动通知到飞书群，实现审查流程的实时同步。

## 功能特性

- ✅ **实时通知**：GitHub PR审查状态变更时立即发送飞书通知
- ✅ **智能解析**：自动解析审查内容，提取关键信息
- ✅ **多状态支持**：支持通过、需要修改、评论、驳回等审查状态
- ✅ **失败告警**：集成失败时自动发送告警通知
- ✅ **配置灵活**：支持环境变量和配置文件
- ✅ **易于部署**：提供Docker部署和服务器部署方案

## 快速开始

### 1. 安装依赖

```bash
cd task-39
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 飞书Webhook URL（必需）
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id

# GitHub Webhook Secret（可选，用于安全验证）
GITHUB_WEBHOOK_SECRET=your-secret-key

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 3. 测试功能

```bash
# 运行所有测试
npm test

# 测试飞书通知连接
npm run test-feishu

# 验证配置
node index.js validate
```

### 4. 启动服务

```bash
# 启动Webhook服务器
node index.js webhook
```

## 部署指南

### Docker部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js", "webhook"]
```

构建和运行：

```bash
docker build -t pr-review-notification .
docker run -p 3000:3000 \
  -e FEISHU_WEBHOOK_URL=your-webhook-url \
  pr-review-notification
```

### 服务器部署

1. 克隆代码到服务器
2. 安装Node.js 18+
3. 配置环境变量
4. 使用PM2进程管理：

```bash
npm install -g pm2
pm2 start index.js --name pr-review-notification -- webhook
pm2 save
pm2 startup
```

## GitHub Webhook配置

1. 进入GitHub仓库设置
2. 选择 "Webhooks" → "Add webhook"
3. 配置参数：
   - **Payload URL**: `http://your-server:3000/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: 与 `GITHUB_WEBHOOK_SECRET` 一致
   - **Events**: 选择 "Let me select individual events"
   - 勾选 "Pull request reviews"

## 代码结构

```
task-39/
├── index.js                 # 主入口文件
├── integration.js          # 集成核心逻辑
├── feishu-notify.js       # 飞书通知功能
├── review-parser.js       # 审查结果解析
├── config.js              # 配置文件
├── package.json           # 依赖配置
├── README.md             # 说明文档
├── test-integration.js   # 集成测试
└── .env.example          # 环境变量示例
```

## API接口

### Webhook端点

- `POST /webhook/github` - GitHub Webhook接收端点
- `GET /health` - 健康检查端点

### 命令行工具

```bash
# 显示帮助
node index.js help

# 运行测试
node index.js test

# 测试飞书通知
node index.js test-feishu

# 验证配置
node index.js validate

# 启动Webhook服务器
node index.js webhook

# 处理事件文件
node index.js notify event.json
```

## 通知示例

### 审查通过通知
```
✅ PR #123 审查通过
PR标题: 修复用户认证模块
审查者: alice
仓库: company/project
通过时间: 2024-01-15 14:30:25
链接: https://github.com/company/project/pull/123
```

### 需要修改通知
```
⚠️ PR #124 需要修改
PR标题: 新增用户管理功能
审查者: bob
仓库: company/project
修改要求: 3 处需要修改
提交者: charlie
链接: https://github.com/company/project/pull/124

修改意见:
1. 缺少错误处理
2. 数据库查询需要优化
3. 添加单元测试
```

### 失败告警通知
```
🚨 PR审查通知发送失败
PR: #125 - 更新文档
仓库: company/docs
失败时间: 2024-01-15 15:45:10
错误信息: 网络请求失败
审查状态: approved
```

## 配置说明

### 飞书配置
```javascript
feishu: {
  webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
  timeout: 10000,      // 请求超时时间(ms)
  retryCount: 3,       // 重试次数
  retryDelay: 1000     // 重试延迟(ms)
}
```

### GitHub配置
```javascript
github: {
  webhookSecret: 'your-secret',  // Webhook签名验证
  apiToken: 'github-token',      // GitHub API令牌
  apiBaseUrl: 'https://api.github.com'
}
```

### 集成配置
```javascript
integration: {
  enableFeishu: true,           // 启用飞书通知
  enableFailureAlert: true,     // 启用失败告警
  notificationLevel: 'all',     // 通知级别: all/important/error
  enableDebugLog: true          // 启用调试日志
}
```

## 故障排除

### 常见问题

1. **飞书通知发送失败**
   - 检查Webhook URL是否正确
   - 验证网络连接
   - 检查飞书机器人是否启用

2. **GitHub Webhook验证失败**
   - 确认Webhook Secret配置一致
   - 检查服务器时间是否准确

3. **服务器无法启动**
   - 检查端口是否被占用
   - 验证Node.js版本（需要18+）
   - 检查依赖是否安装完整

### 日志查看

```bash
# 查看PM2日志
pm2 logs pr-review-notification

# 查看详细日志
NODE_ENV=development node index.js webhook
```

## 开发指南

### 添加新功能

1. 在对应模块中添加功能
2. 编写单元测试
3. 更新文档
4. 运行测试验证

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
node test-integration.js

# 代码覆盖率
npm test -- --coverage
```

## 许可证

MIT License

## 技术支持

- 项目仓库: [trashoa/ai-team-thinktank-code](https://github.com/trashoa/ai-team-thinktank-code)
- 问题反馈: GitHub Issues
- 文档更新: 提交Pull Request

---

**版本**: 1.0.0  
**最后更新**: 2024-01-15  
**维护者**: Pioneer Hand