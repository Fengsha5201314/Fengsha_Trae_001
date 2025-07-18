// 内容脚本 - 注入到网页中处理语音识别和字幕显示

class VoiceTranslator {
  constructor() {
    this.isActive = false;
    this.recognition = null;
    this.overlay = null;
    this.config = {};
    this.init();
  }

  async init() {
    console.log('开始初始化语音翻译内容脚本...');
    
    // 获取配置
    await this.loadConfig();
    console.log('配置加载完成:', this.config);
    
    // 创建字幕覆盖层
    this.createOverlay();
    console.log('字幕覆盖层创建完成');
    
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('收到消息:', message);
      return this.handleMessage(message, sender, sendResponse);
    });
    
    console.log('语音翻译内容脚本已初始化完成');
  }

  // 加载配置
  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_CONFIG' });
      if (response.success) {
        this.config = response.config;
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  // 创建可拖动、可缩放的浮动字幕面板
  createOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'voice-translator-overlay';

    // 设置基础样式
    Object.assign(this.overlay.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '400px',
      minHeight: '80px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      fontSize: '18px',
      fontFamily: 'Microsoft YaHei, Arial, sans-serif',
      fontWeight: '500',
      zIndex: '2147483647', // 最高z-index值
      textAlign: 'center',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
      border: '2px solid rgba(255, 255, 255, 0.3)',
      backdropFilter: 'blur(12px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      opacity: '1',
      transform: 'scale(1)',
      pointerEvents: 'auto',
      cursor: 'move',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      resize: 'both',
      overflow: 'hidden',
      // 强制显示在最前面
      visibility: 'visible',
      isolation: 'isolate'
    });

    document.body.appendChild(this.overlay);

    this.setupDragging();
  }

  // 设置拖动逻辑
  setupDragging() {
    let isDragging = false;
    let offsetX, offsetY;

    const onMouseDown = (e) => {
      // 确保点击的是面板本身，而不是子元素或滚动条
      if (e.target !== this.overlay) return;

      isDragging = true;
      const rect = this.overlay.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      // 移除可能存在的 transition，避免拖动延迟
      this.overlay.style.transition = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;

      // 边界检测，防止拖出视窗
      const maxWidth = window.innerWidth - this.overlay.offsetWidth;
      const maxHeight = window.innerHeight - this.overlay.offsetHeight;
      newX = Math.max(0, Math.min(newX, maxWidth));
      newY = Math.max(0, Math.min(newY, maxHeight));

      this.overlay.style.left = `${newX}px`;
      this.overlay.style.top = `${newY}px`;
      // 清除 bottom 和 right，因为 left/top 优先
      this.overlay.style.bottom = 'auto';
      this.overlay.style.right = 'auto';
    };

    const onMouseUp = () => {
      isDragging = false;
      // 恢复 transition
      this.overlay.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    this.overlay.addEventListener('mousedown', onMouseDown);
  }

  // 开始语音识别
  async startRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
      this.showError('浏览器不支持语音识别功能');
      return;
    }

    // 请求麦克风权限
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateSubtitle('🎤 麦克风权限已获取，正在启动语音识别...');
    } catch (error) {
      console.error('麦克风权限被拒绝:', error);
      this.showError('❌ 需要麦克风权限才能使用语音识别功能，请在浏览器设置中允许麦克风访问');
      return;
    }

    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.sourceLanguage || 'zh-CN';
    this.recognition.maxAlternatives = 1;
    
    // 设置更强的连续性
    if ('webkitSpeechRecognition' in window) {
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    }

    this.recognition.onstart = () => {
      console.log('语音识别已开始');
      this.updateSubtitle('🎤 正在监听语音...');
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 显示临时结果
      if (interimTranscript) {
        this.updateSubtitle(`识别中: ${interimTranscript}`);
      }

      // 翻译最终结果
      if (finalTranscript) {
        this.translateText(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      let errorMessage = '语音识别出现错误';
      
      switch (event.error) {
        case 'not-allowed':
          errorMessage = '❌ 麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
          break;
        case 'no-speech':
          errorMessage = '🔇 未检测到语音，请检查麦克风是否正常工作';
          break;
        case 'audio-capture':
          errorMessage = '❌ 无法访问麦克风，请检查设备连接';
          break;
        case 'network':
          errorMessage = '❌ 网络错误，请检查网络连接';
          break;
        case 'service-not-allowed':
          errorMessage = '❌ 语音识别服务不可用';
          break;
        default:
          errorMessage = `❌ 语音识别错误: ${event.error}`;
      }
      
      this.showError(errorMessage);
    };

    this.recognition.onend = () => {
      console.log('语音识别已结束');
      if (this.isActive) {
        // 如果仍然激活，重新开始识别
        console.log('重新启动语音识别...');
        setTimeout(() => {
          if (this.isActive) {
            this.startRecognition();
          }
        }, 500); // 增加延迟确保稳定性
      }
    };

    this.recognition.start();
    
    // 设置保活机制
    this.setupKeepAlive();
  }

  // 停止语音识别
  stopRecognition() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    
    // 清理保活机制
    this.clearKeepAlive();
  }

  // 设置保活机制
  setupKeepAlive() {
    console.log('设置语音识别保活机制');
    
    // 清理之前的定时器
    this.clearKeepAlive();
    
    // 每30秒检查一次语音识别状态
    this.keepAliveTimer = setInterval(() => {
      if (this.isActive) {
        // 检查语音识别是否还在运行
        if (!this.recognition || this.recognition.readyState === 'inactive') {
          console.log('检测到语音识别已停止，重新启动...');
          this.startRecognition();
        } else {
          console.log('语音识别状态正常');
        }
      }
    }, 30000); // 30秒检查一次
    
    // 每5分钟强制重启一次，确保连续性
    this.forceRestartTimer = setInterval(() => {
      if (this.isActive && this.recognition) {
        console.log('强制重启语音识别以确保连续性');
        this.recognition.stop();
        setTimeout(() => {
          if (this.isActive) {
            this.startRecognition();
          }
        }, 1000);
      }
    }, 300000); // 5分钟
  }

  // 清理保活机制
  clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    
    if (this.forceRestartTimer) {
      clearInterval(this.forceRestartTimer);
      this.forceRestartTimer = null;
    }
  }

  // 翻译文本
  async translateText(text) {
    if (!text.trim()) return;
    
    try {
      // 检测是否为中文，如果是则不翻译
      if (this.isChinese(text)) {
        this.updateSubtitle(`🗣️ ${text}`);
        return;
      }

      this.updateSubtitle(`🔄 正在翻译: "${text.substring(0, 30)}${text.length > 30 ? '...' : '"'}`);
      
      // 调用百度翻译API
      const translatedText = await this.callTranslationAPI(text);
      this.updateSubtitle(`✅ ${translatedText}`);
      
    } catch (error) {
      console.error('翻译失败:', error);
      this.showError(`❌ 翻译失败: ${error.message}`);
    }
  }

  // 调用翻译API - 通过background script处理CORS
  async callTranslationAPI(text) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TRANSLATE_TEXT',
        data: {
          text: text,
          config: this.config
        }
      });
      
      if (response.success) {
        return response.result.translatedText;
      } else {
        throw new Error(response.error || '翻译请求失败');
      }
    } catch (error) {
      console.error('翻译API调用失败:', error);
      throw new Error(`翻译失败: ${error.message}`);
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
      return (value << amount) | (value >>> (32 - amount));
    }

    function addUnsigned(x, y) {
      const lsw = (x & 0xFFFF) + (y & 0xFFFF);
      const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xFFFF);
    }

    function md5cmn(q, a, b, x, s, t) {
      return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
    }

    function md5ff(a, b, c, d, x, s, t) {
      return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }

    function md5gg(a, b, c, d, x, s, t) {
      return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }

    function md5hh(a, b, c, d, x, s, t) {
      return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }

    function md5ii(a, b, c, d, x, s, t) {
      return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    function coreMD5(x, len) {
      x[len >> 5] |= 0x80 << ((len) % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;

      let a = 1732584193;
      let b = -271733879;
      let c = -1732584194;
      let d = 271733878;

      for (let i = 0; i < x.length; i += 16) {
        const olda = a;
        const oldb = b;
        const oldc = c;
        const oldd = d;

        a = md5ff(a, b, c, d, x[i + 0], 7, -680876936);
        d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

        a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5gg(b, c, d, a, x[i + 0], 20, -373897302);
        a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

        a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

        a = md5ii(a, b, c, d, x[i + 0], 6, -198630844);
        d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

        a = addUnsigned(a, olda);
        b = addUnsigned(b, oldb);
        c = addUnsigned(c, oldc);
        d = addUnsigned(d, oldd);
      }
      return [a, b, c, d];
    }

    function utf8Encode(string) {
      string = string.replace(/\r\n/g, '\n');
      let utftext = '';
      for (let n = 0; n < string.length; n++) {
        const c = string.charCodeAt(n);
        if (c < 128) {
          utftext += String.fromCharCode(c);
        } else if ((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        } else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    }

    function convertToWordArray(string) {
      const wordArray = [];
      const len = string.length;
      for (let i = 0; i < len; i += 4) {
        wordArray[i >> 2] = (string.charCodeAt(i) & 0xFF) |
          ((string.charCodeAt(i + 1) & 0xFF) << 8) |
          ((string.charCodeAt(i + 2) & 0xFF) << 16) |
          ((string.charCodeAt(i + 3) & 0xFF) << 24);
      }
      return wordArray;
    }

    function wordToHex(lValue) {
      let wordToHexValue = '';
      for (let lCount = 0; lCount <= 3; lCount++) {
        const lByte = (lValue >>> (lCount * 8)) & 255;
        wordToHexValue += ('0' + lByte.toString(16)).slice(-2);
      }
      return wordToHexValue;
    }

    const x = convertToWordArray(utf8Encode(string));
    const result = coreMD5(x, string.length * 8);
    return result.map(wordToHex).join('');
  }

  // 检测是否为中文
  isChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  // 更新字幕显示
  updateSubtitle(text) {
    if (!this.overlay) {
      console.error('覆盖层不存在，重新创建...');
      this.createOverlay();
      if (!this.overlay) {
        console.error('无法创建覆盖层');
        return;
      }
    }
    
    console.log('更新字幕:', text);
    console.log('覆盖层当前状态:', {
      display: this.overlay.style.display,
      opacity: this.overlay.style.opacity,
      zIndex: this.overlay.style.zIndex,
      position: this.overlay.style.position
    });
    
    this.overlay.textContent = text;
    
    // 强制设置可见性
    this.overlay.style.display = 'flex';
    this.overlay.style.visibility = 'visible';
    this.overlay.style.pointerEvents = 'auto';
    this.overlay.style.zIndex = '2147483647';
    
    // 强制显示和动画
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
        this.overlay.style.transform = 'scale(1)';
        console.log('覆盖层应该已显示，最终状态:', {
          display: this.overlay.style.display,
          opacity: this.overlay.style.opacity,
          visibility: this.overlay.style.visibility
        });
      }
    });
    
    // 8秒后自动淡出（但不隐藏，保持显示状态）
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.overlay && this.isActive) {
        this.overlay.style.opacity = '0.8'; // 淡出到更可见的透明度
      }
    }, 8000);
  }

  // 显示错误信息
  showError(message) {
    this.updateSubtitle(`❌ ${message}`);
  }

  // 切换显示状态
  async toggleDisplay() {
    console.log('切换显示状态，当前状态:', this.isActive);
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      console.log('启动语音翻译...');
      
      // 确保覆盖层存在并立即显示
      if (!this.overlay) {
        this.createOverlay();
      }
      
      // 立即显示覆盖层
      this.overlay.style.display = 'flex';
      this.overlay.style.visibility = 'visible';
      this.overlay.style.pointerEvents = 'auto';
      this.overlay.style.zIndex = '2147483647';
      this.overlay.style.opacity = '1';
      this.overlay.style.transform = 'scale(1)';
      
      console.log('覆盖层已强制显示');
      
      // 显示初始提示
      this.updateSubtitle('🚀 正在启动语音翻译...');
      
      // 设置页面焦点事件监听，防止语音识别停止
      this.setupFocusHandlers();
      
      // 启动翻译（异步）
      try {
        await this.startRecognition();
      } catch (error) {
        console.error('启动语音识别失败:', error);
        this.showError('❌ 启动失败，请检查麦克风权限和网络连接');
        this.isActive = false;
        this.overlay.style.display = 'none';
        throw error; // 重新抛出错误以便上层处理
      }
      
    } else {
      console.log('停止语音翻译...');
      
      // 停止翻译
      this.stopRecognition();
      
      // 移除焦点事件监听
      this.removeFocusHandlers();
      
      // 显示停止提示
      this.updateSubtitle('⏹️ 语音翻译已停止');
      
      // 隐藏动画
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.style.opacity = '0';
          this.overlay.style.transform = 'scale(0.95)';
        }
      }, 1000);
      
      setTimeout(() => {
        if (this.overlay && !this.isActive) {
          this.overlay.style.display = 'none';
          this.overlay.style.pointerEvents = 'none';
        }
      }, 1300);
      
      // 清理定时器
      clearTimeout(this.hideTimer);
    }
  }

  // 设置焦点事件处理，防止语音识别因失去焦点而停止
  setupFocusHandlers() {
    console.log('设置焦点事件监听');
    
    // 页面失去焦点时的处理
    this.onBlurHandler = () => {
      console.log('页面失去焦点，但保持语音识别运行');
      // 不停止语音识别，只是记录状态
    };
    
    // 页面获得焦点时的处理
    this.onFocusHandler = () => {
      console.log('页面获得焦点');
      // 确保语音识别仍在运行
      if (this.isActive && (!this.recognition || this.recognition.readyState === 'inactive')) {
        console.log('重新启动语音识别');
        setTimeout(() => this.startRecognition(), 100);
      }
    };
    
    // 添加事件监听
    window.addEventListener('blur', this.onBlurHandler);
    window.addEventListener('focus', this.onFocusHandler);
    
    // 防止页面隐藏时停止语音识别
    this.onVisibilityChangeHandler = () => {
      if (document.hidden) {
        console.log('页面被隐藏，但保持语音识别运行');
      } else {
        console.log('页面变为可见');
        if (this.isActive && (!this.recognition || this.recognition.readyState === 'inactive')) {
          console.log('页面可见时重新启动语音识别');
          setTimeout(() => this.startRecognition(), 100);
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.onVisibilityChangeHandler);
  }
  
  // 移除焦点事件监听
  removeFocusHandlers() {
    console.log('移除焦点事件监听');
    
    if (this.onBlurHandler) {
      window.removeEventListener('blur', this.onBlurHandler);
      this.onBlurHandler = null;
    }
    
    if (this.onFocusHandler) {
      window.removeEventListener('focus', this.onFocusHandler);
      this.onFocusHandler = null;
    }
    
    if (this.onVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.onVisibilityChangeHandler);
      this.onVisibilityChangeHandler = null;
    }
  }

  // 处理消息
  handleMessage(message, sender, sendResponse) {
    const { action } = message;
    
    switch (action) {
      case 'TOGGLE_TRANSLATOR':
        // 使用异步处理
        (async () => {
          try {
            await this.toggleDisplay();
            console.log('切换成功，当前状态:', this.isActive);
            sendResponse({ 
              success: true, 
              isActive: this.isActive,
              message: this.isActive ? '语音翻译已启动' : '语音翻译已停止'
            });
          } catch (error) {
            console.error('切换失败:', error);
            sendResponse({ 
              success: false, 
              error: error.message || '操作失败',
              isActive: this.isActive
            });
          }
        })();
        return true; // 表示异步响应
        
      case 'UPDATE_CONFIG':
        this.config = message.config;
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: '未知操作' });
    }
  }
}

// 初始化翻译器
const translator = new VoiceTranslator();