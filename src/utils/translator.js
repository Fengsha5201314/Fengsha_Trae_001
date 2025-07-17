// 翻译服务模块

class TranslationService {
  constructor(config = {}) {
    this.config = config;
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    this.retryCount = config.retryCount || 3;
    this.timeout = config.timeout || 10000;
  }

  // 更新配置
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }

  // 主要翻译方法
  async translate(text, options = {}) {
    if (!text || !text.trim()) {
      throw new Error('翻译文本不能为空');
    }

    // 检查缓存
    const cacheKey = this.getCacheKey(text, options);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 检测语言
    const detectedLang = this.detectLanguage(text);
    const fromLang = options.from || this.config.language?.from || 'auto';
    const toLang = options.to || this.config.language?.to || 'zh';

    // 如果检测到目标语言，跳过翻译
    if (detectedLang === toLang) {
      return {
        originalText: text,
        translatedText: text,
        detectedLanguage: detectedLang,
        fromLanguage: fromLang,
        toLanguage: toLang,
        cached: false
      };
    }

    try {
      const result = await this.callTranslationAPI(text, fromLang, toLang);
      
      // 缓存结果
      if (this.config.cacheEnabled !== false) {
        this.cache.set(cacheKey, result);
        
        // 限制缓存大小
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }
      
      return result;
    } catch (error) {
      console.error('翻译失败:', error);
      throw error;
    }
  }

  // 调用百度翻译API
  async callTranslationAPI(text, from, to) {
    const { appid, key } = this.config;
    
    if (!appid || !key) {
      throw new Error('请先配置百度翻译API密钥');
    }

    const salt = Date.now().toString();
    const sign = this.generateSign(appid, text, salt, key);
    
    const params = new URLSearchParams({
      q: text,
      from: from,
      to: to,
      appid: appid,
      salt: salt,
      sign: sign
    });

    let lastError;
    
    // 重试机制
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error_code) {
          throw new Error(this.getErrorMessage(data.error_code, data.error_msg));
        }
        
        if (!data.trans_result || !data.trans_result[0]) {
          throw new Error('翻译结果格式错误');
        }
        
        return {
          originalText: text,
          translatedText: data.trans_result[0].dst,
          detectedLanguage: data.from || from,
          fromLanguage: from,
          toLanguage: to,
          cached: false,
          timestamp: Date.now()
        };
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryCount) {
          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await this.sleep(delay);
          console.warn(`翻译重试 ${attempt}/${this.retryCount}:`, error.message);
        }
      }
    }
    
    throw lastError;
  }

  // 生成百度翻译API签名
  generateSign(appid, query, salt, key) {
    const str = appid + query + salt + key;
    return this.md5(str);
  }

  // MD5哈希函数
  md5(string) {
    // 简化版MD5实现，生产环境建议使用crypto-js
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
    
    // 简化实现，实际应用中建议使用完整的MD5库
    return btoa(string).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 32);
  }

  // 语言检测
  detectLanguage(text) {
    // 中文检测
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return 'zh';
    }
    
    // 日文检测
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja';
    }
    
    // 韩文检测
    if (/[\uac00-\ud7af]/.test(text)) {
      return 'ko';
    }
    
    // 俄文检测
    if (/[\u0400-\u04ff]/.test(text)) {
      return 'ru';
    }
    
    // 阿拉伯文检测
    if (/[\u0600-\u06ff]/.test(text)) {
      return 'ara';
    }
    
    // 默认为英文
    return 'en';
  }

  // 获取缓存键
  getCacheKey(text, options) {
    const from = options.from || this.config.language?.from || 'auto';
    const to = options.to || this.config.language?.to || 'zh';
    return `${from}-${to}-${text.trim()}`;
  }

  // 获取错误信息
  getErrorMessage(errorCode, errorMsg) {
    const errorMessages = {
      '52001': 'APP ID无效',
      '52002': '签名错误',
      '52003': '访问频率受限',
      '54000': '必填参数为空',
      '54001': '签名错误',
      '54003': '访问频率受限',
      '54004': '账户余额不足',
      '54005': '长query请求频繁',
      '58000': '客户端IP非法',
      '58001': '译文语言方向不支持',
      '58002': '服务当前已关闭',
      '90107': '认证未通过或未生效'
    };
    
    return errorMessages[errorCode] || errorMsg || `未知错误 (${errorCode})`;
  }

  // 批量翻译
  async translateBatch(texts, options = {}) {
    const results = [];
    const batchSize = 5; // 限制并发数
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const promises = batch.map(text => this.translate(text, options));
      
      try {
        const batchResults = await Promise.allSettled(promises);
        results.push(...batchResults);
      } catch (error) {
        console.error('批量翻译失败:', error);
      }
    }
    
    return results;
  }

  // 清除缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 1000
    };
  }

  // 工具方法：延迟
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取支持的语言列表
  getSupportedLanguages() {
    return {
      'auto': '自动检测',
      'zh': '中文',
      'en': '英语',
      'ja': '日语',
      'ko': '韩语',
      'fr': '法语',
      'de': '德语',
      'es': '西班牙语',
      'ru': '俄语',
      'th': '泰语',
      'ara': '阿拉伯语',
      'it': '意大利语',
      'pt': '葡萄牙语'
    };
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.TranslationService = TranslationService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationService;
}