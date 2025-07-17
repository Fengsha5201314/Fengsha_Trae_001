// Popup 界面逻辑

class PopupController {
  constructor() {
    this.isActive = false;
    this.currentTab = null;
    this.config = {};
    this.init();
  }

  async init() {
    // 防止页面自动关闭
    this.preventAutoClose();
    
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

  // 防止页面自动关闭
  preventAutoClose() {
    // 阻止默认的关闭行为
    window.addEventListener('beforeunload', (e) => {
      // 只有在用户明确要关闭时才允许
      if (!this.userRequestedClose) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    
    // 监听键盘事件，防止意外关闭
    document.addEventListener('keydown', (e) => {
      // 防止Escape键关闭popup
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    // 确保popup保持打开状态
    this.userRequestedClose = false;
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

      // 简单的测试翻译 <mcreference link="https://baidufanyi.apifox.cn/api-26880827" index="2">2</mcreference>
      const testText = 'Hello';
      const salt = Date.now().toString();
      const sign = this.generateSign(appId, testText, salt, appKey);
      
      console.log('测试参数:', {
        appid: appId,
        q: testText,
        salt: salt,
        sign: sign,
        signString: appId + testText + salt + appKey
      });
      
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
      console.log('API响应:', data);
      
      if (data.error_code) {
        // 显示具体的错误信息 <mcreference link="https://baidufanyi.apifox.cn/api-26880827" index="2">2</mcreference>
        const errorMessages = {
          '52001': 'APP ID无效',
          '52002': '签名错误',
          '52003': '访问频率受限',
          '54001': '签名错误，请检查您的签名生成方法',
          '54003': '访问权限受限',
          '54004': '账户余额不足',
          '54005': '长query请求频繁',
          '58000': '客户端IP非法',
          '58001': '译文语言方向不支持',
          '58002': '服务当前已关闭',
          '90107': '认证未通过或未生效'
        };
        const errorMsg = errorMessages[data.error_code] || data.error_msg || '未知错误';
        throw new Error(`API错误 ${data.error_code}: ${errorMsg}`);
      }

      if (data.trans_result && data.trans_result.length > 0) {
        const result = data.trans_result[0];
        this.showNotification(`API连接测试成功！翻译结果: "${result.src}" → "${result.dst}"`, 'success');
      } else {
        this.showNotification('API连接测试成功', 'success');
      }
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
    // 完整的MD5哈希实现
    return this.md5(str);
  }

  // MD5哈希函数 - 完整实现
  md5(string) {
    function rotateLeft(value, amount) {
      const lbits = (value << amount) | (value >>> (32 - amount));
      return lbits;
    }
    
    function addUnsigned(x, y) {
      const x4 = (x & 0x40000000);
      const y4 = (y & 0x40000000);
      const x8 = (x & 0x80000000);
      const y8 = (y & 0x80000000);
      const result = (x & 0x3FFFFFFF) + (y & 0x3FFFFFFF);
      if (x4 & y4) {
        return (result ^ 0x80000000 ^ x8 ^ y8);
      }
      if (x4 | y4) {
        if (result & 0x40000000) {
          return (result ^ 0xC0000000 ^ x8 ^ y8);
        } else {
          return (result ^ 0x40000000 ^ x8 ^ y8);
        }
      } else {
        return (result ^ x8 ^ y8);
      }
    }
    
    function f(x, y, z) { return (x & y) | ((~x) & z); }
    function g(x, y, z) { return (x & z) | (y & (~z)); }
    function h(x, y, z) { return (x ^ y ^ z); }
    function i(x, y, z) { return (y ^ (x | (~z))); }
    
    function ff(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    
    function gg(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    
    function hh(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    
    function ii(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    
    function convertToWordArray(string) {
      let lWordCount;
      const lMessageLength = string.length;
      const lNumberOfWords_temp1 = lMessageLength + 8;
      const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      const lWordArray = Array(lNumberOfWords - 1);
      let lBytePosition = 0;
      let lByteCount = 0;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    
    function wordToHex(lValue) {
      let wordToHexValue = "", wordToHexValue_temp = "", lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        wordToHexValue_temp = "0" + lByte.toString(16);
        wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
      }
      return wordToHexValue;
    }
    
    const x = convertToWordArray(string);
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;
    
    for (let k = 0; k < x.length; k += 16) {
      const AA = a;
      const BB = b;
      const CC = c;
      const DD = d;
      a = ff(a, b, c, d, x[k + 0], 7, 0xD76AA478);
      d = ff(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
      c = ff(c, d, a, b, x[k + 2], 17, 0x242070DB);
      b = ff(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
      a = ff(a, b, c, d, x[k + 4], 7, 0xF57C0FAF);
      d = ff(d, a, b, c, x[k + 5], 12, 0x4787C62A);
      c = ff(c, d, a, b, x[k + 6], 17, 0xA8304613);
      b = ff(b, c, d, a, x[k + 7], 22, 0xFD469501);
      a = ff(a, b, c, d, x[k + 8], 7, 0x698098D8);
      d = ff(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
      c = ff(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1);
      b = ff(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
      a = ff(a, b, c, d, x[k + 12], 7, 0x6B901122);
      d = ff(d, a, b, c, x[k + 13], 12, 0xFD987193);
      c = ff(c, d, a, b, x[k + 14], 17, 0xA679438E);
      b = ff(b, c, d, a, x[k + 15], 22, 0x49B40821);
      a = gg(a, b, c, d, x[k + 1], 5, 0xF61E2562);
      d = gg(d, a, b, c, x[k + 6], 9, 0xC040B340);
      c = gg(c, d, a, b, x[k + 11], 14, 0x265E5A51);
      b = gg(b, c, d, a, x[k + 0], 20, 0xE9B6C7AA);
      a = gg(a, b, c, d, x[k + 5], 5, 0xD62F105D);
      d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
      c = gg(c, d, a, b, x[k + 15], 14, 0xD8A1E681);
      b = gg(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
      a = gg(a, b, c, d, x[k + 9], 5, 0x21E1CDE6);
      d = gg(d, a, b, c, x[k + 14], 9, 0xC33707D6);
      c = gg(c, d, a, b, x[k + 3], 14, 0xF4D50D87);
      b = gg(b, c, d, a, x[k + 8], 20, 0x455A14ED);
      a = gg(a, b, c, d, x[k + 13], 5, 0xA9E3E905);
      d = gg(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
      c = gg(c, d, a, b, x[k + 7], 14, 0x676F02D9);
      b = gg(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);
      a = hh(a, b, c, d, x[k + 5], 4, 0xFFFA3942);
      d = hh(d, a, b, c, x[k + 8], 11, 0x8771F681);
      c = hh(c, d, a, b, x[k + 11], 16, 0x6D9D6122);
      b = hh(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
      a = hh(a, b, c, d, x[k + 1], 4, 0xA4BEEA44);
      d = hh(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
      c = hh(c, d, a, b, x[k + 7], 16, 0xF6BB4B60);
      b = hh(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
      a = hh(a, b, c, d, x[k + 13], 4, 0x289B7EC6);
      d = hh(d, a, b, c, x[k + 0], 11, 0xEAA127FA);
      c = hh(c, d, a, b, x[k + 3], 16, 0xD4EF3085);
      b = hh(b, c, d, a, x[k + 6], 23, 0x4881D05);
      a = hh(a, b, c, d, x[k + 9], 4, 0xD9D4D039);
      d = hh(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
      c = hh(c, d, a, b, x[k + 15], 16, 0x1FA27CF8);
      b = hh(b, c, d, a, x[k + 2], 23, 0xC4AC5665);
      a = ii(a, b, c, d, x[k + 0], 6, 0xF4292244);
      d = ii(d, a, b, c, x[k + 7], 10, 0x432AFF97);
      c = ii(c, d, a, b, x[k + 14], 15, 0xAB9423A7);
      b = ii(b, c, d, a, x[k + 5], 21, 0xFC93A039);
      a = ii(a, b, c, d, x[k + 12], 6, 0x655B59C3);
      d = ii(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
      c = ii(c, d, a, b, x[k + 10], 15, 0xFFEFF47D);
      b = ii(b, c, d, a, x[k + 1], 21, 0x85845DD1);
      a = ii(a, b, c, d, x[k + 8], 6, 0x6FA87E4F);
      d = ii(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
      c = ii(c, d, a, b, x[k + 6], 15, 0xA3014314);
      b = ii(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
      a = ii(a, b, c, d, x[k + 4], 6, 0xF7537E82);
      d = ii(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
      c = ii(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB);
      b = ii(b, c, d, a, x[k + 9], 21, 0xEB86D391);
      a = addUnsigned(a, AA);
      b = addUnsigned(b, BB);
      c = addUnsigned(c, CC);
      d = addUnsigned(d, DD);
    }
    
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
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
      transition: 'transform 0.3s ease',
      maxWidth: '280px',
      wordWrap: 'break-word'
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

    // 自动隐藏 - 延长显示时间以便用户阅读详细信息
    const hideDelay = type === 'error' ? 5000 : 4000; // 错误信息显示更长时间
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, hideDelay);
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