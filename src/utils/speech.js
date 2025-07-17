// 语音识别模块

class SpeechRecognizer {
  constructor(config = {}) {
    this.config = {
      continuous: true,
      interimResults: true,
      lang: 'auto',
      maxAlternatives: 1,
      ...config
    };
    
    this.recognition = null;
    this.isListening = false;
    this.isSupported = this.checkSupport();
    this.callbacks = {
      onResult: null,
      onError: null,
      onStart: null,
      onEnd: null,
      onSpeechStart: null,
      onSpeechEnd: null
    };
    
    this.silenceTimer = null;
    this.silenceThreshold = 3000; // 3秒静默后触发结束
    this.lastSpeechTime = 0;
  }

  // 检查浏览器支持
  checkSupport() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // 初始化语音识别
  init() {
    if (!this.isSupported) {
      throw new Error('当前浏览器不支持语音识别功能');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // 配置识别器
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;
    
    // 设置语言
    this.setLanguage(this.config.lang);
    
    // 绑定事件
    this.bindEvents();
    
    return this;
  }

  // 绑定事件监听器
  bindEvents() {
    if (!this.recognition) return;

    // 开始识别
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('语音识别已开始');
      this.callbacks.onStart?.();
    };

    // 识别结果
    this.recognition.onresult = (event) => {
      this.handleResult(event);
    };

    // 识别错误
    this.recognition.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      this.handleError(event);
    };

    // 识别结束
    this.recognition.onend = () => {
      this.isListening = false;
      console.log('语音识别已结束');
      this.callbacks.onEnd?.();
      
      // 如果配置为连续识别且没有手动停止，则重新开始
      if (this.config.continuous && this.shouldRestart) {
        setTimeout(() => {
          if (this.shouldRestart) {
            this.start();
          }
        }, 100);
      }
    };

    // 检测到语音开始
    this.recognition.onspeechstart = () => {
      this.lastSpeechTime = Date.now();
      this.clearSilenceTimer();
      console.log('检测到语音开始');
      this.callbacks.onSpeechStart?.();
    };

    // 检测到语音结束
    this.recognition.onspeechend = () => {
      console.log('语音结束');
      this.startSilenceTimer();
      this.callbacks.onSpeechEnd?.();
    };

    // 没有检测到语音
    this.recognition.onnomatch = () => {
      console.log('没有识别到有效语音');
    };

    // 音频开始
    this.recognition.onaudiostart = () => {
      console.log('音频捕获开始');
    };

    // 音频结束
    this.recognition.onaudioend = () => {
      console.log('音频捕获结束');
    };
  }

  // 处理识别结果
  handleResult(event) {
    let finalTranscript = '';
    let interimTranscript = '';
    let confidence = 0;

    // 处理所有结果
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      confidence = Math.max(confidence, result[0].confidence || 0);

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // 调用回调函数
    if (this.callbacks.onResult) {
      this.callbacks.onResult({
        finalTranscript: finalTranscript.trim(),
        interimTranscript: interimTranscript.trim(),
        confidence: confidence,
        isFinal: finalTranscript.length > 0,
        timestamp: Date.now()
      });
    }

    // 更新最后语音时间
    if (finalTranscript || interimTranscript) {
      this.lastSpeechTime = Date.now();
    }
  }

  // 处理错误
  handleError(event) {
    const errorMessages = {
      'no-speech': '没有检测到语音输入',
      'audio-capture': '音频捕获失败',
      'not-allowed': '麦克风权限被拒绝',
      'network': '网络连接错误',
      'service-not-allowed': '语音识别服务不可用',
      'bad-grammar': '语法错误',
      'language-not-supported': '不支持的语言'
    };

    const errorMessage = errorMessages[event.error] || `未知错误: ${event.error}`;
    
    if (this.callbacks.onError) {
      this.callbacks.onError({
        error: event.error,
        message: errorMessage,
        timestamp: Date.now()
      });
    }

    // 某些错误需要重新启动
    if (['no-speech', 'audio-capture'].includes(event.error) && this.config.continuous) {
      setTimeout(() => {
        if (this.shouldRestart) {
          this.start();
        }
      }, 1000);
    }
  }

  // 开始识别
  start() {
    if (!this.isSupported) {
      throw new Error('当前浏览器不支持语音识别功能');
    }

    if (!this.recognition) {
      this.init();
    }

    if (this.isListening) {
      console.warn('语音识别已在运行中');
      return;
    }

    try {
      this.shouldRestart = true;
      this.recognition.start();
    } catch (error) {
      console.error('启动语音识别失败:', error);
      throw error;
    }
  }

  // 停止识别
  stop() {
    this.shouldRestart = false;
    this.clearSilenceTimer();
    
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  // 中止识别
  abort() {
    this.shouldRestart = false;
    this.clearSilenceTimer();
    
    if (this.recognition) {
      this.recognition.abort();
    }
  }

  // 设置语言
  setLanguage(lang) {
    if (!this.recognition) return;
    
    const languageMap = {
      'auto': 'en-US', // 默认英语，实际会自动检测
      'zh': 'zh-CN',
      'en': 'en-US',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'es': 'es-ES',
      'ru': 'ru-RU'
    };
    
    const recognitionLang = languageMap[lang] || lang || 'en-US';
    this.recognition.lang = recognitionLang;
    this.config.lang = lang;
  }

  // 设置回调函数
  setCallback(event, callback) {
    if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase() + event.slice(1)}`)) {
      this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = callback;
    }
  }

  // 批量设置回调函数
  setCallbacks(callbacks) {
    Object.keys(callbacks).forEach(key => {
      if (this.callbacks.hasOwnProperty(`on${key.charAt(0).toUpperCase() + key.slice(1)}`)) {
        this.callbacks[`on${key.charAt(0).toUpperCase() + key.slice(1)}`] = callbacks[key];
      }
    });
  }

  // 更新配置
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.recognition) {
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
      this.setLanguage(this.config.lang);
    }
  }

  // 静默计时器
  startSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (Date.now() - this.lastSpeechTime > this.silenceThreshold) {
        console.log('检测到长时间静默，停止识别');
        this.stop();
      }
    }, this.silenceThreshold);
  }

  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  // 获取状态
  getStatus() {
    return {
      isSupported: this.isSupported,
      isListening: this.isListening,
      language: this.config.lang,
      continuous: this.config.continuous,
      lastSpeechTime: this.lastSpeechTime
    };
  }

  // 获取支持的语言
  getSupportedLanguages() {
    return {
      'zh': '中文 (zh-CN)',
      'en': '英语 (en-US)',
      'ja': '日语 (ja-JP)',
      'ko': '韩语 (ko-KR)',
      'fr': '法语 (fr-FR)',
      'de': '德语 (de-DE)',
      'es': '西班牙语 (es-ES)',
      'ru': '俄语 (ru-RU)'
    };
  }

  // 检查麦克风权限
  async checkMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return { granted: true };
    } catch (error) {
      return {
        granted: false,
        error: error.name,
        message: this.getPermissionErrorMessage(error.name)
      };
    }
  }

  // 获取权限错误信息
  getPermissionErrorMessage(errorName) {
    const messages = {
      'NotAllowedError': '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风',
      'NotFoundError': '未找到麦克风设备',
      'NotReadableError': '麦克风被其他应用占用',
      'OverconstrainedError': '麦克风不满足要求的约束条件',
      'SecurityError': '安全错误，请确保在HTTPS环境下使用',
      'TypeError': '类型错误，浏览器可能不支持此功能'
    };
    
    return messages[errorName] || '未知的麦克风权限错误';
  }

  // 销毁实例
  destroy() {
    this.stop();
    this.clearSilenceTimer();
    this.recognition = null;
    this.callbacks = {};
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.SpeechRecognizer = SpeechRecognizer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeechRecognizer;
}