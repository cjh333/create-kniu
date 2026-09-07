// 通知中心单例（SSE 客户端）。
//
// 对服务端单向事件订阅保持一个 EventSource 长连接，供多页面/多组件复用，
// 避免每个 header 实例各开一条。事件都是"去刷新"类轻量信号，不含任何用户数据；
// 收到后由调用方走带鉴权的 /api 拉取真实状态（鉴权边界保持在 PHP）。
//
// 两类事件：
//   reply-refresh —— 后台审核通过回复，前台红点需要即时更新。
//   data-change   —— 任意一端写库（Core\DataSignal 在请求结束汇总广播），
//                    携带 revision；所有在线页面据此重放各自的数据源。
//
// 事件源断线由 EventSource 自动重连（服务端下发 retry:5000）；
// 若 EventSource 不可用（如旧浏览器），退化为空实现，由页面保留的低频心跳兜底。

var KniuNotify = (function () {
  var source = null;
  var replyHandlers = [];
  var dataHandlers = [];

  function dispatch(type, payload) {
    var list = type === 'reply' ? replyHandlers : type === 'data' ? dataHandlers : [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { }
    }
  }

  function hasSubscribers() {
    return replyHandlers.length > 0 || dataHandlers.length > 0;
  }

  function connect() {
    if (source || typeof EventSource === 'undefined') return;
    if (typeof location === 'undefined') return;
    var sse;
    try {
      sse = new EventSource('/events');
    } catch (e) {
      return;
    }
    source = sse;
    sse.addEventListener('reply-refresh', function () { dispatch('reply'); });
    sse.addEventListener('data-change', function (event) {
      var payload = null;
      try { payload = event && event.data ? JSON.parse(event.data) : null; } catch (e) { payload = null; }
      dispatch('data', payload || {});
    });
    sse.onerror = function () {
      // EventSource 会自行重连，这里仅做防御性清理，避免重复实例。
      // 注意：onerror 触发后连接已关闭，置空以便下次主动连接时重建。
      if (sse.readyState === EventSource.CLOSED) {
        if (source === sse) source = null;
        sse.close();
      }
    };
  }

  /**
   * 订阅"回复通知刷新"信号。
   * @param {Function} handler 收到信号时调用（不携带数据）。
   * @return {Function} 取消订阅函数。
   */
  function subscribeReplyRefresh(handler) {
    if (typeof handler === 'function') replyHandlers.push(handler);
    connect();
    return createUnsubscriber(replyHandlers, handler);
  }

  /**
   * 订阅"数据变更"信号（任一端写库后由服务端广播）。
   * @param {Function} handler 收到信号时调用，入参形如 { revision: Number }。
   * @return {Function} 取消订阅函数。
   */
  function subscribeDataChange(handler) {
    if (typeof handler === 'function') dataHandlers.push(handler);
    connect();
    return createUnsubscriber(dataHandlers, handler);
  }

  /** 生成取消订阅函数：移除 handler，并在无任何订阅者时关闭连接避免后台空挂。 */
  function createUnsubscriber(list, handler) {
    return function () {
      var idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
      if (!hasSubscribers() && source) {
        source.close();
        source = null;
      }
    };
  }

  /** 关闭并重置连接（页面卸载/登出时调用）。 */
  function close() {
    replyHandlers = [];
    dataHandlers = [];
    if (source) {
      source.close();
      source = null;
    }
  }

  return {
    subscribeReplyRefresh: subscribeReplyRefresh,
    subscribeDataChange: subscribeDataChange,
    close: close
  };
}());

export default KniuNotify;
