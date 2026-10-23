# Kniu Request 请求模块使用文档

应用挂载后可通过 `client.request` 使用请求核心：

```js
const result = await client.request.get('/api/data');
await client.request.post('/api/items', { name: 'demo' });
```

非 2xx 响应会抛出带 `status` 和 `body` 的错误。
