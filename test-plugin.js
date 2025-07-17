// 翻译插件基础功能测试
const fs = require('fs');
const path = require('path');

// MD5哈希函数
function md5(string) {
    function rotateLeft(value, amount) {
        return (value << amount) | (value >>> (32 - amount));
    }
    
    function addUnsigned(x, y) {
        const lsw = (x & 0xFFFF) + (y & 0xFFFF);
        const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }
    
    function md5cmn(q, a, b, x, s, t) {
        return addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, q), addUnsigned(x, t)), s), b);
    }
    
    function md5ff(a, b, c, d, x, s, t) {
        return md5cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    
    function md5gg(a, b, c, d, x, s, t) {
        return md5cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    
    function md5hh(a, b, c, d, x, s, t) {
        return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }
    
    function md5ii(a, b, c, d, x, s, t) {
        return md5cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
    
    function convertToWordArray(string) {
        let wordArray = [];
        let wordCount = 0;
        for (let i = 0; i < string.length; i++) {
            wordArray[wordCount >>> 2] |= (string.charCodeAt(i) & 0xFF) << ((wordCount % 4) * 8);
            wordCount++;
        }
        return { words: wordArray, sigBytes: wordCount };
    }
    
    function wordArrayToHex(wordArray) {
        const hexChars = '0123456789abcdef';
        let hex = '';
        for (let i = 0; i < wordArray.sigBytes; i++) {
            const bite = (wordArray.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            hex += hexChars.charAt((bite >>> 4) & 0x0f) + hexChars.charAt(bite & 0x0f);
        }
        return hex;
    }
    
    const wordArray = convertToWordArray(string);
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    
    words[sigBytes >>> 2] |= 0x80 << (24 - (sigBytes % 4) * 8);
    words[(((sigBytes + 8) >>> 6) + 1) * 16 - 1] = sigBytes * 8;
    
    let a = 0x67452301;
    let b = 0xEFCDAB89;
    let c = 0x98BADCFE;
    let d = 0x10325476;
    
    for (let i = 0; i < words.length; i += 16) {
        const olda = a;
        const oldb = b;
        const oldc = c;
        const oldd = d;
        
        a = md5ff(a, b, c, d, words[i] || 0, 7, 0xD76AA478);
        d = md5ff(d, a, b, c, words[i + 1] || 0, 12, 0xE8C7B756);
        c = md5ff(c, d, a, b, words[i + 2] || 0, 17, 0x242070DB);
        b = md5ff(b, c, d, a, words[i + 3] || 0, 22, 0xC1BDCEEE);
        a = md5ff(a, b, c, d, words[i + 4] || 0, 7, 0xF57C0FAF);
        d = md5ff(d, a, b, c, words[i + 5] || 0, 12, 0x4787C62A);
        c = md5ff(c, d, a, b, words[i + 6] || 0, 17, 0xA8304613);
        b = md5ff(b, c, d, a, words[i + 7] || 0, 22, 0xFD469501);
        a = md5ff(a, b, c, d, words[i + 8] || 0, 7, 0x698098D8);
        d = md5ff(d, a, b, c, words[i + 9] || 0, 12, 0x8B44F7AF);
        c = md5ff(c, d, a, b, words[i + 10] || 0, 17, 0xFFFF5BB1);
        b = md5ff(b, c, d, a, words[i + 11] || 0, 22, 0x895CD7BE);
        a = md5ff(a, b, c, d, words[i + 12] || 0, 7, 0x6B901122);
        d = md5ff(d, a, b, c, words[i + 13] || 0, 12, 0xFD987193);
        c = md5ff(c, d, a, b, words[i + 14] || 0, 17, 0xA679438E);
        b = md5ff(b, c, d, a, words[i + 15] || 0, 22, 0x49B40821);
        
        a = md5gg(a, b, c, d, words[i + 1] || 0, 5, 0xF61E2562);
        d = md5gg(d, a, b, c, words[i + 6] || 0, 9, 0xC040B340);
        c = md5gg(c, d, a, b, words[i + 11] || 0, 14, 0x265E5A51);
        b = md5gg(b, c, d, a, words[i] || 0, 20, 0xE9B6C7AA);
        a = md5gg(a, b, c, d, words[i + 5] || 0, 5, 0xD62F105D);
        d = md5gg(d, a, b, c, words[i + 10] || 0, 9, 0x02441453);
        c = md5gg(c, d, a, b, words[i + 15] || 0, 14, 0xD8A1E681);
        b = md5gg(b, c, d, a, words[i + 4] || 0, 20, 0xE7D3FBC8);
        a = md5gg(a, b, c, d, words[i + 9] || 0, 5, 0x21E1CDE6);
        d = md5gg(d, a, b, c, words[i + 14] || 0, 9, 0xC33707D6);
        c = md5gg(c, d, a, b, words[i + 3] || 0, 14, 0xF4D50D87);
        b = md5gg(b, c, d, a, words[i + 8] || 0, 20, 0x455A14ED);
        a = md5gg(a, b, c, d, words[i + 13] || 0, 5, 0xA9E3E905);
        d = md5gg(d, a, b, c, words[i + 2] || 0, 9, 0xFCEFA3F8);
        c = md5gg(c, d, a, b, words[i + 7] || 0, 14, 0x676F02D9);
        b = md5gg(b, c, d, a, words[i + 12] || 0, 20, 0x8D2A4C8A);
        
        a = md5hh(a, b, c, d, words[i + 5] || 0, 4, 0xFFFA3942);
        d = md5hh(d, a, b, c, words[i + 8] || 0, 11, 0x8771F681);
        c = md5hh(c, d, a, b, words[i + 11] || 0, 16, 0x6D9D6122);
        b = md5hh(b, c, d, a, words[i + 14] || 0, 23, 0xFDE5380C);
        a = md5hh(a, b, c, d, words[i + 1] || 0, 4, 0xA4BEEA44);
        d = md5hh(d, a, b, c, words[i + 4] || 0, 11, 0x4BDECFA9);
        c = md5hh(c, d, a, b, words[i + 7] || 0, 16, 0xF6BB4B60);
        b = md5hh(b, c, d, a, words[i + 10] || 0, 23, 0xBEBFBC70);
        a = md5hh(a, b, c, d, words[i + 13] || 0, 4, 0x289B7EC6);
        d = md5hh(d, a, b, c, words[i] || 0, 11, 0xEAA127FA);
        c = md5hh(c, d, a, b, words[i + 3] || 0, 16, 0xD4EF3085);
        b = md5hh(b, c, d, a, words[i + 6] || 0, 23, 0x04881D05);
        a = md5hh(a, b, c, d, words[i + 9] || 0, 4, 0xD9D4D039);
        d = md5hh(d, a, b, c, words[i + 12] || 0, 11, 0xE6DB99E5);
        c = md5hh(c, d, a, b, words[i + 15] || 0, 16, 0x1FA27CF8);
        b = md5hh(b, c, d, a, words[i + 2] || 0, 23, 0xC4AC5665);
        
        a = md5ii(a, b, c, d, words[i] || 0, 6, 0xF4292244);
        d = md5ii(d, a, b, c, words[i + 7] || 0, 10, 0x432AFF97);
        c = md5ii(c, d, a, b, words[i + 14] || 0, 15, 0xAB9423A7);
        b = md5ii(b, c, d, a, words[i + 5] || 0, 21, 0xFC93A039);
        a = md5ii(a, b, c, d, words[i + 12] || 0, 6, 0x655B59C3);
        d = md5ii(d, a, b, c, words[i + 3] || 0, 10, 0x8F0CCC92);
        c = md5ii(c, d, a, b, words[i + 10] || 0, 15, 0xFFEFF47D);
        b = md5ii(b, c, d, a, words[i + 1] || 0, 21, 0x85845DD1);
        a = md5ii(a, b, c, d, words[i + 8] || 0, 6, 0x6FA87E4F);
        d = md5ii(d, a, b, c, words[i + 15] || 0, 10, 0xFE2CE6E0);
        c = md5ii(c, d, a, b, words[i + 6] || 0, 15, 0xA3014314);
        b = md5ii(b, c, d, a, words[i + 13] || 0, 21, 0x4E0811A1);
        a = md5ii(a, b, c, d, words[i + 4] || 0, 6, 0xF7537E82);
        d = md5ii(d, a, b, c, words[i + 11] || 0, 10, 0xBD3AF235);
        c = md5ii(c, d, a, b, words[i + 2] || 0, 15, 0x2AD7D2BB);
        b = md5ii(b, c, d, a, words[i + 9] || 0, 21, 0xEB86D391);
        
        a = addUnsigned(a, olda);
        b = addUnsigned(b, oldb);
        c = addUnsigned(c, oldc);
        d = addUnsigned(d, oldd);
    }
    
    const result = wordArrayToHex({ words: [a, b, c, d], sigBytes: 16 });
    return result;
}

// 生成百度翻译API签名
function generateSign(query, appId, salt, appKey) {
    const str = appId + query + salt + appKey;
    return md5(str);
}

// 测试MD5算法
function testMD5() {
    console.log('测试MD5算法...');
    const testCases = [
        { input: 'hello', expected: '5d41402abc4b2a76b9719d911017c592' },
        { input: 'world', expected: '7d793037a0760186574b0282f2f435e7' }
    ];
    
    let passed = 0;
    testCases.forEach(({ input, expected }) => {
        const result = md5(input);
        const success = result === expected;
        console.log(`MD5('${input}') = ${result} ${success ? '✅' : '❌'}`);
        if (success) passed++;
    });
    
    return passed === testCases.length;
}

// 测试API签名
function testAPISignature() {
    console.log('\n测试API签名生成...');
    const signature = generateSign('hello', 'test_app_id', '1234567890', 'test_app_key');
    console.log(`生成的签名: ${signature}`);
    const isValid = signature && signature.length === 32 && /^[a-f0-9]+$/.test(signature);
    console.log(`签名格式: ${isValid ? '✅ 有效' : '❌ 无效'}`);
    return isValid;
}

// 检查文件结构
function checkFiles() {
    console.log('\n检查文件结构...');
    const files = [
        'manifest.json',
        'src/background.js',
        'src/content.js',
        'src/popup/popup.html',
        'src/popup/popup.js',
        'src/popup/popup.css'
    ];
    
    let allExist = true;
    files.forEach(file => {
        const exists = fs.existsSync(path.join(__dirname, file));
        console.log(`${file}: ${exists ? '✅' : '❌'}`);
        if (!exists) allExist = false;
    });
    
    return allExist;
}

// 主测试函数
function runTests() {
    console.log('🎯 开始翻译插件功能测试\n');
    
    const md5Test = testMD5();
    const signatureTest = testAPISignature();
    const fileTest = checkFiles();
    
    console.log('\n📊 测试结果:');
    console.log(`MD5算法: ${md5Test ? '✅ 通过' : '❌ 失败'}`);
    console.log(`API签名: ${signatureTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`文件结构: ${fileTest ? '✅ 通过' : '❌ 失败'}`);
    
    const allPassed = md5Test && signatureTest && fileTest;
    console.log(`\n总体结果: ${allPassed ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
    
    if (allPassed) {
        console.log('\n🚀 插件已准备就绪！');
        console.log('下一步: 在Chrome中加载扩展程序并配置API密钥');
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { md5, generateSign, testMD5, testAPISignature, runTests };