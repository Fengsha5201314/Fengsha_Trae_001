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