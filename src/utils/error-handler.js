// 错误处理和通知模块

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.notificationContainer = null;
    this.init();
  }

  // 初始化
  init() {
    this.createNotificationContainer();
    this.setupGlobalErrorHandlers();
  }

  // 创建通知容器
  createNotificationContainer() {
    if (document.getElementById('voice-translator-notifications')) {
      return;
    }

    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'voice-translator-notifications';
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      pointer-events: none;
      font-family: 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif;
    `;
    
    document.body.appendChild(this.notificationContainer);
  }

  // 设置全局错误处理
  setupGlobalErrorHandlers() {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'unhandledrejection',
        error: event.reason,
        message: event.reason?.message || '未处理的Promise拒绝',
        stack: event.reason?.stack
      });
    });

    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });
  }

  // 主要错误处理方法
  handleError(errorInfo) {
    const error = this.normalizeError(errorInfo);
    
    // 记录错误
    this.logError(error);
    
    // 根据错误类型决定处理方式
    const severity = this.getErrorSeverity(error);
    
    if (severity === 'critical') {
      this.showNotification(error.message, 'error', 8000);
    } else if (severity === 'warning') {
      this.showNotification(error.message, 'warning', 5000);
    }
    
    // 发送错误报告（如果配置了）
    this.reportError(error);
    
    return error;
  }

  // 标准化错误对象
  normalizeError(errorInfo) {
    if (typeof errorInfo === 'string') {
      return {
        type: 'custom',
        message: errorInfo,
        timestamp: Date.now(),
        severity: 'warning'
      };
    }

    if (errorInfo instanceof Error) {
      return {
        type: 'javascript',
        message: errorInfo.message,
        stack: errorInfo.stack,
        name: errorInfo.name,
        timestamp: Date.now(),
        severity: 'error'
      };
    }

    return {
      type: errorInfo.type || 'unknown',
      message: errorInfo.message || '未知错误',
      stack: errorInfo.stack,
      filename: errorInfo.filename,
      lineno: errorInfo.lineno,
      colno: errorInfo.colno,
      timestamp: Date.now(),
      severity: errorInfo.severity || 'error',
      ...errorInfo
    };
  }

  // 获取错误严重程度
  getErrorSeverity(error) {
    // API相关错误
    if (error.message.includes('API') || error.message.includes('网络')) {
      return 'critical';
    }
    
    // 权限相关错误
    if (error.message.includes('权限') || error.message.includes('not-allowed')) {
      return 'critical';
    }
    
    // 配置相关错误
    if (error.message.includes('配置') || error.message.includes('密钥')) {
      return 'warning';
    }
    
    // 语音识别相关错误
    if (error.message.includes('语音') || error.message.includes('识别')) {
      return 'warning';
    }
    
    return 'error';
  }

  // 记录错误
  logError(error) {
    this.errorLog.push(error);
    
    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    // 控制台输出
    console.error('[VoiceTranslator Error]', error);
  }

  // 显示通知
  showNotification(message, type = 'info', duration = 5000) {
    if (!this.notificationContainer) {
      this.createNotificationContainer();
    }

    const notification = document.createElement('div');
    notification.className = `voice-translator-notification ${type}`;
    
    // 设置样式
    const styles = this.getNotificationStyles(type);
    notification.style.cssText = styles;
    
    // 设置内容
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">${this.getNotificationIcon(type)}</div>
        <div class="notification-message">${this.escapeHtml(message)}</div>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `;
    
    // 添加到容器
    this.notificationContainer.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
      this.hideNotification(notification);
    }, duration);
    
    return notification;
  }

  // 隐藏通知
  hideNotification(notification) {
    if (!notification || !notification.parentNode) return;
    
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // 获取通知样式
  getNotificationStyles(type) {
    const baseStyles = `
      margin-bottom: 10px;
      padding: 0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
      max-width: 400px;
      min-width: 300px;
    `;
    
    const typeStyles = {
      success: 'background: linear-gradient(135deg, #51cf66, #40c057);',
      error: 'background: linear-gradient(135deg, #ff6b6b, #fa5252);',
      warning: 'background: linear-gradient(135deg, #ffd43b, #fab005);',
      info: 'background: linear-gradient(135deg, #667eea, #764ba2);'
    };
    
    return baseStyles + (typeStyles[type] || typeStyles.info);
  }

  // 获取通知图标
  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    return icons[type] || icons.info;
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 特定错误处理方法
  handleNetworkError(error) {
    return this.handleError({
      type: 'network',
      message: '网络连接失败，请检查网络设置',
      originalError: error,
      severity: 'critical'
    });
  }

  handleApiError(error, apiName = 'API') {
    let message = `${apiName}调用失败`;
    
    if (error.message) {
      message += `: ${error.message}`;
    }
    
    return this.handleError({
      type: 'api',
      message: message,
      originalError: error,
      severity: 'critical'
    });
  }

  handlePermissionError(permission) {
    const messages = {
      microphone: '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风',
      tabCapture: '标签页音频捕获权限被拒绝',
      storage: '本地存储权限被拒绝'
    };
    
    return this.handleError({
      type: 'permission',
      message: messages[permission] || '权限被拒绝',
      severity: 'critical'
    });
  }

  handleConfigError(field) {
    return this.handleError({
      type: 'config',
      message: `配置错误: ${field}未正确设置`,
      severity: 'warning'
    });
  }

  // 错误恢复建议
  getRecoverySuggestion(error) {
    const suggestions = {
      'network': '请检查网络连接并重试',
      'permission': '请刷新页面并允许相关权限',
      'config': '请检查API配置是否正确',
      'api': '请稍后重试或检查API配额',
      'speech': '请检查麦克风设备并重新开始'
    };
    
    return suggestions[error.type] || '请刷新页面重试';
  }

  // 获取错误统计
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recent: this.errorLog.slice(-10)
    };
    
    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });
    
    return stats;
  }

  // 清除错误日志
  clearErrorLog() {
    this.errorLog = [];
  }

  // 导出错误日志
  exportErrorLog() {
    const data = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: this.errorLog
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-translator-errors-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  // 发送错误报告（可选）
  reportError(error) {
    // 这里可以实现错误报告功能
    // 例如发送到错误监控服务
    if (window.DEBUG_MODE) {
      console.log('Error report:', error);
    }
  }

  // 销毁实例
  destroy() {
    if (this.notificationContainer && this.notificationContainer.parentNode) {
      this.notificationContainer.parentNode.removeChild(this.notificationContainer);
    }
    this.errorLog = [];
  }
}

// 创建全局实例
const errorHandler = new ErrorHandler();

// 导出
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
  window.errorHandler = errorHandler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler, errorHandler };
}