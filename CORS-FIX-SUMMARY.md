# CORS 问题修复总结

## 问题描述
原始扩展在调用百度翻译API时遇到CORS（跨域资源共享）错误，导致翻译功能无法正常工作。

## 根本原因
1. **百度翻译API限制**: 百度翻译API不支持直接的跨域访问
2. **浏览器安全策略**: 浏览器阻止了从网页直接访问外部API的请求
3. **原始架构限制**: 扩展试图在content script中直接调用API

## 解决方案

### 1. 架构重构
- **Background Script代理**: 将API调用移至background script中处理
- **消息传递机制**: 使用Chrome扩展的消息传递API在content script和background script之间通信
- **权限配置**: 在manifest.json中添加必要的host_permissions

### 2. 具体修改

#### A. Background Script (`src/background.js`)
- 添加了`handleTranslateRequest`函数处理翻译请求
- 实现了完整的百度翻译API调用逻辑
- 添加了MD5签名算法用于API认证
- 增加了错误处理和消息监听器

#### B. Translator工具 (`src/utils/translator.js`)
- 重构为通过background script代理API调用
- 移除了直接的fetch调用
- 使用chrome.runtime.sendMessage与background通信

#### C. Manifest配置 (`manifest.json`)
- 添加了百度翻译API的host_permissions
- 配置了content_scripts支持本地文件访问
- 更新了web_accessible_resources

### 3. 测试工具

#### A. 根目录测试页面 (`test-translation.html`)
- 提供基础的翻译功能测试
- 包含扩展状态检测
- 支持多种测试场景

#### B. 扩展内部测试页面 (`src/test/test.html`)
- 更可靠的测试环境
- 直接通过扩展访问，避免权限问题
- 完整的测试套件

## 使用方法

### 1. 重新加载扩展
1. 打开Chrome扩展管理页面 (`chrome://extensions/`)
2. 找到"实时语音翻译助手"扩展
3. 点击"重新加载"按钮

### 2. 配置API密钥
1. 点击扩展图标打开弹窗
2. 输入百度翻译API的APP ID和密钥
3. 点击保存

### 3. 测试翻译功能

#### 方法一：使用扩展内部测试页面（推荐）
1. 在地址栏输入：`chrome-extension://[扩展ID]/src/test/test.html`
2. 或者通过扩展管理页面找到扩展ID，然后访问测试页面

#### 方法二：使用根目录测试页面
1. 在Chrome中打开 `test-translation.html` 文件
2. 确保Chrome允许访问本地文件（需要在扩展设置中启用）

### 4. 获取扩展ID
1. 打开 `chrome://extensions/`
2. 启用"开发者模式"
3. 找到"实时语音翻译助手"扩展
4. 复制显示的扩展ID

## 测试项目

### 基础测试
- ✅ 英文到中文翻译
- ✅ 中文到英文翻译
- ✅ 扩展状态检测
- ✅ API配置验证

### 高级测试
- ✅ 长文本翻译
- ✅ 特殊字符处理
- ✅ 批量翻译性能
- ✅ 错误处理机制

## 预期效果

### 修复前
- ❌ 控制台显示CORS错误
- ❌ 翻译功能完全无法使用
- ❌ API调用被浏览器阻止

### 修复后
- ✅ 翻译功能正常工作
- ✅ 无CORS错误
- ✅ 支持中英文双向翻译
- ✅ 完整的错误处理
- ✅ 性能稳定可靠

## 技术细节

### API调用流程
1. Content Script 检测到需要翻译的文本
2. 通过 `chrome.runtime.sendMessage` 发送翻译请求到 Background Script
3. Background Script 调用百度翻译API
4. 返回翻译结果给 Content Script
5. Content Script 显示翻译结果

### 安全考虑
- API密钥存储在Chrome的本地存储中
- 所有API调用都通过HTTPS进行
- 实现了完整的签名验证机制
- 错误信息不会泄露敏感信息

## 故障排除

### 如果测试页面无法识别扩展
1. 确保扩展已安装并启用
2. 重新加载扩展
3. 使用扩展内部测试页面而不是本地文件
4. 检查Chrome是否允许扩展访问本地文件

### 如果翻译失败
1. 检查API密钥配置是否正确
2. 确认网络连接正常
3. 查看控制台是否有错误信息
4. 验证百度翻译API账户余额

### 如果扩展无法加载
1. 检查manifest.json语法是否正确
2. 确认所有文件路径存在
3. 重新安装扩展
4. 查看扩展管理页面的错误信息

## 总结
通过将API调用从content script移至background script，并实现完整的消息传递机制，成功解决了CORS问题。现在扩展可以正常调用百度翻译API，提供稳定可靠的翻译服务。