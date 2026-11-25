# Kniu Request 请求模块使用文档

应用挂载后可通过 `client.request` 使用请求核心：

```js
const result = await client.request.get('/api/data');
await client.request.post('/api/items', { name: 'demo' });
```

`post` 自动以 JSON 序列化 body 并补 `Content-Type: application/json`。非 2xx 响应会抛出错误，错误对象挂载完整响应现场：`ok`、`status`、`headers`、`data`（解析后的响应体）和 `response`。

请求默认行为（均可通过 `PROJECT_CONFIG.request` 或单次 init 覆盖）：

- 超时默认 15000ms，超时经 `AbortController` 取消；
- 相同 method+url 的并发请求自动去重（`deduplicate`，默认开启）；
- 带 `cache: true` 的安全请求（GET/HEAD/OPTIONS）按 `cacheTtl` 毫秒缓存，LRU 上限 200 条；
- 非安全方法自动从 `csrfCookie` 读取 CSRF token 写入 `csrfHeader`（Cookie 默认 `KNIU_CLI_XSRF_TOKEN`，Header 默认 `X-CSRF-Token`）；
- 配置了 `getAccessToken` 时自动附加 `Authorization: Bearer` 头；
- 网络错误与 5xx/429 可按 `retries` 指数退避重试，4xx 不重试。

响应拦截器：`client.request.useResponseInterceptor(fn)` 注册，`fn` 接收 `{ ok, status, headers, data, response }`，返回注销函数。