module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly',
    SpeechRecognition: 'readonly',
    webkitSpeechRecognition: 'readonly'
  },
  rules: {
    // 代码质量
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'warn',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // 代码风格
    'indent': ['error', 2, { 
      SwitchCase: 1,
      VariableDeclarator: 1,
      outerIIFEBody: 1
    }],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { 
      avoidEscape: true,
      allowTemplateLiterals: true
    }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { 
      before: false, 
      after: true 
    }],
    'comma-style': ['error', 'last'],
    
    // 空格和换行
    'space-before-blocks': 'error',
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', {
      words: true,
      nonwords: false
    }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'computed-property-spacing': ['error', 'never'],
    'key-spacing': ['error', {
      beforeColon: false,
      afterColon: true
    }],
    
    // 函数和变量
    'func-call-spacing': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'no-multiple-empty-lines': ['error', {
      max: 2,
      maxEOF: 1,
      maxBOF: 0
    }],
    'eol-last': ['error', 'always'],
    
    // ES6+
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': ['error', {
      before: true,
      after: true
    }],
    'arrow-parens': ['error', 'as-needed'],
    'template-curly-spacing': ['error', 'never'],
    
    // 对象和数组
    'object-shorthand': ['error', 'always'],
    'prefer-destructuring': ['error', {
      array: false,
      object: true
    }, {
      enforceForRenamedProperties: false
    }],
    
    // 错误处理
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // 最佳实践
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'no-else-return': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': ['error', {
      allowShortCircuit: true,
      allowTernary: true
    }],
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-regex-literals': 'error',
    'radix': 'error',
    'yoda': 'error',
    
    // 命名规范
    'camelcase': ['error', {
      properties: 'never',
      ignoreDestructuring: false,
      ignoreImports: false,
      ignoreGlobals: false
    }],
    
    // 注释
    'spaced-comment': ['error', 'always', {
      line: {
        markers: ['/'],
        exceptions: ['-', '+', '*']
      },
      block: {
        markers: ['!'],
        exceptions: ['*'],
        balanced: true
      }
    }]
  },
  
  // 针对不同文件类型的特殊规则
  overrides: [
    {
      files: ['src/background.js'],
      env: {
        webextensions: true,
        serviceworker: true
      },
      rules: {
        'no-console': 'off' // 后台脚本允许console
      }
    },
    {
      files: ['src/content.js'],
      env: {
        browser: true,
        webextensions: true
      },
      globals: {
        VoiceTranslator: 'writable'
      }
    },
    {
      files: ['src/popup/*.js'],
      env: {
        browser: true,
        webextensions: true
      },
      globals: {
        PopupController: 'writable'
      }
    },
    {
      files: ['src/utils/*.js'],
      env: {
        browser: true,
        webextensions: true
      },
      rules: {
        'no-console': 'off' // 工具模块允许console用于调试
      }
    }
  ]
};