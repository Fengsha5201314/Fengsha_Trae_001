// 配置管理模块

class ConfigManager {
  constructor() {
    this.defaultConfig = {
      appid: '',
      key: '',
      language: {
        from: 'auto',
        to: 'zh'
      },
      speech: {
        continuous: true,
        interimResults: true,
        lang: 'auto'
      },
      ui: {
        position: 'bottom-center',
        theme: 'dark',
        fontSize: 16,
        autoHide: true,
        hideDelay: 5000
      },
      advanced: {
        retryCount: 3,
        timeout: 10000,
        cacheEnabled: true,
        debugMode: false
      }
    };
  }

  // 获取配置
  async getConfig() {
    try {
      const result = await chrome.storage.local.get(['translatorConfig']);
      const config = result.translatorConfig || {};
      
      // 合并默认配置
      return this.mergeConfig(this.defaultConfig, config);
    } catch (error) {
      console.error('获取配置失败:', error);
      return this.defaultConfig;
    }
  }

  // 保存配置
  async saveConfig(config) {
    try {
      const mergedConfig = this.mergeConfig(this.defaultConfig, config);
      await chrome.storage.local.set({ translatorConfig: mergedConfig });
      return { success: true, config: mergedConfig };
    } catch (error) {
      console.error('保存配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新部分配置
  async updateConfig(partialConfig) {
    try {
      const currentConfig = await this.getConfig();
      const updatedConfig = this.mergeConfig(currentConfig, partialConfig);
      return await this.saveConfig(updatedConfig);
    } catch (error) {
      console.error('更新配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 重置配置
  async resetConfig() {
    try {
      await chrome.storage.local.remove(['translatorConfig']);
      return { success: true, config: this.defaultConfig };
    } catch (error) {
      console.error('重置配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 验证配置
  validateConfig(config) {
    const errors = [];

    // 验证必需的API配置
    if (!config.appid || typeof config.appid !== 'string') {
      errors.push('APP ID 不能为空');
    }

    if (!config.key || typeof config.key !== 'string') {
      errors.push('API密钥不能为空');
    }

    // 验证语言配置
    if (config.language) {
      const validLanguages = ['auto', 'en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
      if (!validLanguages.includes(config.language.from)) {
        errors.push('源语言配置无效');
      }
      if (!validLanguages.includes(config.language.to)) {
        errors.push('目标语言配置无效');
      }
    }

    // 验证UI配置
    if (config.ui) {
      if (config.ui.fontSize && (config.ui.fontSize < 12 || config.ui.fontSize > 24)) {
        errors.push('字体大小必须在12-24之间');
      }
      if (config.ui.hideDelay && (config.ui.hideDelay < 1000 || config.ui.hideDelay > 30000)) {
        errors.push('自动隐藏延迟必须在1-30秒之间');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // 深度合并配置对象
  mergeConfig(defaultConfig, userConfig) {
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (userConfig.hasOwnProperty(key)) {
        if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
          result[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
        } else {
          result[key] = userConfig[key];
        }
      }
    }
    
    return result;
  }

  // 导出配置
  async exportConfig() {
    try {
      const config = await this.getConfig();
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        config: config
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-translator-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      console.error('导出配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 导入配置
  async importConfig(file) {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.config) {
        throw new Error('无效的配置文件格式');
      }
      
      const validation = this.validateConfig(importData.config);
      if (!validation.isValid) {
        throw new Error('配置验证失败: ' + validation.errors.join(', '));
      }
      
      return await this.saveConfig(importData.config);
    } catch (error) {
      console.error('导入配置失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取配置摘要
  getConfigSummary(config) {
    return {
      hasApiConfig: !!(config.appid && config.key),
      languagePair: `${config.language.from} → ${config.language.to}`,
      theme: config.ui.theme,
      debugMode: config.advanced.debugMode
    };
  }
}

// 导出单例实例
if (typeof window !== 'undefined') {
  window.ConfigManager = ConfigManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigManager;
}