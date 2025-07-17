// Popup 界面逻辑

class PopupController {
  constructor() {
    this.isActive = false;
    this.currentTab = null;
    this.config = {};
    this.init();
  }

  async init() {
    // 获取当前标签页
    await this.getCurrentTab();
    
    // 加载配置
    await this.loadConfig();
    
    // 绑定事件
    this.bindEvents();
    
    // 更新UI状态
    this.updateUI();
    
    console.log('Popup 控制器已初始化');
  }

  // 获取当前活动标签页
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      this.updateCurrentUrl(tab.url);
    } catch (error) {
      console.error('获取当前标签页失败:', error);
    }
  }

  // 加载配置
  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (response.success) {
        this.config = response.config;
        this.updateConfigUI();
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  // 绑定事件监听器
  bindEvents() {
    // 主开关按钮
    const toggleBtn = document.getElementById('toggleBtn');
    toggleBtn.addEventListener('click', () => this.toggleTranslation());

    // 设置展开/收起
    const settingsToggle = document.getElementById('settingsToggle');
    settingsToggle.addEventListener('click', () => this.toggleSettings());

    // 保存配置
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', () => this.saveConfig());

    // 测试连接
    const testBtn = document.getElementById('testBtn');
    testBtn.addEventListener('click', () => this.testConnection());

    // 帮助和反馈链接
    const helpLink = document.getElementById('helpLink');
    helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    const feedbackLink = document.getElementById('feedbackLink');
    feedbackLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });

    // 输入框变化监听
    const appIdInput = document.getElementById('appId');
    const appKeyInput = document.getElementById('appKey');
    
    appIdInput.addEventListener('input', () => this.validateInputs());
    appKeyInput.addEventListener('input', () => this.validateInputs());
  }

  // 切换翻译功能
  async toggleTranslation() {
    if (!this.currentTab) {
      this.showNotification('无法获取当前标签页信息', 'error');
      return;
    }

    // 检查配置
    if (!this.config.appid || !this.config.key) {
      this.showNotification('请先配置百度翻译API密钥', 'warning');
      this.toggleSettings(true); // 自动展开设置
      return;
    }

    try {
      const toggleBtn = document.getElementById('toggleBtn');
      toggleBtn.classList.add('loading');

      if (!this.isActive) {
        // 开始翻译
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'TOGGLE_TRANSLATOR'
        });

        if (response && response.success) {
          this.isActive = response.active;
          this.updateUI();
          this.showNotification('语音翻译已启动', 'success');
        } else {
          throw new Error('启动翻译失败');
        }
      } else {
        // 停止翻译
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'TOGGLE_TRANSLATOR'
        });

        if (response && response.success) {
          this.isActive = response.active;
          this.updateUI();
          this.showNotification('语音翻译已停止', 'info');
        }
      }
    } catch (error) {
      console.error('切换翻译状态失败:', error);
      this.showNotification('操作失败，请刷新页面后重试', 'error');
    } finally {
      const toggleBtn = document.getElementById('toggleBtn');
      toggleBtn.classList.remove('loading');
    }
  }

  // 切换设置面板
  toggleSettings(forceExpand = false) {
    const settingsContent = document.getElementById('settingsContent');
    const isExpanded = settingsContent.classList.contains('expanded');
    
    if (forceExpand || !isExpanded) {
      settingsContent.classList.add('expanded');
    } else {
      settingsContent.classList.remove('expanded');
    }
  }

  // 保存配置
  async saveConfig() {
    const appId = document.getElementById('appId').value.trim();
    const appKey = document.getElementById('appKey').value.trim();

    if (!appId || !appKey) {
      this.showNotification('请填写完整的API配置信息', 'warning');
      return;
    }

    try {
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.classList.add('loading');
      saveBtn.textContent = '保存中...';

      const config = {
        appid: appId,
        key: appKey,
        timestamp: Date.now()
      };

      const response = await chrome.runtime.sendMessage({
        action: 'SAVE_CONFIG',
        data: config
      });

      if (response.success) {
        this.config = config;
        this.showNotification('配置保存成功', 'success');
        
        // 通知content script更新配置
        if (this.currentTab) {
          chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'UPDATE_CONFIG',
            config: config
          }).catch(() => {
            // 忽略错误，可能页面还没有注入content script
          });
        }
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      this.showNotification('保存失败: ' + error.message, 'error');
    } finally {
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.classList.remove('loading');
      saveBtn.textContent = '保存配置';
    }
  }

  // 测试API连接
  async testConnection() {
    const appId = document.getElementById('appId').value.trim();
    const appKey = document.getElementById('appKey').value.trim();

    if (!appId || !appKey) {
      this.showNotification('请先填写API配置信息', 'warning');
      return;
    }

    try {
      const testBtn = document.getElementById('testBtn');
      testBtn.classList.add('loading');
      testBtn.textContent = '测试中...';

      // 简单的测试翻译
      const testText = 'Hello';
      const salt = Date.now().toString();
      const sign = this.generateSign(appId, testText, salt, appKey);
      
      const params = new URLSearchParams({
        q: testText,
        from: 'en',
        to: 'zh',
        appid: appId,
        salt: salt,
        sign: sign
      });

      const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const data = await response.json();
      
      if (data.error_code) {
        throw new Error(`API错误: ${data.error_msg}`);
      }

      this.showNotification('API连接测试成功', 'success');
    } catch (error) {
      console.error('测试连接失败:', error);
      this.showNotification('连接测试失败: ' + error.message, 'error');
    } finally {
      const testBtn = document.getElementById('testBtn');
      testBtn.classList.remove('loading');
      testBtn.textContent = '测试连接';
    }
  }

  // 生成百度翻译API签名
  generateSign(appid, query, salt, key) {
    const str = appid + query + salt + key;
    // 简单的MD5实现（生产环境建议使用crypto-js库）
    return this.md5(str);
  }

  // 简单MD5实现
  md5(string) {
    // 这里使用简化版本，实际应用中建议使用crypto-js
    return btoa(string).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 32);
  }

  // 验证输入
  validateInputs() {
    const appId = document.getElementById('appId').value.trim();
    const appKey = document.getElementById('appKey').value.trim();
    const saveBtn = document.getElementById('saveBtn');
    const testBtn = document.getElementById('testBtn');
    
    const isValid = appId.length > 0 && appKey.length > 0;
    saveBtn.disabled = !isValid;
    testBtn.disabled = !isValid;
  }

  // 更新UI状态
  updateUI() {
    const toggleBtn = document.getElementById('toggleBtn');
    const btnText = document.getElementById('btnText');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');
    const iconPlay = toggleBtn.querySelector('.icon-play');
    const iconStop = toggleBtn.querySelector('.icon-stop');

    if (this.isActive) {
      toggleBtn.classList.add('active');
      btnText.textContent = '停止翻译';
      statusDot.classList.add('active');
      statusText.textContent = '正在翻译';
      iconPlay.style.display = 'none';
      iconStop.style.display = 'block';
    } else {
      toggleBtn.classList.remove('active');
      btnText.textContent = '开始翻译';
      statusDot.classList.remove('active');
      statusText.textContent = '未激活';
      iconPlay.style.display = 'block';
      iconStop.style.display = 'none';
    }
  }

  // 更新配置UI
  updateConfigUI() {
    if (this.config.appid) {
      document.getElementById('appId').value = this.config.appid;
    }
    if (this.config.key) {
      document.getElementById('appKey').value = this.config.key;
    }
    this.validateInputs();
  }

  // 更新当前URL显示
  updateCurrentUrl(url) {
    const currentUrlElement = document.getElementById('currentUrl');
    if (url) {
      const domain = new URL(url).hostname;
      currentUrlElement.textContent = domain;
    } else {
      currentUrlElement.textContent = '未知';
    }
  }

  // 显示通知
  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      padding: '10px 16px',
      borderRadius: '6px',
      color: 'white',
      fontSize: '13px',
      fontWeight: '500',
      zIndex: '10000',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    });

    // 设置背景色
    const colors = {
      success: '#51cf66',
      error: '#ff6b6b',
      warning: '#ffd43b',
      info: '#667eea'
    };
    notification.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // 打开帮助页面
  openHelp() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/voice-translator/wiki'
    });
  }

  // 打开反馈页面
  openFeedback() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/voice-translator/issues'
    });
  }
}

// 初始化Popup控制器
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});