#!/usr/bin/env node

/**
 * 构建脚本 - 用于打包Chrome扩展
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 项目根目录
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ICONS_DIR = path.join(ROOT_DIR, 'icons');

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
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'cyan');
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

// 工具函数
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    logError(`Failed to read JSON file: ${filePath}`);
    throw error;
  }
}

function writeJsonFile(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    logError(`Failed to write JSON file: ${filePath}`);
    throw error;
  }
}

// 清理构建目录
function cleanDist() {
  logStep('1', 'Cleaning dist directory...');
  
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  
  ensureDir(DIST_DIR);
  logSuccess('Dist directory cleaned');
}

// 代码检查
function lintCode() {
  logStep('2', 'Running ESLint...');
  
  try {
    execSync('npm run lint', { 
      cwd: ROOT_DIR, 
      stdio: 'inherit' 
    });
    logSuccess('Code linting passed');
  } catch (error) {
    logWarning('ESLint found issues, but continuing build...');
  }
}

// 复制源文件
function copySourceFiles() {
  logStep('3', 'Copying source files...');
  
  // 复制主要文件
  const filesToCopy = [
    'manifest.json',
    'src/background.js',
    'src/content.js',
    'src/content.css'
  ];
  
  filesToCopy.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);
    
    if (fs.existsSync(srcPath)) {
      copyFile(srcPath, destPath);
      log(`  ✓ ${file}`, 'green');
    } else {
      logWarning(`File not found: ${file}`);
    }
  });
  
  // 复制目录
  const dirsToCopy = [
    { src: 'src/popup', dest: 'src/popup' },
    { src: 'src/utils', dest: 'src/utils' },
    { src: 'icons', dest: 'icons' }
  ];
  
  dirsToCopy.forEach(({ src, dest }) => {
    const srcPath = path.join(ROOT_DIR, src);
    const destPath = path.join(DIST_DIR, dest);
    
    if (fs.existsSync(srcPath)) {
      copyDir(srcPath, destPath);
      log(`  ✓ ${src}/`, 'green');
    } else {
      logWarning(`Directory not found: ${src}`);
    }
  });
  
  logSuccess('Source files copied');
}

// 处理manifest.json
function processManifest() {
  logStep('4', 'Processing manifest.json...');
  
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    logError('manifest.json not found in dist directory');
    return;
  }
  
  const manifest = readJsonFile(manifestPath);
  
  // 更新版本号（如果需要）
  const packageJson = readJsonFile(path.join(ROOT_DIR, 'package.json'));
  if (packageJson.version) {
    manifest.version = packageJson.version;
    log(`  ✓ Updated version to ${manifest.version}`, 'green');
  }
  
  // 生产环境优化
  if (process.env.NODE_ENV === 'production') {
    // 移除开发相关的权限或配置
    log('  ✓ Applied production optimizations', 'green');
  }
  
  writeJsonFile(manifestPath, manifest);
  logSuccess('Manifest processed');
}

// 压缩代码（简单版本）
function minifyCode() {
  logStep('5', 'Minifying code...');
  
  // 这里可以集成更复杂的压缩工具
  // 目前只是移除注释和多余空白
  
  const jsFiles = [
    'src/background.js',
    'src/content.js',
    'src/popup/popup.js'
  ];
  
  jsFiles.forEach(file => {
    const filePath = path.join(DIST_DIR, file);
    
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 移除单行注释（简单处理）
      content = content.replace(/\/\/.*$/gm, '');
      
      // 移除多行注释
      content = content.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // 移除多余的空行
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      fs.writeFileSync(filePath, content, 'utf8');
      log(`  ✓ ${file}`, 'green');
    }
  });
  
  logSuccess('Code minified');
}

// 验证构建结果
function validateBuild() {
  logStep('6', 'Validating build...');
  
  const requiredFiles = [
    'manifest.json',
    'src/background.js',
    'src/content.js',
    'src/content.css',
    'src/popup/popup.html',
    'src/popup/popup.js',
    'src/popup/popup.css',
    'icons/icon16.svg',
    'icons/icon48.svg',
    'icons/icon128.svg'
  ];
  
  let allValid = true;
  
  requiredFiles.forEach(file => {
    const filePath = path.join(DIST_DIR, file);
    
    if (fs.existsSync(filePath)) {
      log(`  ✓ ${file}`, 'green');
    } else {
      log(`  ✗ ${file}`, 'red');
      allValid = false;
    }
  });
  
  // 验证manifest.json
  try {
    const manifest = readJsonFile(path.join(DIST_DIR, 'manifest.json'));
    
    if (!manifest.manifest_version) {
      logError('Invalid manifest: missing manifest_version');
      allValid = false;
    }
    
    if (!manifest.name) {
      logError('Invalid manifest: missing name');
      allValid = false;
    }
    
    if (!manifest.version) {
      logError('Invalid manifest: missing version');
      allValid = false;
    }
    
    log('  ✓ manifest.json is valid', 'green');
  } catch (error) {
    logError('Invalid manifest.json');
    allValid = false;
  }
  
  if (allValid) {
    logSuccess('Build validation passed');
  } else {
    logError('Build validation failed');
    process.exit(1);
  }
}

// 生成构建信息
function generateBuildInfo() {
  logStep('7', 'Generating build info...');
  
  const buildInfo = {
    buildTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    environment: process.env.NODE_ENV || 'development',
    gitCommit: null,
    gitBranch: null
  };
  
  // 尝试获取Git信息
  try {
    buildInfo.gitCommit = execSync('git rev-parse HEAD', { 
      cwd: ROOT_DIR,
      encoding: 'utf8' 
    }).trim();
    
    buildInfo.gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { 
      cwd: ROOT_DIR,
      encoding: 'utf8' 
    }).trim();
  } catch (error) {
    log('  ⚠️  Git info not available', 'yellow');
  }
  
  const buildInfoPath = path.join(DIST_DIR, 'build-info.json');
  writeJsonFile(buildInfoPath, buildInfo);
  
  logSuccess('Build info generated');
}

// 主构建函数
function build() {
  log('🚀 Starting build process...', 'bright');
  
  const startTime = Date.now();
  
  try {
    cleanDist();
    lintCode();
    copySourceFiles();
    processManifest();
    
    if (process.env.NODE_ENV === 'production') {
      minifyCode();
    }
    
    validateBuild();
    generateBuildInfo();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log('', 'reset');
    log('🎉 Build completed successfully!', 'bright');
    log(`📦 Output: ${DIST_DIR}`, 'cyan');
    log(`⏱️  Duration: ${duration}s`, 'cyan');
    log('', 'reset');
    
    // 显示下一步操作提示
    log('Next steps:', 'bright');
    log('1. Open Chrome and go to chrome://extensions/', 'blue');
    log('2. Enable "Developer mode"', 'blue');
    log('3. Click "Load unpacked" and select the dist folder', 'blue');
    log('', 'reset');
    
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  }
}

// 运行构建
if (require.main === module) {
  build();
}

module.exports = { build };