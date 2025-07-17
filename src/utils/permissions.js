// 权限管理模块

class PermissionManager {
  constructor() {
    this.permissions = {
      microphone: false,
      tabCapture: false,
      storage: true // 通常默认可用
    };
    this.callbacks = {};
    this.checkInterval = null;
  }

  // 初始化权限检查
  async init() {
    await this.checkAllPermissions();
    this.startPeriodicCheck();
    return this.permissions;
  }

  // 检查所有权限
  async checkAllPermissions() {
    const results = await Promise.allSettled([
      this.checkMicrophonePermission(),
      this.checkTabCapturePermission(),
      this.checkStoragePermission()
    ]);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const permissionNames = ['microphone', 'tabCapture', 'storage'];
        this.permissions[permissionNames[index]] = result.value;
      }
    });

    this.notifyPermissionChange();
    return this.permissions;
  }

  // 检查麦克风权限
  async checkMicrophonePermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('MediaDevices API not supported');
        return false;
      }

      // 检查权限状态
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        if (permission.state === 'denied') {
          return false;
        }
        if (permission.state === 'granted') {
          return true;
        }
      }

      // 尝试获取媒体流来测试权限
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false 
        });
        
        // 立即停止流
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          return false;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    }
  }

  // 检查标签页捕获权限
  async checkTabCapturePermission() {
    try {
      if (!chrome || !chrome.tabCapture) {
        return false;
      }

      return new Promise((resolve) => {
        chrome.tabCapture.getCaptureInfo((info) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error checking tabCapture permission:', error);
      return false;
    }
  }

  // 检查存储权限
  async checkStoragePermission() {
    try {
      if (!chrome || !chrome.storage) {
        return false;
      }

      return new Promise((resolve) => {
        chrome.storage.local.get(['test'], (result) => {
          if (chrome.runtime.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error checking storage permission:', error);
      return false;
    }
  }

  // 请求麦克风权限
  async requestMicrophonePermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false 
      });
      
      // 立即停止流
      stream.getTracks().forEach(track => track.stop());
      
      this.permissions.microphone = true;
      this.notifyPermissionChange('microphone', true);
      
      return true;
    } catch (error) {
      this.permissions.microphone = false;
      this.notifyPermissionChange('microphone', false);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      } else if (error.name === 'NotFoundError') {
        throw new Error('未找到麦克风设备');
      } else if (error.name === 'NotReadableError') {
        throw new Error('麦克风设备被其他应用占用');
      } else {
        throw new Error(`麦克风权限请求失败: ${error.message}`);
      }
    }
  }

  // 请求标签页捕获权限
  async requestTabCapturePermission(tabId) {
    try {
      if (!chrome || !chrome.tabCapture) {
        throw new Error('TabCapture API not available');
      }

      return new Promise((resolve, reject) => {
        chrome.tabCapture.capture({
          audio: true,
          video: false
        }, (stream) => {
          if (chrome.runtime.lastError) {
            this.permissions.tabCapture = false;
            this.notifyPermissionChange('tabCapture', false);
            reject(new Error(`标签页音频捕获失败: ${chrome.runtime.lastError.message}`));
          } else {
            this.permissions.tabCapture = true;
            this.notifyPermissionChange('tabCapture', true);
            resolve(stream);
          }
        });
      });
    } catch (error) {
      this.permissions.tabCapture = false;
      this.notifyPermissionChange('tabCapture', false);
      throw error;
    }
  }

  // 检查是否有所需权限
  hasPermission(permission) {
    return this.permissions[permission] === true;
  }

  // 检查是否有所有必需权限
  hasAllRequiredPermissions() {
    return this.permissions.microphone && this.permissions.storage;
  }

  // 获取缺失的权限
  getMissingPermissions() {
    const missing = [];
    
    Object.keys(this.permissions).forEach(permission => {
      if (!this.permissions[permission]) {
        missing.push(permission);
      }
    });
    
    return missing;
  }

  // 获取权限状态描述
  getPermissionStatus() {
    const status = {
      microphone: {
        granted: this.permissions.microphone,
        required: true,
        description: '麦克风权限用于语音识别'
      },
      tabCapture: {
        granted: this.permissions.tabCapture,
        required: false,
        description: '标签页音频捕获用于页面音频翻译'
      },
      storage: {
        granted: this.permissions.storage,
        required: true,
        description: '本地存储用于保存配置'
      }
    };
    
    return status;
  }

  // 生成权限请求指南
  getPermissionGuide() {
    const guide = {
      microphone: {
        title: '麦克风权限',
        steps: [
          '点击地址栏左侧的锁形图标',
          '在弹出菜单中找到"麦克风"选项',
          '选择"允许"',
          '刷新页面'
        ],
        troubleshooting: [
          '确保麦克风设备已连接',
          '检查系统音频设置',
          '尝试在其他网站测试麦克风',
          '重启浏览器'
        ]
      },
      tabCapture: {
        title: '标签页音频捕获',
        steps: [
          '确保扩展已安装并启用',
          '检查扩展权限设置',
          '重新加载扩展'
        ],
        troubleshooting: [
          '检查Chrome扩展管理页面',
          '确保扩展有足够权限',
          '尝试重新安装扩展'
        ]
      },
      storage: {
        title: '本地存储',
        steps: [
          '检查浏览器存储设置',
          '清除浏览器缓存',
          '重启浏览器'
        ],
        troubleshooting: [
          '检查是否启用了隐私模式',
          '确保有足够的存储空间',
          '检查浏览器安全设置'
        ]
      }
    };
    
    return guide;
  }

  // 注册权限变化回调
  onPermissionChange(callback) {
    const id = Date.now() + Math.random();
    this.callbacks[id] = callback;
    return id;
  }

  // 移除权限变化回调
  removePermissionChangeListener(id) {
    delete this.callbacks[id];
  }

  // 通知权限变化
  notifyPermissionChange(permission = null, granted = null) {
    const data = {
      permissions: { ...this.permissions },
      changedPermission: permission,
      granted: granted,
      timestamp: Date.now()
    };
    
    Object.values(this.callbacks).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in permission change callback:', error);
      }
    });
  }

  // 开始定期检查权限
  startPeriodicCheck(interval = 30000) {
    this.stopPeriodicCheck();
    
    this.checkInterval = setInterval(async () => {
      const oldPermissions = { ...this.permissions };
      await this.checkAllPermissions();
      
      // 检查是否有变化
      const hasChanges = Object.keys(this.permissions).some(
        key => oldPermissions[key] !== this.permissions[key]
      );
      
      if (hasChanges) {
        console.log('Permission status changed:', this.permissions);
      }
    }, interval);
  }

  // 停止定期检查
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // 重置权限状态
  resetPermissions() {
    this.permissions = {
      microphone: false,
      tabCapture: false,
      storage: false
    };
    this.notifyPermissionChange();
  }

  // 获取浏览器兼容性信息
  getBrowserCompatibility() {
    const compatibility = {
      mediaDevices: !!navigator.mediaDevices,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      chromeExtensions: !!(window.chrome && chrome.runtime),
      tabCapture: !!(window.chrome && chrome.tabCapture),
      storage: !!(window.chrome && chrome.storage),
      permissions: !!navigator.permissions
    };
    
    return compatibility;
  }

  // 生成兼容性报告
  getCompatibilityReport() {
    const compatibility = this.getBrowserCompatibility();
    const report = {
      browser: this.getBrowserInfo(),
      features: compatibility,
      recommendations: []
    };
    
    if (!compatibility.mediaDevices) {
      report.recommendations.push('浏览器不支持MediaDevices API，请升级浏览器');
    }
    
    if (!compatibility.speechRecognition) {
      report.recommendations.push('浏览器不支持语音识别API，请使用Chrome浏览器');
    }
    
    if (!compatibility.chromeExtensions) {
      report.recommendations.push('请在Chrome浏览器中使用此扩展');
    }
    
    return report;
  }

  // 获取浏览器信息
  getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';
    
    if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      if (match) version = match[1];
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      if (match) version = match[1];
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      if (match) version = match[1];
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      if (match) version = match[1];
    }
    
    return { browser, version, userAgent };
  }

  // 销毁实例
  destroy() {
    this.stopPeriodicCheck();
    this.callbacks = {};
    this.permissions = {};
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.PermissionManager = PermissionManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PermissionManager;
}