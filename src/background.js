// 后台服务脚本 - 管理音频捕获和消息通信

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('实时语音翻译插件已安装');
});

// 存储活动的音频流
let activeStreams = new Map();

// 开始音频捕获
async function startCapture(tabId) {
  try {
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });
    
    if (stream) {
      activeStreams.set(tabId, stream);
      console.log(`开始捕获标签页 ${tabId} 的音频`);
      return { success: true };
    }
  } catch (error) {
    console.error('音频捕获失败:', error);
    return { success: false, error: error.message };
  }
}

// 停止音频捕获
function stopCapture(tabId) {
  const stream = activeStreams.get(tabId);
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    activeStreams.delete(tabId);
    console.log(`停止捕获标签页 ${tabId} 的音频`);
    return { success: true };
  }
  return { success: false, error: '未找到活动的音频流' };
}

// 处理翻译请求 - 解决CORS问题
async function handleTranslateRequest(text, config) {
  const { appid, key } = config;
  
  if (!appid || !key) {
    return { success: false, error: '请先配置百度翻译API密钥' };
  }

  const salt = Date.now().toString();
  const sign = generateSign(appid, text, salt, key);
  
  const params = new URLSearchParams({
    q: text,
    from: 'auto',
    to: 'zh',
    appid: appid,
    salt: salt,
    sign: sign
  });

  try {
    const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error_code) {
      throw new Error(`API错误 ${data.error_code}: ${getErrorMessage(data.error_code)}`);
    }
    
    if (!data.trans_result || !data.trans_result[0]) {
      throw new Error('翻译结果格式错误');
    }
    
    return {
      success: true,
      result: {
        originalText: text,
        translatedText: data.trans_result[0].dst,
        detectedLanguage: data.from || 'auto',
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('翻译请求失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 生成百度翻译API签名
function generateSign(appid, query, salt, key) {
  const str = appid + query + salt + key;
  return md5(str);
}

// MD5哈希函数
function md5(string) {
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
    let WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValue_temp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
    }
    return WordToHexValue;
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

// 获取错误信息
function getErrorMessage(errorCode) {
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
  
  return errorMessages[errorCode] || `未知错误 (${errorCode})`;
}

// 处理来自popup和content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, tabId, data } = message;
  
  switch (action) {
    case 'PING':
      // 扩展状态检测
      sendResponse({ success: true, message: 'Extension is active' });
      break;
      
    case 'START_CAPTURE':
      startCapture(tabId).then(sendResponse);
      return true; // 异步响应
      
    case 'STOP_CAPTURE':
      sendResponse(stopCapture(tabId));
      break;
      
    case 'SAVE_CONFIG':
      saveConfig(data).then(sendResponse);
      return true;
      
    case 'GET_CONFIG':
      getConfig().then(sendResponse);
      return true;
      
    case 'TRANSLATE_TEXT':
      handleTranslateRequest(data.text, data.config).then(sendResponse);
      return true;
      
    default:
      sendResponse({ success: false, error: '未知操作' });
  }
});

// 保存配置到本地存储
async function saveConfig(config) {
  try {
    await chrome.storage.local.set({ translatorConfig: config });
    return { success: true };
  } catch (error) {
    console.error('保存配置失败:', error);
    return { success: false, error: error.message };
  }
}

// 获取配置
async function getConfig() {
  try {
    const result = await chrome.storage.local.get(['translatorConfig']);
    return { success: true, config: result.translatorConfig || {} };
  } catch (error) {
    console.error('获取配置失败:', error);
    return { success: false, error: error.message };
  }
}

// 标签页关闭时清理资源
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeStreams.has(tabId)) {
    stopCapture(tabId);
  }
});