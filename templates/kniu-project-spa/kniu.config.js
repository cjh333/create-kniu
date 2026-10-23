export default {
  // 根目录。
  root: './client/views',
  publicDir: './public',
  loading: true,
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
  // 模板引擎配置：文档头资源以别名书写，由模板引擎挂载后渲染为正式路径注入。
  template: {
    head: {
      favicon: '@img/favicon.ico',
      style: ['@kniu/kniu.min.css', '@style/app.css'],
      js: ['@kniu/kniu.min.js']
    }
  },
  // 服务器配置。
  server: {
    host: '127.0.0.1',
    port: 6173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9900',
        changeOrigin: true
      }
    }
  },
  // 通用请求安全策略：同源凭证、超时、CSRF 与 Bearer Token 注入由 Core 统一处理。
  request: {
    credentials: 'same-origin',
    timeout: 15000,
    csrfCookie: 'XSRF-TOKEN',
    csrfHeader: 'X-CSRF-Token',
    traceHeader: 'X-Request-ID'
  },
  // 认证可按项目接口启用。路由可配置 meta: { requiresAuth, roles, permissions }。
  auth: {
    enabled: false,
    storageKey: 'KNIU_CLI_AUTH',
    loginRoute: '/login',
    sessionUrl: ''
  },
  // 身份信息默认仅保留在当前会话。persist 仅适合经过 XSS 风险评估的业务。
  identity: {
    storageKey: 'KNIU_CLI_IDENTITY',
    persist: false
  },
  // 生产环境按需启用；上报端点应在服务端过滤敏感字段并实施限流。
  observability: {
    enabled: false,
    endpoint: '/api/client-observability',
    // 默认禁止跨域遥测，确有可信观测平台时才显式开启。
    allowCrossOrigin: false
  },
  // 轻量全局状态；persist 为 true 时存储到 localStorage，sync 同步到同源标签页。
  store: {
    state: {},
    persist: false,
    sync: false,
    key: 'KNIU_STORE'
  },
  serviceWorker: {
    enabled: false,
    url: '/public/assets/kniu-sw.js',
    scope: '/public/assets/'
  },
  security: {
    cspNonce: ''
  },
  seo: {
    siteUrl: 'http://localhost:6173',
    routes: ['/', '/about/1'],
    robots: 'index,follow'
  },
  // 打包配置。
  build: {
    outDir: './dist',
    outFile: './views/',
    outPublic: './public',
    successMessage: 'Kniu CLI build created in dist/',
    plugins: [], // 构建扩展：插件可实现 beforeBuild、transformModule、afterBuild 异步钩子。
    minify: true,
    performance: {
      maxInitialJsKiB: 300,
      maxComponentChunkKiB: 250,
      failOnBudgetExceeded: false
    },
    componentTags: [] // 自动扫描 views 中的 kniu-* 标签；运行时动态创建的组件可在此数组显式补充。
  },
  // 组件配置。
  components: {
    btn: {
      size: 'default'
    },
    page: {
      layout: '条数,首页,上一页,页码,下一页,末页,总数'
    },
    editor: {
      mediaUploadUrl: '/article_media_upload'
    },
    'article-tab': {
      previousLabel: '上一篇',
      nextLabel: '下一篇'
    }
  },
  // 主题配置。
  theme: {
    preset: 'light'
  }
};