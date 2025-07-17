#!/usr/bin/env node

/**
 * 开发脚本 - 用于开发模式的文件监听和自动重载
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');

// 项目根目录
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 工具函数
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  try {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    return true;
  } catch (error) {
    logError(`Failed to copy ${src} to ${dest}: ${error.message}`);
    return false;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 初始构建
function initialBuild() {
  log('🚀 Starting initial build...', 'bright');
  
  try {
    // 运行构建脚本
    execSync('node scripts/build.js', { 
      cwd: ROOT_DIR, 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    
    logSuccess('Initial build completed');
    return true;
  } catch (error) {
    logError('Initial build failed');
    return false;
  }
}

// 增量更新文件
function updateFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  
  // 确定目标路径
  let destPath;
  
  if (relativePath.startsWith('src/')) {
    destPath = path.join(DIST_DIR, relativePath);
  } else if (relativePath === 'manifest.json') {
    destPath = path.join(DIST_DIR, 'manifest.json');
  } else if (relativePath.startsWith('icons/')) {
    destPath = path.join(DIST_DIR, relativePath);
  } else {
    // 不需要更新的文件
    return;
  }
  
  if (copyFile(filePath, destPath)) {
    logSuccess(`Updated: ${relativePath}`);
    
    // 如果是manifest.json，提示重新加载扩展
    if (relativePath === 'manifest.json') {
      logWarning('manifest.json changed - please reload the extension in Chrome');
    }
    
    // 如果是background.js，提示重新加载扩展
    if (relativePath === 'src/background.js') {
      logWarning('background.js changed - please reload the extension in Chrome');
    }
  }
}

// 删除文件
function removeFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  
  let destPath;
  if (relativePath.startsWith('src/')) {
    destPath = path.join(DIST_DIR, relativePath);
  } else if (relativePath === 'manifest.json') {
    destPath = path.join(DIST_DIR, 'manifest.json');
  } else if (relativePath.startsWith('icons/')) {
    destPath = path.join(DIST_DIR, relativePath);
  } else {
    return;
  }
  
  try {
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
      logInfo(`Removed: ${relativePath}`);
    }
  } catch (error) {
    logError(`Failed to remove ${destPath}: ${error.message}`);
  }
}

// 运行ESLint检查
function runLint(filePath) {
  if (!filePath.endsWith('.js')) return;
  
  try {
    execSync(`npx eslint "${filePath}"`, { 
      cwd: ROOT_DIR,
      stdio: 'pipe'
    });
    logSuccess(`Lint passed: ${path.relative(ROOT_DIR, filePath)}`);
  } catch (error) {
    const output = error.stdout ? error.stdout.toString() : error.message;
    if (output.trim()) {
      logWarning(`Lint issues in ${path.relative(ROOT_DIR, filePath)}:`);
      console.log(output);
    }
  }
}

// 创建防抖的更新函数
const debouncedUpdate = debounce((filePath) => {
  updateFile(filePath);
  runLint(filePath);
}, 100);

const debouncedRemove = debounce((filePath) => {
  removeFile(filePath);
}, 100);

// 设置文件监听
function setupWatcher() {
  log('👀 Setting up file watcher...', 'bright');
  
  // 监听的文件模式
  const watchPatterns = [
    'src/**/*',
    'manifest.json',
    'icons/**/*'
  ];
  
  // 忽略的文件模式
  const ignorePatterns = [
    'node_modules/**',
    'dist/**',
    '.git/**',
    '**/*.log',
    '**/*.tmp',
    '**/.DS_Store'
  ];
  
  const watcher = chokidar.watch(watchPatterns, {
    cwd: ROOT_DIR,
    ignored: ignorePatterns,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });
  
  // 文件变化事件
  watcher.on('change', (relativePath) => {
    const fullPath = path.join(ROOT_DIR, relativePath);
    log(`📝 Changed: ${relativePath}`, 'yellow');
    debouncedUpdate(fullPath);
  });
  
  // 文件添加事件
  watcher.on('add', (relativePath) => {
    const fullPath = path.join(ROOT_DIR, relativePath);
    log(`➕ Added: ${relativePath}`, 'green');
    debouncedUpdate(fullPath);
  });
  
  // 文件删除事件
  watcher.on('unlink', (relativePath) => {
    const fullPath = path.join(ROOT_DIR, relativePath);
    log(`🗑️  Removed: ${relativePath}`, 'red');
    debouncedRemove(fullPath);
  });
  
  // 监听器就绪
  watcher.on('ready', () => {
    logSuccess('File watcher is ready');
    log('', 'reset');
    log('📋 Development server is running:', 'bright');
    log('  • File changes will be automatically synced to dist/', 'blue');
    log('  • ESLint will check JavaScript files on change', 'blue');
    log('  • Reload the extension in Chrome when prompted', 'blue');
    log('', 'reset');
    log('💡 Tips:', 'bright');
    log('  • Press Ctrl+C to stop the development server', 'cyan');
    log('  • Use Chrome DevTools to debug the extension', 'cyan');
    log('  • Check the console for any runtime errors', 'cyan');
    log('', 'reset');
  });
  
  // 错误处理
  watcher.on('error', (error) => {
    logError(`Watcher error: ${error.message}`);
  });
  
  return watcher;
}

// 显示开发指南
function showDevGuide() {
  log('', 'reset');
  log('🔧 Development Guide:', 'bright');
  log('', 'reset');
  log('1. Loading the extension:', 'bright');
  log('   • Open Chrome and go to chrome://extensions/', 'blue');
  log('   • Enable "Developer mode" (top right toggle)', 'blue');
  log('   • Click "Load unpacked" and select the dist/ folder', 'blue');
  log('', 'reset');
  log('2. Making changes:', 'bright');
  log('   • Edit files in src/ directory', 'blue');
  log('   • Changes will be automatically copied to dist/', 'blue');
  log('   • Reload the extension when prompted', 'blue');
  log('', 'reset');
  log('3. Debugging:', 'bright');
  log('   • Right-click extension icon → "Inspect popup"', 'blue');
  log('   • Go to chrome://extensions/ → "background page"', 'blue');
  log('   • Use console.log() in your code for debugging', 'blue');
  log('', 'reset');
  log('4. Testing:', 'bright');
  log('   • Test on different websites', 'blue');
  log('   • Check browser console for errors', 'blue');
  log('   • Verify permissions are working correctly', 'blue');
  log('', 'reset');
}

// 清理函数
function cleanup(watcher) {
  log('🧹 Cleaning up...', 'yellow');
  
  if (watcher) {
    watcher.close();
  }
  
  logSuccess('Development server stopped');
  process.exit(0);
}

// 主开发函数
function startDev() {
  log('🚀 Starting development server...', 'bright');
  log('', 'reset');
  
  // 检查依赖
  try {
    require('chokidar');
  } catch (error) {
    logError('chokidar is not installed. Please run: npm install chokidar --save-dev');
    process.exit(1);
  }
  
  // 初始构建
  if (!initialBuild()) {
    logError('Failed to complete initial build');
    process.exit(1);
  }
  
  // 设置文件监听
  const watcher = setupWatcher();
  
  // 显示开发指南
  setTimeout(showDevGuide, 1000);
  
  // 处理退出信号
  process.on('SIGINT', () => cleanup(watcher));
  process.on('SIGTERM', () => cleanup(watcher));
  process.on('exit', () => cleanup(watcher));
  
  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    logError(`Uncaught exception: ${error.message}`);
    cleanup(watcher);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logError(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    cleanup(watcher);
  });
}

// 运行开发服务器
if (require.main === module) {
  startDev();
}

module.exports = { startDev };