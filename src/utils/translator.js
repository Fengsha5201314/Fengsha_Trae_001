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

  // 调用百度翻译API - 通过background script解决CORS问题
  async callTranslationAPI(text, from, to) {
    const { appid, key, corsProxy } = this.config;
    
    if (!appid || !key) {
      throw new Error('请先配置百度翻译API密钥');
    }

    let lastError;
    
    // 重试机制
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const result = await this.sendMessageToBackground({
          action: 'TRANSLATE_TEXT',
          data: {
            text: text,
            config: {
              appid: appid,
              key: key,
              corsProxy: corsProxy
            }
          }
        });
        
        if (result.success) {
          return {
            originalText: text,
            translatedText: result.result.translatedText,
            detectedLanguage: result.result.detectedLanguage,
            fromLanguage: from,
            toLanguage: to,
            cached: false,
            timestamp: result.result.timestamp
          };
        } else {
          throw new Error(result.error);
        }
        
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

  // 发送消息到background script
  async sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } else {
        reject(new Error('Chrome扩展环境不可用'));
      }
    });
  }

  // 生成百度翻译API签名
  generateSign(appid, query, salt, key) {
    const str = appid + query + salt + key;
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