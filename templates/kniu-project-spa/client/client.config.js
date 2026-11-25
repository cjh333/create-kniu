export default {
  root: './client/views',
  publicDir: './public',
  // 开发服务器配置。
  server: {
    version: '1.0.0',
    timezone: 'Asia/Shanghai',
    host: '127.0.0.1',
    port: 6173,
    strictPort: true,
    hmr: {
      enabled: true, // 默认开启热更新。
      reload: true // 核心模块或组件无法局部接管时自动整页刷新，避免旧模块继续占用页面。
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9900',
        changeOrigin: true
      }
    }
  },
  // 路径别名配置。
  resolve: {
    alias: {
      '@': './',
      '@style': './public/static/css',
      '@img': './public/static/img',
      '@upload': './public/upload',
      '@plugin': './public/static/plugin',
      '@kniu': './public/static/plugin/kniu'
    }
  },
  // 打包配置。
  build: {
    outDir: './dist', // 打包后项目目录。
    outFile: './views/', // 打包后项目视图目录。
    outPublic: './public', // 打包后项目公共资源目录。
    successMessage: 'Kniu CLI build created in dist/', // 打包成功提示信息。
    plugins: [], // 构建扩展：插件可实现 beforeBuild、transformModule、afterBuild 异步钩子。
    minify: true, // 是否压缩代码。
    performance: {
      maxInitialJsKiB: 1024, // 最大初始 JavaScript 文件大小（KiB）。
      maxComponentChunkKiB: 250, // 最大组件块大小（KiB）。
      failOnBudgetExceeded: false // 是否在超过预算时失败。
    },
    componentTags: [] // 组件标签，用于自动注册组件。
  },
  // 框架组件默认值。
  components: {
    btn: {
      size: 'default'
    },
    page: {
      layout: '条数,首页,上一页,页码,下一页,末页,总数',
      sizes: [20, 60, 100, 160]
    },
    editor: {
      mediaUploadUrl: '/article_media_upload'
    },
    'article-tab': {
      previousLabel: '上一篇',
      nextLabel: '下一篇'
    },
    business: [
      'kniu-comment', 'kniu-like', 'kniu-article-tab', 'kniu-user-login',
      'kniu-smsvcode', 'kniu-gvcode', 'kniu-auth-layout'
    ]
  },
  // 主题配置。
  theme: {
    preset: 'light'
  },
  // 应测配置。
  observability: {
    enabled: false, // 是否启用遥测。
    endpoint: '/test/client-observability', // 遥测上报端点。
    allowCrossOrigin: false // 默认禁止跨域遥测，确有可信观测平台时才显式开启。
  },
  // 通用请求安全策略。
  request: {
    credentials: 'same-origin',
    timeout: 15000,
    csrfCookie: 'KNIU_CLI_XSRF_TOKEN',
    csrfHeader: 'X-CSRF-Token',
    traceHeader: 'X-Request-ID'
  },
  // 认证协议注入：示例项目不启用路由级登录守卫，业务项目按后端契约覆盖。
  auth: {
    enabled: false,
    storageKey: 'KNIU_CLI_AUTH',
    loginRoute: '/',
    sessionUrl: ''
  },
  // 身份信息默认仅保留在当前会话。
  identity: {
    storageKey: 'KNIU_CLI_IDENTITY',
    persist: false
  },
  // 轻量全局状态。
  store: {
    key: 'KNIU_CLI_STORE', // 存储键名。
    state: {}, // 初始状态。
    persist: false, // 为 true 时存储到 localStorage。
    sync: false // 为 true 时同步到同源标签页。
  },
  serviceWorker: {
    enabled: false // 是否启用服务工作线程。
  },
  security: {
    cspNonce: '' // 内容安全策略（CSP）非空值，用于动态生成安全策略。
  },
  debug: {
    enabled: false,
    log: false
  }
};