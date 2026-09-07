// 服务端 SSE 事件总线（仅 Node 运行时使用）。
//
// 维护一组浏览器 SSE 长连接（EventSource），提供"通知类"事件单向广播。
// 出于安全：SSE 通道本身不透传任何用户数据——它只发"去刷新"类轻量信号，
// 客户端收到后仍走原有的、带鉴权的 /api 请求拉取真实状态，鉴权边界保持在 PHP。
//
// 被 kniuserver.mjs 复用；kniuserver.mjs 负责 /events(订阅) 与 /__notify(触发) 两条路由。
import { randomUUID } from 'node:crypto';

/** 心跳间隔：定期写注释行保持代理/连接存活。 */
const HEARTBEAT_MS = 25000;

const clients = new Set();

/**
 * 订阅一个 SSE 客户端。
 * @param {import('node:http').ServerResponse} response
 * @returns {() => void} 取消订阅函数（连接关闭/异常时由调用方触发）。
 */
export function subscribe(response) {
  const id = randomUUID();
  const client = { id, response, alive: true };
  clients.add(client);
  const heartbeat = setInterval(function () {
    if (!client.alive) return;
    // SSE 注释行仅用于保活，不携带业务数据。
    response.write(': ping\n\n');
  }, HEARTBEAT_MS);
  client.heartbeat = heartbeat;
  return function () {
    client.alive = false;
    clearInterval(heartbeat);
    clients.delete(client);
  };
}

/**
 * 向所有 SSE 订阅者广播一条指定类型的消息。
 * @param {string} eventType 事件类型名，如 'reply-refresh'
 * @param {unknown} [data] 附加数据（会被 JSON 序列化）。SSE 通道不应携带敏感数据。
 */
export function broadcast(eventType, data) {
  const payload = data === undefined ? '' : 'data: ' + JSON.stringify(data) + '\n';
  const frame = `event: ${eventType}\n${payload}\n`;
  for (const client of clients) {
    if (client.alive) {
      try {
        client.response.write(frame);
      } catch {
        client.alive = false;
        clients.delete(client);
      }
    }
  }
}

/** 当前在线订阅数（便于调试）。 */
export function subscriberCount() {
  return clients.size;
}
