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

// 处理来自popup和content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, tabId, data } = message;
  
  switch (action) {
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