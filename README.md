# 语音翻译浏览器扩展

一个实时语音翻译的Chrome浏览器扩展，支持将网页音频或麦克风输入的语音实时翻译并显示字幕。

## 功能特性

### 核心功能
- 🎤 **实时语音识别** - 使用Web Speech API进行语音识别
- 🌐 **智能翻译** - 集成百度翻译API，支持多语言翻译
- 📺 **字幕显示** - 在网页上显示半透明字幕覆盖层
- 🎵 **音频捕获** - 支持捕获标签页音频进行翻译
- ⚙️ **灵活配置** - 可配置API密钥、语言设置等

### 技术特性
- 📱 **现代UI** - 美观的弹出界面和字幕显示
- 🔒 **安全存储** - 使用Chrome Storage API安全存储配置
- 🛡️ **错误处理** - 完善的错误处理和用户提示
- 🔧 **权限管理** - 智能的权限检查和引导
- 📊 **性能优化** - 防抖、缓存等性能优化措施

## 安装说明

### 开发环境安装

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd voice-translator-extension
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建项目**
   ```bash
   npm run build
   ```

### Chrome扩展安装

1. 打开Chrome浏览器，进入 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录
5. 扩展安装完成

## 使用指南

### 首次配置

1. **API配置**
   - 点击扩展图标打开弹出界面
   - 展开"API配置"部分
   - 输入百度翻译API的APP ID和密钥
   - 点击"测试连接"验证配置
   - 点击"保存"保存配置

2. **权限授权**
   - 首次使用时会请求麦克风权限
   - 点击"允许"授权麦克风访问
   - 如需翻译页面音频，还需授权标签页音频捕获

### 基本使用

1. **开始翻译**
   - 点击扩展图标
   - 点击"开始翻译"按钮
   - 开始说话或播放音频
   - 字幕将实时显示在页面上

2. **停止翻译**
   - 再次点击扩展图标
   - 点击"停止翻译"按钮
   - 或者直接关闭标签页

### 高级功能

- **语言设置** - 在弹出界面中可以看到当前识别语言
- **字幕样式** - 字幕支持多种显示状态（正常、加载、错误、成功）
- **错误恢复** - 遇到错误时会显示详细提示和恢复建议

## API配置

### 百度翻译API

1. **注册账号**
   - 访问 [百度翻译开放平台](https://fanyi-api.baidu.com/)
   - 注册并登录账号

2. **创建应用**
   - 进入管理控制台
   - 创建新的翻译应用
   - 获取APP ID和密钥

3. **配置扩展**
   - 在扩展弹出界面中输入APP ID和密钥
   - 测试连接确保配置正确

## 开发说明

### 项目结构

```
voice-translator-extension/
├── manifest.json          # 扩展配置文件
├── package.json           # 项目依赖配置
├── README.md             # 项目说明文档
├── src/                  # 源代码目录
│   ├── background.js     # 后台服务脚本
│   ├── content.js        # 内容脚本
│   ├── content.css       # 内容脚本样式
│   ├── popup/            # 弹出界面
│   │   ├── popup.html    # 弹出界面HTML
│   │   ├── popup.css     # 弹出界面样式
│   │   └── popup.js      # 弹出界面逻辑
│   └── utils/            # 工具模块
│       ├── config.js     # 配置管理
│       ├── translator.js # 翻译服务
│       ├── speech.js     # 语音识别
│       ├── error-handler.js # 错误处理
│       └── permissions.js   # 权限管理
└── icons/                # 图标文件
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

### 核心模块

#### 1. 后台服务 (background.js)
- 管理扩展生命周期
- 处理音频流捕获
- 消息通信中转
- 配置存储管理

#### 2. 内容脚本 (content.js)
- 创建字幕覆盖层
- 语音识别处理
- 翻译API调用
- 用户界面更新

#### 3. 弹出界面 (popup/)
- 扩展控制面板
- API配置界面
- 状态显示
- 用户交互

#### 4. 工具模块 (utils/)
- **ConfigManager** - 配置管理
- **TranslationService** - 翻译服务
- **SpeechRecognizer** - 语音识别
- **ErrorHandler** - 错误处理
- **PermissionManager** - 权限管理

### 开发命令

```bash
# 开发模式（监听文件变化）
npm run dev

# 构建生产版本
npm run build

# 代码规范检查
npm run lint
```

## 浏览器兼容性

### 支持的浏览器
- ✅ Chrome 88+
- ✅ Edge 88+
- ❌ Firefox（不支持Chrome扩展API）
- ❌ Safari（不支持Chrome扩展API）

### 所需API支持
- Web Speech API
- MediaDevices API
- Chrome Extensions API
- Chrome Storage API
- Chrome TabCapture API

## 常见问题

### Q: 麦克风权限被拒绝怎么办？
A: 
1. 点击地址栏左侧的锁形图标
2. 在弹出菜单中找到"麦克风"选项
3. 选择"允许"
4. 刷新页面

### Q: 翻译不准确怎么办？
A:
1. 检查网络连接
2. 确保API配置正确
3. 尝试说话更清晰
4. 检查识别语言设置

### Q: 字幕不显示怎么办？
A:
1. 检查是否已开始翻译
2. 确保麦克风权限已授权
3. 检查页面是否支持内容脚本注入
4. 尝试刷新页面

### Q: API调用失败怎么办？
A:
1. 检查API密钥是否正确
2. 确认API账户余额充足
3. 检查网络连接
4. 查看错误提示信息

## 更新日志

### v1.0.0 (2024-01-XX)
- 🎉 初始版本发布
- ✨ 实时语音识别和翻译
- ✨ 字幕显示功能
- ✨ 百度翻译API集成
- ✨ 完善的错误处理
- ✨ 权限管理系统

## 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

### 代码规范
- 使用ESLint进行代码检查
- 遵循JavaScript标准规范
- 添加适当的注释
- 编写测试用例

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目地址: [GitHub Repository]
- 问题反馈: [GitHub Issues]
- 邮箱: [your-email@example.com]

---

**注意**: 本扩展需要网络连接和相关API服务支持，请确保网络畅通并正确配置API密钥。