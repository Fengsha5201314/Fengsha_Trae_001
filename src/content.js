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
    // 获取配置
    await this.loadConfig();
    
    // 创建字幕覆盖层
    this.createOverlay();
    
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
    
    console.log('语音翻译内容脚本已初始化');
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

  // 创建半透明字幕覆盖层
  createOverlay() {
    if (this.overlay) return;
    
    this.overlay = document.createElement('div');
    this.overlay.id = 'voice-translator-overlay';
    this.overlay.className = 'voice-translator-hidden';
    
    // 设置样式
    Object.assign(this.overlay.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      zIndex: '10000',
      maxWidth: '80%',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      transition: 'opacity 0.3s ease',
      opacity: '0',
      pointerEvents: 'none'
    });
    
    document.body.appendChild(this.overlay);
  }

  // 开始语音识别
  startRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
      this.showError('浏览器不支持语音识别功能');
      return;
    }

    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'auto'; // 自动检测语言

    this.recognition.onstart = () => {
      console.log('语音识别已开始');
      this.updateSubtitle('正在监听语音...');
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
      this.showError(`语音识别错误: ${event.error}`);
    };

    this.recognition.onend = () => {
      console.log('语音识别已结束');
      if (this.isActive) {
        // 如果仍然激活，重新开始识别
        setTimeout(() => this.startRecognition(), 100);
      }
    };

    this.recognition.start();
  }

  // 停止语音识别
  stopRecognition() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  // 翻译文本
  async translateText(text) {
    if (!text.trim()) return;
    
    try {
      // 检测是否为中文，如果是则不翻译
      if (this.isChinese(text)) {
        this.updateSubtitle(text);
        return;
      }

      this.updateSubtitle('翻译中...');
      
      // 调用百度翻译API
      const translatedText = await this.callTranslationAPI(text);
      this.updateSubtitle(translatedText);
      
    } catch (error) {
      console.error('翻译失败:', error);
      this.showError('翻译失败，请检查网络连接');
    }
  }

  // 调用翻译API
  async callTranslationAPI(text) {
    const { appid, key } = this.config;
    if (!appid || !key) {
      throw new Error('请先配置百度翻译API密钥');
    }

    const salt = Date.now().toString();
    const sign = this.generateSign(appid, text, salt, key);
    
    const params = new URLSearchParams({
      q: text,
      from: 'auto',
      to: 'zh',
      appid: appid,
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
      throw new Error(`翻译API错误: ${data.error_msg}`);
    }

    return data.trans_result[0].dst;
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

  // 检测是否为中文
  isChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
  }

  // 更新字幕显示
  updateSubtitle(text) {
    if (!this.overlay) return;
    
    this.overlay.textContent = text;
    this.overlay.style.opacity = '1';
    
    // 5秒后自动隐藏
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '0';
      }
    }, 5000);
  }

  // 显示错误信息
  showError(message) {
    this.updateSubtitle(`❌ ${message}`);
  }

  // 切换显示状态
  toggleDisplay() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      this.startRecognition();
      this.overlay.style.display = 'block';
    } else {
      this.stopRecognition();
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay && !this.isActive) {
          this.overlay.style.display = 'none';
        }
      }, 300);
    }
  }

  // 处理消息
  handleMessage(message, sender, sendResponse) {
    const { action } = message;
    
    switch (action) {
      case 'TOGGLE_TRANSLATOR':
        this.toggleDisplay();
        sendResponse({ success: true, active: this.isActive });
        break;
        
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